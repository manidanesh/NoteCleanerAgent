import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AccessibilityInfo,
  Appearance,
  ColorSchemeName,
  Text,
  TouchableOpacity,
} from 'react-native';

interface AccessibilityContextType {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isHighContrastEnabled: boolean;
  isLargeTextEnabled: boolean;
  colorScheme: ColorSchemeName;
  announceForAccessibility: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isHighContrastEnabled, setIsHighContrastEnabled] = useState(false);
  const [isLargeTextEnabled, setIsLargeTextEnabled] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    // Check initial accessibility settings
    const checkAccessibilitySettings = async () => {
      try {
        const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        setIsScreenReaderEnabled(screenReaderEnabled);

        const reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        setIsReduceMotionEnabled(reduceMotionEnabled);

        // Note: High contrast and large text detection may require platform-specific implementations
        // For now, we'll use basic detection methods
        const currentColorScheme = Appearance.getColorScheme();
        setColorScheme(currentColorScheme);
        
        // Detect high contrast mode (simplified detection)
        // In a real implementation, you'd use platform-specific APIs
        setIsHighContrastEnabled(false);
        
        // Detect large text preference (simplified detection)
        // In a real implementation, you'd check system font size settings
        setIsLargeTextEnabled(false);
      } catch (error) {
        console.warn('Error checking accessibility settings:', error);
      }
    };

    checkAccessibilitySettings();

    // Set up listeners for accessibility changes
    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled
    );

    const colorSchemeListener = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });

    // Cleanup listeners
    return () => {
      screenReaderListener?.remove();
      reduceMotionListener?.remove();
      colorSchemeListener?.remove();
    };
  }, []);

  const announceForAccessibility = (message: string) => {
    if (isScreenReaderEnabled) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const contextValue: AccessibilityContextType = {
    isScreenReaderEnabled,
    isReduceMotionEnabled,
    isHighContrastEnabled,
    isLargeTextEnabled,
    colorScheme,
    announceForAccessibility,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

// Accessibility helper components
interface AccessibleTextProps {
  children: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'none' | 'button' | 'link' | 'search' | 'image' | 'keyboardkey' | 'text' | 'adjustable' | 'imagebutton' | 'header' | 'summary' | 'alert' | 'checkbox' | 'combobox' | 'menu' | 'menubar' | 'menuitem' | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar' | 'spinbutton' | 'switch' | 'tab' | 'tablist' | 'timer' | 'toolbar';
  style?: any;
}

export const AccessibleText: React.FC<AccessibleTextProps> = ({
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'text',
  style,
}) => {
  const { isHighContrastEnabled, isLargeTextEnabled } = useAccessibility();
  
  // Apply accessibility-aware styling
  const accessibleStyle = {
    ...style,
    ...(isHighContrastEnabled && {
      color: '#000000',
      backgroundColor: '#ffffff',
    }),
    ...(isLargeTextEnabled && {
      fontSize: (style?.fontSize || 16) * 1.2,
      lineHeight: (style?.lineHeight || 20) * 1.2,
    }),
  };

  return (
    <Text
      style={accessibleStyle}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </Text>
  );
};

interface AccessibleButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: any;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}) => {
  const { isHighContrastEnabled, announceForAccessibility } = useAccessibility();
  
  const handlePress = () => {
    if (!disabled) {
      onPress();
      // Announce action completion for screen readers
      announceForAccessibility(`${accessibilityLabel} activated`);
    }
  };

  const accessibleStyle = {
    ...style,
    ...(isHighContrastEnabled && {
      borderWidth: 2,
      borderColor: '#000000',
    }),
    ...(disabled && {
      opacity: 0.5,
    }),
  };

  return (
    <TouchableOpacity
      style={accessibleStyle}
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {children}
    </TouchableOpacity>
  );
};

// Utility functions for accessibility
export const getAccessibilityLabel = {
  utilityScore: (score: number): string => 
    `Utility score: ${score} out of 100. ${score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'} utility`,
  
  recommendationAction: (action: string): string => 
    `Recommended action: ${action.replace('_', ' ')}`,
  
  processingProgress: (step: string, progress: number): string => 
    `Processing: ${step}. ${Math.round(progress)}% complete`,
  
  batchAction: (count: number, action: string): string => 
    `Batch ${action} for ${count} recommendation${count > 1 ? 's' : ''}`,
};

export const getAccessibilityHint = {
  recommendationCard: 'Double tap to view details and take action',
  approveButton: 'Double tap to approve this recommendation',
  rejectButton: 'Double tap to reject this recommendation',
  undoButton: 'Double tap to undo this action',
  expandButton: 'Double tap to expand or collapse details',
};

// Screen reader announcements for common actions
export const announcements = {
  recommendationApproved: (action: string) => `Recommendation approved. ${action} action will be executed.`,
  recommendationRejected: 'Recommendation rejected and feedback recorded.',
  batchActionStarted: (count: number) => `Starting batch action for ${count} recommendations.`,
  batchActionCompleted: (successful: number, total: number) => 
    `Batch action completed. ${successful} of ${total} actions successful.`,
  undoCompleted: 'Action undone successfully. Previous state restored.',
  processingStarted: 'Note analysis started. This may take a few moments.',
  processingCompleted: 'Note analysis completed. Recommendations are ready for review.',
};