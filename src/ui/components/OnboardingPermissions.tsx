import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { DesignSystem } from '../design/DesignSystem';

interface PrivacyFeature {
  icon: string;
  title: string;
  description: string;
  technical: string;
}

const privacyFeatures: PrivacyFeature[] = [
  {
    icon: '📱',
    title: 'On-Device Processing',
    description: 'All AI analysis happens locally on your device',
    technical: 'Uses Core ML and local LLM models. No data sent to external servers.'
  },
  {
    icon: '🔒',
    title: 'Encrypted Storage',
    description: 'Temporary data is encrypted using device-level security',
    technical: 'AES-256 encryption with hardware security module integration.'
  },
  {
    icon: '🚫',
    title: 'No Cloud Dependency',
    description: 'Works completely offline without internet connection',
    technical: 'Self-contained processing pipeline with local model inference.'
  },
  {
    icon: '🗑️',
    title: 'Automatic Cleanup',
    description: 'Cached data is automatically cleared when app is backgrounded',
    technical: 'Secure memory management with immediate data purging on app state changes.'
  },
  {
    icon: '👤',
    title: 'User Control',
    description: 'You can revoke permissions and delete all data at any time',
    technical: 'Granular permission management with complete data removal capabilities.'
  }
];

interface OnboardingPermissionsProps {
  onNext: () => void;
  onPrevious: () => void;
}

export const OnboardingPermissions: React.FC<OnboardingPermissionsProps> = ({ onNext, onPrevious }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const handleGrantPermission = () => {
    // In a real implementation, this would request actual Notes permission
    setPermissionGranted(true);
  };

  const openPrivacyPolicy = () => {
    // In a real implementation, this would open the actual privacy policy
    Linking.openURL('https://example.com/privacy-policy');
  };

  const openSecurityDocs = () => {
    // In a real implementation, this would open security documentation
    Linking.openURL('https://example.com/security-details');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Privacy & Permissions</Text>
      <Text style={styles.subtitle}>
        Your privacy is our top priority. Here's how we protect your data:
      </Text>

      <View style={styles.privacyFeatures}>
        {privacyFeatures.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{feature.icon}</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
              {showTechnicalDetails && (
                <Text style={styles.technicalDetails}>{feature.technical}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.technicalToggle}
        onPress={() => setShowTechnicalDetails(!showTechnicalDetails)}
      >
        <Text style={styles.technicalToggleText}>
          {showTechnicalDetails ? '🔼 Hide' : '🔽 Show'} Technical Details
        </Text>
      </TouchableOpacity>

      <View style={styles.permissionSection}>
        <Text style={styles.permissionTitle}>Required Permission</Text>
        <Text style={styles.permissionDescription}>
          We need access to your Apple Notes to analyze and organize them. This permission allows us to:
        </Text>
        
        <View style={styles.permissionList}>
          <Text style={styles.permissionItem}>• Read note content for analysis</Text>
          <Text style={styles.permissionItem}>• Access note metadata (dates, folders)</Text>
          <Text style={styles.permissionItem}>• Modify notes only when you approve actions</Text>
          <Text style={styles.permissionItem}>• Monitor for changes to keep analysis current</Text>
        </View>

        <View style={styles.permissionNote}>
          <Text style={styles.noteIcon}>ℹ️</Text>
          <Text style={styles.noteText}>
            You can revoke this permission at any time in iOS Settings → Privacy & Security → Notes
          </Text>
        </View>

        {!permissionGranted ? (
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={handleGrantPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Notes Access</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.permissionGranted}>
            <Text style={styles.grantedIcon}>✅</Text>
            <Text style={styles.grantedText}>Permission Granted</Text>
          </View>
        )}
      </View>

      <View style={styles.dataProcessingInfo}>
        <Text style={styles.dataTitle}>What Data We Process</Text>
        
        <View style={styles.dataCategory}>
          <Text style={styles.categoryTitle}>📝 Note Content</Text>
          <Text style={styles.categoryDescription}>
            Text, handwriting (via OCR), images, and attachments for content analysis
          </Text>
        </View>

        <View style={styles.dataCategory}>
          <Text style={styles.categoryTitle}>📊 Usage Patterns</Text>
          <Text style={styles.categoryDescription}>
            When notes were created, modified, and accessed to determine importance
          </Text>
        </View>

        <View style={styles.dataCategory}>
          <Text style={styles.categoryTitle}>🏷️ Metadata</Text>
          <Text style={styles.categoryDescription}>
            Titles, folders, and organizational structure for better recommendations
          </Text>
        </View>

        <View style={styles.dataRetention}>
          <Text style={styles.retentionTitle}>Data Retention</Text>
          <Text style={styles.retentionText}>
            • Analysis results are cached temporarily for performance
          </Text>
          <Text style={styles.retentionText}>
            • All cached data is encrypted and automatically deleted
          </Text>
          <Text style={styles.retentionText}>
            • No permanent copies of your notes are stored
          </Text>
        </View>
      </View>

      <View style={styles.documentationLinks}>
        <Text style={styles.linksTitle}>Learn More</Text>
        
        <TouchableOpacity style={styles.linkButton} onPress={openPrivacyPolicy}>
          <Text style={styles.linkIcon}>📄</Text>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={openSecurityDocs}>
          <Text style={styles.linkIcon}>🔐</Text>
          <Text style={styles.linkText}>Security Documentation</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={onPrevious}
        >
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.button, 
            permissionGranted ? styles.primaryButton : styles.disabledButton
          ]} 
          onPress={onNext}
          disabled={!permissionGranted}
        >
          <Text style={[
            permissionGranted ? styles.primaryButtonText : styles.disabledButtonText
          ]}>
            Next
          </Text>
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
  privacyFeatures: {
    marginBottom: DesignSystem.spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.md,
    padding: DesignSystem.spacing.md,
    marginBottom: DesignSystem.spacing.sm,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: DesignSystem.spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  featureDescription: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    lineHeight: 18,
  },
  technicalDetails: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.tertiary,
    marginTop: DesignSystem.spacing.xs,
    fontStyle: 'italic',
  },
  technicalToggle: {
    alignSelf: 'center',
    padding: DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.lg,
  },
  technicalToggleText: {
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.primary,
    fontWeight: '600',
  },
  permissionSection: {
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.lg,
    padding: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.lg,
  },
  permissionTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
  },
  permissionDescription: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.md,
    lineHeight: 18,
  },
  permissionList: {
    marginBottom: DesignSystem.spacing.md,
  },
  permissionItem: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  permissionNote: {
    flexDirection: 'row',
    backgroundColor: DesignSystem.colors.background.tertiary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.md,
  },
  noteIcon: {
    fontSize: 16,
    marginRight: DesignSystem.spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: DesignSystem.typography.caption.fontSize,
    color: DesignSystem.colors.text.secondary,
  },
  permissionButton: {
    backgroundColor: DesignSystem.colors.primary,
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.lg,
    borderRadius: DesignSystem.borderRadius.md,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: DesignSystem.colors.background.primary,
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
  },
  permissionGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignSystem.spacing.md,
  },
  grantedIcon: {
    fontSize: 20,
    marginRight: DesignSystem.spacing.sm,
  },
  grantedText: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.success,
    fontWeight: '600',
  },
  dataProcessingInfo: {
    marginBottom: DesignSystem.spacing.lg,
  },
  dataTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.md,
  },
  dataCategory: {
    marginBottom: DesignSystem.spacing.md,
  },
  categoryTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.xs,
  },
  categoryDescription: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    lineHeight: 18,
  },
  dataRetention: {
    backgroundColor: DesignSystem.colors.background.secondary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginTop: DesignSystem.spacing.md,
  },
  retentionTitle: {
    fontSize: DesignSystem.typography.body.fontSize,
    fontWeight: '600',
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.sm,
  },
  retentionText: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xs,
  },
  documentationLinks: {
    marginBottom: DesignSystem.spacing.xl,
  },
  linksTitle: {
    fontSize: DesignSystem.typography.h4.fontSize,
    fontWeight: DesignSystem.typography.h4.fontWeight as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignSystem.colors.background.secondary,
    padding: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.sm,
  },
  linkIcon: {
    fontSize: 20,
    marginRight: DesignSystem.spacing.md,
  },
  linkText: {
    flex: 1,
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.primary,
  },
  linkArrow: {
    fontSize: DesignSystem.typography.body.fontSize,
    color: DesignSystem.colors.text.secondary,
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
  disabledButton: {
    backgroundColor: DesignSystem.colors.background.tertiary,
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
  disabledButtonText: {
    color: DesignSystem.colors.text.tertiary,
    fontSize: DesignSystem.typography.body.fontSize,
  },
});