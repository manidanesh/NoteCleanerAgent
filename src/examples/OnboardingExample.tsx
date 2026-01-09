/**
 * Example implementation of onboarding integration
 * Demonstrates how to use the onboarding system in the main app
 */

import React from 'react';
import { View } from 'react-native';
import { OnboardingManager } from '../ui/components/OnboardingManager';
import { Dashboard } from '../ui/components/Dashboard';
import { OnboardingService } from '../services/OnboardingService';
import { RecommendationActionService } from '../services/RecommendationActionService';
import { UndoService } from '../services/UndoService';
import { AppleNotesAPIService } from '../services/NotesAPIService';
import { LearningComponent } from '../agents/LearningComponent';

/**
 * Main App component with onboarding integration
 */
export const AppWithOnboarding: React.FC = () => {
  const handleOnboardingComplete = () => {
    console.log('Onboarding completed - user can now use the app');
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
  const handleFirstRecommendationView = async () => {
    console.log('First recommendation viewed');
  };

  // Initialize services for dashboard
  const notesAPI = AppleNotesAPIService.getInstance();
  const learningComponent = new LearningComponent();
  const actionService = new RecommendationActionService(notesAPI, learningComponent);
  const undoService = new UndoService(actionService);

  const mockProcessingStatus = {
    isProcessing: false,
    currentStep: '',
    progress: 0,
    totalNotes: 0,
    processedNotes: 0,
  };

  const handleRecommendationAction = (recommendationId: string, action: 'approve' | 'reject', result?: any) => {
    console.log('Recommendation action:', recommendationId, action, result);
  };

  const handleBatchComplete = (results: any[]) => {
    console.log('Batch complete:', results);
  };

  const handleRefresh = () => {
    console.log('Refreshing data...');
  };

  const handleRecommendationPress = (recommendation: any) => {
    console.log('Recommendation pressed:', recommendation);
  };

  return (
    <View style={{ flex: 1 }}>
      <Dashboard 
        recommendations={[]}
        notes={[]}
        processingStatus={mockProcessingStatus}
        actionService={actionService}
        undoService={undoService}
        onRecommendationAction={handleRecommendationAction}
        onBatchComplete={handleBatchComplete}
        onRefresh={handleRefresh}
        onRecommendationPress={handleRecommendationPress}
      />
    </View>
  );
};

/**
 * Example usage functions
 */
export class OnboardingIntegrationExamples {
  
  /**
   * Check if user has completed onboarding before showing advanced features
   */
  static async shouldShowAdvancedFeatures(): Promise<boolean> {
    const onboardingService = OnboardingService.getInstance();
    return await onboardingService.isOnboardingComplete();
  }

  /**
   * Reset onboarding for testing or user request
   */
  static async resetOnboardingForTesting(): Promise<void> {
    const onboardingService = OnboardingService.getInstance();
    await onboardingService.resetOnboarding();
    console.log('Onboarding reset - user will see tutorial on next app launch');
  }
}