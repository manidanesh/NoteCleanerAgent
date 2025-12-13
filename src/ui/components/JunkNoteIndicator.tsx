import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { JunkDetectionResult, JunkConfidence, JunkNoteCategory } from '../../agents/JunkNoteDetectorAgent';

interface JunkNoteIndicatorProps {
  result: JunkDetectionResult;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Component for displaying junk note classification indicators
 */
export const JunkNoteIndicator: React.FC<JunkNoteIndicatorProps> = ({
  result,
  showDetails = false,
  compact = false
}) => {
  const getConfidenceColor = (confidence: JunkConfidence): string => {
    switch (confidence) {
      case JunkConfidence.HIGH:
        return '#FF4444'; // Red
      case JunkConfidence.MEDIUM:
        return '#FF8800'; // Orange
      case JunkConfidence.LOW:
        return '#FFAA00'; // Yellow-orange
      case JunkConfidence.UNCERTAIN:
        return '#888888'; // Gray
      default:
        return '#888888';
    }
  };

  const getCategoryIcon = (category?: JunkNoteCategory): string => {
    if (!category) return '❓';
    
    switch (category) {
      case JunkNoteCategory.SHOPPING_LIST:
        return '🛒';
      case JunkNoteCategory.SCRATCH_PAD:
        return '📝';
      case JunkNoteCategory.EXPIRED_REMINDER:
        return '⏰';
      case JunkNoteCategory.EMPTY_NOTE:
        return '📄';
      case JunkNoteCategory.TEMPORARY_LIST:
        return '📋';
      case JunkNoteCategory.COMPLETED_TASK:
        return '✅';
      case JunkNoteCategory.OUTDATED_INFO:
        return '🗂️';
      default:
        return '❓';
    }
  };

  const getCategoryLabel = (category?: JunkNoteCategory): string => {
    if (!category) return 'Unknown';
    
    switch (category) {
      case JunkNoteCategory.SHOPPING_LIST:
        return 'Shopping List';
      case JunkNoteCategory.SCRATCH_PAD:
        return 'Scratch Pad';
      case JunkNoteCategory.EXPIRED_REMINDER:
        return 'Expired Reminder';
      case JunkNoteCategory.EMPTY_NOTE:
        return 'Empty Note';
      case JunkNoteCategory.TEMPORARY_LIST:
        return 'Temporary List';
      case JunkNoteCategory.COMPLETED_TASK:
        return 'Completed Task';
      case JunkNoteCategory.OUTDATED_INFO:
        return 'Outdated Info';
      default:
        return 'Unknown';
    }
  };

  const getConfidenceLabel = (confidence: JunkConfidence): string => {
    switch (confidence) {
      case JunkConfidence.HIGH:
        return 'High Confidence';
      case JunkConfidence.MEDIUM:
        return 'Medium Confidence';
      case JunkConfidence.LOW:
        return 'Low Confidence';
      case JunkConfidence.UNCERTAIN:
        return 'Needs Review';
      default:
        return 'Unknown';
    }
  };

  if (!result.isJunk && !result.requiresManualReview) {
    return null; // Don't show indicator for non-junk notes
  }

  const confidenceColor = getConfidenceColor(result.confidence);
  const categoryIcon = getCategoryIcon(result.category);
  const categoryLabel = getCategoryLabel(result.category);
  const confidenceLabel = getConfidenceLabel(result.confidence);

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderLeftColor: confidenceColor }]}>
        <Text style={styles.compactIcon}>{categoryIcon}</Text>
        <Text style={[styles.compactText, { color: confidenceColor }]}>
          {result.requiresManualReview ? 'Review' : 'Junk'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: confidenceColor }]}>
      <View style={styles.header}>
        <View style={styles.categorySection}>
          <Text style={styles.categoryIcon}>{categoryIcon}</Text>
          <Text style={styles.categoryLabel}>{categoryLabel}</Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
          <Text style={styles.confidenceText}>{result.confidenceScore}%</Text>
        </View>
      </View>
      
      <Text style={styles.confidenceLabel}>{confidenceLabel}</Text>
      
      {showDetails && (
        <View style={styles.detailsSection}>
          <Text style={styles.reasoning}>{result.reasoning}</Text>
          
          {result.indicators.length > 0 && (
            <View style={styles.indicatorsSection}>
              <Text style={styles.indicatorsTitle}>Key Indicators:</Text>
              {result.indicators.slice(0, 3).map((indicator, index) => (
                <View key={index} style={styles.indicatorItem}>
                  <Text style={styles.indicatorBullet}>•</Text>
                  <Text style={styles.indicatorText}>{indicator.description}</Text>
                </View>
              ))}
            </View>
          )}
          
          {result.requiresManualReview && (
            <View style={styles.reviewNotice}>
              <Text style={styles.reviewText}>
                ⚠️ Manual review recommended before taking action
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9F9',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F9',
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detailsSection: {
    marginTop: 8,
  },
  reasoning: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  indicatorsSection: {
    marginBottom: 12,
  },
  indicatorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  indicatorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  indicatorBullet: {
    fontSize: 14,
    color: '#666',
    marginRight: 6,
    marginTop: 2,
  },
  indicatorText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
    lineHeight: 18,
  },
  reviewNotice: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  reviewText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
  },
  compactIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
  },
});