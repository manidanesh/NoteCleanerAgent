import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { DuplicateGroup, MergeType } from '../../models/DuplicateGroup';
import { Note } from '../../models/Note';
import { Recommendation } from '../../models/Recommendation';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  getDuplicateGroupStyle,
  getDuplicateHighlightStyle,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
  AccessibilityLabels,
  AccessibilityHints,
  ComponentStyles,
} from '../design/DesignSystem';

interface DuplicateGroupCardProps {
  duplicateGroup: DuplicateGroup;
  notes: Note[];
  recommendation: Recommendation;
  onPress: () => void;
  onNotePress: (noteId: string) => void;
  isHighContrast?: boolean;
  isLargeText?: boolean;
}

export const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  duplicateGroup,
  notes,
  recommendation,
  onPress,
  onNotePress,
  isHighContrast = false,
  isLargeText = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const primaryNote = notes.find(note => note.id === duplicateGroup.recommendedPrimary);
  const duplicateNotes = notes.filter(note => note.id !== duplicateGroup.recommendedPrimary);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const renderNoteDifferences = (note1: Note, note2: Note) => {
    const differences = [];
    
    // Title differences
    if (note1.title !== note2.title) {
      differences.push({
        type: 'title',
        note1Value: note1.title,
        note2Value: note2.title,
      });
    }
    
    // Content length differences
    if (Math.abs(note1.content.length - note2.content.length) > 50) {
      differences.push({
        type: 'length',
        note1Value: `${note1.content.length} characters`,
        note2Value: `${note2.content.length} characters`,
      });
    }
    
    // Date differences
    if (Math.abs(note1.modifiedDate.getTime() - note2.modifiedDate.getTime()) > 86400000) { // 1 day
      differences.push({
        type: 'date',
        note1Value: note1.modifiedDate.toLocaleDateString(),
        note2Value: note2.modifiedDate.toLocaleDateString(),
      });
    }
    
    return differences;
  };

  const renderNotePreview = (note: Note, isPrimary: boolean = false) => {
    const differences = primaryNote && !isPrimary 
      ? renderNoteDifferences(primaryNote, note)
      : [];
    
    return (
      <TouchableOpacity
        key={note.id}
        style={[
          styles.notePreview,
          isPrimary && styles.primaryNotePreview,
          getAccessibleContainerStyle(styles.notePreview, isHighContrast),
        ]}
        onPress={() => onNotePress(note.id)}
        accessibilityLabel={`${isPrimary ? 'Primary' : 'Duplicate'} note: ${note.title}`}
        accessibilityHint="Double tap to view full note content"
      >
        {/* Note Header */}
        <View style={styles.noteHeader}>
          <View style={styles.noteHeaderLeft}>
            <Text style={[
              styles.noteIndicator,
              isPrimary && styles.primaryIndicator,
              getAccessibleTextStyle(styles.noteIndicator, isHighContrast, isLargeText),
            ]}>
              {isPrimary ? '👑' : '📄'}
            </Text>
            <Text style={[
              styles.noteLabel,
              isPrimary && styles.primaryLabel,
              getAccessibleTextStyle(styles.noteLabel, isHighContrast, isLargeText),
            ]}>
              {isPrimary ? 'Keep This' : 'Duplicate'}
            </Text>
          </View>
          <Text style={[
            styles.similarityScore,
            getAccessibleTextStyle(styles.similarityScore, isHighContrast, isLargeText),
          ]}>
            {Math.round((duplicateGroup.similarityScores[notes.indexOf(note)] || 0) * 100)}% similar
          </Text>
        </View>

        {/* Note Content */}
        <Text style={[
          styles.noteTitle,
          getAccessibleTextStyle(styles.noteTitle, isHighContrast, isLargeText),
        ]} numberOfLines={1}>
          {note.title}
        </Text>
        
        <Text style={[
          styles.noteContent,
          getAccessibleTextStyle(styles.noteContent, isHighContrast, isLargeText),
        ]} numberOfLines={2}>
          {note.content}
        </Text>

        {/* Note Metadata */}
        <View style={styles.noteMetadata}>
          <Text style={[
            styles.metadataText,
            getAccessibleTextStyle(styles.metadataText, isHighContrast, isLargeText),
          ]}>
            Modified: {note.modifiedDate.toLocaleDateString()}
          </Text>
          <Text style={[
            styles.metadataText,
            getAccessibleTextStyle(styles.metadataText, isHighContrast, isLargeText),
          ]}>
            {note.metadata.wordCount} words
          </Text>
        </View>

        {/* Differences Highlight */}
        {differences.length > 0 && (
          <View style={styles.differencesContainer}>
            <Text style={[
              styles.differencesTitle,
              getAccessibleTextStyle(styles.differencesTitle, isHighContrast, isLargeText),
            ]}>
              Key Differences:
            </Text>
            {differences.map((diff, index) => (
              <View key={index} style={styles.differenceItem}>
                <Text style={[
                  styles.differenceType,
                  getAccessibleTextStyle(styles.differenceType, isHighContrast, isLargeText),
                ]}>
                  {diff.type}:
                </Text>
                <View style={getDuplicateHighlightStyle()}>
                  <Text style={[
                    styles.differenceValue,
                    getAccessibleTextStyle(styles.differenceValue, isHighContrast, isLargeText),
                  ]}>
                    {diff.note2Value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      style={[
        ComponentStyles.card,
        getDuplicateGroupStyle(),
        getAccessibleContainerStyle(ComponentStyles.card, isHighContrast),
      ]}
      onPress={onPress}
      accessibilityLabel={AccessibilityLabels.duplicateGroup}
      accessibilityHint={AccessibilityHints.duplicateGroup}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.groupIcon}>🔗</Text>
          <View>
            <Text style={[
              styles.groupTitle,
              getAccessibleTextStyle(styles.groupTitle, isHighContrast, isLargeText),
            ]}>
              Duplicate Group
            </Text>
            <Text style={[
              styles.groupSubtitle,
              getAccessibleTextStyle(styles.groupSubtitle, isHighContrast, isLargeText),
            ]}>
              {duplicateGroup.noteIds.length} similar notes found
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.expandButton}
          onPress={toggleExpanded}
          accessibilityLabel={isExpanded ? 'Collapse group' : 'Expand group'}
        >
          <Text style={[
            styles.expandIcon,
            getAccessibleTextStyle(styles.expandIcon, isHighContrast, isLargeText),
          ]}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Merge Strategy */}
      <View style={styles.strategyContainer}>
        <Text style={[
          styles.strategyTitle,
          getAccessibleTextStyle(styles.strategyTitle, isHighContrast, isLargeText),
        ]}>
          Recommended Action:
        </Text>
        <Text style={[
          styles.strategyText,
          getAccessibleTextStyle(styles.strategyText, isHighContrast, isLargeText),
        ]}>
          {duplicateGroup.mergeStrategy.type === MergeType.KEEP_PRIMARY 
            ? 'Keep the most complete version and archive duplicates'
            : 'Merge content from all versions into one comprehensive note'
          }
        </Text>
      </View>

      {/* Primary Note Preview */}
      {primaryNote && renderNotePreview(primaryNote, true)}

      {/* Duplicate Notes (when expanded) */}
      {isExpanded && (
        <View style={styles.duplicatesContainer}>
          <Text style={[
            styles.duplicatesTitle,
            getAccessibleTextStyle(styles.duplicatesTitle, isHighContrast, isLargeText),
          ]}>
            Duplicate Notes:
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.duplicatesScroll}
          >
            {duplicateNotes.map(note => renderNotePreview(note, false))}
          </ScrollView>
        </View>
      )}

      {/* Conflict Areas */}
      {duplicateGroup.conflictAreas && duplicateGroup.conflictAreas.length > 0 && (
        <View style={styles.conflictsContainer}>
          <Text style={[
            styles.conflictsTitle,
            getAccessibleTextStyle(styles.conflictsTitle, isHighContrast, isLargeText),
          ]}>
            ⚠️ Conflicts to Review:
          </Text>
          {duplicateGroup.conflictAreas.map((conflict, index) => (
            <Text key={index} style={[
              styles.conflictItem,
              getAccessibleTextStyle(styles.conflictItem, isHighContrast, isLargeText),
            ]}>
              • {conflict.field}: {conflict.values.length} conflicting values
            </Text>
          ))}
        </View>
      )}

      {/* Confidence Indicator */}
      <View style={styles.confidenceContainer}>
        <Text style={[
          styles.confidenceText,
          getAccessibleTextStyle(styles.confidenceText, isHighContrast, isLargeText),
        ]}>
          Merge Confidence: {Math.round(recommendation.confidence * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  groupTitle: {
    ...Typography.h4,
    color: Colors.gray800,
  },
  groupSubtitle: {
    ...Typography.caption,
    color: Colors.gray500,
  },
  expandButton: {
    padding: Spacing.sm,
  },
  expandIcon: {
    fontSize: 16,
    color: Colors.gray500,
  },
  strategyContainer: {
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  strategyTitle: {
    ...Typography.label,
    color: Colors.gray800,
    marginBottom: Spacing.xs,
  },
  strategyText: {
    ...Typography.body2,
    color: Colors.gray600,
    fontStyle: 'italic',
  },
  notePreview: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    minWidth: 280,
    marginRight: Spacing.md,
  },
  primaryNotePreview: {
    borderColor: Colors.success,
    borderWidth: 2,
    backgroundColor: '#f8fff9',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteIndicator: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  noteLabel: {
    ...Typography.caption,
    color: Colors.gray600,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  primaryLabel: {
    color: Colors.success,
  },
  primaryIndicator: {
    // Crown emoji already indicates primary
  },
  similarityScore: {
    ...Typography.caption,
    color: Colors.info,
    fontWeight: '600',
  },
  noteTitle: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.gray800,
    marginBottom: Spacing.xs,
  },
  noteContent: {
    ...Typography.body2,
    color: Colors.gray600,
    marginBottom: Spacing.sm,
  },
  noteMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metadataText: {
    ...Typography.caption,
    color: Colors.gray500,
  },
  differencesContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  differencesTitle: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.warning,
    marginBottom: Spacing.xs,
  },
  differenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  differenceType: {
    ...Typography.caption,
    color: Colors.gray600,
    marginRight: Spacing.xs,
    textTransform: 'capitalize',
  },
  differenceValue: {
    ...Typography.caption,
    color: Colors.gray800,
    fontWeight: '500',
  },
  duplicatesContainer: {
    marginTop: Spacing.md,
  },
  duplicatesTitle: {
    ...Typography.label,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  duplicatesScroll: {
    flexDirection: 'row',
  },
  conflictsContainer: {
    backgroundColor: '#fff3cd',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  conflictsTitle: {
    ...Typography.label,
    color: '#856404',
    marginBottom: Spacing.sm,
  },
  conflictItem: {
    ...Typography.body2,
    color: '#856404',
    marginBottom: Spacing.xs,
  },
  confidenceContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  confidenceText: {
    ...Typography.caption,
    color: Colors.gray500,
    fontWeight: '600',
  },
});