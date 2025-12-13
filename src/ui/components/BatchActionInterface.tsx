import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Recommendation } from '../../models/Recommendation';
import { Note } from '../../models/Note';
import { RecommendationActionService, ActionResult } from '../../services/RecommendationActionService';

interface BatchActionInterfaceProps {
  selectedRecommendations: Array<{ recommendation: Recommendation; note: Note }>;
  actionService: RecommendationActionService;
  onBatchComplete: (results: BatchActionResult[]) => void;
  onCancel: () => void;
}

interface BatchActionResult {
  recommendationId: string;
  action: 'approve' | 'reject';
  result: ActionResult;
  noteTitle: string;
}

export const BatchActionInterface: React.FC<BatchActionInterfaceProps> = ({
  selectedRecommendations,
  actionService,
  onBatchComplete,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [results, setResults] = useState<BatchActionResult[]>([]);
  
  const selectedCount = selectedRecommendations.length;

  const handleApprove = () => {
    // Get prioritized recommendations for safer batch processing
    const prioritized = actionService.prioritizeRecommendations(
      selectedRecommendations.map(item => item.recommendation)
    );
    
    const highRiskCount = prioritized.filter(rec => 
      rec.action === 'delete' || rec.confidence < 0.8
    ).length;
    
    const warningMessage = highRiskCount > 0 
      ? `\n\n⚠️ ${highRiskCount} high-risk action${highRiskCount > 1 ? 's' : ''} included. Please review carefully.`
      : '';
    
    Alert.alert(
      'Confirm Batch Approval',
      `Are you sure you want to approve ${selectedCount} recommendation${selectedCount > 1 ? 's' : ''}? This will execute all selected actions.${warningMessage}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Approve All', 
          style: 'default',
          onPress: () => executeBatchActions('approve')
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Confirm Batch Rejection',
      `Are you sure you want to reject ${selectedCount} recommendation${selectedCount > 1 ? 's' : ''}? This will dismiss all selected recommendations and record feedback for learning.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject All', 
          style: 'destructive',
          onPress: () => executeBatchActions('reject')
        },
      ]
    );
  };

  const executeBatchActions = async (action: 'approve' | 'reject') => {
    setIsProcessing(true);
    setResults([]);
    const batchResults: BatchActionResult[] = [];
    
    try {
      // Process recommendations in priority order for approvals
      const itemsToProcess = action === 'approve' 
        ? prioritizeForBatch(selectedRecommendations)
        : selectedRecommendations;
      
      for (let i = 0; i < itemsToProcess.length; i++) {
        const { recommendation, note } = itemsToProcess[i];
        setProcessingStatus(`Processing ${i + 1} of ${itemsToProcess.length}: ${note.title}`);
        
        try {
          let result: ActionResult;
          
          if (action === 'approve') {
            result = await actionService.executeRecommendation(recommendation, note, true);
          } else {
            result = await actionService.rejectRecommendation(recommendation, note, 'Batch rejection');
          }
          
          const batchResult: BatchActionResult = {
            recommendationId: recommendation.id,
            action,
            result,
            noteTitle: note.title
          };
          
          batchResults.push(batchResult);
          setResults(prev => [...prev, batchResult]);
          
          // Small delay to prevent overwhelming the system
          if (i < itemsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          console.error(`Failed to process recommendation ${recommendation.id}:`, error);
          const errorResult: BatchActionResult = {
            recommendationId: recommendation.id,
            action,
            result: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              reversible: false
            },
            noteTitle: note.title
          };
          batchResults.push(errorResult);
          setResults(prev => [...prev, errorResult]);
        }
      }
      
      // Show completion summary
      const successCount = batchResults.filter(r => r.result.success).length;
      const failureCount = batchResults.length - successCount;
      
      let summaryMessage = `Batch ${action} completed.\n${successCount} successful`;
      if (failureCount > 0) {
        summaryMessage += `, ${failureCount} failed`;
      }
      
      Alert.alert('Batch Complete', summaryMessage);
      onBatchComplete(batchResults);
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      Alert.alert('Batch Failed', 'An unexpected error occurred during batch processing.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const prioritizeForBatch = (items: Array<{ recommendation: Recommendation; note: Note }>) => {
    // Sort by safety: safer actions first, then by confidence
    return [...items].sort((a, b) => {
      const aSafety = getSafetyScore(a.recommendation);
      const bSafety = getSafetyScore(b.recommendation);
      
      if (aSafety !== bSafety) {
        return bSafety - aSafety; // Higher safety first
      }
      
      return b.recommendation.confidence - a.recommendation.confidence;
    });
  };

  const getSafetyScore = (recommendation: Recommendation): number => {
    // Higher score = safer action
    let score = recommendation.confidence * 100;
    
    switch (recommendation.action) {
      case 'delete':
        score -= 30; // Deletion is riskier
        break;
      case 'merge_duplicates':
        score -= 20; // Merging has some risk
        break;
      case 'archive':
        score -= 5; // Archiving is fairly safe
        break;
      case 'rename':
        score += 10; // Renaming is very safe
        break;
    }
    
    return score;
  };

  const getActionSummary = () => {
    const actionCounts = selectedRecommendations.reduce((acc, { recommendation }) => {
      const action = recommendation.action;
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const actionIcons: Record<string, string> = {
      'delete': '🗑️',
      'archive': '📦',
      'rename': '✏️',
      'merge_duplicates': '🔗',
      'keep': '📌',
      'review': '👀'
    };

    return Object.entries(actionCounts).map(([action, count]) => ({
      action: action.replace('_', ' '),
      count,
      icon: actionIcons[action] || '📝'
    }));
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Batch Actions</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!isProcessing ? (
              <>
                <Text style={styles.description}>
                  You have selected {selectedCount} recommendation{selectedCount > 1 ? 's' : ''}.
                </Text>
                <Text style={styles.subDescription}>
                  Choose an action to apply to all selected recommendations:
                </Text>

                {/* Recommendation Summary */}
                <View style={styles.summarySection}>
                  <Text style={styles.summaryTitle}>Selected Actions:</Text>
                  {getActionSummary().map((summary, index) => (
                    <View key={index} style={styles.summaryItem}>
                      <Text style={styles.summaryIcon}>{summary.icon}</Text>
                      <Text style={styles.summaryText}>
                        {summary.count} × {summary.action}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={handleReject}
                    disabled={isProcessing}
                  >
                    <Text style={styles.rejectButtonText}>Reject All</Text>
                    <Text style={styles.buttonSubtext}>
                      Dismiss all selected recommendations
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={handleApprove}
                    disabled={isProcessing}
                  >
                    <Text style={styles.approveButtonText}>Approve All</Text>
                    <Text style={styles.buttonSubtext}>
                      Execute all selected actions
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Safety Notice */}
                <View style={styles.safetyNotice}>
                  <Text style={styles.safetyTitle}>⚠️ Safety Notice</Text>
                  <Text style={styles.safetyText}>
                    Actions will be processed in order of safety. Most actions are reversible through the undo history.
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Processing Status */}
                <View style={styles.processingSection}>
                  <Text style={styles.processingTitle}>Processing Batch Actions</Text>
                  <Text style={styles.processingStatus}>{processingStatus}</Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${(results.length / selectedCount) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {results.length} of {selectedCount} completed
                  </Text>
                </View>

                {/* Results */}
                {results.length > 0 && (
                  <View style={styles.resultsSection}>
                    <Text style={styles.resultsTitle}>Results:</Text>
                    {results.map((result, index) => (
                      <View key={index} style={styles.resultItem}>
                        <Text style={styles.resultIcon}>
                          {result.result.success ? '✅' : '❌'}
                        </Text>
                        <View style={styles.resultDetails}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            {result.noteTitle}
                          </Text>
                          <Text style={styles.resultMessage}>
                            {result.result.success 
                              ? (result.result.message || `${result.action} successful`)
                              : (result.result.error || `${result.action} failed`)
                            }
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>
                {isProcessing ? 'Processing...' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6c757d',
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 24,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
  },
  safetyNotice: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
  summarySection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#495057',
  },
  processingSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  processingStatus: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
  },
  resultsSection: {
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  resultDetails: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  resultMessage: {
    fontSize: 12,
    color: '#6c757d',
  },
});