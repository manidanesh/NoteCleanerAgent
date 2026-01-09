/**
 * Main App Component for Notes AI Organizer
 * Cross-platform entry point for iOS and macOS
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';

// Import main components
import { Dashboard } from './ui/components/Dashboard';
import { OnboardingFlow } from './ui/components/OnboardingFlow';
import { AccessibilityProvider } from './ui/components/AccessibilityProvider';

// Import services
import { SecurityService } from './services/SecurityService';
import { OnboardingService } from './services/OnboardingService';
import { AgentCoordinator } from './agents/AgentCoordinator';
import { RecommendationActionService } from './services/RecommendationActionService';
import { UndoService } from './services/UndoService';
import { AppleNotesAPIService } from './services/NotesAPIService';
import { LearningComponent } from './agents/LearningComponent';

// Import models
import { Recommendation } from './models/Recommendation';
import { Note } from './models/Note';

// Import design system
import { DesignSystem } from './ui/design/DesignSystem';

interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  totalNotes: number;
  processedNotes: number;
  estimatedTimeRemaining?: number;
}

interface AppState {
  isInitialized: boolean;
  isOnboardingComplete: boolean;
  isSecurityEnabled: boolean;
  error: string | null;
  recommendations: Recommendation[];
  notes: Note[];
  processingStatus: ProcessingStatus;
  actionService?: RecommendationActionService;
  undoService?: UndoService;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isInitialized: false,
    isOnboardingComplete: false,
    isSecurityEnabled: false,
    error: null,
    recommendations: [],
    notes: [],
    processingStatus: {
      isProcessing: false,
      currentStep: '',
      progress: 0,
      totalNotes: 0,
      processedNotes: 0,
    },
  });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize security service
      const securityService = SecurityService.getInstance();
      await securityService.initialize();

      // Check onboarding status
      const onboardingService = OnboardingService.getInstance();
      const onboardingComplete = await onboardingService.isOnboardingComplete();

      // Initialize agent coordinator
      const agentCoordinator = AgentCoordinator.getInstance();
      await agentCoordinator.initialize();

      // Initialize services for dashboard
      const notesAPI = AppleNotesAPIService.getInstance();
      const learningComponent = new LearningComponent();
      const actionService = new RecommendationActionService(notesAPI, learningComponent);
      const undoService = new UndoService(actionService);

      setState({
        isInitialized: true,
        isOnboardingComplete: onboardingComplete,
        isSecurityEnabled: true,
        error: null,
        recommendations: [],
        notes: [],
        processingStatus: {
          isProcessing: false,
          currentStep: '',
          progress: 0,
          totalNotes: 0,
          processedNotes: 0,
        },
        actionService,
        undoService,
      });
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setState(prev => ({
        ...prev,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  };

  const handleOnboardingComplete = () => {
    setState(prev => ({
      ...prev,
      isOnboardingComplete: true,
    }));
  };

  const handleOnboardingSkip = () => {
    setState(prev => ({
      ...prev,
      isOnboardingComplete: true,
    }));
  };

  const handleRecommendationAction = (recommendationId: string, action: 'approve' | 'reject', result?: any) => {
    // Implementation for handling recommendation actions
    console.log('Recommendation action:', recommendationId, action, result);
  };

  const handleBatchComplete = (results: any[]) => {
    // Implementation for handling batch completion
    console.log('Batch complete:', results);
  };

  const handleRefresh = () => {
    // Implementation for refreshing data
    console.log('Refreshing data...');
  };

  const handleRecommendationPress = async (recommendation: Recommendation) => {
    console.log('Recommendation pressed:', recommendation);
    try {
      const notesAPI = AppleNotesAPIService.getInstance();
      const result = await notesAPI.showNote(recommendation.noteId);
      if (!result.success) {
        console.error('Failed to open note:', result.error);
        // In a real app we might show a toast or alert here
      }
    } catch (error) {
      console.error('Error opening note:', error);
    }
  };

  if (!state.isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          {/* Loading indicator would go here */}
        </View>
      </SafeAreaView>
    );
  }

  if (state.error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          {/* Error display would go here */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AccessibilityProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'default'}
          backgroundColor={DesignSystem.colors.background.primary}
        />

        {!state.isOnboardingComplete ? (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        ) : (
          state.actionService && state.undoService ? (
            <Dashboard
              recommendations={state.recommendations}
              notes={state.notes}
              processingStatus={state.processingStatus}
              actionService={state.actionService}
              undoService={state.undoService}
              onRecommendationAction={handleRecommendationAction}
              onBatchComplete={handleBatchComplete}
              onRefresh={handleRefresh}
              onRecommendationPress={handleRecommendationPress}
            />
          ) : (
            <View style={styles.loadingContainer}>
              {/* Loading services */}
            </View>
          )
        )}
      </SafeAreaView>
    </AccessibilityProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DesignSystem.colors.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DesignSystem.colors.background.primary,
    padding: DesignSystem.spacing.large,
  },
});

export default App;