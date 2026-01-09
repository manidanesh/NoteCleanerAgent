#!/usr/bin/env node

/**
 * Simple test to verify Ollama integration works
 */

async function testOllama() {
  console.log('🧪 Testing Ollama integration...');
  
  try {
    // Test if Ollama server is running
    const response = await fetch('http://localhost:11434/api/tags');
    
    if (!response.ok) {
      console.log('❌ Ollama server not running on localhost:11434');
      console.log('💡 Start Ollama with: ollama serve');
      return;
    }
    
    const data = await response.json();
    console.log('✅ Ollama server is running');
    console.log('📋 Available models:', data.models?.map(m => m.name) || []);
    
    // Test a simple generation
    const testRequest = {
      model: 'llama3.2:3b',
      prompt: 'Analyze this note content and identify the main topic: "Meeting with John about project timeline and deliverables"',
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 100
      }
    };
    
    console.log('🔄 Testing LLM generation...');
    const genResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest),
    });
    
    if (genResponse.ok) {
      const result = await genResponse.json();
      console.log('✅ LLM generation successful');
      console.log('📝 Response:', result.response?.substring(0, 200) + '...');
      console.log('⏱️  Processing time:', result.total_duration ? `${Math.round(result.total_duration / 1000000)}ms` : 'N/A');
    } else {
      console.log('❌ LLM generation failed:', genResponse.status, genResponse.statusText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure Ollama is installed and running:');
    console.log('   1. Install: https://ollama.ai/');
    console.log('   2. Pull model: ollama pull llama3.2:3b');
    console.log('   3. Start server: ollama serve');
  }
}

testOllama();