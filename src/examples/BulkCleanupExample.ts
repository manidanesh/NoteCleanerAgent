import { BulkCleanupService, SafetyConfidence } from '../services/BulkCleanupService';
import { AgentCoordinator } from '../agents/AgentCoordinator';
import { AppleNotesAPIService } from '../services/NotesAPIService';
import { RecommendationActionService } from '../services/RecommendationActionService';
import { CheckpointService } from '../services/CheckpointService';
import { LLMServiceFactory } from '../services/LLMServiceFactory';

/**
 * Example demonstrating bulk cleanup functionality
 * Implements Requirements 17.1, 17.2, 17.3, 17.4, 17.5
 */
export class BulkCleanupExample {
  private bulkCleanupService: BulkCleanupService;

  constructor() {
    // Initialize dependencies
    const llmService = LLMServiceFactory.createPrivacyFirst();
    const agentCoordinator = AgentCoordinator.getInstance(llmService);
    const notesAPI = AppleNotesAPIService.getInstance();
    const actionService = new RecommendationActionService(notesAPI, {} as any);
    const checkpointService = new CheckpointService({} as any);

    // Create bulk cleanup service
    this.bulkCleanupService = new BulkCleanupService(
      agentCoordinator,
      notesAPI,
      actionService,
      checkpointService
    );
  }

  /**
   * Demonstrate complete bulk cleanup workflow
   */
  async demonstrateBulkCleanup(): Promise<void> {
    console.log('🚀 Starting Bulk Cleanup Demo');
    
    try {
      // Step 1: Analyze entire notes library
      console.log('\n📊 Step 1: Analyzing entire notes library...');
      const analysisResult = await this.bulkCleanupService.analyzeNotesLibrary();
      
      console.log(`✅ Analysis complete!`);
      console.log(`   📝 Total notes: ${analysisResult.totalNotes}`);
      console.log(`   💾 Potential savings: ${this.formatBytes(analysisResult.storageEstimate.potentialSavings)} (${analysisResult.storageEstimate.savingsPercentage.toFixed(1)}%)`);
      console.log(`   🔒 Backup created: ${analysisResult.backupInfo.noteCount} notes secured`);
      
      // Step 2: Display safety groups
      console.log('\n🛡️ Step 2: Safety Groups Analysis');
      for (const group of analysisResult.safetyGroups) {
        const confidenceEmoji = this.getConfidenceEmoji(group.confidence);
        console.log(`   ${confidenceEmoji} ${group.confidence}: ${group.totalCount} notes (${this.formatBytes(group.estimatedSavings)} savings)`);
        console.log(`      Actions: ${group.recommendedActions.join(', ')}`);
      }

      // Step 3: Execute cleanup for high confidence items only
      console.log('\n🧹 Step 3: Executing cleanup (High Confidence only)...');
      
      // Set up progress monitoring
      this.bulkCleanupService.onProgress((progress) => {
        const percentage = Math.round((progress.completedOperations / progress.totalOperations) * 100);
        console.log(`   Progress: ${percentage}% (${progress.completedOperations}/${progress.totalOperations}) - ${progress.currentOperation}`);
      });

      const executionResult = await this.bulkCleanupService.executeBulkCleanup(
        analysisResult,
        [SafetyConfidence.HIGH] // Only process high confidence items
      );

      // Step 4: Display results
      console.log('\n✨ Step 4: Cleanup Results');
      console.log(`   ✅ Success: ${executionResult.success}`);
      console.log(`   📊 Processed: ${executionResult.totalProcessed} notes`);
      console.log(`   ✅ Successful: ${executionResult.successfulOperations}`);
      console.log(`   ❌ Failed: ${executionResult.failedOperations}`);
      console.log(`   ⏱️ Duration: ${this.formatDuration(executionResult.endTime.getTime() - executionResult.startTime.getTime())}`);
      console.log(`   🔄 Undo available: ${executionResult.undoAvailable ? 'Yes' : 'No'}`);

      if (executionResult.errors.length > 0) {
        console.log('\n⚠️ Errors encountered:');
        executionResult.errors.forEach(error => console.log(`   - ${error}`));
      }

      console.log('\n🎉 Bulk cleanup demo completed successfully!');

    } catch (error) {
      console.error('❌ Bulk cleanup demo failed:', error);
    }
  }

  /**
   * Demonstrate analysis-only workflow
   */
  async demonstrateAnalysisOnly(): Promise<void> {
    console.log('🔍 Starting Analysis-Only Demo');
    
    try {
      const analysisResult = await this.bulkCleanupService.analyzeNotesLibrary();
      
      console.log('\n📈 Analysis Summary:');
      console.log(`   Total Notes: ${analysisResult.totalNotes}`);
      console.log(`   Library Size: ${this.formatBytes(analysisResult.storageEstimate.totalLibrarySize)}`);
      console.log(`   Cleanup Candidates: ${analysisResult.safetyGroups.reduce((sum, g) => sum + g.totalCount, 0)}`);
      
      console.log('\n💾 Storage Breakdown:');
      console.log(`   High Confidence: ${this.formatBytes(analysisResult.storageEstimate.breakdown.highConfidence)}`);
      console.log(`   Medium Confidence: ${this.formatBytes(analysisResult.storageEstimate.breakdown.mediumConfidence)}`);
      console.log(`   Review Needed: ${this.formatBytes(analysisResult.storageEstimate.breakdown.reviewNeeded)}`);
      
      if (analysisResult.processingErrors.length > 0) {
        console.log('\n⚠️ Processing Errors:');
        analysisResult.processingErrors.forEach(error => console.log(`   - ${error}`));
      }

    } catch (error) {
      console.error('❌ Analysis demo failed:', error);
    }
  }

  /**
   * Demonstrate progress monitoring
   */
  async demonstrateProgressMonitoring(): Promise<void> {
    console.log('📊 Starting Progress Monitoring Demo');
    
    // Set up detailed progress monitoring
    this.bulkCleanupService.onProgress((progress) => {
      console.log(`\n📊 Progress Update:`);
      console.log(`   Current Operation: ${progress.currentOperation}`);
      console.log(`   Safety Level: ${progress.currentSafetyLevel}`);
      console.log(`   Completed: ${progress.completedOperations}/${progress.totalOperations}`);
      console.log(`   Success Rate: ${progress.successCount}/${progress.completedOperations}`);
      
      if (progress.estimatedTimeRemaining > 0) {
        console.log(`   ETA: ${this.formatDuration(progress.estimatedTimeRemaining)}`);
      }
    });

    try {
      const analysisResult = await this.bulkCleanupService.analyzeNotesLibrary();
      
      // Execute with all safety levels to see more progress updates
      await this.bulkCleanupService.executeBulkCleanup(
        analysisResult,
        [SafetyConfidence.HIGH, SafetyConfidence.MEDIUM]
      );

    } catch (error) {
      console.error('❌ Progress monitoring demo failed:', error);
    }
  }

  // Helper methods

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getConfidenceEmoji(confidence: SafetyConfidence): string {
    switch (confidence) {
      case SafetyConfidence.HIGH:
        return '🟢';
      case SafetyConfidence.MEDIUM:
        return '🟡';
      case SafetyConfidence.REVIEW_NEEDED:
        return '🔴';
      default:
        return '⚪';
    }
  }
}

// Example usage
async function runBulkCleanupExamples() {
  const example = new BulkCleanupExample();
  
  console.log('='.repeat(60));
  console.log('🧹 BULK CLEANUP SERVICE EXAMPLES');
  console.log('='.repeat(60));
  
  // Run different demo scenarios
  await example.demonstrateAnalysisOnly();
  
  console.log('\n' + '='.repeat(60));
  
  await example.demonstrateBulkCleanup();
  
  console.log('\n' + '='.repeat(60));
  
  await example.demonstrateProgressMonitoring();
}

// Export for use in other examples
export { runBulkCleanupExamples };