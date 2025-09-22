/**
 * Test Script for Unified AI Service and MCP Integration
 * Tests the unified API architecture with MCP routing
 */

import { unifiedAI } from '../services/unifiedAI.js';
import { mcpClient } from '../services/mcpClient.js';

async function testUnifiedAI() {
  console.log('🚀 Testing Unified AI Service...\n');

  // Test 1: Check service status
  console.log('1. Checking service status...');
  try {
    const status = await unifiedAI.getServiceStatus();
    console.log('✅ Service Status:', JSON.stringify(status, null, 2));
  } catch (error) {
    console.log('❌ Service status check failed:', error.message);
  }

  // Test 2: Test MCP connection
  console.log('\n2. Testing MCP connection...');
  try {
    const mcpAvailable = await mcpClient.testConnection();
    console.log(`✅ MCP Server: ${mcpAvailable ? 'Available' : 'Unavailable'}`);
    
    if (mcpAvailable) {
      const health = await mcpClient.getHealth();
      console.log('MCP Health:', health.status);
    }
  } catch (error) {
    console.log('❌ MCP connection test failed:', error.message);
  }

  // Test 3: Test chicken note parsing
  console.log('\n3. Testing chicken note parsing...');
  try {
    const testNote = "Owner: Buy magnolia whole chicken 20 bags (10 chickens per bag)";
    const parseResult = await unifiedAI.parseChickenNote(testNote, 'owner');
    
    console.log('✅ Parse Result:', {
      success: parseResult.success,
      source: parseResult.source,
      hasData: !!parseResult.data
    });
    
    if (parseResult.success && parseResult.data) {
      console.log('Parsed business type:', parseResult.data.business_type);
    }
  } catch (error) {
    console.log('❌ Note parsing failed:', error.message);
  }

  // Test 4: Test business advice
  console.log('\n4. Testing business advice...');
  try {
    const adviceResult = await unifiedAI.getBusinessAdvice(
      "How can I optimize my chicken processing efficiency?",
      'owner'
    );
    
    console.log('✅ Advice Result:', {
      success: adviceResult.success,
      source: adviceResult.source,
      hasData: !!adviceResult.data
    });
  } catch (error) {
    console.log('❌ Business advice failed:', error.message);
  }

  // Test 5: Test embeddings
  console.log('\n5. Testing embeddings generation...');
  try {
    const embeddingResult = await unifiedAI.generateEmbeddings([
      "Buy chicken from supplier",
      "Process chicken into parts",
      "Distribute to branches"
    ]);
    
    console.log('✅ Embedding Result:', {
      success: embeddingResult.success,
      source: embeddingResult.source,
      hasData: !!embeddingResult.data
    });
  } catch (error) {
    console.log('❌ Embeddings generation failed:', error.message);
  }

  // Test 6: Multi-LLM Routing
  console.log('\n6. Testing multi-LLM routing...');
  try {
    const testPrompt = "Parse: Bought 20 bags chicken from Magnolia.";
    const multiResult = await unifiedAI.parseChickenNote(testPrompt, 'owner', { provider: 'cohere' }); // Specify provider
    
    console.log('✅ Multi-LLM Result:', {
      success: multiResult.success,
      source: multiResult.source,
      providerUsed: multiResult.data?.model || 'unknown', // Should show 'command-r' or fallback
      hasData: !!multiResult.data
    });

    // Test fallback (simulate Gemini limit by forcing fallback)
    const fallbackResult = await unifiedAI.parseChickenNote(testPrompt, 'owner', { provider: 'gemini' }); // Will fallback if limited
    console.log('Fallback Test:', fallbackResult.source);
  } catch (error) {
    console.log('❌ Multi-LLM test failed:', error.message);
  }

  console.log('\n🎉 Unified AI Service test completed!');
}

// Run the test
testUnifiedAI().catch(console.error);