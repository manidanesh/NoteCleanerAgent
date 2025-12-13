// UI Components
export { Dashboard } from './Dashboard';
export { RecommendationCard } from './RecommendationCard';
export { DetailView } from './DetailView';
export { BatchActionInterface } from './BatchActionInterface';
export { BulkCleanupInterface } from './BulkCleanupInterface';
export { ProgressIndicator } from './ProgressIndicator';
export { UndoHistoryView } from './UndoHistoryView';
export { JunkNoteIndicator } from './JunkNoteIndicator';
export { JunkDetectionSummaryComponent } from './JunkDetectionSummary';

// Design System Components
export { DuplicateGroupCard } from './DuplicateGroupCard';
export { 
  ExplanationFormatter, 
  UtilityScoreExplanation, 
  RecommendationExplanation 
} from './ExplanationFormatter';
export { 
  AccessibilityProvider, 
  useAccessibility,
  AccessibleText,
  AccessibleButton,
  getAccessibilityLabel,
  getAccessibilityHint,
  announcements
} from './AccessibilityProvider';

// Onboarding Components
export { OnboardingFlow } from './OnboardingFlow';
export { OnboardingManager, useOnboarding, TutorialHint } from './OnboardingManager';
export { OnboardingExamples } from './OnboardingExamples';
export { OnboardingPermissions } from './OnboardingPermissions';
export { OnboardingSetup } from './OnboardingSetup';

// Design System
export * from '../design/DesignSystem';