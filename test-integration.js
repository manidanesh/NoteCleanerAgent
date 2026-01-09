#!/usr/bin/env node

/**
 * Test integration to identify the actual blocker
 */

const { LLMServiceImpl, PrivacyLevel } = require('./dist/services/LLMService');
const { AgentCoordinator } = require('./dist/agents/AgentCoordinator');

async function testIntegration() {
  console.log('🔍 Testing integration step by step...');
  
  try {
    // Step 1: Test LLMService creation
    console.log('1. Creating LLMService...');
    const llmService = new LLMServiceImpl({
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
    });
    console.log('✅ LLMService created successfully');
    
    // Step 2: Test AgentCoordinator creation
    console.log('2. Creating AgentCoordinator...');
    const agentCoordinator = AgentCoordinator.getInstance(llmService);
    console.log('✅ AgentCoordinator created successfully');
    
    // Step 3: Test AgentCoordinator initialization
    console.log('3. Initializing AgentCoordinator...');
    await agentCoordinator.initialize();
    console.log('✅ AgentCoordinator initialized successfully');
    
    console.log('🎉 Integration test passed!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testIntegration();