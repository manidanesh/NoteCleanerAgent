import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Recommendation, RecommendationAction, ImpactLevel } from '../../models/Recommendation';
import { Note } from '../../models/Note';
import { RecommendationActionService } from '../../services/RecommendationActionService';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  getActionIcon,
  getActionColor,
  getActionLabel,
  getImpactBorderStyle,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
  AccessibilityLabels,
  AccessibilityHints,
  ComponentStyles,
} from '../design/DesignSystem';
import { useAccessibility } from './AccessibilityProvider';
import { RecommendationExplanation } from './ExplanationFormatter';

interface RecommendationCardProps {
  recommendation: Recommendation;
  note?: Note;
  actionService: RecommendationActionService;
  onAction: (recommendationId: string, action: 'approve' | 'reject', result?: any) => void;
  onPress: () => void;
  onSelect?: (recommendationId: string, selected: boolean) => void;
  isSelected?: boolean;
  showSelection?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  note,
  actionService,
  onAction,
  onPress,
  onSelect,
  isSelected = false,
  showSelection = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { isHighContrastEnabled, isLargeTextEnabled, announceForAccessibility } = useAccessibility();

  const handleApprove = async () => {
    if (!note) {
      Alert.alert('Error', 'Note data not available');
      return;
    }

    // Get detailed explanation for the action
    const explanation = actionService.getActionExplanation(recommendation, note);
    
    if (recommendation.action === RecommendationAction.DELETE) {
      Alert.alert(
        'Confirm Deletion',
        `${explanation}\n\nAre you sure you want to delete "${note.title}"? This action can be undone later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: () => executeApprovalAction()
          },
        ]
      );
    } else if (recommendation.action === RecommendationAction.MERGE_DUPLICATES) {
      Alert.alert(
        'Confirm Merge',
        `${explanation}\n\nProceed with merging duplicates?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Merge', 
            style: 'default',
            onPress: () => executeApprovalAction()
          },
        ]
      );
    } else {
      executeApprovalAction();
    }
  };

  const handleReject = () => {
    if (!note) {
      Alert.alert('Error', 'Note data not available');
      return;
    }
    executeRejectionAction();
  };

  const executeApprovalAction = async () => {
    if (!note) return;
    
    setIsProcessing(true);
    try {
      const result = await actionService.executeRecommendation(recommendation, note, true);
      onAction(recommendation.id, 'approve', result);
      handleActionComplete('approve');
      
      if (!result.success) {
        Alert.alert('Action Failed', result.error || 'Unknown error occurred');
      } else if (result.message) {
        Alert.alert('Success', result.message);
      }
    } catch (error) {
      console.error('Action execution failed:', error);
      Alert.alert('Error', 'Failed to execute action');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRejectionAction = async () => {
    if (!note) return;
    
    setIsProcessing(true);
    try {
      const result = await actionService.rejectRecommendation(recommendation, note);
      onAction(recommendation.id, 'reject', result);
      handleActionComplete('reject');
      
      if (!result.success) {
        Alert.alert('Rejection Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Rejection failed:', error);
      Alert.alert('Error', 'Failed to record rejection');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelect = () => {
    if (onSelect) {
      onSelect(recommendation.id, !isSelected);
    }
  };

  const handleActionComplete = (action: 'approve' | 'reject') => {
    const message = action === 'approve' 
      ? `Recommendation approved. ${getActionLabel(recommendation.action)} action will be executed.`
      : 'Recommendation rejected and feedback recorded.';
    announceForAccessibility(message);
  };

  return (
    <TouchableOpacity
      style={[
        ComponentStyles.card,
        isSelected && styles.selectedCard,
        getImpactBorderStyle(recommendation.impact),
        getAccessibleContainerStyle(ComponentStyles.card, isHighContrastEnabled)
      ]}
      onPress={onPress}
      disabled={isProcessing}
      accessibilityLabel={AccessibilityLabels.recommendationAction(recommendation.action)}
      accessibilityHint={AccessibilityHints.recommendationCard}
    >
      {/* Selection Checkbox */}
      {showSelection && (
        <TouchableOpacity
          style={styles.selectionButton}
          onPress={handleSelect}
        >
          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      )}

      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.actionBadge}>
          <Text style={styles.actionIcon}>{getActionIcon(recommendation.action)}</Text>
          <Text style={[
            styles.actionText, 
            { color: getActionColor(recommendation.action) },
            getAccessibleTextStyle(styles.actionText, isHighContrastEnabled, isLargeTextEnabled)
          ]}>
            {getActionLabel(recommendation.action)}
          </Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{Math.round(recommendation.confidence * 100)}%</Text>
        </View>
      </View>

      {/* Note Preview */}
      <View style={styles.notePreview}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {note?.title || 'Untitled Note'}
        </Text>
        <Text style={styles.noteContent} numberOfLines={2}>
          {note?.content || 'No content available'}
        </Text>
        <Text style={styles.noteMetadata}>
          Modified: {note?.modifiedDate ? new Date(note.modifiedDate).toLocaleDateString() : 'Unknown'}
          {note?.metadata.wordCount && ` • ${note.metadata.wordCount} words`}
        </Text>
      </View>

      {/* AI Analysis */}
      <RecommendationExplanation
        action={getActionLabel(recommendation.action)}
        reasoning={recommendation.reasoning}
        confidence={recommendation.confidence}
        isHighContrast={isHighContrastEnabled}
        isLargeText={isLargeTextEnabled}
      />

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleReject}
          disabled={isProcessing}
        >
          <Text style={styles.rejectButtonText}>
            {isProcessing ? 'Processing...' : 'Reject'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={handleApprove}
          disabled={isProcessing}
        >
          <Text style={styles.approveButtonText}>
            {isProcessing ? 'Processing...' : 'Approve'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reversible Indicator */}
      {recommendation.reversible && (
        <View style={styles.reversibleIndicator}>
          <Text style={styles.reversibleText}>↶ Reversible</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  selectedCard: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  selectionButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.round,
    borderWidth: 2,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  actionText: {
    ...Typography.label,
  },
  confidenceBadge: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  confidenceText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.gray600,
  },
  notePreview: {
    marginBottom: Spacing.md,
  },
  noteTitle: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.gray900,
    marginBottom: Spacing.xs,
  },
  noteContent: {
    ...Typography.body2,
    color: Colors.gray500,
    marginBottom: Spacing.xs,
  },
  noteMetadata: {
    ...Typography.caption,
    color: Colors.gray400,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
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
  reversibleIndicator: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  reversibleText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '500',
  },
});