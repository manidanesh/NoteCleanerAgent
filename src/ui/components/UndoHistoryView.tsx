import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { UndoService, OperationSummary, UndoResult, StateRestorationDetails } from '../../services/UndoService';

interface UndoHistoryViewProps {
  undoService: UndoService;
  onOperationUndone?: (operationId: string, result: UndoResult) => void;
  maxItems?: number;
}

interface HistoryItemProps {
  operation: OperationSummary;
  onUndo: (operationId: string) => void;
  onPreviewRestore: (operationId: string) => void;
  isProcessing: boolean;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ operation, onUndo, onPreviewRestore, isProcessing }) => {
  const handleUndo = () => {
    if (!operation.canUndo) {
      Alert.alert('Cannot Undo', 'This operation cannot be reversed.');
      return;
    }

    Alert.alert(
      'Confirm Undo',
      `Are you sure you want to undo: ${operation.description}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Undo', 
          style: 'default',
          onPress: () => onUndo(operation.id)
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return timestamp.toLocaleDateString();
  };

  const getOperationIcon = (type: string): string => {
    switch (type) {
      case 'delete_note': return '🗑️';
      case 'archive_note': return '📦';
      case 'rename_note': return '✏️';
      case 'merge_notes': return '🔗';
      case 'move_note': return '📁';
      default: return '📝';
    }
  };

  const getOperationColor = (type: string): string => {
    switch (type) {
      case 'delete_note': return '#dc3545';
      case 'archive_note': return '#6c757d';
      case 'rename_note': return '#ffc107';
      case 'merge_notes': return '#17a2b8';
      case 'move_note': return '#28a745';
      default: return '#007bff';
    }
  };

  const getRiskColor = (riskLevel?: string): string => {
    switch (riskLevel) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  return (
    <View style={[styles.historyItem, !operation.canUndo && styles.nonUndoableItem]}>
      <View style={styles.itemHeader}>
        <View style={styles.operationInfo}>
          <Text style={styles.operationIcon}>{getOperationIcon(operation.type)}</Text>
          <View style={styles.operationDetails}>
            <Text style={styles.operationDescription} numberOfLines={2}>
              {operation.description}
            </Text>
            <Text style={styles.operationTimestamp}>
              {formatTimestamp(operation.timestamp)}
            </Text>
          </View>
        </View>
        
        {operation.canUndo && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.previewButton]}
              onPress={() => onPreviewRestore(operation.id)}
              disabled={isProcessing}
            >
              <Text style={styles.previewButtonText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.undoButton, { backgroundColor: getOperationColor(operation.type) }]}
              onPress={handleUndo}
              disabled={isProcessing}
            >
              <Text style={styles.undoButtonText}>
                {isProcessing ? '...' : 'Undo'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Additional operation details */}
      <View style={styles.operationMeta}>
        {operation.affectedItems && operation.affectedItems > 1 && (
          <Text style={styles.metaText}>
            📊 {operation.affectedItems} items affected
          </Text>
        )}
        {operation.riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(operation.riskLevel) }]}>
            <Text style={styles.riskBadgeText}>
              {operation.riskLevel.toUpperCase()} RISK
            </Text>
          </View>
        )}
      </View>
      
      {!operation.canUndo && (
        <Text style={styles.nonUndoableText}>Cannot be undone</Text>
      )}
    </View>
  );
};

export const UndoHistoryView: React.FC<UndoHistoryViewProps> = ({
  undoService,
  onOperationUndone,
  maxItems = 50
}) => {
  const [operations, setOperations] = useState<OperationSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingOperations, setProcessingOperations] = useState<Set<string>>(new Set());
  const [showRestorePreview, setShowRestorePreview] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [restorationDetails, setRestorationDetails] = useState<StateRestorationDetails | null>(null);

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = () => {
    const history = undoService.getOperationHistory(maxItems);
    setOperations(history);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    loadOperations();
    setIsRefreshing(false);
  };

  const handlePreviewRestore = async (operationId: string) => {
    try {
      const preview = undoService.previewStateRestoration(operationId);
      
      if (preview.success && preview.preview) {
        setSelectedOperation(operationId);
        setRestorationDetails(preview.preview);
        setShowRestorePreview(true);
      } else {
        Alert.alert('Preview Failed', preview.error || 'Cannot preview restoration');
      }
    } catch (error) {
      console.error('Preview failed:', error);
      Alert.alert('Error', 'Failed to generate preview');
    }
  };

  const handleUndo = async (operationId: string) => {
    setProcessingOperations(prev => new Set(prev).add(operationId));
    
    try {
      const result = await undoService.undoWithStateRestoration(operationId);
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Operation undone successfully');
        loadOperations(); // Refresh the list
        onOperationUndone?.(operationId, result);
      } else {
        Alert.alert('Undo Failed', result.error || 'Failed to undo operation');
      }
    } catch (error) {
      console.error('Undo failed:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setProcessingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
    }
  };

  const handleConfirmRestore = async () => {
    if (!selectedOperation) return;
    
    setShowRestorePreview(false);
    await handleUndo(selectedOperation);
    setSelectedOperation(null);
    setRestorationDetails(null);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all operation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            undoService.clearHistory();
            setOperations([]);
          }
        },
      ]
    );
  };

  const renderHistoryItem = ({ item }: { item: OperationSummary }) => (
    <HistoryItem
      operation={item}
      onUndo={handleUndo}
      onPreviewRestore={handlePreviewRestore}
      isProcessing={processingOperations.has(item.id)}
    />
  );

  const renderStateRestorationPreview = () => {
    if (!restorationDetails) return null;

    return (
      <Modal
        visible={showRestorePreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRestorePreview(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>State Restoration Preview</Text>
            <TouchableOpacity
              onPress={() => setShowRestorePreview(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Restoration Steps */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>🔄 Restoration Steps</Text>
              {restorationDetails.restorationSteps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Estimated Time */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>⏱️ Estimated Time</Text>
              <Text style={styles.estimatedTime}>
                {restorationDetails.estimatedTime} seconds
              </Text>
            </View>

            {/* Changes Preview */}
            {restorationDetails.changesPreview.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>📋 Changes to Restore</Text>
                {restorationDetails.changesPreview.map((change, index) => (
                  <View key={index} style={styles.changeItem}>
                    <View style={styles.changeHeader}>
                      <Text style={styles.changeField}>{change.field}</Text>
                      <View style={[
                        styles.changeTypeBadge,
                        { backgroundColor: getChangeTypeColor(change.changeType) }
                      ]}>
                        <Text style={styles.changeTypeBadgeText}>
                          {change.changeType.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.changeValue}>
                      From: {String(change.currentValue).substring(0, 100)}
                      {String(change.currentValue).length > 100 ? '...' : ''}
                    </Text>
                    <Text style={styles.changeValue}>
                      To: {String(change.originalValue).substring(0, 100)}
                      {String(change.originalValue).length > 100 ? '...' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Potential Issues */}
            {restorationDetails.potentialIssues.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>⚠️ Potential Issues</Text>
                {restorationDetails.potentialIssues.map((issue, index) => (
                  <View key={index} style={styles.issueItem}>
                    <Text style={styles.issueBullet}>•</Text>
                    <Text style={styles.issueText}>{issue}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowRestorePreview(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmRestore}
            >
              <Text style={styles.confirmButtonText}>Restore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📝</Text>
      <Text style={styles.emptyStateTitle}>No Operations Yet</Text>
      <Text style={styles.emptyStateDescription}>
        When you approve recommendations, they'll appear here with undo options.
      </Text>
    </View>
  );

  const undoableCount = operations.filter(op => op.canUndo).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Operation History</Text>
        {operations.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {undoableCount > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {undoableCount} operation{undoableCount !== 1 ? 's' : ''} can be undone
          </Text>
        </View>
      )}

      <FlatList
        data={operations}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={operations.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007bff"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
      
      {renderStateRestorationPreview()}
    </View>
  );

};

// Helper method for change type colors
const getChangeTypeColor = (changeType: string): string => {
  switch (changeType) {
    case 'added': return '#28a745';
    case 'removed': return '#dc3545';
    case 'modified': return '#ffc107';
    default: return '#6c757d';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#dc3545',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryBar: {
    backgroundColor: '#e7f3ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#b3d9ff',
  },
  summaryText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },
  historyItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  nonUndoableItem: {
    opacity: 0.7,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  operationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  operationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  operationDetails: {
    flex: 1,
  },
  operationDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  operationTimestamp: {
    fontSize: 12,
    color: '#6c757d',
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  undoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  nonUndoableText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  previewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  previewButtonText: {
    color: '#495057',
    fontSize: 14,
    fontWeight: '500',
  },
  operationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#6c757d',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6c757d',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  previewSection: {
    marginVertical: 16,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007bff',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  estimatedTime: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007bff',
  },
  changeItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeField: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  changeTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeTypeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  changeValue: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueBullet: {
    fontSize: 14,
    color: '#ffc107',
    marginRight: 8,
    marginTop: 2,
  },
  issueText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6c757d',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007bff',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});