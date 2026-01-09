import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingState {
  isCompleted: boolean;
  currentStep: string | null;
  completedSteps: string[];
  skippedSteps: string[];
  completedAt?: Date;
  version: string;
}

export interface OnboardingPreferences {
  showTutorialHints: boolean;
  enableProgressNotifications: boolean;
  autoStartAnalysis: boolean;
}

/**
 * Service for managing user onboarding state and preferences
 * Implements requirements 22.1-22.5 for onboarding and user education
 */
export class OnboardingService {
  private static instance: OnboardingService;
  private static readonly STORAGE_KEY = 'notes_ai_onboarding_state';
  private static readonly PREFERENCES_KEY = 'notes_ai_onboarding_preferences';
  private static readonly CURRENT_VERSION = '1.0.0';

  private constructor() {}

  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  /**
   * Check if user has completed onboarding
   * Requirement 22.1: Interactive tutorial explaining agentic capabilities
   */
  static async isOnboardingCompleted(): Promise<boolean> {
    try {
      const state = await this.getOnboardingState();
      return state.isCompleted && state.version === this.CURRENT_VERSION;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Instance method for checking onboarding completion
   */
  async isOnboardingComplete(): Promise<boolean> {
    return OnboardingService.isOnboardingCompleted();
  }

  /**
   * Instance method for resetting onboarding
   */
  async resetOnboarding(): Promise<void> {
    return OnboardingService.resetOnboarding();
  }

  /**
   * Get current onboarding state
   */
  static async getOnboardingState(): Promise<OnboardingState> {
    try {
      const stateJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stateJson) {
        const state = JSON.parse(stateJson);
        return {
          ...state,
          completedAt: state.completedAt ? new Date(state.completedAt) : undefined
        };
      }
    } catch (error) {
      console.error('Error getting onboarding state:', error);
    }

    // Return default state
    return {
      isCompleted: false,
      currentStep: null,
      completedSteps: [],
      skippedSteps: [],
      version: this.CURRENT_VERSION
    };
  }

  /**
   * Update onboarding state
   */
  static async updateOnboardingState(updates: Partial<OnboardingState>): Promise<void> {
    try {
      const currentState = await this.getOnboardingState();
      const newState: OnboardingState = {
        ...currentState,
        ...updates,
        version: this.CURRENT_VERSION
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Error updating onboarding state:', error);
      throw error;
    }
  }

  /**
   * Mark onboarding as completed
   * Requirement 22.4: Progress indicators with estimated completion times
   */
  static async completeOnboarding(): Promise<void> {
    await this.updateOnboardingState({
      isCompleted: true,
      completedAt: new Date(),
      currentStep: null
    });
  }

  /**
   * Mark a specific step as completed
   */
  static async completeStep(stepId: string): Promise<void> {
    const state = await this.getOnboardingState();
    if (!state.completedSteps.includes(stepId)) {
      await this.updateOnboardingState({
        completedSteps: [...state.completedSteps, stepId],
        currentStep: stepId
      });
    }
  }

  /**
   * Skip a specific step
   */
  static async skipStep(stepId: string): Promise<void> {
    const state = await this.getOnboardingState();
    if (!state.skippedSteps.includes(stepId)) {
      await this.updateOnboardingState({
        skippedSteps: [...state.skippedSteps, stepId]
      });
    }
  }

  /**
   * Reset onboarding state (for testing or re-onboarding)
   */
  static async resetOnboarding(): Promise<void> {
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    await AsyncStorage.removeItem(this.PREFERENCES_KEY);
  }

  /**
   * Get onboarding preferences
   */
  static async getOnboardingPreferences(): Promise<OnboardingPreferences> {
    try {
      const prefsJson = await AsyncStorage.getItem(this.PREFERENCES_KEY);
      if (prefsJson) {
        return JSON.parse(prefsJson);
      }
    } catch (error) {
      console.error('Error getting onboarding preferences:', error);
    }

    // Return default preferences
    return {
      showTutorialHints: true,
      enableProgressNotifications: true,
      autoStartAnalysis: true
    };
  }

  /**
   * Update onboarding preferences
   */
  static async updateOnboardingPreferences(preferences: Partial<OnboardingPreferences>): Promise<void> {
    try {
      const currentPrefs = await this.getOnboardingPreferences();
      const newPrefs = { ...currentPrefs, ...preferences };
      await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Error updating onboarding preferences:', error);
      throw error;
    }
  }

  /**
   * Check if user should see tutorial hints
   * Requirement 22.2: Example recommendations with AI reasoning demonstrations
   */
  static async shouldShowTutorialHints(): Promise<boolean> {
    const preferences = await this.getOnboardingPreferences();
    const isCompleted = await this.isOnboardingCompleted();
    return preferences.showTutorialHints && isCompleted;
  }

  /**
   * Get onboarding analytics data (for improving the onboarding experience)
   */
  static async getOnboardingAnalytics(): Promise<{
    completionRate: number;
    averageTimeToComplete: number | null;
    mostSkippedSteps: string[];
    completedStepsCount: number;
  }> {
    const state = await this.getOnboardingState();
    
    return {
      completionRate: state.isCompleted ? 100 : (state.completedSteps.length / 5) * 100,
      averageTimeToComplete: state.completedAt ? 
        (state.completedAt.getTime() - new Date().getTime()) / 1000 : null,
      mostSkippedSteps: state.skippedSteps,
      completedStepsCount: state.completedSteps.length
    };
  }

  /**
   * Validate onboarding version and trigger re-onboarding if needed
   */
  static async validateOnboardingVersion(): Promise<boolean> {
    const state = await this.getOnboardingState();
    if (state.version !== this.CURRENT_VERSION) {
      // Version mismatch - user needs to go through onboarding again
      await this.resetOnboarding();
      return false;
    }
    return true;
  }

  /**
   * Get recommended next step for incomplete onboarding
   */
  static async getRecommendedNextStep(): Promise<string | null> {
    const state = await this.getOnboardingState();
    if (state.isCompleted) return null;

    const allSteps = ['welcome', 'capabilities', 'examples', 'permissions', 'setup'];
    const nextStep = allSteps.find(step => 
      !state.completedSteps.includes(step) && !state.skippedSteps.includes(step)
    );

    return nextStep || null;
  }

  /**
   * Check if specific permissions have been explained during onboarding
   * Requirement 22.3: Permission explanation with privacy protection details
   */
  static async hasExplainedPermissions(): Promise<boolean> {
    const state = await this.getOnboardingState();
    return state.completedSteps.includes('permissions') || state.skippedSteps.includes('permissions');
  }

  /**
   * Check if privacy information has been shown
   * Requirement 22.5: Detailed privacy and security information with documentation links
   */
  static async hasShownPrivacyInformation(): Promise<boolean> {
    const state = await this.getOnboardingState();
    return state.completedSteps.includes('permissions');
  }
}