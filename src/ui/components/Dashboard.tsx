import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { RecommendationCard } from './RecommendationCard';
import { ProgressIndicator } from './ProgressIndicator';
import { BatchActionInterface } from './BatchActionInterface';
import { UndoHistoryView } from './UndoHistoryView';
import { Recommendation, RecommendationStatus, ImpactLevel } from '../../models/Recommendation';
import { Note } from '../../models/Note';
import { RecommendationActionService } from '../../services/RecommendationActionService';
import { UndoService } from '../../services/UndoService';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  getImpactColor,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
  ComponentStyles,
} from '../design/DesignSystem';
import { useAccessibility } from './AccessibilityProvider';

interface DashboardProps {
  recommendations: Recommendation[];
  notes: Note[];
  processingStatus: ProcessingStatus;
  actionService: RecommendationActionService;
  undoService: UndoService;
  onRecommendationAction: (recommendationId: string, action: 'approve' | 'reject', result?: any) => void;
  onBatchComplete: (results: any[]) => void;
  onRefresh: () => void;
  onRecommendationPress: (recommendation: Recommendation) => void;
}

interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number; // 0-100
  totalNotes: number;
  processedNotes: number;
  estimatedTimeRemaining?: number; // seconds
}

interface DashboardStats {
  totalRecommendations: number;
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  pendingCount: number;
  potentialStorageSavings: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  recommendations,
  notes,
  processingStatus,
  actionService,
  undoService,
  onRecommendationAction,
  onBatchComplete,
  onRefresh,
  onRecommendationPress,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showUndoHistory, setShowUndoHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'history'>('recommendations');
  const { isHighContrastEnabled, isLargeTextEnabled, announceForAccessibility } = useAccessibility();

  const stats = calculateStats(recommendations);
  const highImpactRecommendations = recommendations
    .filter(r => r.impact === ImpactLevel.HIGH && r.status === RecommendationStatus.PENDING)
    .slice(0, 5); // Show top 5 high-impact recommendations

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleRecommendationSelect = (recommendationId: string, selected: boolean) => {
    if (selected) {
      setSelectedRecommendations(prev => [...prev, recommendationId]);
    } else {
      setSelectedRecommendations(prev => prev.filter(id => id !== recommendationId));
    }
  };

  const handleBatchActionPress = () => {
    if (selectedRecommendations.length === 0) {
      Alert.alert('No Selection', 'Please select recommendations to perform batch actions.');
      return;
    }
    setShowBatchActions(true);
  };

  const handleBatchComplete = (results: any[]) => {
    onBatchComplete(results);
    setSelectedRecommendations([]);
    setShowBatchActions(false);
  };

  const getSelectedRecommendationData = () => {
    return selectedRecommendations
      .map(id => {
        const recommendation = recommendations.find(r => r.id === id);
        const note = notes.find(n => n.id === recommendation?.noteId);
        return recommendation && note ? { recommendation, note } : null;
      })
      .filter(Boolean) as Array<{ recommendation: Recommendation; note: Note }>;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Processing Status */}
      {processingStatus.isProcessing && (
        <View style={styles.processingSection}>
          <ProgressIndicator
            progress={processingStatus.progress}
            currentStep={processingStatus.currentStep}
            estimatedTimeRemaining={processingStatus.estimatedTimeRemaining}
          />
        </View>
      )}

      {/* Dashboard Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Analysis Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalRecommendations}</Text>
            <Text style={styles.statLabel}>Total Recommendations</Text>
          </View>
          <View style={[styles.statCard, styles.highImpactCard]}>
            <Text style={[styles.statNumber, styles.highImpactText]}>{stats.highImpactCount}</Text>
            <Text style={styles.statLabel}>High Impact</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.mediumImpactCount}</Text>
            <Text style={styles.statLabel}>Medium Impact</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.potentialStorageSavings}</Text>
            <Text style={styles.statLabel}>Potential Savings</Text>
          </View>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabsSection}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recommendations' && styles.activeTab]}
          onPress={() => setActiveTab('recommendations')}
        >
          <Text style={[styles.tabText, activeTab === 'recommendations' && styles.activeTabText]}>
            Recommendations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
          {undoService.hasUndoableOperations() && (
            <View style={styles.undoBadge}>
              <Text style={styles.undoBadgeText}>!</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'recommendations' && (
        <>
          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleBatchActionPress}
                disabled={selectedRecommendations.length === 0}
              >
                <Text style={styles.actionButtonText}>
                  Batch Actions ({selectedRecommendations.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {activeTab === 'recommendations' && (
        /* High Impact Recommendations */
        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>High Impact Recommendations</Text>
          {highImpactRecommendations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {processingStatus.isProcessing 
                  ? 'Processing your notes...' 
                  : 'No high-impact recommendations at this time'}
              </Text>
            </View>
          ) : (
            highImpactRecommendations.map(recommendation => {
              const note = notes.find(n => n.id === recommendation.noteId);
              return (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  note={note}
                  actionService={actionService}
                  onAction={onRecommendationAction}
                  onPress={() => onRecommendationPress(recommendation)}
                  onSelect={handleRecommendationSelect}
                  isSelected={selectedRecommendations.includes(recommendation.id)}
                  showSelection={selectedRecommendations.length > 0}
                />
              );
            })
          )}
        </View>
      )}

      {activeTab === 'history' && (
        /* Undo History */
        <View style={styles.historySection}>
          <UndoHistoryView
            undoService={undoService}
            onOperationUndone={(operationId, result) => {
              if (result.success) {
                onRefresh(); // Refresh recommendations after undo
              }
            }}
          />
        </View>
      )}

      {/* Batch Action Interface */}
      {showBatchActions && (
        <BatchActionInterface
          selectedRecommendations={getSelectedRecommendationData()}
          actionService={actionService}
          onBatchComplete={handleBatchComplete}
          onCancel={() => setShowBatchActions(false)}
        />
      )}
    </ScrollView>
  );
};

function calculateStats(recommendations: Recommendation[]): DashboardStats {
  const pending = recommendations.filter(r => r.status === RecommendationStatus.PENDING);
  
  return {
    totalRecommendations: recommendations.length,
    highImpactCount: pending.filter(r => r.impact === ImpactLevel.HIGH).length,
    mediumImpactCount: pending.filter(r => r.impact === ImpactLevel.MEDIUM).length,
    lowImpactCount: pending.filter(r => r.impact === ImpactLevel.LOW).length,
    pendingCount: pending.length,
    potentialStorageSavings: estimateStorageSavings(pending),
  };
}

function estimateStorageSavings(recommendations: Recommendation[]): string {
  // Estimate based on delete and archive recommendations
  const deletions = recommendations.filter(r => r.action === 'delete').length;
  const archives = recommendations.filter(r => r.action === 'archive').length;
  
  // Rough estimate: average note size ~2KB
  const estimatedBytes = (deletions * 2048) + (archives * 1024);
  
  if (estimatedBytes < 1024) return `${estimatedBytes}B`;
  if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)}KB`;
  return `${Math.round(estimatedBytes / (1024 * 1024))}MB`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  processingSection: {
    ...ComponentStyles.section,
    margin: Spacing.lg,
  },
  statsSection: {
    ...ComponentStyles.section,
    margin: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  highImpactCard: {
    backgroundColor: '#fff3cd',
    borderColor: Colors.warning,
    borderWidth: 1,
  },
  statNumber: {
    ...Typography.h2,
    fontWeight: 'bold',
  },
  highImpactText: {
    color: '#856404',
  },
  statLabel: {
    ...Typography.caption,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  quickActionsSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  recommendationsSection: {
    margin: 16,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  tabsSection: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#007bff',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6c757d',
  },
  activeTabText: {
    color: '#fff',
  },
  undoBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  undoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  historySection: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});