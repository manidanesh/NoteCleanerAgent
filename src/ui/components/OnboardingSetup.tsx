import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { DesignSystem } from '../design/DesignSystem';
import { ProgressIndicator } from './ProgressIndicator';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  estimatedTime: number; // in seconds
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface OnboardingSetupProps {
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
}

export const OnboardingSetup: React.FC<OnboardingSetupProps> = ({ onNext, onPrevious, onComplete }) => {
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 'permissions',
      title: 'Requesting Notes Access',
      description: 'Getting permission to access your Apple Notes',
      estimatedTime: 5,
      status: 'pending'
    },
    {
      id: 'models',
      title: 'Loading AI Models',
      description: 'Initializing on-device machine learning models',
      estimatedTime: 15,
      status: 'pending'
    },
    {
      id: 'indexing',
      title: 'Scanning Notes Library',
      description: 'Creating initial index of your notes',
      estimatedTime: 30,
      status: 'pending'
    },
    {
      id: 'analysis',
      title: 'Initial Analysis',
      description: 'Running first-pass content analysis',
      estimatedTime: 45,
      status: 'pending'
    },
    {
      id: 'recommendations',
      title: 'Generating Recommendations',
      description: 'Creating your first set of suggestions',
      estimatedTime: 20,
      status: 'pending'
    }
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isSetupStarted, setIsSetupStarted] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [totalEstimatedTime, setTotalEstimatedTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const total = setupSteps.reduce((sum, step) => sum + step.estimatedTime, 0);
    setTotalEstimatedTime(total);
  }, []);

  useEffect(() => {
    if (isSetupStarted && !isSetupComplete) {
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSetupStarted, isSetupComplete]);

  useEffect(() => {
    // Pulse animation for current step
    if (currentStepIndex >= 0 && !isSetupComplete) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [currentStepIndex, isSetupComplete]);

  const startSetup = async () => {
    setIsSetupStarted(true);
    
    for (let i = 0; i < setupSteps.length; i++) {
      setCurrentStepIndex(i);
      
      // Update step status to running
      setSetupSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'running' } : step
      ));

      // Simulate setup process
      await simulateSetupStep(setupSteps[i]);

      // Update step status to completed
      setSetupSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'completed' } : step
      ));
    }

    setCurrentStepIndex(-1);
    setIsSetupComplete(true);
  };

  const simulateSetupStep = (step: SetupStep): Promise<void> => {
    return new Promise((resolve) => {
      // Simulate actual setup time (reduced for demo)
      const actualTime = Math.min(step.estimatedTime * 100, 3000); // Max 3 seconds per step
      setTimeout(resolve, actualTime);
    });
  };

  const getStepIcon = (step: SetupStep, index: number) => {
    if (step.status === 'completed') return '✅';
    if (step.status === 'running') return '⚡';
    if (step.status === 'error') return '❌';
    if (index < currentStepIndex) return '✅';
    return '⏳';
  };

  const getStepStatusColor = (step: SetupStep) => {
    switch (step.status) {
      case 'completed': return DesignSystem.colors.success;
      case 'running': return DesignSystem.colors.primary;
      case 'error': return DesignSystem.colors.error;
      default: return DesignSystem.colors.text.secondary;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getProgressPercentage = () => {
    if (!isSetupStarted) return 0;
    if (isSetupComplete) return 100;
    
    const completedSteps = setupSteps.filter(step => step.status === 'completed').length;
    const currentStepProgress = currentStepIndex >= 0 ? 0.5 : 0; // 50% for current running step
    return Math.round(((completedSteps + currentStepProgress) / setupSteps.length) * 100);
  };

  if (!isSetupStarted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Ready to Get Started</Text>
        <Text style={styles.subtitle}>
          We'll now set up your AI assistant and perform an initial analysis of your notes.
        </Text>

        <View style={styles.setupPreview}>
          <Text style={styles.previewTitle}>Setup Process</Text>
          {setupSteps.map((step, index) => (
            <View key={step.id} style={styles.previewStep}>
              <Text style={styles.previewIcon}>⏳</Text>
              <View style={styles.previewContent}>
                <Text style={styles.previewStepTitle}>{step.title}</Text>
                <Text style={styles.previewStepDescription}>{step.description}</Text>
              </View>
              <Text style={styles.previewTime}>~{formatTime(step.estimatedTime)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.timeEstimate}>
          <Text style={styles.estimateTitle}>Total Estimated Time</Text>
          <Text style={styles.estimateTime}>{formatTime(totalEstimatedTime)}</Text>
          <Text style={styles.estimateNote}>
            Actual time may vary based on your notes library size
          </Text>
        </View>

        <View style={styles.setupInfo}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📱</Text>
            <Text style={styles.infoText}>
              Setup runs entirely on your device - no internet required
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🔋</Text>
            <Text style={styles.infoText}>
              You can continue using your device during setup
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>⏸️</Text>
            <Text style={styles.infoText}>
              Setup can be paused and resumed if needed
            </Text>
          </View>
        </View>

        <View style={styles.navigationButtons}>
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={onPrevious}
          >
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={startSetup}
          >
            <Text style={styles.primaryButtonText}>Start Setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isSetupComplete) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Setup Complete! 🎉</Text>
        <Text style={styles.subtitle}>
          Your AI assistant is ready to help organize your notes.
        </Text>

        <View style={styles.completionSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>📊</Text>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Analysis Complete</Text>
              <Text style={styles.summaryDescription}>
                Your notes have been analyzed and recommendations are ready
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>⏱️</Text>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Setup Time</Text>
              <Text style={styles.summaryDescription}>
                Completed in {formatTime(elapsedTime)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>🚀</Text>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Ready to Use</Text>
              <Text style={styles.summaryDescription}>
                Start reviewing recommendations and organizing your notes
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.nextSteps}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          <Text style={styles.nextStepItem}>• Review AI recommendations on the dashboard</Text>
          <Text style={styles.nextStepItem}>• Approve or reject suggestions to train the AI</Text>
          <Text style={styles.nextStepItem}>• Explore bulk cleanup and organization features</Text>
          <Text style={styles.nextStepItem}>• Check privacy settings anytime in the app</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.primaryButton, styles.fullWidthButton]} 
          onPress={onComplete}
        >
          <Text style={styles.primaryButtonText}>Start Using Notes AI Organizer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setting Up Your AI Assistant</Text>
      <Text style={styles.subtitle}>
        Please wait while we prepare everything for you...
      </Text>

      <View style={styles.progressSection}>
        <ProgressIndicator
          current={getProgressPercentage()}
          total={100}
          showPercentage={true}
          size="large"
        />
        
        <Text style={styles.progressText}>
          {getProgressPercentage()}% Complete
        </Text>
        
        <Text style={styles.timeText}>
          Elapsed: {formatTime(elapsedTime)} / Estimated: {formatTime(totalEstimatedTime)}
        </Text>
      </View>

      <View style={styles.stepsList}>
        {setupSteps.map((step, index) => (
          <Animated.View 
            key={step.id} 
            style={[
              styles.setupStep,
              index === currentStepIndex && { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <Text style={styles.stepIcon}>{getStepIcon(step, index)}</Text>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: getStepStatusColor(step) }]}>
                {step.title}
              </Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
              {step.status === 'running' && (
                <Text style={styles.stepStatus}>In progress...</Text>
              )}
            </View>
            <Text style={styles.stepTime}>
              {formatTime(step.estimatedTime)}
            </Text>
          </Animated.View>
        ))}
      </View>

      <View style={styles.setupNote}>
        <Text style={styles.noteText}>
          💡 Your device may warm up slightly during AI model initialization. This is normal.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: DesignSystem.typography.h3.fontSize,
    fontWeight: DesignSystem.typography.h3.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.sm,
  },
  subtitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  setupPreview: {
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.lg,
  },
  previewTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.md,
    textAlign: 'center',
  },
  previewStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignSystem.spacing.sm,
  },
  previewIcon: {
    fontSize: 16,
    marginRight: DesignSystem.spacing.md,
  },
  previewContent: {
    flex: 1,
  },
  previewStepTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
  },
  previewStepDescription: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
  },
  previewTime: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.tertiary,
  },
  timeEstimate: {
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  estimateTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  estimateTime: {
    fontSize: DesignSystem.typography.h2.fontSize,
    fontWeight: DesignSystem.typography.h2.fontWeight as any,
    color: DesignSystem.colors.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  estimateNote: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.tertiary,
    textAlign: 'center',
  },
  setupInfo: {
    marginBottom: DesignSystem.spacing.xl,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.sm,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: DesignSystem.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  progressText: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginTop: DesignSystem.spacing.md,
  },
  timeText: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginTop: DesignSystem.spacing.xs,
  },
  stepsList: {
    marginBottom: DesignSystem.spacing.lg,
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    marginBottom: DesignSystem.spacing.sm,
  },
  stepIcon: {
    fontSize: 20,
    marginRight: DesignSystem.spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    marginBottom: DesignSystem.spacing.xs,
  },
  stepDescription: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
  },
  stepStatus: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.primary,
    fontStyle: 'italic',
    marginTop: DesignSystem.spacing.xs,
  },
  stepTime: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.tertiary,
  },
  setupNote: {
    backgroundColor: DesignSystem.colors.background.secondary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.lg,
  },
  noteText: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
  },
  completionSummary: {
    marginBottom: DesignSystem.spacing.lg,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    marginBottom: DesignSystem.spacing.sm,
  },
  summaryIcon: {
    fontSize: 24,
    marginRight: DesignSystem.spacing.md,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  summaryDescription: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
  },
  nextSteps: {
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.xl,
  },
  nextStepsTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.md,
    textAlign: 'center',
  },
  nextStepItem: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: DesignSystem.spacing.lg,
  },
  button: {
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderRadius: DesignSystem.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: DesignSystem.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: DesignSystem.colors.border,
  },
  fullWidthButton: {
    width: '100%',
  },
  primaryButtonText: {
    color: DesignSystem.colors.background.primary,
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: DesignSystem.colors.text.primary,
    fontSize: DesignSystem.typography.body.fontSize,
  },
});