import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds
  showDetails?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  currentStep,
  estimatedTimeRemaining,
  showDetails = true,
}) => {
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s remaining`;
    } else if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes}m remaining`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${minutes}m remaining`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Processing Notes</Text>
        <Text style={styles.percentage}>{Math.round(progress)}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(0, Math.min(100, progress))}%` }
            ]}
          />
        </View>
      </View>

      {/* Progress Details */}
      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.currentStep}>{currentStep}</Text>
          {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
            <Text style={styles.timeRemaining}>
              {formatTimeRemaining(estimatedTimeRemaining)}
            </Text>
          )}
        </View>
      )}

      {/* Processing Steps Indicator */}
      <View style={styles.stepsContainer}>
        <ProcessingStep
          title="Indexing"
          isActive={currentStep.toLowerCase().includes('index')}
          isComplete={progress > 20}
        />
        <ProcessingStep
          title="Extraction"
          isActive={currentStep.toLowerCase().includes('extract')}
          isComplete={progress > 40}
        />
        <ProcessingStep
          title="Scoring"
          isActive={currentStep.toLowerCase().includes('scor')}
          isComplete={progress > 60}
        />
        <ProcessingStep
          title="Detection"
          isActive={currentStep.toLowerCase().includes('detect')}
          isComplete={progress > 80}
        />
        <ProcessingStep
          title="Recommendations"
          isActive={currentStep.toLowerCase().includes('recommend')}
          isComplete={progress >= 100}
        />
      </View>
    </View>
  );
};

interface ProcessingStepProps {
  title: string;
  isActive: boolean;
  isComplete: boolean;
}

const ProcessingStep: React.FC<ProcessingStepProps> = ({
  title,
  isActive,
  isComplete,
}) => {
  return (
    <View style={styles.step}>
      <View style={[
        styles.stepIndicator,
        isComplete && styles.stepComplete,
        isActive && styles.stepActive,
      ]}>
        {isComplete ? (
          <Text style={styles.stepCheckmark}>✓</Text>
        ) : (
          <View style={styles.stepDot} />
        )}
      </View>
      <Text style={[
        styles.stepTitle,
        isActive && styles.stepTitleActive,
        isComplete && styles.stepTitleComplete,
      ]}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  percentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 4,
  },
  details: {
    marginBottom: 16,
  },
  currentStep: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  timeRemaining: {
    fontSize: 12,
    color: '#6c757d',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepActive: {
    backgroundColor: '#007bff',
  },
  stepComplete: {
    backgroundColor: '#28a745',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c757d',
  },
  stepCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepTitle: {
    fontSize: 10,
    color: '#6c757d',
    textAlign: 'center',
  },
  stepTitleActive: {
    color: '#007bff',
    fontWeight: '600',
  },
  stepTitleComplete: {
    color: '#28a745',
    fontWeight: '600',
  },
});