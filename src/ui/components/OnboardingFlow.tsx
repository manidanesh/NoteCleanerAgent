import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { DesignSystem } from '../design/DesignSystem';
import { ProgressIndicator } from './ProgressIndicator';
import { OnboardingExamples } from './OnboardingExamples';
import { OnboardingPermissions } from './OnboardingPermissions';
import { OnboardingSetup } from './OnboardingSetup';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
}

interface OnboardingStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Notes AI Organizer',
    description: 'Your intelligent assistant for organizing Apple Notes',
    component: WelcomeStep
  },
  {
    id: 'capabilities',
    title: 'AI Capabilities',
    description: 'Learn about our specialized AI agents',
    component: CapabilitiesStep
  },
  {
    id: 'examples',
    title: 'Example Recommendations',
    description: 'See how AI reasoning works',
    component: ExamplesStepWrapper
  },
  {
    id: 'permissions',
    title: 'Privacy & Permissions',
    description: 'Your data stays secure and private',
    component: PermissionsStepWrapper
  },
  {
    id: 'setup',
    title: 'Initial Setup',
    description: 'Get started with your first analysis',
    component: SetupStepWrapper
  }
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onSkip }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  const currentStep = onboardingSteps[currentStepIndex];
  const StepComponent = currentStep.component;

  const handleNext = () => {
    if (currentStepIndex < onboardingSteps.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ProgressIndicator
          current={currentStepIndex + 1}
          total={onboardingSteps.length}
          showPercentage={false}
        />
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.stepTitle}>{currentStep.title}</Text>
        <Text style={styles.stepDescription}>{currentStep.description}</Text>
        
        <StepComponent
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkip={onSkip}
          isFirst={currentStepIndex === 0}
          isLast={currentStepIndex === onboardingSteps.length - 1}
        />
      </Animated.View>
    </View>
  );
};

// Welcome Step Component
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext, isFirst, isLast }) => {
  return (
    <ScrollView style={styles.stepContent}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeTitle}>🤖 AI-Powered Note Organization</Text>
        <Text style={styles.welcomeText}>
          Notes AI Organizer uses specialized AI agents to help you:
        </Text>
        
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🧹</Text>
            <Text style={styles.featureText}>Clean up junk and temporary notes</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔍</Text>
            <Text style={styles.featureText}>Find and merge duplicate content</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <Text style={styles.featureText}>Score note importance and utility</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📁</Text>
            <Text style={styles.featureText}>Suggest better organization</Text>
          </View>
        </View>

        <Text style={styles.privacyNote}>
          🔒 All processing happens on your device - your notes never leave your control.
        </Text>
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={onNext}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Capabilities Step Component  
const CapabilitiesStep: React.FC<OnboardingStepProps> = ({ onNext, onPrevious, isFirst, isLast }) => {
  return (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Meet Your AI Agents</Text>
      
      <View style={styles.agentList}>
        <View style={styles.agentCard}>
          <Text style={styles.agentIcon}>🔍</Text>
          <Text style={styles.agentName}>Content Extractor</Text>
          <Text style={styles.agentDescription}>
            Reads and understands all your note content including text, handwriting, images, and attachments.
          </Text>
        </View>

        <View style={styles.agentCard}>
          <Text style={styles.agentIcon}>⚖️</Text>
          <Text style={styles.agentName}>Utility Scorer</Text>
          <Text style={styles.agentDescription}>
            Analyzes how useful each note is based on content quality, usage patterns, and relevance.
          </Text>
        </View>

        <View style={styles.agentCard}>
          <Text style={styles.agentIcon}>👥</Text>
          <Text style={styles.agentName}>Duplicate Detector</Text>
          <Text style={styles.agentDescription}>
            Finds similar or identical notes and suggests which ones to keep or merge.
          </Text>
        </View>

        <View style={styles.agentCard}>
          <Text style={styles.agentIcon}>📋</Text>
          <Text style={styles.agentName}>Organization Agent</Text>
          <Text style={styles.agentDescription}>
            Suggests better titles, folder structures, and organizational improvements.
          </Text>
        </View>

        <View style={styles.agentCard}>
          <Text style={styles.agentIcon}>🧠</Text>
          <Text style={styles.agentName}>Learning Component</Text>
          <Text style={styles.agentDescription}>
            Learns from your feedback to make better recommendations over time.
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
          onPress={onNext}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.lg,
    paddingTop: DesignSystem.spacing.xl,
    paddingBottom: DesignSystem.spacing.md,
  },
  skipButton: {
    padding: DesignSystem.spacing.sm,
  },
  skipText: {
    color: DesignSystem.colors.text.secondary,
    fontSize: DesignSystem.typography.body.fontSize,
  },
  content: {
    flex: 1,
    paddingHorizontal: DesignSystem.spacing.lg,
  },
  stepTitle: {
    fontSize: DesignSystem.typography.h2.fontSize,
    fontWeight: DesignSystem.typography.h2.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
  },
  stepDescription: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: DesignSystem.spacing.xl,
  },
  welcomeTitle: {
    fontSize: DesignSystem.typography.h1.fontSize,
    fontWeight: DesignSystem.typography.h1.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  welcomeText: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  featureList: {
    width: '100%',
    marginBottom: DesignSystem.spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.sm,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: DesignSystem.spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.primary,
  },
  privacyNote: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.success,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: DesignSystem.colors.background.secondary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
  },
  sectionTitle: {
    fontSize: DesignSystem.typography.h3.fontSize,
    fontWeight: DesignSystem.typography.h3.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.lg,
    textAlign: 'center',
  },
  agentList: {
    marginBottom: DesignSystem.spacing.xl,
  },
  agentCard: {
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.md,
    alignItems: 'center',
  },
  agentIcon: {
    fontSize: 32,
    marginBottom: DesignSystem.spacing.sm,
  },
  agentName: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
    textAlign: 'center',
  },
  agentDescription: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
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

// Wrapper components to match the OnboardingStepProps interface
const ExamplesStepWrapper: React.FC<OnboardingStepProps> = ({ onNext, onPrevious }) => (
  <OnboardingExamples onNext={onNext} onPrevious={onPrevious} />
);

const PermissionsStepWrapper: React.FC<OnboardingStepProps> = ({ onNext, onPrevious }) => (
  <OnboardingPermissions onNext={onNext} onPrevious={onPrevious} />
);

const SetupStepWrapper: React.FC<OnboardingStepProps> = ({ onNext, onPrevious, onSkip }) => (
  <OnboardingSetup onNext={onNext} onPrevious={onPrevious} onComplete={onNext} />
);