/**
 * Test Enhanced Chicken Business AI
 * Verify the integration of Gemini 2.5 models with chicken business system
 */

// Load environment variables
import { readFileSync } from 'fs';

function loadEnv() {
    try {
        const envFile = readFileSync('.env', 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
                process.env[key.trim()] = value.trim();
            }
        });
        return envVars;
    } catch (error) {
        console.warn('Could not read .env file:', error.message);
        return {};
    }
}

async function testEnhancedGeminiAPI() {
    console.log('🧪 Testing Enhanced Gemini API Integration\n');
    
    const env = loadEnv();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        console.error('❌ No Gemini API key found');
        return;
    }
    
    console.log('✅ API Key found:', GEMINI_API_KEY.substring(0, 20) + '...');
    
    try {
        // Test with @google/genai library
        console.log('\n1️⃣ Testing @google/genai library...');
        
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        
        // Test Gemini 2.5 Flash model  
        console.log('Testing Gemini 2.5 Flash...');
        
        const testPrompt = `
Parse this chicken business note into JSON:
"Today we bought 15 bags of whole chicken from Magnolia supplier. Each bag has 8 chickens. Total cost was 7500 pesos."

Return ONLY valid JSON:
{
  "business_type": "purchase|processing|distribution|cooking|sales|general",
  "confidence_score": 0.0-1.0,
  "learned_patterns": {
    "supplier": "supplier name",
    "quantities": "extracted quantities",
    "prices": "extracted prices"
  }
}`;

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [{ text: testPrompt }],
                role: 'user'
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1000,
                responseMimeType: "application/json"
            }
        });
        
        const response = await result.response;
        const responseText = response.text;
        
        console.log('✅ Gemini 2.5 Flash Response:');
        console.log('Raw response:', responseText);
        
        try {
            const parsed = JSON.parse(responseText);
            console.log('✅ Successfully parsed JSON:', {
                businessType: parsed.business_type,
                confidence: parsed.confidence_score,
                supplier: parsed.learned_patterns?.supplier,
                quantities: parsed.learned_patterns?.quantities
            });
        } catch (parseError) {
            console.warn('⚠️ JSON parsing failed, but API call succeeded');
        }
        
        // Test Gemini 2.5 Pro model for complex analysis
        console.log('\n2️⃣ Testing Gemini 2.5 Pro for business insights...');
        
        const insightPrompt = `
Analyze this chicken business operation data and provide strategic insights:

Recent Operations:
- Purchase: 15 bags whole chicken, 8 chickens/bag, 7500 pesos from Magnolia
- Processing: Converted to 12 bags parts + 8 bags necks
- Distribution: Sent 6 bags parts to Branch A, 6 bags to Branch B
- Sales: Branch A sold 80% at 15 pesos/piece, Branch B sold 60% at 18 pesos/piece

Provide business insights and recommendations in JSON format:
{
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "performance_indicators": {"metric": "value"}
}`;

        const insightResult = await genAI.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{
                parts: [{ text: insightPrompt }],
                role: 'user'
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1500,
                responseMimeType: "application/json"
            }
        });
        
        const insightResponse = await insightResult.response;
        const insightText = insightResponse.text;
        
        console.log('✅ Gemini 2.5 Pro Business Insights:');
        console.log('Raw response:', insightText);
        
        try {
            const insightsParsed = JSON.parse(insightText);
            console.log('📊 Business Insights:', insightsParsed.insights?.slice(0, 2));
            console.log('🎯 Recommendations:', insightsParsed.recommendations?.slice(0, 2));
        } catch (parseError) {
            console.warn('⚠️ Insights JSON parsing failed, but API call succeeded');
        }
        
        console.log('\n✅ Enhanced Gemini integration test completed successfully!');
        console.log('� Ready to integrate with chicken business system');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error.message?.includes('API_KEY')) {
            console.log('ℹ️ Make sure GEMINI_API_KEY is properly configured in .env file');
        }
        
        if (error.message?.includes('quota')) {
            console.log('ℹ️ API quota exceeded, try again later');
        }
    }
}

// Run test
testEnhancedGeminiAPI().then(() => {
    console.log('\n🏁 Enhanced Gemini API test completed');
}).catch(error => {
    console.error('💥 Test execution failed:', error);
});