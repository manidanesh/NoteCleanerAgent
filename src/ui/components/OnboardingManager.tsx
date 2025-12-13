import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import { OnboardingFlow } from './OnboardingFlow';
import { OnboardingService } from '../../services/OnboardingService';
import { DesignSystem } from '../design/DesignSystem';

interface OnboardingManagerProps {
  onComplete: () => void;
  children: React.ReactNode;
}

/**
 * Main onboarding manager that controls when to show onboarding
 * Implements requirements 22.1-22.5 for complete onboarding experience
 */
export const OnboardingManager: React.FC<OnboardingManagerProps> = ({ onComplete, children }) => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      // Validate onboarding version first
      const isVersionValid = await OnboardingService.validateOnboardingVersion();
      
      if (!isVersionValid) {
        // Version mismatch - show onboarding
        setShowOnboarding(true);
        setIsLoading(false);
        return;
      }

      // Check if onboarding is completed
      const isCompleted = await OnboardingService.isOnboardingCompleted();
      
      if (!isCompleted) {
        setShowOnboarding(true);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // On error, show onboarding to be safe
      setShowOnboarding(true);
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await OnboardingService.completeOnboarding();
      setShowOnboarding(false);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert(
        'Setup Error',
        'There was an issue completing the setup. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleOnboardingSkip = async () => {
    try {
      // Show confirmation dialog
      Alert.alert(
        'Skip Setup?',
        'You can always access the tutorial and setup from the settings menu later.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Skip',
            style: 'destructive',
            onPress: async () => {
              await OnboardingService.completeOnboarding();
              setShowOnboarding(false);
              onComplete();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* In a real app, this would be a proper loading screen */}
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <View style={styles.onboardingContainer}>
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </View>
    );
  }

  return <>{children}</>;
};

/**
 * Hook for accessing onboarding-related functionality in components
 */
export const useOnboarding = () => {
  const [shouldShowHints, setShouldShowHints] = useState(false);

  useEffect(() => {
    checkTutorialHints();
  }, []);

  const checkTutorialHints = async () => {
    const showHints = await OnboardingService.shouldShowTutorialHints();
    setShouldShowHints(showHints);
  };

  const markStepCompleted = async (stepId: string) => {
    await OnboardingService.completeStep(stepId);
  };

  const resetOnboarding = async () => {
    await OnboardingService.resetOnboarding();
  };

  const getOnboardingProgress = async () => {
    return await OnboardingService.getOnboardingAnalytics();
  };

  return {
    shouldShowHints,
    markStepCompleted,
    resetOnboarding,
    getOnboardingProgress
  };
};

/**
 * Component for showing tutorial hints in the main app
 * Requirement 22.2: Example recommendations with AI reasoning demonstrations
 */
export const TutorialHint: React.FC<{
  title: string;
  description: string;
  onDismiss: () => void;
}> = ({ title, description, onDismiss }) => {
  return (
    <View style={styles.hintContainer}>
      <View style={styles.hintContent}>
        <Text style={styles.hintTitle}>{title}</Text>
        <Text style={styles.hintDescription}>{description}</Text>
      </View>
      <TouchableOpacity style={styles.hintDismiss} onPress={onDismiss}>
        <Text style={styles.hintDismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background.primary,
  },
  hintContainer: {
    flexDirection: 'row',
    backgroundColor: DesignSystem.colors.info,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    margin: DesignSystem.spacing.md,
    alignItems: 'flex-start',
  },
  hintContent: {
    flex: 1,
  },
  hintTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.background.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  hintDescription: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.background.primary,
    opacity: 0.9,
  },
  hintDismiss: {
    padding: DesignSystem.spacing.xs,
    marginLeft: DesignSystem.spacing.sm,
  },
  hintDismissText: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.background.primary,
    fontWeight: 'bold',
  },
});