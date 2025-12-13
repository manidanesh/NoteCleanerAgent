import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  ExplanationStyles,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
} from '../design/DesignSystem';

interface ExplanationFormatterProps {
  title?: string;
  explanation: string;
  confidence?: number;
  factors?: string[];
  type?: 'info' | 'warning' | 'success' | 'error';
  isHighContrast?: boolean;
  isLargeText?: boolean;
}

export const ExplanationFormatter: React.FC<ExplanationFormatterProps> = ({
  title,
  explanation,
  confidence,
  factors,
  type = 'info',
  isHighContrast = false,
  isLargeText = false,
}) => {
  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'warning': return Colors.warning;
      case 'success': return Colors.success;
      case 'error': return Colors.danger;
      default: return Colors.info;
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const formatExplanationText = (text: string): React.ReactNode => {
    // Split text into sentences for better readability
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    return sentences.map((sentence, index) => {
      // Highlight technical terms or important phrases
      const highlightedSentence = sentence.replace(
        /\b(utility score|confidence|similarity|duplicate|archive|delete|merge)\b/gi,
        (match) => `<highlight>${match}</highlight>`
      );
      
      // Split by highlight markers and render
      const parts = highlightedSentence.split(/(<highlight>.*?<\/highlight>)/);
      
      return (
        <Text key={index} style={[
          styles.sentence,
          getAccessibleTextStyle(styles.sentence, isHighContrast, isLargeText),
        ]}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('<highlight>') && part.endsWith('</highlight>')) {
              const highlightText = part.replace(/<\/?highlight>/g, '');
              return (
                <Text key={partIndex} style={[
                  styles.highlight,
                  getAccessibleTextStyle(styles.highlight, isHighContrast, isLargeText),
                ]}>
                  {highlightText}
                </Text>
              );
            }
            return part;
          })}
          {index < sentences.length - 1 ? ' ' : ''}
        </Text>
      );
    });
  };

  const renderConfidenceIndicator = (confidence: number) => {
    const getConfidenceColor = (conf: number): string => {
      if (conf >= 0.8) return Colors.success;
      if (conf >= 0.6) return Colors.warning;
      return Colors.danger;
    };

    const getConfidenceLabel = (conf: number): string => {
      if (conf >= 0.8) return 'High Confidence';
      if (conf >= 0.6) return 'Medium Confidence';
      return 'Low Confidence';
    };

    return (
      <View style={styles.confidenceContainer}>
        <View style={[
          styles.confidenceBar,
          { backgroundColor: Colors.gray200 }
        ]}>
          <View style={[
            styles.confidenceFill,
            { 
              width: `${confidence * 100}%`,
              backgroundColor: getConfidenceColor(confidence)
            }
          ]} />
        </View>
        <Text style={[
          styles.confidenceLabel,
          { color: getConfidenceColor(confidence) },
          getAccessibleTextStyle(styles.confidenceLabel, isHighContrast, isLargeText),
        ]}>
          {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
        </Text>
      </View>
    );
  };

  return (
    <View style={[
      ExplanationStyles.container,
      { borderLeftColor: getTypeColor(type) },
      getAccessibleContainerStyle(ExplanationStyles.container, isHighContrast),
    ]}>
      {/* Header */}
      {title && (
        <View style={styles.header}>
          <Text style={styles.icon}>{getTypeIcon(type)}</Text>
          <Text style={[
            ExplanationStyles.title,
            getAccessibleTextStyle(ExplanationStyles.title, isHighContrast, isLargeText),
          ]}>
            {title}
          </Text>
        </View>
      )}

      {/* Main Explanation */}
      <View style={styles.explanationContent}>
        {formatExplanationText(explanation)}
      </View>

      {/* Contributing Factors */}
      {factors && factors.length > 0 && (
        <View style={styles.factorsContainer}>
          <Text style={[
            styles.factorsTitle,
            getAccessibleTextStyle(styles.factorsTitle, isHighContrast, isLargeText),
          ]}>
            Key factors considered:
          </Text>
          {factors.map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <Text style={styles.factorBullet}>•</Text>
              <Text style={[
                styles.factorText,
                getAccessibleTextStyle(styles.factorText, isHighContrast, isLargeText),
              ]}>
                {factor}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Confidence Indicator */}
      {confidence !== undefined && renderConfidenceIndicator(confidence)}
    </View>
  );
};

// Specialized explanation components for different contexts
export const UtilityScoreExplanation: React.FC<{
  score: number;
  explanation: string;
  factors: string[];
  isHighContrast?: boolean;
  isLargeText?: boolean;
}> = ({ score, explanation, factors, isHighContrast, isLargeText }) => {
  const getScoreType = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'error';
  };

  return (
    <ExplanationFormatter
      title={`Utility Score: ${score}/100`}
      explanation={explanation}
      factors={factors}
      type={getScoreType(score)}
      isHighContrast={isHighContrast}
      isLargeText={isLargeText}
    />
  );
};

export const RecommendationExplanation: React.FC<{
  action: string;
  reasoning: string;
  confidence: number;
  isHighContrast?: boolean;
  isLargeText?: boolean;
}> = ({ action, reasoning, confidence, isHighContrast, isLargeText }) => {
  const getActionType = (action: string): 'info' | 'warning' | 'error' => {
    if (action.toLowerCase().includes('delete')) return 'error';
    if (action.toLowerCase().includes('archive') || action.toLowerCase().includes('merge')) return 'warning';
    return 'info';
  };

  return (
    <ExplanationFormatter
      title={`Why ${action}?`}
      explanation={reasoning}
      confidence={confidence}
      type={getActionType(action)}
      isHighContrast={isHighContrast}
      isLargeText={isLargeText}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  explanationContent: {
    marginBottom: Spacing.sm,
  },
  sentence: {
    ...Typography.body2,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  highlight: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 2,
    borderRadius: 2,
    fontWeight: '500',
    color: Colors.gray800,
  },
  factorsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  factorsTitle: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  factorBullet: {
    ...Typography.body2,
    color: Colors.gray500,
    marginRight: Spacing.xs,
    marginTop: 2,
  },
  factorText: {
    ...Typography.body2,
    color: Colors.gray600,
    flex: 1,
    lineHeight: 18,
  },
  confidenceContainer: {
    marginTop: Spacing.md,
  },
  confidenceBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceLabel: {
    ...Typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});