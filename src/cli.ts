#!/usr/bin/env node

/**
 * CLI Interface for Notes AI Organizer (macOS)
 * Provides command-line access to the AI organizer functionality
 */

import { LangGraphCoordinator } from './agents/LangGraphCoordinator';
import { AppleNotesAPIService } from './services/NotesAPIService';
import { SecurityService } from './services/SecurityService';
import { OnboardingService } from './services/OnboardingService';

interface CLIOptions {
  analyze?: boolean;
  cleanup?: boolean;
  duplicates?: boolean;
  organize?: boolean;
  help?: boolean;
  verbose?: boolean;
}

class NotesOrganizerCLI {
  private agentCoordinator?: LangGraphCoordinator;
  private notesAPI: AppleNotesAPIService;
  private securityService: SecurityService;

  constructor() {
    this.notesAPI = AppleNotesAPIService.getInstance();
    this.securityService = SecurityService.getInstance();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Notes AI Organizer...');
    
    try {
      // Initialize security
      await this.securityService.initialize();
      console.log('✅ Security service initialized');

      // Initialize LLM service first
      const { LLMServiceImpl } = await import('./services/LLMService');
      const llmService = new LLMServiceImpl();
      
      // Initialize agent coordinator with LLM service
      this.agentCoordinator = LangGraphCoordinator.getInstance(llmService);
      await this.agentCoordinator.initialize();
      console.log('✅ LangGraph AI agents initialized');

      // Check permissions
      const hasPermission = await this.notesAPI.requestPermission();
      if (!hasPermission) {
        throw new Error('Notes access permission required');
      }
      console.log('✅ Notes access permission granted');

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    }
  }

  async analyzeNotes(): Promise<void> {
    console.log('\n📊 Analyzing your notes...');
    
    try {
      const notesResult = await this.notesAPI.getAllNotes();
      if (!notesResult.success || !notesResult.data) {
        throw new Error('Failed to fetch notes');
      }
      
      const notes = notesResult.data;
      console.log(`Found ${notes.length} notes to analyze`);

      if (!this.agentCoordinator) {
        throw new Error('Agent coordinator not initialized');
      }

      const results = await this.agentCoordinator.processNotes(notes);
      
      console.log('\n📈 Analysis Results:');
      console.log(`- Processing results: ${results.length}`);
      
      // Extract recommendations from results
      const allRecommendations = results.flatMap(result => result.recommendations || []);
      if (allRecommendations.length > 0) {
        console.log('\n🎯 Top Recommendations:');
        allRecommendations.slice(0, 5).forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.action} - ${rec.reasoning.substring(0, 100)}...`);
        });
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error);
    }
  }

  async findDuplicates(): Promise<void> {
    console.log('\n🔍 Finding duplicate notes...');
    
    try {
      const notesResult = await this.notesAPI.getAllNotes();
      if (!notesResult.success || !notesResult.data) {
        throw new Error('Failed to fetch notes');
      }
      
      if (!this.agentCoordinator) {
        throw new Error('Agent coordinator not initialized');
      }
      
      const notes = notesResult.data;
      const results = await this.agentCoordinator.processNotes(notes);
      
      // Extract duplicate groups from results
      const allDuplicates = results.flatMap(result => result.duplicateGroups || []);
      
      if (allDuplicates.length === 0) {
        console.log('✨ No duplicates found!');
        return;
      }

      console.log(`\n📋 Found ${allDuplicates.length} duplicate groups:`);
      allDuplicates.forEach((group, index) => {
        console.log(`\nGroup ${index + 1}:`);
        group.noteIds.forEach(noteId => {
          const note = notes.find(n => n.id === noteId);
          console.log(`  - "${note?.title || 'Unknown'}" (${note?.folder || 'Unknown folder'})`);
        });
        console.log(`  Confidence: ${(group.confidence * 100).toFixed(1)}%`);
      });

    } catch (error) {
      console.error('❌ Duplicate detection failed:', error);
    }
  }

  async organizeNotes(): Promise<void> {
    console.log('\n📁 Generating organization suggestions...');
    
    try {
      const notesResult = await this.notesAPI.getAllNotes();
      if (!notesResult.success || !notesResult.data) {
        throw new Error('Failed to fetch notes');
      }
      
      if (!this.agentCoordinator) {
        throw new Error('Agent coordinator not initialized');
      }
      
      const notes = notesResult.data;
      const results = await this.agentCoordinator.processNotes(notes);
      
      // Extract organization recommendations from results
      const organizationRecommendations = results.flatMap(result => 
        (result.recommendations || []).filter(rec => 
          rec.action.includes('MOVE') || rec.action.includes('RENAME') || rec.action.includes('ORGANIZE')
        )
      );
      
      if (organizationRecommendations.length === 0) {
        console.log('✨ Your notes are already well organized!');
        return;
      }

      console.log(`\n📝 Organization Suggestions (${organizationRecommendations.length}):`);
      organizationRecommendations.slice(0, 10).forEach((suggestion, index) => {
        console.log(`${index + 1}. ${suggestion.action}: ${suggestion.reasoning.substring(0, 100)}...`);
      });

    } catch (error) {
      console.error('❌ Organization failed:', error);
    }
  }

  async performCleanup(): Promise<void> {
    console.log('\n🧹 Performing cleanup analysis...');
    
    try {
      const notesResult = await this.notesAPI.getAllNotes();
      if (!notesResult.success || !notesResult.data) {
        throw new Error('Failed to fetch notes');
      }
      
      if (!this.agentCoordinator) {
        throw new Error('Agent coordinator not initialized');
      }
      
      const notes = notesResult.data;
      const results = await this.agentCoordinator.processNotes(notes);
      
      // Extract junk detection results
      const junkResults = results.filter(result => 
        result.junkDetectionResult && result.junkDetectionResult.isJunk
      );
      
      if (junkResults.length === 0) {
        console.log('✨ No junk notes detected!');
        return;
      }

      console.log(`\n🗑️  Found ${junkResults.length} potential junk notes:`);
      junkResults.slice(0, 10).forEach((result, index) => {
        const note = notes.find(n => n.id === result.noteId);
        const junkResult = result.junkDetectionResult!;
        console.log(`${index + 1}. "${note?.title || 'Unknown'}" - ${junkResult.reasoning}`);
      });

      console.log('\n⚠️  Review these suggestions before taking action.');

    } catch (error) {
      console.error('❌ Cleanup analysis failed:', error);
    }
  }

  displayHelp(): void {
    console.log(`
📱 Notes AI Organizer CLI

Usage: npm run cli [options]

Options:
  --analyze     Analyze all notes and generate recommendations
  --duplicates  Find duplicate notes
  --organize    Generate organization suggestions
  --cleanup     Find potential junk notes for cleanup
  --verbose     Enable verbose logging
  --help        Show this help message

Examples:
  npm run cli -- --analyze
  npm run cli -- --duplicates
  npm run cli -- --organize --verbose
  npm run cli -- --cleanup
`);
  }

  async run(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    if (options.help || Object.keys(options).length === 0) {
      this.displayHelp();
      return;
    }

    if (options.verbose) {
      console.log('🔧 Verbose mode enabled');
    }

    await this.initialize();

    if (options.analyze) {
      await this.analyzeNotes();
    }

    if (options.duplicates) {
      await this.findDuplicates();
    }

    if (options.organize) {
      await this.organizeNotes();
    }

    if (options.cleanup) {
      await this.performCleanup();
    }

    console.log('\n✅ Complete!');
  }

  private parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {};
    
    for (const arg of args) {
      switch (arg) {
        case '--analyze':
          options.analyze = true;
          break;
        case '--duplicates':
          options.duplicates = true;
          break;
        case '--organize':
          options.organize = true;
          break;
        case '--cleanup':
          options.cleanup = true;
          break;
        case '--verbose':
          options.verbose = true;
          break;
        case '--help':
          options.help = true;
          break;
      }
    }

    return options;
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new NotesOrganizerCLI();
  cli.run(process.argv.slice(2)).catch(error => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });
}

export { NotesOrganizerCLI };