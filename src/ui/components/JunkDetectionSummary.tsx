import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { JunkDetectionSummary, JunkNoteDetectionService } from '../../services/JunkNoteDetectionService';
import { JunkNoteCategory, JunkConfidence } from '../../agents/JunkNoteDetectorAgent';

interface JunkDetectionSummaryProps {
  summary: JunkDetectionSummary;
  showDetails?: boolean;
}

/**
 * Component for displaying junk detection analysis summary
 */
export const JunkDetectionSummaryComponent: React.FC<JunkDetectionSummaryProps> = ({
  summary,
  showDetails = true
}) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatProcessingTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getCategoryIcon = (category: JunkNoteCategory): string => {
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

  const getCategoryLabel = (category: JunkNoteCategory): string => {
    switch (category) {
      case JunkNoteCategory.SHOPPING_LIST:
        return 'Shopping Lists';
      case JunkNoteCategory.SCRATCH_PAD:
        return 'Scratch Pads';
      case JunkNoteCategory.EXPIRED_REMINDER:
        return 'Expired Reminders';
      case JunkNoteCategory.EMPTY_NOTE:
        return 'Empty Notes';
      case JunkNoteCategory.TEMPORARY_LIST:
        return 'Temporary Lists';
      case JunkNoteCategory.COMPLETED_TASK:
        return 'Completed Tasks';
      case JunkNoteCategory.OUTDATED_INFO:
        return 'Outdated Info';
      default:
        return 'Unknown';
    }
  };

  const getConfidenceColor = (confidence: JunkConfidence): string => {
    switch (confidence) {
      case JunkConfidence.HIGH:
        return '#4CAF50'; // Green
      case JunkConfidence.MEDIUM:
        return '#FF9800'; // Orange
      case JunkConfidence.LOW:
        return '#FFC107'; // Amber
      case JunkConfidence.UNCERTAIN:
        return '#9E9E9E'; // Gray
      default:
        return '#9E9E9E';
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

  const junkPercentage = summary.totalNotesAnalyzed > 0 
    ? Math.round((summary.junkNotesFound / summary.totalNotesAnalyzed) * 100)
    : 0;

  return (
    <ScrollView style={styles.container}>
      {/* Overview Section */}
      <View style={styles.overviewSection}>
        <Text style={styles.sectionTitle}>Junk Detection Summary</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{summary.totalNotesAnalyzed}</Text>
            <Text style={styles.statLabel}>Notes Analyzed</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF5722' }]}>
              {summary.junkNotesFound}
            </Text>
            <Text style={styles.statLabel}>Junk Found</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
              {junkPercentage}%
            </Text>
            <Text style={styles.statLabel}>Junk Rate</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#2196F3' }]}>
              {formatBytes(summary.estimatedStorageSavings)}
            </Text>
            <Text style={styles.statLabel}>Storage Savings</Text>
          </View>
        </View>
        
        <View style={styles.processingInfo}>
          <Text style={styles.processingText}>
            Analysis completed in {formatProcessingTime(summary.processingTime)}
          </Text>
        </View>
      </View>

      {showDetails && (
        <>
          {/* Category Breakdown */}
          {summary.categoryCounts.size > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Junk Categories Found</Text>
              {Array.from(summary.categoryCounts.entries()).map(([category, count]) => (
                <View key={category} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryIcon}>{getCategoryIcon(category)}</Text>
                    <Text style={styles.categoryName}>{getCategoryLabel(category)}</Text>
                  </View>
                  <View style={styles.categoryCount}>
                    <Text style={styles.countNumber}>{count}</Text>
                    <Text style={styles.countLabel}>notes</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Confidence Distribution */}
          {summary.confidenceDistribution.size > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Confidence Levels</Text>
              {Array.from(summary.confidenceDistribution.entries()).map(([confidence, count]) => (
                <View key={confidence} style={styles.confidenceItem}>
                  <View style={styles.confidenceHeader}>
                    <View 
                      style={[
                        styles.confidenceDot, 
                        { backgroundColor: getConfidenceColor(confidence) }
                      ]} 
                    />
                    <Text style={styles.confidenceName}>{getConfidenceLabel(confidence)}</Text>
                  </View>
                  <View style={styles.confidenceCount}>
                    <Text style={styles.countNumber}>{count}</Text>
                    <Text style={styles.countLabel}>notes</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Steps</Text>
            
            {summary.junkNotesFound > 0 ? (
              <View style={styles.recommendationsList}>
                <View style={styles.recommendationItem}>
                  <Text style={styles.recommendationIcon}>🔍</Text>
                  <Text style={styles.recommendationText}>
                    Review the {summary.junkNotesFound} identified junk notes before taking action
                  </Text>
                </View>
                
                <View style={styles.recommendationItem}>
                  <Text style={styles.recommendationIcon}>🗑️</Text>
                  <Text style={styles.recommendationText}>
                    Consider archiving or deleting notes with high confidence scores
                  </Text>
                </View>
                
                <View style={styles.recommendationItem}>
                  <Text style={styles.recommendationIcon}>⚠️</Text>
                  <Text style={styles.recommendationText}>
                    Manually review uncertain classifications to improve accuracy
                  </Text>
                </View>
                
                {summary.estimatedStorageSavings > 1024 * 1024 && (
                  <View style={styles.recommendationItem}>
                    <Text style={styles.recommendationIcon}>💾</Text>
                    <Text style={styles.recommendationText}>
                      Cleaning up junk notes could free up {formatBytes(summary.estimatedStorageSavings)} of storage
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noJunkFound}>
                <Text style={styles.noJunkIcon}>✨</Text>
                <Text style={styles.noJunkText}>
                  Great! No junk notes were found in your library.
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  overviewSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  processingInfo: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  processingText: {
    fontSize: 14,
    color: '#666',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#333',
  },
  categoryCount: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5722',
  },
  countLabel: {
    fontSize: 12,
    color: '#666',
  },
  confidenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  confidenceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  confidenceName: {
    fontSize: 16,
    color: '#333',
  },
  confidenceCount: {
    alignItems: 'center',
  },
  recommendationsList: {
    marginTop: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recommendationIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    color: '#444',
    flex: 1,
    lineHeight: 20,
  },
  noJunkFound: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noJunkIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noJunkText: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
  },
});