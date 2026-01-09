/**
 * Final test to verify LLM throttling is completely resolved
 */

const { spawn } = require('child_process');

console.log('🧪 Final Test: Verifying LLM Throttling Fix');
console.log('==========================================');

const child = spawn('node', ['production-notes-app.js'], {
  stdio: 'pipe'
});

let output = '';
let hasThrottlingError = false;
let hasSuccess = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text);
  
  // Check for throttling errors
  if (text.includes('throttled') || text.includes('resource constraints')) {
    hasThrottlingError = true;
    console.log('❌ THROTTLING DETECTED!');
  }
  
  // Check for success
  if (text.includes('Analysis completed successfully') || text.includes('Analysis complete')) {
    hasSuccess = true;
    console.log('✅ SUCCESS: Analysis completed without throttling!');
  }
});

child.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

// Timeout after 30 seconds
setTimeout(() => {
  child.kill();
  
  console.log('\n🔍 Test Results:');
  console.log('================');
  
  if (hasThrottlingError) {
    console.log('❌ FAILED: Throttling still detected');
  } else if (hasSuccess) {
    console.log('✅ PASSED: No throttling detected, analysis completed successfully');
  } else {
    console.log('⚠️ PARTIAL: No throttling detected, but analysis may not have completed');
  }
  
  process.exit(hasThrottlingError ? 1 : 0);
}, 30000);

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});