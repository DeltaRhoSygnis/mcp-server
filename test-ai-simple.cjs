/**
 * Simple test for new AI providers
 */

const { config } = require('dotenv');
const OpenAI = require('openai');
const { Cerebras } = require('@cerebras/cerebras_cloud_sdk');

// Load environment variables
config();

// Test Cerebras (highest priority)
async function testCerebras() {
  console.log('\n🧠 Testing Cerebras API...');
  
  const apiKey = process.env.CEREBRAS_API_KEY?.trim();
  if (!apiKey) {
    console.log('❌ CEREBRAS_API_KEY not found');
    return { success: false, error: 'No API key' };
  }

  try {
    const cerebras = new Cerebras({
      apiKey: apiKey
    });

    const completion = await cerebras.chat.completions.create({
      messages: [
        {
          "role": "system",
          "content": "You are a helpful AI assistant for chicken business analysis."
        },
        {
          "role": "user", 
          "content": "Analyze this chicken business note: 'Fed 50 chickens today, collected 35 eggs, sold 20 eggs for $40'. Extract key business data."
        }
      ],
      model: 'qwen-3-235b-a22b-instruct-2507',
      stream: false,
      max_completion_tokens: 1024,
      temperature: 0.7,
      top_p: 0.8
    });

    console.log('✅ Cerebras Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'cerebras',
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

// Test NVIDIA DeepSeek
async function testNVIDIA() {
  console.log('\n🚀 Testing NVIDIA DeepSeek API...');
  
  if (!process.env.NVIDIA_API_KEY) {
    console.log('❌ NVIDIA_API_KEY not found in environment');
    return { success: false, error: 'No API key' };
  }

  try {
    const nvidia = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });

    const completion = await nvidia.chat.completions.create({
      model: "deepseek-ai/deepseek-r1",
      messages: [{"role": "user", "content": "Calculate: If 20 chickens lay eggs every 1.5 days, how many eggs per week? Show reasoning."}],
      temperature: 0.6,
      top_p: 0.7,
      max_tokens: 2048,
      stream: false
    });

    console.log('✅ NVIDIA DeepSeek Response:', completion.choices[0]?.message?.content);
    
    // Check for reasoning content (may not be available in standard response)
    if (completion.choices[0]?.message?.reasoning_content) {
      console.log('🧠 Reasoning:', completion.choices[0].message.reasoning_content.substring(0, 200) + '...');
    }
    
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'nvidia-deepseek',
      response: completion.choices[0]?.message?.content,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ NVIDIA Error:', error.message);
    return {
      success: false,
      provider: 'nvidia-deepseek',
      error: error.message
    };
  }
}

// Test Groq
async function testGroq() {
  console.log('\n⚡ Testing Groq API...');
  
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    console.log('❌ GROQ_API_KEY not found');
    return { success: false, error: 'No API key' };
  }

  try {
    const groq = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // Updated to supported model
      messages: [{"role": "user", "content": "What is 2+2? Explain briefly."}],
      temperature: 0.7,
      max_tokens: 512,
    });

    console.log('✅ Groq Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'groq',
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

// Test Mistral
async function testMistral() {
  console.log('\n🌪️ Testing Mistral API...');
  
  const apiKey = process.env.MINSTRAL_API_KEY?.trim();
  if (!apiKey) {
    console.log('❌ MINSTRAL_API_KEY not found');
    return { success: false, error: 'No API key' };
  }

  try {
    const mistral = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.mistral.ai/v1',
    });

    const completion = await mistral.chat.completions.create({
      model: "mistral-large-latest",
      messages: [{"role": "user", "content": "Analyze a chicken farm business briefly."}],
      temperature: 0.7,
      max_tokens: 1024,
    });

    console.log('✅ Mistral Response:', completion.choices[0]?.message?.content);
    console.log('📊 Usage:', completion.usage);
    
    return {
      success: true,
      provider: 'mistral',
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

// Run all tests
async function runTests() {
  console.log('🧪 Testing New AI Providers...\n');
  
  const results = [];
  
  // Test in priority order: Cerebras, NVIDIA, Groq, Mistral
  results.push(await testCerebras());
  results.push(await testNVIDIA());
  results.push(await testGroq());
  results.push(await testMistral());
  
  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Working: ${successful.length}/${results.length} providers`);
  console.log(`❌ Failed: ${failed.length}/${results.length} providers`);
  
  console.log('\n✅ WORKING PROVIDERS:');
  successful.forEach(result => {
    console.log(`  🟢 ${result.provider.toUpperCase()}`);
  });
  
  console.log('\n❌ FAILED PROVIDERS:');
  failed.forEach(result => {
    if (result && result.provider) {
      console.log(`  🔴 ${result.provider.toUpperCase()}: ${result.error}`);
    }
  });
  
  // Recommendations
  console.log('\n💡 INTEGRATION RECOMMENDATIONS:');
  if (successful.find(r => r.provider === 'cerebras')) {
    console.log('🏆 PRIMARY: Cerebras - Ultra-fast, high throughput');
  }
  if (successful.find(r => r.provider === 'nvidia-deepseek')) {
    console.log('🧠 REASONING: NVIDIA DeepSeek - Complex analysis');
  }
  if (successful.find(r => r.provider === 'groq')) {
    console.log('⚡ SPEED: Groq - Lightning fast responses');
  }
  if (successful.find(r => r.provider === 'mistral')) {
    console.log('🌍 ALTERNATIVE: Mistral - European option');
  }
  
  return results;
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCerebras,
  testNVIDIA,
  testGroq,
  testMistral,
  runTests
};