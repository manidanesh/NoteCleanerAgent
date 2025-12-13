import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { DesignSystem } from '../design/DesignSystem';

interface ExampleRecommendation {
  id: string;
  noteTitle: string;
  noteContent: string;
  action: 'delete' | 'merge' | 'rename' | 'archive';
  utilityScore: number;
  reasoning: string;
  aiExplanation: string;
  confidence: number;
}

const exampleRecommendations: ExampleRecommendation[] = [
  {
    id: '1',
    noteTitle: 'Shopping List',
    noteContent: 'Milk\nBread\nEggs\nButter\n\nBought on 2023-10-15',
    action: 'delete',
    utilityScore: 15,
    reasoning: 'Completed shopping list from over a month ago',
    aiExplanation: 'This appears to be a completed shopping list with a completion date. The content suggests all items were purchased, and the age (over 30 days) indicates it\'s no longer relevant.',
    confidence: 92
  },
  {
    id: '2',
    noteTitle: 'Meeting Notes',
    noteContent: 'Project kickoff meeting\n- Timeline: 6 months\n- Budget: $50k\n- Team: Sarah, Mike, Alex\n- Next meeting: Friday 2pm',
    action: 'rename',
    utilityScore: 85,
    reasoning: 'Important content but generic title',
    aiExplanation: 'This note contains valuable project information including timeline, budget, and team details. However, the title "Meeting Notes" is too generic. A more specific title like "Project Kickoff - Timeline & Budget" would make it easier to find.',
    confidence: 88
  },
  {
    id: '3',
    noteTitle: 'Recipe Ideas',
    noteContent: 'Pasta with garlic and olive oil\nChicken stir fry\nVegetable soup',
    action: 'merge',
    utilityScore: 70,
    reasoning: 'Similar content found in "Cooking Ideas" note',
    aiExplanation: 'I found another note titled "Cooking Ideas" with overlapping recipe content. Merging these notes would eliminate duplication and create a more comprehensive recipe collection.',
    confidence: 79
  }
];

interface OnboardingExamplesProps {
  onNext: () => void;
  onPrevious: () => void;
}

export const OnboardingExamples: React.FC<OnboardingExamplesProps> = ({ onNext, onPrevious }) => {
  const [selectedExample, setSelectedExample] = useState<string | null>(null);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'delete': return DesignSystem.colors.error;
      case 'merge': return DesignSystem.colors.warning;
      case 'rename': return DesignSystem.colors.info;
      case 'archive': return DesignSystem.colors.secondary;
      default: return DesignSystem.colors.primary;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'delete': return '🗑️';
      case 'merge': return '🔗';
      case 'rename': return '✏️';
      case 'archive': return '📦';
      default: return '📝';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return DesignSystem.colors.success;
    if (score >= 40) return DesignSystem.colors.warning;
    return DesignSystem.colors.error;
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Example AI Recommendations</Text>
      <Text style={styles.subtitle}>
        See how our AI analyzes notes and explains its reasoning
      </Text>

      <View style={styles.examplesList}>
        {exampleRecommendations.map((example) => (
          <TouchableOpacity
            key={example.id}
            style={[
              styles.exampleCard,
              selectedExample === example.id && styles.selectedCard
            ]}
            onPress={() => setSelectedExample(
              selectedExample === example.id ? null : example.id
            )}
          >
            <View style={styles.cardHeader}>
              <View style={styles.noteInfo}>
                <Text style={styles.noteTitle}>{example.noteTitle}</Text>
                <View style={styles.scoreContainer}>
                  <Text style={[styles.scoreText, { color: getScoreColor(example.utilityScore) }]}>
                    {example.utilityScore}/100
                  </Text>
                </View>
              </View>
              <View style={[styles.actionBadge, { backgroundColor: getActionColor(example.action) }]}>
                <Text style={styles.actionIcon}>{getActionIcon(example.action)}</Text>
                <Text style={styles.actionText}>{example.action.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.noteContent} numberOfLines={3}>
              {example.noteContent}
            </Text>

            <Text style={styles.reasoning}>
              💡 {example.reasoning}
            </Text>

            {selectedExample === example.id && (
              <View style={styles.expandedContent}>
                <View style={styles.divider} />
                
                <Text style={styles.sectionTitle}>AI Reasoning Process</Text>
                <Text style={styles.aiExplanation}>
                  {example.aiExplanation}
                </Text>

                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>Confidence Level</Text>
                  <View style={styles.confidenceBar}>
                    <View 
                      style={[
                        styles.confidenceFill, 
                        { 
                          width: `${example.confidence}%`,
                          backgroundColor: example.confidence >= 80 
                            ? DesignSystem.colors.success 
                            : example.confidence >= 60 
                            ? DesignSystem.colors.warning 
                            : DesignSystem.colors.error
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.confidenceText}>{example.confidence}%</Text>
                </View>

                <View style={styles.analysisFactors}>
                  <Text style={styles.factorsTitle}>Analysis Factors:</Text>
                  <Text style={styles.factorItem}>• Content type and structure</Text>
                  <Text style={styles.factorItem}>• Age and last modification date</Text>
                  <Text style={styles.factorItem}>• Usage patterns and frequency</Text>
                  <Text style={styles.factorItem}>• Semantic similarity to other notes</Text>
                </View>
              </View>
            )}

            <Text style={styles.tapHint}>
              {selectedExample === example.id ? 'Tap to collapse' : 'Tap to see AI reasoning'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.keyInsights}>
        <Text style={styles.insightsTitle}>Key Insights</Text>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🎯</Text>
          <Text style={styles.insightText}>
            AI considers multiple factors: content quality, usage patterns, age, and relationships to other notes
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🔍</Text>
          <Text style={styles.insightText}>
            Every recommendation includes clear reasoning so you understand why the AI made that suggestion
          </Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>⚖️</Text>
          <Text style={styles.insightText}>
            Confidence levels help you prioritize which recommendations to review first
          </Text>
        </View>
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={onPrevious}
        >
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={onNext}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: DesignSystem.typography.h3.fontSize,
    fontWeight: DesignSystem.typography.h3.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.sm,
  },
  subtitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    textAlign: 'center',
    marginBottom: DesignSystem.spacing.lg,
  },
  examplesList: {
    marginBottom: DesignSystem.spacing.lg,
  },
  exampleCard: {
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.md,
    borderWidth: 1,
    borderColor: DesignSystem.colors.border,
  },
  selectedCard: {
    borderColor: DesignSystem.colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DesignSystem.spacing.sm,
  },
  noteInfo: {
    flex: 1,
    marginRight: DesignSystem.spacing.md,
  },
  noteTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  scoreContainer: {
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: DesignSystem.typography.caption.fontSize,
    fontWeight: '600',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.xs,
    borderRadius: DesignSystem.borderRadius.sm,
  },
  actionIcon: {
    fontSize: 12,
    marginRight: DesignSystem.spacing.xs,
  },
  actionText: {
    color: DesignSystem.colors.background.primary,
    fontSize: DesignSystem.typography.caption.fontSize,
    fontWeight: '600',
  },
  noteContent: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.sm,
    lineHeight: 18,
  },
  reasoning: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.primary,
    fontStyle: 'italic',
    marginBottom: DesignSystem.spacing.sm,
  },
  expandedContent: {
    marginTop: DesignSystem.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: DesignSystem.colors.border,
    marginBottom: DesignSystem.spacing.md,
  },
  sectionTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
  },
  aiExplanation: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    lineHeight: 20,
    marginBottom: DesignSystem.spacing.md,
  },
  confidenceContainer: {
    marginBottom: DesignSystem.spacing.md,
  },
  confidenceLabel: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: DesignSystem.colors.background.tertiary,
    borderRadius: 4,
    marginBottom: DesignSystem.spacing.xs,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.primary,
    fontWeight: '600',
  },
  analysisFactors: {
    backgroundColor: DesignSystem.colors.background.tertiary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
  },
  factorsTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
  },
  factorItem: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  tapHint: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.tertiary,
    textAlign: 'center',
    marginTop: DesignSystem.spacing.sm,
  },
  keyInsights: {
    backgroundColor: DesignSystem.colors.background.secondary,
    padding: DesignSystem.spacing.lg,
    borderRadius: DesignSystem.borderRadius.lg,
    marginBottom: DesignSystem.spacing.xl,
  },
  insightsTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.md,
    textAlign: 'center',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: DesignSystem.spacing.sm,
  },
  insightIcon: {
    fontSize: 16,
    marginRight: DesignSystem.spacing.sm,
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    lineHeight: 18,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: DesignSystem.spacing.lg,
  },
  button: {
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderRadius: DesignSystem.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: DesignSystem.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: DesignSystem.colors.border,
  },
  primaryButtonText: {
    color: DesignSystem.colors.background.primary,
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: DesignSystem.colors.text.primary,
    fontSize: DesignSystem.typography.body.fontSize,
  },
});