/**
 * Main entry point for Notes AI Organizer
 * Simple Node.js version for macOS
 */

import { LangGraphCoordinator } from './agents/LangGraphCoordinator';
import { AppleNotesAPIService } from './services/NotesAPIService';
import { SecurityService } from './services/SecurityService';
import { LLMServiceImpl } from './services/LLMService';
import { DatabaseService } from './services/DatabaseService';
import { WorkerPool } from './services/worker/WorkerPool';

async function main() {
  console.log('🚀 Starting Notes AI Organizer...');

  try {
    // Initialize security
    const securityService = SecurityService.getInstance();
    await securityService.initialize();
    console.log('✅ Security initialized');

    // Initialize core services
    const llmService = new LLMServiceImpl();
    // Initialize Database Service (Persistence Layer)
    const databaseService = new DatabaseService();
    await databaseService.initialize();
    console.log('✅ Database initialized');

    // Initialize Worker Pool
    const workerPool = new WorkerPool();
    console.log('✅ Worker Pool initialized');

    // Initialize agent coordinator with dependencies
    const agentCoordinator = LangGraphCoordinator.getInstance(
      llmService,
      databaseService,
      workerPool
    );
    await agentCoordinator.initialize();
    console.log('✅ LangGraph AI agents initialized');

    // Initialize Notes API
    const notesAPI = AppleNotesAPIService.getInstance();
    const hasPermission = await notesAPI.requestPermission();

    if (!hasPermission) {
      console.log('❌ Notes access permission required');
      console.log('Please grant permission to access Apple Notes in System Preferences > Security & Privacy > Privacy > Full Disk Access');
      return;
    }

    console.log('✅ Notes access granted');

    // Get notes and analyze
    console.log('📊 Analyzing your notes...');
    const notesResult = await notesAPI.getAllNotes();
    if (!notesResult.success || !notesResult.data) {
      console.log('❌ Failed to fetch notes');
      return;
    }

    const notes = notesResult.data;
    console.log(`Found ${notes.length} notes`);

    if (notes.length === 0) {
      console.log('No notes found to analyze');
      return;
    }

    // Process notes
    const results = await agentCoordinator.processNotes(notes);

    console.log('\n📈 Analysis Complete!');
    console.log(`- Processing results: ${results.length}`);

    // Extract recommendations from results
    const allRecommendations = results.flatMap(result => result.recommendations || []);
    if (allRecommendations.length > 0) {
      console.log('\n🎯 Top Recommendations:');
      allRecommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.action} - ${rec.reasoning.substring(0, 100)}...`);
      });
    }

    console.log('\n✅ Analysis complete! Use the CLI for more detailed operations.');
    console.log('Run: npm run cli -- --help');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };