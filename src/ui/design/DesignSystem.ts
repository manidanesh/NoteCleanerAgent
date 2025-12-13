/**
 * Visual Design System for Notes AI Organizer
 * Implements Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { RecommendationAction, ImpactLevel } from '../../models/Recommendation';

// Color Palette
export const Colors = {
  // Primary Colors
  primary: '#007bff',
  primaryDark: '#0056b3',
  primaryLight: '#66b3ff',
  
  // Utility Score Colors (Requirement 12.1)
  utilityHigh: '#28a745',      // Green for high utility (70-100)
  utilityMedium: '#ffc107',    // Yellow for medium utility (40-69)
  utilityLow: '#dc3545',       // Red for low utility (0-39)
  
  // Recommendation Action Colors (Requirement 12.2)
  actionDelete: '#dc3545',     // Red for delete actions
  actionArchive: '#6c757d',    // Gray for archive actions
  actionMerge: '#17a2b8',      // Teal for merge actions
  actionRename: '#fd7e14',     // Orange for rename actions
  actionReview: '#ffc107',     // Yellow for review actions
  actionKeep: '#28a745',       // Green for keep actions
  
  // Duplicate Group Colors (Requirement 12.3)
  duplicateGroup: '#e3f2fd',   // Light blue background
  duplicateBorder: '#2196f3',  // Blue border
  duplicateHighlight: '#ffeb3b', // Yellow highlight for differences
  
  // Semantic Colors
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
  
  // Neutral Colors
  white: '#ffffff',
  gray50: '#f8f9fa',
  gray100: '#e9ecef',
  gray200: '#dee2e6',
  gray300: '#ced4da',
  gray400: '#adb5bd',
  gray500: '#6c757d',
  gray600: '#495057',
  gray700: '#343a40',
  gray800: '#212529',
  gray900: '#1a1a1a',
  
  // Background Colors
  background: '#f8f9fa',
  surface: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // High Contrast Mode Colors (Requirement 12.4)
  highContrastText: '#000000',
  highContrastBackground: '#ffffff',
  highContrastBorder: '#000000',
};

// Typography Scale (Requirement 12.4 - Dynamic Type support)
export const Typography = {
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: Colors.gray900,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
    color: Colors.gray900,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
    color: Colors.gray900,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: Colors.gray900,
  },
  
  // Body Text
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: Colors.gray700,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: Colors.gray600,
  },
  
  // Captions and Labels
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: Colors.gray500,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 18,
    color: Colors.gray700,
  },
  
  // Button Text
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  
  // Accessibility - Large Text Support
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 26,
    color: Colors.gray700,
  },
  captionLarge: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: Colors.gray500,
  },
};

// Spacing Scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border Radius
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 50,
};

// Shadow Styles
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Utility Score Styling Functions (Requirement 12.1)
export const getUtilityScoreColor = (score: number): string => {
  if (score >= 70) return Colors.utilityHigh;
  if (score >= 40) return Colors.utilityMedium;
  return Colors.utilityLow;
};

export const getUtilityScoreLabel = (score: number): string => {
  if (score >= 70) return 'High Utility';
  if (score >= 40) return 'Medium Utility';
  return 'Low Utility';
};

export const getUtilityScoreStyle = (score: number): ViewStyle => ({
  backgroundColor: getUtilityScoreColor(score),
  paddingHorizontal: Spacing.sm,
  paddingVertical: Spacing.xs,
  borderRadius: BorderRadius.md,
});

// Recommendation Action Styling Functions (Requirement 12.2)
export const getActionIcon = (action: RecommendationAction): string => {
  const icons = {
    [RecommendationAction.DELETE]: '🗑️',
    [RecommendationAction.ARCHIVE]: '📦',
    [RecommendationAction.MERGE_DUPLICATES]: '🔗',
    [RecommendationAction.RENAME]: '✏️',
    [RecommendationAction.REVIEW]: '👀',
    [RecommendationAction.KEEP]: '📌',
  };
  return icons[action] || '📝';
};

export const getActionColor = (action: RecommendationAction): string => {
  const colors = {
    [RecommendationAction.DELETE]: Colors.actionDelete,
    [RecommendationAction.ARCHIVE]: Colors.actionArchive,
    [RecommendationAction.MERGE_DUPLICATES]: Colors.actionMerge,
    [RecommendationAction.RENAME]: Colors.actionRename,
    [RecommendationAction.REVIEW]: Colors.actionReview,
    [RecommendationAction.KEEP]: Colors.actionKeep,
  };
  return colors[action] || Colors.primary;
};

export const getActionLabel = (action: RecommendationAction): string => {
  const labels = {
    [RecommendationAction.DELETE]: 'Delete',
    [RecommendationAction.ARCHIVE]: 'Archive',
    [RecommendationAction.MERGE_DUPLICATES]: 'Merge Duplicates',
    [RecommendationAction.RENAME]: 'Rename',
    [RecommendationAction.REVIEW]: 'Review',
    [RecommendationAction.KEEP]: 'Keep',
  };
  return labels[action] || action;
};

// Impact Level Styling Functions
export const getImpactColor = (impact: ImpactLevel): string => {
  const colors = {
    [ImpactLevel.HIGH]: Colors.danger,
    [ImpactLevel.MEDIUM]: Colors.warning,
    [ImpactLevel.LOW]: Colors.success,
  };
  return colors[impact] || Colors.gray500;
};

export const getImpactBorderStyle = (impact: ImpactLevel): ViewStyle => ({
  borderLeftWidth: 4,
  borderLeftColor: getImpactColor(impact),
});

// Duplicate Group Styling Functions (Requirement 12.3)
export const getDuplicateGroupStyle = (): ViewStyle => ({
  backgroundColor: Colors.duplicateGroup,
  borderWidth: 1,
  borderColor: Colors.duplicateBorder,
  borderRadius: BorderRadius.lg,
  padding: Spacing.md,
});

export const getDuplicateHighlightStyle = (): ViewStyle => ({
  backgroundColor: Colors.duplicateHighlight,
  paddingHorizontal: Spacing.xs,
  borderRadius: BorderRadius.sm,
});

// Accessibility Helpers (Requirement 12.4)
export const getAccessibleTextStyle = (
  baseStyle: TextStyle,
  isHighContrast: boolean = false,
  isLargeText: boolean = false
): TextStyle => {
  let style = { ...baseStyle };
  
  if (isHighContrast) {
    style.color = Colors.highContrastText;
  }
  
  if (isLargeText) {
    style.fontSize = (style.fontSize || 16) * 1.2;
    style.lineHeight = (style.lineHeight || 20) * 1.2;
  }
  
  return style;
};

export const getAccessibleContainerStyle = (
  baseStyle: ViewStyle,
  isHighContrast: boolean = false
): ViewStyle => {
  let style = { ...baseStyle };
  
  if (isHighContrast) {
    style.backgroundColor = Colors.highContrastBackground;
    style.borderColor = Colors.highContrastBorder;
    style.borderWidth = 1;
  }
  
  return style;
};

// Non-technical Explanation Formatting (Requirement 12.5)
export const ExplanationStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  title: {
    ...Typography.label,
    color: Colors.gray800,
    marginBottom: Spacing.xs,
  },
  text: {
    ...Typography.body2,
    color: Colors.gray600,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  highlight: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    color: Colors.gray800,
    fontWeight: '500',
  },
  confidence: {
    ...Typography.caption,
    color: Colors.gray500,
    marginTop: Spacing.xs,
  },
});

// Component Base Styles
export const ComponentStyles = StyleSheet.create({
  // Cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: Colors.gray100,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  dangerButton: {
    backgroundColor: Colors.danger,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  
  // Input Fields
  input: {
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    color: Colors.gray800,
    backgroundColor: Colors.surface,
  },
  
  // Badges
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Sections
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  sectionContent: {
    padding: Spacing.lg,
  },
});

// Accessibility Constants (Requirement 12.4)
export const AccessibilityLabels = {
  utilityScore: (score: number) => `Utility score: ${score} out of 100. ${getUtilityScoreLabel(score)}`,
  recommendationAction: (action: RecommendationAction) => `Recommended action: ${getActionLabel(action)}`,
  impactLevel: (impact: ImpactLevel) => `Impact level: ${impact}`,
  duplicateGroup: 'Group of duplicate notes',
  reversibleAction: 'This action can be undone',
  irreversibleAction: 'This action cannot be undone',
  processingStatus: (step: string, progress: number) => `Processing: ${step}. ${progress}% complete`,
};

// VoiceOver Hints (Requirement 12.4)
export const AccessibilityHints = {
  recommendationCard: 'Double tap to view details and take action on this recommendation',
  approveButton: 'Double tap to approve and execute this recommendation',
  rejectButton: 'Double tap to reject this recommendation and provide feedback',
  batchAction: 'Double tap to perform action on all selected recommendations',
  undoAction: 'Double tap to undo this action and restore previous state',
  duplicateGroup: 'Double tap to view all notes in this duplicate group',
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  getUtilityScoreColor,
  getUtilityScoreLabel,
  getUtilityScoreStyle,
  getActionIcon,
  getActionColor,
  getActionLabel,
  getImpactColor,
  getImpactBorderStyle,
  getDuplicateGroupStyle,
  getDuplicateHighlightStyle,
  getAccessibleTextStyle,
  getAccessibleContainerStyle,
  ExplanationStyles,
  ComponentStyles,
  AccessibilityLabels,
  AccessibilityHints,
};