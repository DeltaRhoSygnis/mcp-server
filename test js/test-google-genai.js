/**
 * Test Gemini API using @google/genai library (like the cloned MCP server)
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

async function testWithGoogleGenAI() {
    console.log('🧪 Testing Gemini API with @google/genai library...\n');
    
    const env = loadEnv();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        console.error('❌ No Gemini API key found');
        return;
    }
    
    console.log('✅ API Key found:', GEMINI_API_KEY.substring(0, 20) + '...');
    
    try {
        // Test if we can dynamically import @google/genai
        const { GoogleGenAI } = await import('@google/genai');
        
        console.log('✅ @google/genai library loaded successfully');
        
        // Initialize the client
        const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        
        console.log('✅ GoogleGenAI client initialized');
        
        // Test a simple generation
        const result = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{
                parts: [{ text: 'Hello! Can you respond with "API test successful via @google/genai"?' }],
                role: 'user'
            }]
        });
        
        console.log('✅ API call successful!');
        console.log('Response:', result.text);
        
        // Test token counting
        const tokenCount = await genAI.models.countTokens({
            model: 'gemini-1.5-flash',
            contents: [{
                parts: [{ text: 'Test message for token counting' }]
            }]
        });
        
        console.log('✅ Token counting successful:', tokenCount.totalTokens, 'tokens');
        
    } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
            console.log('⚠️  @google/genai library not found. Installing...');
            await installGoogleGenAI();
        } else {
            console.error('❌ Error testing with @google/genai:', error.message);
            
            // Fallback to direct API test with different endpoint format
            console.log('\n🔄 Trying fallback with direct API...');
            await testDirectAPI(GEMINI_API_KEY);
        }
    }
}

async function installGoogleGenAI() {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
        console.log('📦 Installing @google/genai...');
        await execAsync('npm install @google/genai');
        console.log('✅ Installation complete, retrying test...');
        await testWithGoogleGenAI();
    } catch (error) {
        console.error('❌ Failed to install @google/genai:', error.message);
    }
}

async function testDirectAPI(apiKey) {
    // Try different API endpoints and formats
    const endpoints = [
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔗 Testing endpoint: ${endpoint}`);
            
            const response = await fetch(`${endpoint}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Hello! Test message.' }]
                    }]
                })
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Success with endpoint:', endpoint);
                console.log('Response:', data.candidates?.[0]?.content?.parts?.[0]?.text);
                return;
            } else {
                const errorData = await response.text();
                console.log('❌ Error:', errorData.substring(0, 200));
            }
            
        } catch (error) {
            console.log('❌ Fetch error:', error.message);
        }
    }
}

// Run the test
testWithGoogleGenAI().catch(console.error);