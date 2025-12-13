/**
 * Example implementation of onboarding integration
 * Demonstrates how to use the onboarding system in the main app
 * 
 * Requirements implemented:
 * - 22.1: Interactive tutorial explaining agentic capabilities
 * - 22.2: Example recommendations with AI reasoning demonstrations  
 * - 22.3: Permission explanation with privacy protection details
 * - 22.4: Progress indicators with estimated completion times
 * - 22.5: Detailed privacy and security information with documentation links
 */

import React from 'react';
import { View } from 'react-native';
import { OnboardingManager, useOnboarding } from '../ui/components/OnboardingManager';
import { Dashboard } from '../ui/components/Dashboard';

/**
 * Main App component with onboarding integration
 */
export const AppWithOnboarding: React.FC = () => {
  const handleOnboardingComplete = () => {
    console.log('Onboarding completed - user can now use the app');
    // Initialize main app services here
    // Start background analysis if user opted in
  };

  return (
    <OnboardingManager onComplete={handleOnboardingComplete}>
      <MainApp />
    </OnboardingManager>
  );
};

/**
 * Main app component that shows after onboarding
 */
const MainApp: React.FC = () => {
  const { shouldShowHints, markStepCompleted } = useOnboarding();

  const handleFirstRecommendationView = async () => {
    if (shouldShowHints) {
      await markStepCompleted('first_recommendation_viewed');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Dashboard onFirstRecommendationView={handleFirstRecommendationView} />
    </View>
  );
};

/**
 * Example usage in different parts of the app
 */
export class OnboardingIntegrationExamples {
  
  /**
   * Check if user has completed onboarding before showing advanced features
   */
  static async shouldShowAdvancedFeatures(): Promise<boolean> {
    const { OnboardingService } = await import('../services/OnboardingService');
    return await OnboardingService.isOnboardingCompleted();
  }

  /**
   * Show contextual help based on onboarding completion
   */
  static async getContextualHelpLevel(): Promise<'basic' | 'intermediate' | 'advanced'> {
    const { OnboardingService } = await import('../services/OnboardingService');
    const isCompleted = await OnboardingService.isOnboardingCompleted();
    const analytics = await OnboardingService.getOnboardingAnalytics();
    
    if (!isCompleted) return 'basic';
    if (analytics.completionRate < 80) return 'intermediate';
    return 'advanced';
  }

  /**
   * Reset onboarding for testing or user request
   */
  static async resetOnboardingForTesting(): Promise<void> {
    const { OnboardingService } = await import('../services/OnboardingService');
    await OnboardingService.resetOnboarding();
    console.log('Onboarding reset - user will see tutorial on next app launch');
  }

  /**
   * Get onboarding analytics for improving the experience
   */
  static async getOnboardingMetrics(): Promise<{
    completionRate: number;
    mostSkippedSteps: string[];
    averageCompletionTime: number | null;
  }> {
    const { OnboardingService } = await import('../services/OnboardingService');
    return await OnboardingService.getOnboardingAnalytics();
  }

  /**
   * Check if specific onboarding topics were covered
   */
  static async hasUserLearnedAboutPrivacy(): Promise<boolean> {
    const { OnboardingService } = await import('../services/OnboardingService');
    return await OnboardingService.hasShownPrivacyInformation();
  }

  /**
   * Check if permissions were properly explained
   */
  static async hasUserLearnedAboutPermissions(): Promise<boolean> {
    const { OnboardingService } = await import('../services/OnboardingService');
    return await OnboardingService.hasExplainedPermissions();
  }
}

/**
 * Settings screen integration example
 */
export const OnboardingSettingsSection: React.FC = () => {
  const { resetOnboarding, getOnboardingProgress } = useOnboarding();

  const handleReplayTutorial = async () => {
    await resetOnboarding();
    // Navigate back to onboarding or restart app
  };

  const handleViewProgress = async () => {
    const progress = await getOnboardingProgress();
    console.log('Onboarding progress:', progress);
    // Show progress in UI
  };

  return (
    <View>
      {/* Settings UI would go here */}
      {/* Button to replay tutorial */}
      {/* Button to view onboarding progress */}
      {/* Toggle for tutorial hints */}
    </View>
  );
};

/**
 * Example of showing contextual onboarding hints in the main app
 */
export const ContextualOnboardingHints = {
  
  /**
   * Show hint when user first sees recommendations
   */
  showRecommendationHint: () => ({
    title: "AI Recommendations",
    description: "These suggestions are based on content analysis, usage patterns, and semantic understanding. Tap any card to see detailed reasoning.",
    placement: "above-recommendations"
  }),

  /**
   * Show hint when user first encounters duplicate detection
   */
  showDuplicateHint: () => ({
    title: "Duplicate Detection",
    description: "Similar notes are grouped together. The AI considers content similarity, not just exact matches.",
    placement: "above-duplicates"
  }),

  /**
   * Show hint about privacy when accessing settings
   */
  showPrivacyHint: () => ({
    title: "Privacy First",
    description: "All analysis happens on your device. Your notes never leave your control.",
    placement: "privacy-section"
  }),

  /**
   * Show hint about learning from feedback
   */
  showLearningHint: () => ({
    title: "AI Learning",
    description: "When you approve or reject recommendations, the AI learns your preferences for better future suggestions.",
    placement: "feedback-buttons"
  })
};