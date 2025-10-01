/**
 * Test Script for New AI Providers
 * Tests NVIDIA DeepSeek, Cerebras, Mistral, and Grok APIs
 */

import OpenAI from 'openai';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test prompts for different capabilities
const testPrompts = {
  simple: "What is 2+2? Explain briefly.",
  business: "Analyze this chicken business note: 'Fed 50 chickens today, collected 35 eggs, sold 20 eggs for $40'",
  reasoning: "Solve this step-by-step: If a chicken lays 1 egg every 1.5 days, how many eggs will 20 chickens lay in one week?",
  complex: "Create a business analysis for a small chicken farm with recommendations for growth."
};

/**
 * Test NVIDIA DeepSeek API
 */
async function testNVIDIADeepSeek() {
  console.log('\n🚀 Testing NVIDIA DeepSeek API...');
  
  const nvidia = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });

  try {
    const completion = await nvidia.chat.completions.create({
      model: "deepseek-ai/deepseek-r1",
      messages: [{"role": "user", "content": testPrompts.reasoning}],
      temperature: 0.6,
      top_p: 0.7,
      max_tokens: 2048,
      stream: false
    });

    const reasoning = completion.choices[0]?.message?.reasoning_content;
    if (reasoning) {
      console.log('🧠 Reasoning Process:', reasoning.substring(0, 200) + '...');
    }
    
    console.log('✅ NVIDIA DeepSeek Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'nvidia-deepseek',
      model: 'deepseek-ai/deepseek-r1',
      reasoning: !!reasoning,
      response: completion.choices[0]?.message?.content,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ NVIDIA DeepSeek Error:', error.message);
    return {
      success: false,
      provider: 'nvidia-deepseek',
      error: error.message
    };
  }
}

/**
 * Test Cerebras API
 */
async function testCerebras() {
  console.log('\n🧠 Testing Cerebras API...');
  
  const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY
  });

  try {
    const completion = await cerebras.chat.completions.create({
      messages: [
        {
          "role": "system",
          "content": "You are a helpful AI assistant specialized in business analysis."
        },
        {
          "role": "user", 
          "content": testPrompts.business
        }
      ],
      model: 'qwen-3-235b-a22b-instruct-2507',
      stream: false,
      max_completion_tokens: 2048,
      temperature: 0.7,
      top_p: 0.8
    });

    console.log('✅ Cerebras Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'cerebras',
      model: 'qwen-3-235b-a22b-instruct-2507',
      response: completion.choices[0]?.message?.content,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ Cerebras Error:', error.message);
    return {
      success: false,
      provider: 'cerebras',
      error: error.message
    };
  }
}

/**
 * Test Cerebras Streaming
 */
async function testCerebrasStreaming() {
  console.log('\n📡 Testing Cerebras Streaming...');
  
  const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY
  });

  try {
    const stream = await cerebras.chat.completions.create({
      messages: [
        {
          "role": "user",
          "content": testPrompts.simple
        }
      ],
      model: 'qwen-3-235b-a22b-instruct-2507',
      stream: true,
      max_completion_tokens: 1024,
      temperature: 0.7,
      top_p: 0.8
    });

    let fullResponse = '';
    console.log('🔄 Streaming response:');
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      process.stdout.write(content);
      fullResponse += content;
    }
    
    console.log('\n✅ Cerebras Streaming Complete');
    
    return {
      success: true,
      provider: 'cerebras-streaming',
      response: fullResponse
    };
  } catch (error) {
    console.error('❌ Cerebras Streaming Error:', error.message);
    return {
      success: false,
      provider: 'cerebras-streaming',
      error: error.message
    };
  }
}

/**
 * Test Groq API (for Grok/Whisper)
 */
async function testGroq() {
  console.log('\n⚡ Testing Groq API...');
  
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  try {
    // Test chat completion
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [{"role": "user", "content": testPrompts.simple}],
      temperature: 0.7,
      max_tokens: 1024,
    });

    console.log('✅ Groq Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'groq',
      model: 'llama-3.1-70b-versatile',
      response: completion.choices[0]?.message?.content,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ Groq Error:', error.message);
    return {
      success: false,
      provider: 'groq',
      error: error.message
    };
  }
}

/**
 * Test Mistral API
 */
async function testMistral() {
  console.log('\n🌪️ Testing Mistral API...');
  
  const mistral = new OpenAI({
    apiKey: process.env.MINSTRAL_API_KEY, // Note: keeping original typo from .env
    baseURL: 'https://api.mistral.ai/v1',
  });

  try {
    const completion = await mistral.chat.completions.create({
      model: "mistral-large-latest",
      messages: [{"role": "user", "content": testPrompts.business}],
      temperature: 0.7,
      max_tokens: 2048,
    });

    console.log('✅ Mistral Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'mistral',
      model: 'mistral-large-latest',
      response: completion.choices[0]?.message?.content,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ Mistral Error:', error.message);
    return {
      success: false,
      provider: 'mistral',
      error: error.message
    };
  }
}

/**
 * Run all tests and generate report
 */
async function runAllTests() {
  console.log('🧪 Starting AI Provider Tests...\n');
  
  const results = [];
  
  // Test all providers
  results.push(await testNVIDIADeepSeek());
  results.push(await testCerebras());
  results.push(await testCerebrasStreaming());
  results.push(await testGroq());
  results.push(await testMistral());
  
  // Generate report
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  console.log('\n✅ Working Providers:');
  successful.forEach(result => {
    console.log(`  • ${result.provider}${result.model ? ` (${result.model})` : ''}`);
    if (result.reasoning) console.log('    - Supports reasoning chains ✨');
  });
  
  console.log('\n❌ Failed Providers:');
  failed.forEach(result => {
    console.log(`  • ${result.provider}: ${result.error}`);
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');
  
  if (successful.find(r => r.provider === 'nvidia-deepseek')) {
    console.log('🏆 NVIDIA DeepSeek: HIGHLY RECOMMENDED - Reasoning capabilities');
  }
  
  if (successful.find(r => r.provider === 'cerebras')) {
    console.log('🚀 Cerebras: HIGHLY RECOMMENDED - Fast inference, good for real-time');
  }
  
  if (successful.find(r => r.provider === 'groq')) {
    console.log('⚡ Groq: Good for high-speed processing');
  }
  
  if (successful.find(r => r.provider === 'mistral')) {
    console.log('🌪️ Mistral: Solid European option with good performance');
  }
  
  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export {
  testNVIDIADeepSeek,
  testCerebras,
  testCerebrasStreaming,
  testGroq,
  testMistral,
  runAllTests
};