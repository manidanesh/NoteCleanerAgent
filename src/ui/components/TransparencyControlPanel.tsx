import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { 
  DetailedExplanation, 
  OverrideOption, 
  UncertaintyIndicator,
  ContentFactor,
  TransparencyService 
} from '../../services/TransparencyService';
import { FeedbackRecordingService } from '../../services/FeedbackRecordingService';
import { UndoService, StateRestorationDetails } from '../../services/UndoService';
import { Recommendation } from '../../models/Recommendation';
import { Note } from '../../models/Note';
import { UtilityScore } from '../../models/UtilityScore';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
} from '../design/DesignSystem';
import { useAccessibility } from './AccessibilityProvider';

interface TransparencyControlPanelProps {
  recommendation: Recommendation;
  note: Note;
  utilityScore?: UtilityScore;
  transparencyService: TransparencyService;
  feedbackService: FeedbackRecordingService;
  undoService: UndoService;
  onAction: (action: 'approve' | 'reject' | 'override', option?: OverrideOption) => void;
  onClose: () => void;
}

export const TransparencyControlPanel: React.FC<TransparencyControlPanelProps> = ({
  recommendation,
  note,
  utilityScore,
  transparencyService,
  feedbackService,
  undoService,
  onAction,
  onClose,
}) => {
  const [explanation, setExplanation] = useState<DetailedExplanation | null>(null);
  const [overrideOptions, setOverrideOptions] = useState<OverrideOption[]>([]);
  const [showDetailedFactors, setShowDetailedFactors] = useState(false);
  const [showUndoPreview, setShowUndoPreview] = useState(false);
  const [interactionStartTime] = useState(Date.now());
  const { isHighContrastEnabled, isLargeTextEnabled } = useAccessibility();

  useEffect(() => {
    // Generate detailed explanation
    const detailedExplanation = transparencyService.generateClearExplanation(
      recommendation,
      note,
      utilityScore
    );
    setExplanation(detailedExplanation);

    // Generate override options
    const options = transparencyService.generateOverrideOptions(
      recommendation,
      detailedExplanation.uncertaintyIndicators
    );
    setOverrideOptions(options);
  }, [recommendation, note, utilityScore, transparencyService]);

  const handleApprove = () => {
    const interactionTime = (Date.now() - interactionStartTime) / 1000;
    feedbackService.recordApproval(recommendation, note, interactionTime);
    onAction('approve');
  };

  const handleReject = () => {
    const interactionTime = (Date.now() - interactionStartTime) / 1000;
    feedbackService.recordRejection(recommendation, note, interactionTime);
    onAction('reject');
  };

  const handleOverride = (option: OverrideOption) => {
    const interactionTime = (Date.now() - interactionStartTime) / 1000;
    
    if (option.requiresConfirmation) {
      Alert.alert(
        'Confirm Override',
        `Are you sure you want to ${option.label.toLowerCase()}? ${option.description}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Confirm', 
            onPress: () => {
              feedbackService.recordOverride(recommendation, note, option, interactionTime);
              onAction('override', option);
            }
          }
        ]
      );
    } else {
      feedbackService.recordOverride(recommendation, note, option, interactionTime);
      onAction('override', option);
    }
  };

  const renderConfidenceIndicator = (confidenceLevel: any) => {
    const getConfidenceColor = () => {
      switch (confidenceLevel.label) {
        case 'High': return Colors.success;
        case 'Medium': return Colors.warning;
        case 'Low': return Colors.danger;
        default: return Colors.gray500;
      }
    };

    return (
      <View style={styles.confidenceSection}>
        <Text style={[
          styles.sectionTitle,
          getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
        ]}>
          AI Confidence Level
        </Text>
        
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceHeader}>
            <View style={[
              styles.confidenceBadge,
              { backgroundColor: getConfidenceColor() }
            ]}>
              <Text style={styles.confidenceBadgeText}>
                {confidenceLevel.label} ({Math.round(confidenceLevel.score * 100)}%)
              </Text>
            </View>
            <View style={[
              styles.riskBadge,
              { backgroundColor: getRiskColor(confidenceLevel.riskLevel) }
            ]}>
              <Text style={styles.riskBadgeText}>
                {confidenceLevel.riskLevel.toUpperCase()} RISK
              </Text>
            </View>
          </View>
          
          <Text style={[
            styles.confidenceDescription,
            getAccessibleTextStyle(styles.confidenceDescription, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            {confidenceLevel.description}
          </Text>
        </View>
      </View>
    );
  };

  const renderUncertaintyIndicators = (indicators: UncertaintyIndicator[]) => {
    if (indicators.length === 0) return null;

    return (
      <View style={styles.uncertaintySection}>
        <Text style={[
          styles.sectionTitle,
          getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
        ]}>
          ⚠️ Uncertainty Indicators
        </Text>
        
        {indicators.map((indicator, index) => (
          <View key={index} style={[
            styles.uncertaintyItem,
            { borderLeftColor: getSeverityColor(indicator.severity) }
          ]}>
            <Text style={[
              styles.uncertaintyDescription,
              getAccessibleTextStyle(styles.uncertaintyDescription, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {indicator.description}
            </Text>
            <Text style={[
              styles.uncertaintyRecommendation,
              getAccessibleTextStyle(styles.uncertaintyRecommendation, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              💡 {indicator.recommendation}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderContentFactors = (factors: ContentFactor[]) => {
    const displayFactors = showDetailedFactors ? factors : factors.slice(0, 3);

    return (
      <View style={styles.factorsSection}>
        <View style={styles.factorsHeader}>
          <Text style={[
            styles.sectionTitle,
            getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            Key Factors Considered
          </Text>
          {factors.length > 3 && (
            <TouchableOpacity
              onPress={() => setShowDetailedFactors(!showDetailedFactors)}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {showDetailedFactors ? 'Show Less' : `Show All (${factors.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {displayFactors.map((factor, index) => (
          <View key={index} style={styles.factorItem}>
            <View style={styles.factorHeader}>
              <Text style={[
                styles.factorName,
                getAccessibleTextStyle(styles.factorName, isHighContrastEnabled, isLargeTextEnabled)
              ]}>
                {factor.name}
              </Text>
              <View style={[
                styles.impactBadge,
                { backgroundColor: getImpactColor(factor.impact) }
              ]}>
                <Text style={styles.impactBadgeText}>
                  {factor.impact.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={[
              styles.factorValue,
              getAccessibleTextStyle(styles.factorValue, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {typeof factor.value === 'number' ? factor.value.toFixed(2) : factor.value}
            </Text>
            
            <Text style={[
              styles.factorDescription,
              getAccessibleTextStyle(styles.factorDescription, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {factor.description}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderOverrideOptions = (options: OverrideOption[]) => {
    return (
      <View style={styles.overrideSection}>
        <Text style={[
          styles.sectionTitle,
          getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
        ]}>
          Alternative Actions
        </Text>
        
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.overrideOption,
              { borderColor: getSafetyColor(option.safetyLevel) }
            ]}
            onPress={() => handleOverride(option)}
          >
            <View style={styles.overrideHeader}>
              <Text style={[
                styles.overrideLabel,
                getAccessibleTextStyle(styles.overrideLabel, isHighContrastEnabled, isLargeTextEnabled)
              ]}>
                {option.label}
              </Text>
              <View style={[
                styles.safetyBadge,
                { backgroundColor: getSafetyColor(option.safetyLevel) }
              ]}>
                <Text style={styles.safetyBadgeText}>
                  {option.safetyLevel.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={[
              styles.overrideDescription,
              getAccessibleTextStyle(styles.overrideDescription, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {factor.description}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderOverrideOptions = (options: OverrideOption[]) => {
    return (
      <View style={styles.overrideSection}>
        <Text style={[
          styles.sectionTitle,
          getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
        ]}>
          Alternative Actions
        </Text>
        
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.overrideOption,
              { borderColor: this.getSafetyColor(option.safetyLevel) }
            ]}
            onPress={() => handleOverride(option)}
          >
            <View style={styles.overrideHeader}>
              <Text style={[
                styles.overrideLabel,
                getAccessibleTextStyle(styles.overrideLabel, isHighContrastEnabled, isLargeTextEnabled)
              ]}>
                {option.label}
              </Text>
              <View style={[
                styles.safetyBadge,
                { backgroundColor: this.getSafetyColor(option.safetyLevel) }
              ]}>
                <Text style={styles.safetyBadgeText}>
                  {option.safetyLevel.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <Text style={[
              styles.overrideDescription,
              getAccessibleTextStyle(styles.overrideDescription, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {option.description}
            </Text>
            
            {option.requiresConfirmation && (
              <Text style={styles.confirmationNote}>
                ⚠️ Requires confirmation
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSaferAlternatives = (alternatives?: string[]) => {
    if (!alternatives || alternatives.length === 0) return null;

    return (
      <View style={styles.alternativesSection}>
        <Text style={[
          styles.sectionTitle,
          getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
        ]}>
          🛡️ Safer Alternatives
        </Text>
        
        {alternatives.map((alternative, index) => (
          <View key={index} style={styles.alternativeItem}>
            <Text style={styles.alternativeBullet}>•</Text>
            <Text style={[
              styles.alternativeText,
              getAccessibleTextStyle(styles.alternativeText, isHighContrastEnabled, isLargeTextEnabled)
            ]}>
              {alternative}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (!explanation) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading detailed analysis...</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      getAccessibleContainerStyle(styles.container, isHighContrastEnabled)
    ]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[
            styles.title,
            getAccessibleTextStyle(styles.title, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            AI Recommendation Analysis
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <Text style={[
            styles.summary,
            getAccessibleTextStyle(styles.summary, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            {explanation.summary}
          </Text>
        </View>

        {/* Confidence Level */}
        {renderConfidenceIndicator(explanation.confidenceLevel)}

        {/* Uncertainty Indicators */}
        {renderUncertaintyIndicators(explanation.uncertaintyIndicators)}

        {/* Detailed Reasoning */}
        <View style={styles.reasoningSection}>
          <Text style={[
            styles.sectionTitle,
            getAccessibleTextStyle(styles.sectionTitle, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            Detailed Reasoning
          </Text>
          <Text style={[
            styles.reasoning,
            getAccessibleTextStyle(styles.reasoning, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            {explanation.reasoning}
          </Text>
        </View>

        {/* Content Factors */}
        {renderContentFactors(explanation.contentFactors)}

        {/* Safer Alternatives */}
        {renderSaferAlternatives(explanation.saferAlternatives)}

        {/* Override Options */}
        {renderOverrideOptions(overrideOptions)}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleReject}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={handleApprove}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

};

// Helper methods for colors
const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'high': return Colors.danger;
      case 'medium': return Colors.warning;
      case 'low': return Colors.success;
      default: return Colors.gray500;
    }
};

const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return Colors.danger;
      case 'medium': return Colors.warning;
      case 'low': return Colors.info;
      default: return Colors.gray500;
    }
};

const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'positive': return Colors.success;
      case 'negative': return Colors.danger;
      case 'neutral': return Colors.gray400;
      default: return Colors.gray500;
    }
};

const getSafetyColor = (safetyLevel: string): string => {
    switch (safetyLevel) {
      case 'safe': return Colors.success;
      case 'moderate': return Colors.warning;
      case 'risky': return Colors.danger;
      default: return Colors.gray500;
    }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  title: {
    ...Typography.h2,
    color: Colors.gray900,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: Colors.gray500,
  },
  summarySection: {
    paddingVertical: Spacing.lg,
  },
  summary: {
    ...Typography.body1,
    color: Colors.gray800,
    lineHeight: 24,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  confidenceSection: {
    marginBottom: Spacing.lg,
  },
  confidenceContainer: {
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
  },
  confidenceBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  riskBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 10,
  },
  confidenceDescription: {
    ...Typography.body2,
    color: Colors.gray700,
    lineHeight: 20,
  },
  uncertaintySection: {
    marginBottom: Spacing.lg,
  },
  uncertaintyItem: {
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    marginBottom: Spacing.sm,
  },
  uncertaintyDescription: {
    ...Typography.body2,
    color: Colors.gray800,
    marginBottom: Spacing.xs,
  },
  uncertaintyRecommendation: {
    ...Typography.caption,
    color: Colors.gray600,
    fontStyle: 'italic',
  },
  reasoningSection: {
    marginBottom: Spacing.lg,
  },
  reasoning: {
    ...Typography.body2,
    color: Colors.gray700,
    lineHeight: 22,
  },
  factorsSection: {
    marginBottom: Spacing.lg,
  },
  factorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  toggleButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  toggleButtonText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  factorItem: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: Spacing.sm,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  factorName: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.gray900,
  },
  impactBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  impactBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 10,
  },
  factorValue: {
    ...Typography.body2,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },
  factorDescription: {
    ...Typography.caption,
    color: Colors.gray600,
    lineHeight: 16,
  },
  overrideSection: {
    marginBottom: Spacing.lg,
  },
  overrideOption: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  overrideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  overrideLabel: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.gray900,
  },
  safetyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  safetyBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 10,
  },
  overrideDescription: {
    ...Typography.body2,
    color: Colors.gray700,
    lineHeight: 20,
  },
  confirmationNote: {
    ...Typography.caption,
    color: Colors.warning,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  alternativesSection: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.info + '10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  alternativeBullet: {
    ...Typography.body2,
    color: Colors.info,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  alternativeText: {
    ...Typography.body2,
    color: Colors.gray700,
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  rejectButton: {
    backgroundColor: Colors.gray500,
  },
  approveButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  rejectButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
});