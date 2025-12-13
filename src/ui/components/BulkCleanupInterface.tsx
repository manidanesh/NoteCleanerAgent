import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { 
  BulkCleanupService, 
  BulkAnalysisResult, 
  SafetyConfidence, 
  BulkExecutionProgress,
  BulkExecutionResult 
} from '../../services/BulkCleanupService';
import { ProgressIndicator } from './ProgressIndicator';
import { DesignSystem } from '../design/DesignSystem';

/**
 * Props for BulkCleanupInterface component
 */
interface BulkCleanupInterfaceProps {
  bulkCleanupService: BulkCleanupService;
  onAnalysisComplete?: (result: BulkAnalysisResult) => void;
  onExecutionComplete?: (result: BulkExecutionResult) => void;
}

/**
 * Bulk Cleanup Interface Component
 * Provides UI for analyzing and executing bulk cleanup operations
 */
export const BulkCleanupInterface: React.FC<BulkCleanupInterfaceProps> = ({
  bulkCleanupService,
  onAnalysisComplete,
  onExecutionComplete
}) => {
  const [analysisResult, setAnalysisResult] = useState<BulkAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<BulkExecutionProgress | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<SafetyConfidence[]>([SafetyConfidence.HIGH]);
  const [error, setError] = useState<string | null>(null);

  // Progress callback for execution updates
  const handleProgressUpdate = useCallback((progress: BulkExecutionProgress) => {
    setExecutionProgress(progress);
  }, []);

  // Register progress listener on mount
  useEffect(() => {
    bulkCleanupService.onProgress(handleProgressUpdate);
    
    return () => {
      bulkCleanupService.removeProgressListener(handleProgressUpdate);
    };
  }, [bulkCleanupService, handleProgressUpdate]);

  /**
   * Start analysis of the entire notes library
   */
  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('Starting bulk cleanup analysis...');
      const result = await bulkCleanupService.analyzeNotesLibrary();
      setAnalysisResult(result);
      onAnalysisComplete?.(result);
      
      console.log(`Analysis complete: ${result.totalNotes} notes analyzed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Execute bulk cleanup with selected safety groups
   */
  const handleExecuteCleanup = async () => {
    if (!analysisResult) {
      Alert.alert('Error', 'Please run analysis first');
      return;
    }

    // Show confirmation dialog
    const totalCandidates = analysisResult.safetyGroups
      .filter(group => selectedGroups.includes(group.confidence))
      .reduce((sum, group) => sum + group.totalCount, 0);

    Alert.alert(
      'Confirm Bulk Cleanup',
      `This will process ${totalCandidates} notes. A backup has been created and all actions can be undone. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          style: 'destructive',
          onPress: executeCleanup
        }
      ]
    );
  };

  /**
   * Execute the actual cleanup
   */
  const executeCleanup = async () => {
    if (!analysisResult) return;
    
    setIsExecuting(true);
    setError(null);
    
    try {
      console.log('Starting bulk cleanup execution...');
      const result = await bulkCleanupService.executeBulkCleanup(analysisResult, selectedGroups);
      onExecutionComplete?.(result);
      
      // Show completion alert
      Alert.alert(
        'Cleanup Complete',
        `Successfully processed ${result.successfulOperations} notes. ${result.failedOperations} operations failed.`,
        [{ text: 'OK' }]
      );
      
      console.log(`Execution complete: ${result.successfulOperations} successful, ${result.failedOperations} failed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      setError(errorMessage);
      console.error('Execution failed:', err);
    } finally {
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  };

  /**
   * Toggle safety group selection
   */
  const toggleSafetyGroup = (confidence: SafetyConfidence) => {
    setSelectedGroups(prev => {
      if (prev.includes(confidence)) {
        return prev.filter(c => c !== confidence);
      } else {
        return [...prev, confidence];
      }
    });
  };

  /**
   * Format bytes to human readable string
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Get safety group color
   */
  const getSafetyGroupColor = (confidence: SafetyConfidence): string => {
    switch (confidence) {
      case SafetyConfidence.HIGH:
        return DesignSystem.colors.success;
      case SafetyConfidence.MEDIUM:
        return DesignSystem.colors.warning;
      case SafetyConfidence.REVIEW_NEEDED:
        return DesignSystem.colors.error;
      default:
        return DesignSystem.colors.text.secondary;
    }
  };

  /**
   * Get safety group label
   */
  const getSafetyGroupLabel = (confidence: SafetyConfidence): string => {
    switch (confidence) {
      case SafetyConfidence.HIGH:
        return 'High Confidence';
      case SafetyConfidence.MEDIUM:
        return 'Medium Confidence';
      case SafetyConfidence.REVIEW_NEEDED:
        return 'Review Needed';
      default:
        return confidence;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bulk Cleanup</Text>
        <Text style={styles.subtitle}>
          Analyze your entire notes library and safely remove clutter
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Analysis Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Analyze Notes Library</Text>
        <Text style={styles.sectionDescription}>
          Scan all your notes to identify cleanup opportunities
        </Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleStartAnalysis}
          disabled={isAnalyzing || isExecuting}
        >
          {isAnalyzing ? (
            <ActivityIndicator color={DesignSystem.colors.background.primary} />
          ) : (
            <Text style={styles.buttonText}>
              {analysisResult ? 'Re-analyze Library' : 'Start Analysis'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Analysis Results */}
      {analysisResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Analysis Results</Text>
          
          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              📊 {analysisResult.totalNotes} notes analyzed
            </Text>
            <Text style={styles.summaryText}>
              💾 {formatBytes(analysisResult.storageEstimate.potentialSavings)} potential savings 
              ({analysisResult.storageEstimate.savingsPercentage.toFixed(1)}%)
            </Text>
            <Text style={styles.summaryText}>
              ✅ Backup created: {analysisResult.backupInfo.noteCount} notes secured
            </Text>
          </View>

          {/* Safety Groups */}
          <Text style={styles.subsectionTitle}>Cleanup Candidates by Safety Level</Text>
          
          {analysisResult.safetyGroups.map((group) => (
            <TouchableOpacity
              key={group.confidence}
              style={[
                styles.safetyGroup,
                selectedGroups.includes(group.confidence) && styles.safetyGroupSelected
              ]}
              onPress={() => toggleSafetyGroup(group.confidence)}
            >
              <View style={styles.safetyGroupHeader}>
                <View style={[
                  styles.safetyIndicator,
                  { backgroundColor: getSafetyGroupColor(group.confidence) }
                ]} />
                <Text style={styles.safetyGroupTitle}>
                  {getSafetyGroupLabel(group.confidence)}
                </Text>
                <Text style={styles.safetyGroupCount}>
                  {group.totalCount} notes
                </Text>
              </View>
              
              <Text style={styles.safetyGroupSavings}>
                Potential savings: {formatBytes(group.estimatedSavings)}
              </Text>
              
              <Text style={styles.safetyGroupActions}>
                Actions: {group.recommendedActions.join(', ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Execution Section */}
      {analysisResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Execute Cleanup</Text>
          <Text style={styles.sectionDescription}>
            Process selected safety groups. Higher confidence groups are processed first.
          </Text>
          
          {selectedGroups.length === 0 ? (
            <Text style={styles.warningText}>
              Please select at least one safety group to proceed
            </Text>
          ) : (
            <View>
              <Text style={styles.selectedGroupsText}>
                Selected: {selectedGroups.map(getSafetyGroupLabel).join(', ')}
              </Text>
              
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleExecuteCleanup}
                disabled={isAnalyzing || isExecuting}
              >
                {isExecuting ? (
                  <ActivityIndicator color={DesignSystem.colors.background.primary} />
                ) : (
                  <Text style={styles.buttonText}>Execute Cleanup</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Execution Progress */}
      {executionProgress && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cleanup Progress</Text>
          
          <ProgressIndicator
            progress={executionProgress.completedOperations / executionProgress.totalOperations}
            label={executionProgress.currentOperation}
            showPercentage={true}
          />
          
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              Processing: {getSafetyGroupLabel(executionProgress.currentSafetyLevel)}
            </Text>
            <Text style={styles.progressText}>
              Completed: {executionProgress.completedOperations} / {executionProgress.totalOperations}
            </Text>
            <Text style={styles.progressText}>
              Success: {executionProgress.successCount} | Failed: {executionProgress.failureCount}
            </Text>
            {executionProgress.estimatedTimeRemaining > 0 && (
              <Text style={styles.progressText}>
                Estimated time remaining: {Math.ceil(executionProgress.estimatedTimeRemaining / 1000)}s
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background.primary,
    padding: DesignSystem.spacing.medium,
  },
  header: {
    marginBottom: DesignSystem.spacing.large,
  },
  title: {
    fontSize: DesignSystem.typography.sizes.xlarge,
    fontWeight: DesignSystem.typography.weights.bold as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.small,
  },
  subtitle: {
    fontSize: DesignSystem.typography.sizes.medium,
    color: DesignSystem.colors.text.secondary,
  },
  section: {
    marginBottom: DesignSystem.spacing.large,
    padding: DesignSystem.spacing.medium,
    backgroundColor: DesignSystem.colors.background.secondary,
    borderRadius: DesignSystem.borderRadius.medium,
  },
  sectionTitle: {
    fontSize: DesignSystem.typography.sizes.large,
    fontWeight: DesignSystem.typography.weights.semibold as any,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.small,
  },
  sectionDescription: {
    fontSize: DesignSystem.typography.sizes.medium,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.medium,
  },
  subsectionTitle: {
    fontSize: DesignSystem.typography.sizes.medium,
    fontWeight: DesignSystem.typography.weights.semibold as any,
    color: DesignSystem.colors.text.primary,
    marginTop: DesignSystem.spacing.medium,
    marginBottom: DesignSystem.spacing.small,
  },
  button: {
    padding: DesignSystem.spacing.medium,
    borderRadius: DesignSystem.borderRadius.medium,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: DesignSystem.colors.primary,
  },
  dangerButton: {
    backgroundColor: DesignSystem.colors.error,
  },
  buttonText: {
    color: DesignSystem.colors.background.primary,
    fontSize: DesignSystem.typography.sizes.medium,
    fontWeight: DesignSystem.typography.weights.semibold as any,
  },
  errorContainer: {
    backgroundColor: DesignSystem.colors.error + '20',
    padding: DesignSystem.spacing.medium,
    borderRadius: DesignSystem.borderRadius.medium,
    marginBottom: DesignSystem.spacing.medium,
  },
  errorText: {
    color: DesignSystem.colors.error,
    fontSize: DesignSystem.typography.sizes.medium,
  },
  summaryContainer: {
    backgroundColor: DesignSystem.colors.background.primary,
    padding: DesignSystem.spacing.medium,
    borderRadius: DesignSystem.borderRadius.small,
    marginBottom: DesignSystem.spacing.medium,
  },
  summaryText: {
    fontSize: DesignSystem.typography.sizes.medium,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.small,
  },
  safetyGroup: {
    backgroundColor: DesignSystem.colors.background.primary,
    padding: DesignSystem.spacing.medium,
    borderRadius: DesignSystem.borderRadius.small,
    marginBottom: DesignSystem.spacing.small,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  safetyGroupSelected: {
    borderColor: DesignSystem.colors.primary,
  },
  safetyGroupHeader: {
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    marginBottom: DesignSystem.spacing.small,
  },
  safetyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: DesignSystem.spacing.small,
  },
  safetyGroupTitle: {
    fontSize: DesignSystem.typography.sizes.medium,
    fontWeight: DesignSystem.typography.weights.semibold as any,
    color: DesignSystem.colors.text.primary,
    flex: 1,
  },
  safetyGroupCount: {
    fontSize: DesignSystem.typography.sizes.small,
    color: DesignSystem.colors.text.secondary,
  },
  safetyGroupSavings: {
    fontSize: DesignSystem.typography.sizes.small,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xsmall,
  },
  safetyGroupActions: {
    fontSize: DesignSystem.typography.sizes.small,
    color: DesignSystem.colors.text.secondary,
  },
  warningText: {
    color: DesignSystem.colors.warning,
    fontSize: DesignSystem.typography.sizes.medium,
    textAlign: 'center' as any,
    padding: DesignSystem.spacing.medium,
  },
  selectedGroupsText: {
    fontSize: DesignSystem.typography.sizes.medium,
    color: DesignSystem.colors.text.primary,
    marginBottom: DesignSystem.spacing.medium,
  },
  progressStats: {
    marginTop: DesignSystem.spacing.medium,
  },
  progressText: {
    fontSize: DesignSystem.typography.sizes.small,
    color: DesignSystem.colors.text.secondary,
    marginBottom: DesignSystem.spacing.xsmall,
  },
};