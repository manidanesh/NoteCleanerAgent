import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Recommendation, RecommendationAction } from '../../models/Recommendation';
import { Note } from '../../models/Note';
import { UtilityScore } from '../../models/UtilityScore';

interface DetailViewProps {
  recommendation: Recommendation;
  note: Note;
  utilityScore?: UtilityScore;
  visible: boolean;
  onClose: () => void;
  onAction: (recommendationId: string, action: 'approve' | 'reject') => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  recommendation,
  note,
  utilityScore,
  visible,
  onClose,
  onAction,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['content']));
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleApprove = async () => {
    if (recommendation.action === RecommendationAction.DELETE) {
      Alert.alert(
        'Confirm Deletion',
        `Are you sure you want to delete "${note.title}"? This action can be undone later.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: () => executeAction('approve')
          },
        ]
      );
    } else {
      executeAction('approve');
    }
  };

  const executeAction = async (action: 'approve' | 'reject') => {
    setIsProcessing(true);
    try {
      await onAction(recommendation.id, action);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getActionDescription = (action: RecommendationAction): string => {
    switch (action) {
      case RecommendationAction.DELETE:
        return 'This note will be permanently deleted from your Apple Notes library.';
      case RecommendationAction.ARCHIVE:
        return 'This note will be moved to an archive folder to reduce clutter.';
      case RecommendationAction.MERGE_DUPLICATES:
        return 'This note will be merged with similar notes to eliminate duplicates.';
      case RecommendationAction.RENAME:
        return 'This note will be given a more descriptive title based on its content.';
      case RecommendationAction.REVIEW:
        return 'This note requires manual review to determine the best action.';
      case RecommendationAction.KEEP:
        return 'This note will remain unchanged in your library.';
      default:
        return 'An action will be performed on this note.';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recommendation Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {/* Recommendation Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Action</Text>
            <View style={styles.actionSummary}>
              <Text style={styles.actionTitle}>
                {recommendation.action.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.actionDescription}>
                {getActionDescription(recommendation.action)}
              </Text>
              <Text style={styles.confidenceText}>
                Confidence: {Math.round(recommendation.confidence * 100)}%
              </Text>
            </View>
          </View>

          {/* Note Content */}
          <TouchableOpacity
            style={styles.section}
            onPress={() => toggleSection('content')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Note Content</Text>
              <Text style={styles.expandIcon}>
                {expandedSections.has('content') ? '▼' : '▶'}
              </Text>
            </View>
            {expandedSections.has('content') && (
              <View style={styles.noteContent}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteText}>{note.content}</Text>
                <View style={styles.noteMetadata}>
                  <Text style={styles.metadataText}>
                    Created: {formatDate(note.createdDate)}
                  </Text>
                  <Text style={styles.metadataText}>
                    Modified: {formatDate(note.modifiedDate)}
                  </Text>
                  <Text style={styles.metadataText}>
                    Folder: {note.folder}
                  </Text>
                  <Text style={styles.metadataText}>
                    Words: {note.metadata.wordCount}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* AI Analysis */}
          <TouchableOpacity
            style={styles.section}
            onPress={() => toggleSection('analysis')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Analysis</Text>
              <Text style={styles.expandIcon}>
                {expandedSections.has('analysis') ? '▼' : '▶'}
              </Text>
            </View>
            {expandedSections.has('analysis') && (
              <View style={styles.analysisContent}>
                <Text style={styles.reasoningTitle}>Reasoning:</Text>
                <Text style={styles.reasoningText}>{recommendation.reasoning}</Text>
                
                {utilityScore && (
                  <>
                    <Text style={styles.scoreTitle}>Utility Score: {utilityScore.overallScore}/100</Text>
                    <Text style={styles.scoreExplanation}>{utilityScore.explanation}</Text>
                    
                    <View style={styles.scoreBreakdown}>
                      <Text style={styles.scoreBreakdownTitle}>Score Breakdown:</Text>
                      <Text style={styles.scoreItem}>
                        Content: {utilityScore.contentScore}/100
                      </Text>
                      <Text style={styles.scoreItem}>
                        Behavioral: {utilityScore.behavioralScore}/100
                      </Text>
                      <Text style={styles.scoreItem}>
                        Semantic: {utilityScore.semanticScore}/100
                      </Text>
                      <Text style={styles.scoreItem}>
                        Rule-based: {utilityScore.ruleBasedScore}/100
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Attachments & Checklists */}
          {(note.attachments.length > 0 || note.checklists.length > 0) && (
            <TouchableOpacity
              style={styles.section}
              onPress={() => toggleSection('attachments')}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Additional Content</Text>
                <Text style={styles.expandIcon}>
                  {expandedSections.has('attachments') ? '▼' : '▶'}
                </Text>
              </View>
              {expandedSections.has('attachments') && (
                <View style={styles.additionalContent}>
                  {note.attachments.length > 0 && (
                    <View style={styles.attachmentsSection}>
                      <Text style={styles.subsectionTitle}>Attachments ({note.attachments.length})</Text>
                      {note.attachments.map(attachment => (
                        <View key={attachment.id} style={styles.attachmentItem}>
                          <Text style={styles.attachmentName}>{attachment.filename}</Text>
                          <Text style={styles.attachmentType}>{attachment.type}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {note.checklists.length > 0 && (
                    <View style={styles.checklistsSection}>
                      <Text style={styles.subsectionTitle}>Checklists</Text>
                      {note.checklists.map(item => (
                        <View key={item.id} style={styles.checklistItem}>
                          <Text style={styles.checklistText}>
                            {item.completed ? '☑' : '☐'} {item.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Related Notes */}
          {recommendation.relatedNotes && recommendation.relatedNotes.length > 0 && (
            <TouchableOpacity
              style={styles.section}
              onPress={() => toggleSection('related')}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Related Notes</Text>
                <Text style={styles.expandIcon}>
                  {expandedSections.has('related') ? '▼' : '▶'}
                </Text>
              </View>
              {expandedSections.has('related') && (
                <View style={styles.relatedNotes}>
                  {recommendation.relatedNotes.map(noteId => (
                    <Text key={noteId} style={styles.relatedNoteItem}>
                      • Note ID: {noteId}
                    </Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => executeAction('reject')}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    fontSize: 18,
    color: '#6c757d',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  expandIcon: {
    fontSize: 14,
    color: '#6c757d',
  },
  actionSummary: {
    padding: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  noteContent: {
    padding: 16,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 24,
    marginBottom: 16,
  },
  noteMetadata: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  analysisContent: {
    padding: 16,
  },
  reasoningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  scoreExplanation: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 16,
  },
  scoreBreakdown: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  scoreBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  scoreItem: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  additionalContent: {
    padding: 16,
  },
  attachmentsSection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  attachmentName: {
    fontSize: 14,
    color: '#495057',
  },
  attachmentType: {
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
  },
  checklistsSection: {
    marginBottom: 16,
  },
  checklistItem: {
    paddingVertical: 2,
  },
  checklistText: {
    fontSize: 14,
    color: '#495057',
  },
  relatedNotes: {
    padding: 16,
  },
  relatedNoteItem: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#6c757d',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});