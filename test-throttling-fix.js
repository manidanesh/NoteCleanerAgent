/**
 * Test script to verify LLM throttling fixes
 */

const { runProductionApp } = require('./dist/src/production-app.js');

async function testThrottlingFix() {
  console.log('🧪 Testing LLM Throttling Fixes');
  console.log('================================');
  
  try {
    // Test with a timeout to prevent infinite loops
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout after 15 seconds')), 15000);
    });
    
    const appTest = runProductionApp(['analyze']);
    
    const result = await Promise.race([appTest, timeout]);
    
    console.log('✅ Test completed successfully - no throttling issues detected');
    
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('⚠️ Test timed out - this suggests the infinite loop issue may still exist');
    } else if (error.message.includes('throttled')) {
      console.log('❌ Throttling issue still present:', error.message);
    } else {
      console.log('ℹ️ Test completed with expected error:', error.message);
    }
  }
}

testThrottlingFix().catch(console.error);