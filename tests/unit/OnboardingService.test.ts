import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingService, OnboardingState, OnboardingPreferences } from '../../src/services/OnboardingService';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import the mocked AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
const mockAsyncStorage = AsyncStorage as any;

describe('OnboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isOnboardingCompleted', () => {
    it('should return false for new users', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await OnboardingService.isOnboardingCompleted();
      
      expect(result).toBe(false);
    });

    it('should return true for completed onboarding with current version', async () => {
      const completedState: OnboardingState = {
        isCompleted: true,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities', 'examples', 'permissions', 'setup'],
        skippedSteps: [],
        completedAt: new Date(),
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(completedState));
      
      const result = await OnboardingService.isOnboardingCompleted();
      
      expect(result).toBe(true);
    });

    it('should return false for completed onboarding with old version', async () => {
      const oldVersionState: OnboardingState = {
        isCompleted: true,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities', 'examples', 'permissions', 'setup'],
        skippedSteps: [],
        completedAt: new Date(),
        version: '0.9.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldVersionState));
      
      const result = await OnboardingService.isOnboardingCompleted();
      
      expect(result).toBe(false);
    });
  });

  describe('getOnboardingState', () => {
    it('should return default state for new users', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const state = await OnboardingService.getOnboardingState();
      
      expect(state).toEqual({
        isCompleted: false,
        currentStep: null,
        completedSteps: [],
        skippedSteps: [],
        version: '1.0.0'
      });
    });

    it('should parse stored state correctly', async () => {
      const storedState: OnboardingState = {
        isCompleted: false,
        currentStep: 'capabilities',
        completedSteps: ['welcome'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedState));
      
      const state = await OnboardingService.getOnboardingState();
      
      expect(state).toEqual(storedState);
    });

    it('should handle corrupted storage gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');
      
      const state = await OnboardingService.getOnboardingState();
      
      expect(state.isCompleted).toBe(false);
      expect(state.version).toBe('1.0.0');
    });
  });

  describe('updateOnboardingState', () => {
    it('should merge updates with existing state', async () => {
      const existingState: OnboardingState = {
        isCompleted: false,
        currentStep: 'welcome',
        completedSteps: [],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingState));
      
      await OnboardingService.updateOnboardingState({
        completedSteps: ['welcome'],
        currentStep: 'capabilities'
      });
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'notes_ai_onboarding_state',
        JSON.stringify({
          ...existingState,
          completedSteps: ['welcome'],
          currentStep: 'capabilities',
          version: '1.0.0'
        })
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should mark onboarding as completed with timestamp', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        isCompleted: false,
        currentStep: 'setup',
        completedSteps: ['welcome', 'capabilities', 'examples', 'permissions'],
        skippedSteps: [],
        version: '1.0.0'
      }));
      
      await OnboardingService.completeOnboarding();
      
      const setItemCall = mockAsyncStorage.setItem.mock.calls[0];
      const savedState = JSON.parse(setItemCall[1]);
      
      expect(savedState.isCompleted).toBe(true);
      expect(savedState.currentStep).toBe(null);
      expect(savedState.completedAt).toBeDefined();
    });
  });

  describe('completeStep', () => {
    it('should add step to completed steps if not already present', async () => {
      const existingState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingState));
      
      await OnboardingService.completeStep('capabilities');
      
      const setItemCall = mockAsyncStorage.setItem.mock.calls[0];
      const savedState = JSON.parse(setItemCall[1]);
      
      expect(savedState.completedSteps).toEqual(['welcome', 'capabilities']);
      expect(savedState.currentStep).toBe('capabilities');
    });

    it('should not duplicate steps in completed steps', async () => {
      const existingState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingState));
      
      await OnboardingService.completeStep('capabilities');
      
      // Should not call setItem since step is already completed
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('skipStep', () => {
    it('should add step to skipped steps', async () => {
      const existingState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingState));
      
      await OnboardingService.skipStep('examples');
      
      const setItemCall = mockAsyncStorage.setItem.mock.calls[0];
      const savedState = JSON.parse(setItemCall[1]);
      
      expect(savedState.skippedSteps).toEqual(['examples']);
    });
  });

  describe('resetOnboarding', () => {
    it('should remove all onboarding data', async () => {
      await OnboardingService.resetOnboarding();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('notes_ai_onboarding_state');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('notes_ai_onboarding_preferences');
    });
  });

  describe('getOnboardingPreferences', () => {
    it('should return default preferences for new users', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const preferences = await OnboardingService.getOnboardingPreferences();
      
      expect(preferences).toEqual({
        showTutorialHints: true,
        enableProgressNotifications: true,
        autoStartAnalysis: true
      });
    });

    it('should parse stored preferences correctly', async () => {
      const storedPrefs: OnboardingPreferences = {
        showTutorialHints: false,
        enableProgressNotifications: true,
        autoStartAnalysis: false
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedPrefs));
      
      const preferences = await OnboardingService.getOnboardingPreferences();
      
      expect(preferences).toEqual(storedPrefs);
    });
  });

  describe('shouldShowTutorialHints', () => {
    it('should return true for completed onboarding with hints enabled', async () => {
      // Mock the getItem calls with the correct keys
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'notes_ai_onboarding_preferences') {
          return Promise.resolve(JSON.stringify({
            showTutorialHints: true
          }));
        }
        if (key === 'notes_ai_onboarding_state') {
          return Promise.resolve(JSON.stringify({
            isCompleted: true,
            version: '1.0.0'
          }));
        }
        return Promise.resolve(null);
      });
      
      const result = await OnboardingService.shouldShowTutorialHints();
      
      expect(result).toBe(true);
    });

    it('should return false for incomplete onboarding', async () => {
      // Mock the getItem calls with the correct keys
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'notes_ai_onboarding_preferences') {
          return Promise.resolve(JSON.stringify({
            showTutorialHints: true
          }));
        }
        if (key === 'notes_ai_onboarding_state') {
          return Promise.resolve(JSON.stringify({
            isCompleted: false,
            version: '1.0.0'
          }));
        }
        return Promise.resolve(null);
      });
      
      const result = await OnboardingService.shouldShowTutorialHints();
      
      expect(result).toBe(false);
    });
  });

  describe('getRecommendedNextStep', () => {
    it('should return first incomplete step', async () => {
      const partialState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(partialState));
      
      const nextStep = await OnboardingService.getRecommendedNextStep();
      
      expect(nextStep).toBe('examples');
    });

    it('should return null for completed onboarding', async () => {
      const completedState: OnboardingState = {
        isCompleted: true,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities', 'examples', 'permissions', 'setup'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(completedState));
      
      const nextStep = await OnboardingService.getRecommendedNextStep();
      
      expect(nextStep).toBe(null);
    });

    it('should skip over skipped steps', async () => {
      const partialState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome'],
        skippedSteps: ['capabilities', 'examples'],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(partialState));
      
      const nextStep = await OnboardingService.getRecommendedNextStep();
      
      expect(nextStep).toBe('permissions');
    });
  });

  describe('validateOnboardingVersion', () => {
    it('should return true for current version', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        version: '1.0.0'
      }));
      
      const isValid = await OnboardingService.validateOnboardingVersion();
      
      expect(isValid).toBe(true);
    });

    it('should reset onboarding for old version', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        version: '0.9.0'
      }));
      
      const isValid = await OnboardingService.validateOnboardingVersion();
      
      expect(isValid).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('notes_ai_onboarding_state');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('notes_ai_onboarding_preferences');
    });
  });

  describe('hasExplainedPermissions', () => {
    it('should return true if permissions step was completed', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        completedSteps: ['welcome', 'capabilities', 'permissions'],
        skippedSteps: []
      }));
      
      const result = await OnboardingService.hasExplainedPermissions();
      
      expect(result).toBe(true);
    });

    it('should return true if permissions step was skipped', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        completedSteps: ['welcome', 'capabilities'],
        skippedSteps: ['permissions']
      }));
      
      const result = await OnboardingService.hasExplainedPermissions();
      
      expect(result).toBe(true);
    });

    it('should return false if permissions step was not encountered', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        completedSteps: ['welcome'],
        skippedSteps: []
      }));
      
      const result = await OnboardingService.hasExplainedPermissions();
      
      expect(result).toBe(false);
    });
  });

  describe('getOnboardingAnalytics', () => {
    it('should calculate completion rate correctly', async () => {
      const partialState: OnboardingState = {
        isCompleted: false,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities', 'examples'],
        skippedSteps: [],
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(partialState));
      
      const analytics = await OnboardingService.getOnboardingAnalytics();
      
      expect(analytics.completionRate).toBe(60); // 3/5 * 100
      expect(analytics.completedStepsCount).toBe(3);
      expect(analytics.mostSkippedSteps).toEqual([]);
    });

    it('should return 100% completion rate for completed onboarding', async () => {
      const completedState: OnboardingState = {
        isCompleted: true,
        currentStep: null,
        completedSteps: ['welcome', 'capabilities', 'examples', 'permissions', 'setup'],
        skippedSteps: [],
        completedAt: new Date(),
        version: '1.0.0'
      };
      
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(completedState));
      
      const analytics = await OnboardingService.getOnboardingAnalytics();
      
      expect(analytics.completionRate).toBe(100);
    });
  });
});