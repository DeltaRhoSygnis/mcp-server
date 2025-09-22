/**
 * Simple Gemini API Test
 * Test if we can reach Google's Gemini API
 */

import { readFileSync } from 'fs';

// Read .env file manually
function loadEnv() {
    try {
        const envFile = readFileSync('.env', 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        });
        return envVars;
    } catch (error) {
        console.warn('Could not read .env file:', error.message);
        return {};
    }
}

const env = loadEnv();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;

async function testGeminiAPI() {
    console.log('🧪 Testing Gemini API connectivity...\n');
    
    if (!GEMINI_API_KEY) {
        console.error('❌ No Gemini API key found in environment variables');
        return;
    }
    
    console.log('✅ API Key found:', GEMINI_API_KEY.substring(0, 20) + '...');
    
    // Test different models
    const modelsToTest = [
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash', 
        'gemini-2.5-flash',
        'gemini-1.5-flash'
    ];
    
    for (const model of modelsToTest) {
        console.log(`\n🤖 Testing model: ${model}`);
        await testModel(model);
    }
}

async function testModel(model) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Hello! Can you respond with "API test successful"?' }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 50
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ ${model}: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
            return;
        }
        
        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (result) {
            console.log(`✅ ${model}: ${result.trim()}`);
        } else {
            console.log(`⚠️  ${model}: Got response but no text content`);
            console.log('Raw response:', JSON.stringify(data, null, 2).substring(0, 300));
        }
        
    } catch (error) {
        console.log(`❌ ${model}: ${error.message}`);
    }
}

// Run the test
testGeminiAPI().catch(console.error);