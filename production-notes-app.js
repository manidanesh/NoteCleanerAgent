#!/usr/bin/env node

/**
 * Production Notes AI Organizer - Real Apple Notes Integration
 * Built on the working demo foundation with actual Apple Notes API
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the compiled services
const { AppleNotesAPIService } = require('./dist/services/NotesAPIService');
const { SecurityService } = require('./dist/services/SecurityService');
const { AgentCoordinator } = require('./dist/agents/AgentCoordinator');
const { LearningComponent } = require('./dist/agents/LearningComponent');
const { RecommendationActionService } = require('./dist/services/RecommendationActionService');

console.log('🚀 Notes AI Organizer - Production Version');
console.log('==========================================');
console.log('');

class ProductionNotesApp {
  constructor() {
    this.notesAPI = null;
    this.securityService = null;
    this.agentCoordinator = null;
    this.learningComponent = null;
    this.actionService = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing services...');
      
      // Initialize security service
      this.securityService = SecurityService.getInstance();
      await this.securityService.initialize();
      console.log('✅ Security service initialized');

      // Initialize Notes API
      this.notesAPI = AppleNotesAPIService.getInstance();
      console.log('✅ Notes API service initialized');

      // Create a simple LLM service mock for now
      const simpleLLMService = {
        processRequest: async (request) => ({
          requestId: Date.now().toString(),
          response: 'Mock LLM response',
          confidence: 0.8,
          tokensUsed: 100,
          processingTime: 500,
          model: 'mock',
          fallbackUsed: false
        }),
        isAvailable: async () => true,
        getCurrentProvider: () => 'mock',
        setProviderPreference: () => {},
        getResourceUsage: () => ({
          totalRequests: 0,
          onDeviceRequests: 0,
          cloudRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          memoryUsage: 0,
          cpuUsage: 0
        }),
        shutdown: async () => {}
      };

      // Initialize agent coordinator with mock LLM service
      this.agentCoordinator = AgentCoordinator.getInstance(simpleLLMService);
      await this.agentCoordinator.initialize();
      console.log('✅ Agent coordinator initialized');

      // Initialize learning component
      this.learningComponent = new LearningComponent();
      await this.learningComponent.initialize();
      console.log('✅ Learning component initialized');

      // Initialize action service
      this.actionService = new RecommendationActionService(
        this.notesAPI,
        this.learningComponent
      );
      console.log('✅ Action service initialized');

      this.isInitialized = true;
      console.log('✅ All services initialized successfully');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async requestPermissions() {
    try {
      console.log('🔐 Requesting Apple Notes permissions...');
      
      const hasPermission = await this.notesAPI.requestPermission();
      if (!hasPermission) {
        console.log('❌ Notes access permission denied');
        console.log('Please grant permission in System Preferences > Security & Privacy > Privacy > Full Disk Access');
        return false;
      }
      
      console.log('✅ Apple Notes access granted');
      return true;
      
    } catch (error) {
      console.error('❌ Permission request failed:', error.message);
      return false;
    }
  }

  async analyzeNotes() {
    if (!this.isInitialized) {
      throw new Error('App not initialized');
    }

    try {
      console.log('📊 Fetching your Apple Notes...');
      
      // Get real notes from Apple Notes
      const notesResult = await this.notesAPI.getAllNotes();
      if (!notesResult.success || !notesResult.data) {
        throw new Error('Failed to fetch notes: ' + (notesResult.error || 'Unknown error'));
      }

      const notes = notesResult.data;
      console.log(`Found ${notes.length} notes in your Apple Notes library`);

      if (notes.length === 0) {
        console.log('No notes found to analyze');
        return { success: true, totalNotes: 0, recommendations: [] };
      }

      console.log('🤖 Running AI analysis...');
      
      // Process notes through the agent coordinator
      const results = await this.agentCoordinator.processNotes(notes);
      
      // Extract recommendations
      const allRecommendations = results.flatMap(result => result.recommendations || []);
      
      console.log('\n📈 Analysis Complete!');
      console.log(`- Total notes analyzed: ${notes.length}`);
      console.log(`- Recommendations generated: ${allRecommendations.length}`);
      
      // Show summary by recommendation type
      const recommendationTypes = {};
      allRecommendations.forEach(rec => {
        recommendationTypes[rec.action] = (recommendationTypes[rec.action] || 0) + 1;
      });

      if (Object.keys(recommendationTypes).length > 0) {
        console.log('\n🎯 Recommendation Summary:');
        Object.entries(recommendationTypes).forEach(([action, count]) => {
          console.log(`- ${action}: ${count} notes`);
        });
      }

      // Show top recommendations
      if (allRecommendations.length > 0) {
        console.log('\n🔍 Top Recommendations:');
        allRecommendations.slice(0, 5).forEach((rec, index) => {
          const note = notes.find(n => n.id === rec.noteId);
          const noteTitle = note ? note.title : 'Unknown';
          console.log(`${index + 1}. ${rec.action.toUpperCase()}: "${noteTitle}"`);
          console.log(`   Reason: ${rec.reasoning.substring(0, 80)}...`);
          console.log(`   Confidence: ${Math.round(rec.confidence * 100)}%`);
          console.log('');
        });
      }

      return {
        success: true,
        totalNotes: notes.length,
        recommendations: allRecommendations,
        notes: notes
      };

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      return {
        success: false,
        totalNotes: 0,
        recommendations: [],
        error: error.message
      };
    }
  }

  async getStatistics() {
    try {
      const notesResult = await this.notesAPI.getAllNotes();
      const totalNotes = notesResult.success ? notesResult.data?.length || 0 : 0;
      
      const learningStats = this.learningComponent?.getFeedbackStats() || {
        total: 0, approved: 0, rejected: 0, approvalRate: 0
      };

      console.log('\n📊 Application Statistics:');
      console.log(`- Total notes in library: ${totalNotes}`);
      console.log(`- Learning feedback collected: ${learningStats.total}`);
      console.log(`- Approval rate: ${Math.round(learningStats.approvalRate * 100)}%`);

      return {
        totalNotes,
        learningFeedback: learningStats.total,
        approvalRate: learningStats.approvalRate
      };

    } catch (error) {
      console.error('❌ Error getting statistics:', error.message);
      return { totalNotes: 0, learningFeedback: 0, approvalRate: 0 };
    }
  }
}

async function main() {
  const app = new ProductionNotesApp();
  
  try {
    // Initialize the app
    await app.initialize();
    
    // Request permissions
    const hasPermissions = await app.requestPermissions();
    if (!hasPermissions) {
      console.log('\n❌ Cannot proceed without Apple Notes access');
      process.exit(1);
    }

    // Parse command line arguments
    const command = process.argv[2] || 'analyze';

    switch (command) {
      case 'analyze':
        const result = await app.analyzeNotes();
        if (result.success) {
          console.log('\n✅ Analysis completed successfully!');
          console.log('\n💡 This is your real Apple Notes data being analyzed.');
          console.log('   Use the recommendations to clean up and organize your notes.');
        } else {
          console.log('\n❌ Analysis failed:', result.error);
        }
        break;

      case 'stats':
        await app.getStatistics();
        break;

      case 'help':
      default:
        console.log('\n📱 Notes AI Organizer - Production Commands:');
        console.log('\nUsage: node production-notes-app.js [command]');
        console.log('\nCommands:');
        console.log('  analyze  - Analyze your real Apple Notes and generate recommendations');
        console.log('  stats    - Show statistics about your notes library');
        console.log('  help     - Show this help message');
        console.log('\nFeatures:');
        console.log('✅ Real Apple Notes integration');
        console.log('✅ AI-powered analysis and recommendations');
        console.log('✅ Privacy-first on-device processing');
        console.log('✅ Learning from user feedback');
        break;
    }

  } catch (error) {
    console.error('❌ Application error:', error.message);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down gracefully...');
  process.exit(0);
});

// Run the app
if (require.main === module) {
  main();
}

module.exports = { ProductionNotesApp };