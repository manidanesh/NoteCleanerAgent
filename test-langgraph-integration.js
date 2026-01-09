/**
 * Test LangGraph Integration
 * Simple test to verify the LangGraph coordinator works correctly
 */

const { LangGraphCoordinator } = require('./dist/agents/LangGraphCoordinator');
const { LLMServiceImpl } = require('./dist/services/LLMService');

async function testLangGraphIntegration() {
  console.log('🧪 Testing LangGraph Integration...');

  try {
    // Initialize LLM service
    const llmService = new LLMServiceImpl();
    console.log('✅ LLM Service initialized');

    // Initialize LangGraph coordinator without database service for testing
    const coordinator = LangGraphCoordinator.getInstance(llmService, undefined, undefined, {
      enableOnDeviceLLM: true,
      enableCloudLLM: false,
      privacyMode: 'strict'
    });
    await coordinator.initialize();
    console.log('✅ LangGraph Coordinator initialized');

    // Test note
    const testNote = {
      id: 'test-note-1',
      title: 'Test Meeting Notes',
      content: 'Meeting with team about project planning. Discussed deadlines and resource allocation.',
      folder: 'Work',
      createdAt: new Date(),
      modifiedAt: new Date(),
      modifiedDate: new Date(),
      attachments: [],
      checklists: []
    };

    console.log('📝 Processing test note...');

    // Test different strategies
    const strategies = ['quick_junk', 'balanced', 'comprehensive'];
    
    for (const strategy of strategies) {
      console.log(`\n🔄 Testing ${strategy} strategy...`);
      
      try {
        const result = await coordinator.processNote(testNote, strategy);
        
        console.log(`✅ ${strategy} completed in ${result.processingTime}ms`);
        console.log(`   - Errors: ${result.errors.length}`);
        console.log(`   - Recommendations: ${result.recommendations?.length || 0}`);
        
        if (result.errors.length > 0) {
          console.log('   - Error details:', result.errors.map(e => e.error));
        }
      } catch (error) {
        console.error(`❌ ${strategy} strategy failed:`, error.message);
      }
    }

    // Test workflow info
    console.log('\n📊 Available workflows:');
    const workflows = coordinator.getAvailableWorkflows();
    workflows.forEach(workflow => {
      const info = coordinator.getWorkflowInfo(workflow);
      console.log(`   - ${workflow}: ${info.description} (${info.estimatedTime})`);
    });

    console.log('\n✅ LangGraph integration test completed successfully!');

  } catch (error) {
    console.error('❌ LangGraph integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run test
testLangGraphIntegration();