import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { PerformanceOptimizer, ResourceMetrics } from '../../services/PerformanceOptimizer';
import { BatchProcessor, BatchProgress, BatchProcessingEvent } from '../../services/BatchProcessor';

interface PerformanceMonitorProps {
  performanceOptimizer: PerformanceOptimizer;
  batchProcessor: BatchProcessor;
  onInterruptProcessing?: () => void;
  onResumeProcessing?: () => void;
  showDetailedMetrics?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  performanceOptimizer,
  batchProcessor,
  onInterruptProcessing,
  onResumeProcessing,
  showDetailedMetrics = false,
}) => {
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  useEffect(() => {
    // Update resource metrics every second
    const resourceInterval = setInterval(() => {
      const metrics = performanceOptimizer.getCurrentResourceMetrics();
      setResourceMetrics(metrics);
      
      const perfMetrics = performanceOptimizer.getPerformanceMetrics();
      setPerformanceMetrics(perfMetrics);
    }, 1000);

    // Listen to batch processing events
    const handleBatchEvent = (event: BatchProcessingEvent) => {
      switch (event.type) {
        case 'batch_started':
          setIsProcessing(true);
          setIsPaused(false);
          break;
        case 'processing_paused':
          setIsPaused(true);
          break;
        case 'processing_resumed':
          setIsPaused(false);
          break;
        case 'progress_updated':
          setBatchProgress(event.progress);
          break;
      }
    };

    batchProcessor.addEventListener(handleBatchEvent);

    // Update processing state
    const processingInterval = setInterval(() => {
      setIsProcessing(batchProcessor.isCurrentlyProcessing());
      setIsPaused(batchProcessor.isCurrentlyPaused());
      setBatchProgress(batchProcessor.getProgress());
    }, 500);

    return () => {
      clearInterval(resourceInterval);
      clearInterval(processingInterval);
      batchProcessor.removeEventListener(handleBatchEvent);
    };
  }, [performanceOptimizer, batchProcessor]);

  const handleInterrupt = () => {
    Alert.alert(
      'Interrupt Processing',
      'Are you sure you want to interrupt the current processing? Progress will be saved and you can resume later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Interrupt',
          style: 'destructive',
          onPress: () => {
            batchProcessor.interruptProcessing();
            onInterruptProcessing?.();
          }
        }
      ]
    );
  };

  const handleResume = () => {
    onResumeProcessing?.();
  };

  const getResourceStatusColor = (usage: number, threshold: number): string => {
    if (usage > threshold * 0.9) return '#dc3545'; // Red - critical
    if (usage > threshold * 0.7) return '#ffc107'; // Yellow - warning
    return '#28a745'; // Green - good
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Processing Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Processing Status</Text>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isProcessing ? (isPaused ? '#ffc107' : '#28a745') : '#6c757d' }
          ]} />
          <Text style={styles.statusText}>
            {isProcessing ? (isPaused ? 'Paused' : 'Processing') : 'Idle'}
          </Text>
        </View>

        {isProcessing && (
          <TouchableOpacity
            style={[styles.button, styles.interruptButton]}
            onPress={handleInterrupt}
          >
            <Text style={styles.buttonText}>Interrupt Processing</Text>
          </TouchableOpacity>
        )}

        {isPaused && (
          <TouchableOpacity
            style={[styles.button, styles.resumeButton]}
            onPress={handleResume}
          >
            <Text style={styles.buttonText}>Resume Processing</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Batch Progress */}
      {batchProgress && isProcessing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batch Progress</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Batches:</Text>
              <Text style={styles.progressValue}>
                {batchProgress.completedBatches} / {batchProgress.totalBatches}
              </Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Notes:</Text>
              <Text style={styles.progressValue}>
                {batchProgress.processedNotes} / {batchProgress.totalNotes}
              </Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Current Step:</Text>
              <Text style={styles.progressValue}>{batchProgress.currentStep}</Text>
            </View>
            {batchProgress.estimatedTimeRemaining > 0 && (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Time Remaining:</Text>
                <Text style={styles.progressValue}>
                  {formatTime(batchProgress.estimatedTimeRemaining)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Resource Metrics */}
      {resourceMetrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Resources</Text>
          
          {/* CPU Usage */}
          <View style={styles.metricContainer}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>CPU Usage</Text>
              <Text style={[
                styles.metricValue,
                { color: getResourceStatusColor(resourceMetrics.cpuUsage, 25) }
              ]}>
                {resourceMetrics.cpuUsage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, resourceMetrics.cpuUsage)}%`,
                    backgroundColor: getResourceStatusColor(resourceMetrics.cpuUsage, 25)
                  }
                ]}
              />
            </View>
          </View>

          {/* Memory Usage */}
          <View style={styles.metricContainer}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Memory Usage</Text>
              <Text style={[
                styles.metricValue,
                { color: getResourceStatusColor(resourceMetrics.memoryUsage, 500) }
              ]}>
                {formatBytes(resourceMetrics.memoryUsage * 1024 * 1024)}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (resourceMetrics.memoryUsage / 500) * 100)}%`,
                    backgroundColor: getResourceStatusColor(resourceMetrics.memoryUsage, 500)
                  }
                ]}
              />
            </View>
          </View>

          {/* Battery Level */}
          {resourceMetrics.batteryLevel !== undefined && (
            <View style={styles.metricContainer}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>Battery Level</Text>
                <Text style={[
                  styles.metricValue,
                  { color: getResourceStatusColor(100 - resourceMetrics.batteryLevel, 80) }
                ]}>
                  {resourceMetrics.batteryLevel.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${resourceMetrics.batteryLevel}%`,
                      backgroundColor: resourceMetrics.batteryLevel > 20 ? '#28a745' : '#dc3545'
                    }
                  ]}
                />
              </View>
            </View>
          )}

          {/* Thermal State */}
          {resourceMetrics.thermalState && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Thermal State:</Text>
              <Text style={[
                styles.metricValue,
                {
                  color: resourceMetrics.thermalState === 'normal' ? '#28a745' :
                        resourceMetrics.thermalState === 'fair' ? '#ffc107' : '#dc3545'
                }
              ]}>
                {resourceMetrics.thermalState.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Network Status */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Network:</Text>
            <Text style={[
              styles.metricValue,
              {
                color: resourceMetrics.networkStatus === 'wifi' ? '#28a745' :
                      resourceMetrics.networkStatus === 'cellular' ? '#ffc107' : '#dc3545'
              }
            ]}>
              {resourceMetrics.networkStatus.toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      {/* Performance Metrics */}
      {showDetailedMetrics && performanceMetrics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>
          
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Cache Hit Rate:</Text>
            <Text style={styles.metricValue}>
              {(performanceMetrics.cacheHitRate * 100).toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Throttle Events:</Text>
            <Text style={styles.metricValue}>
              {performanceMetrics.throttleEvents}
            </Text>
          </View>
          
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Interruption Events:</Text>
            <Text style={styles.metricValue}>
              {performanceMetrics.interruptionEvents}
            </Text>
          </View>
          
          {performanceMetrics.averageBatchTime > 0 && (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Avg Batch Time:</Text>
              <Text style={styles.metricValue}>
                {formatTime(performanceMetrics.averageBatchTime)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Errors */}
      {batchProgress && batchProgress.errors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Errors</Text>
          {batchProgress.errors.slice(-3).map((error, index) => (
            <Text key={index} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    backgroundColor: '#fff',
    margin: 8,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  interruptButton: {
    backgroundColor: '#dc3545',
  },
  resumeButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    color: '#495057',
  },
  progressValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  metricContainer: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#495057',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});