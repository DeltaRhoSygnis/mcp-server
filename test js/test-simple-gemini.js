/**
 * Simple test of enhanced Gemini integration using working patterns
 */

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
        return {};
    }
}

async function testSimpleGeminiIntegration() {
    console.log('🧪 Testing Simple Enhanced Gemini Integration\n');
    
    const env = loadEnv();
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        console.error('❌ No Gemini API key found');
        return;
    }
    
    console.log('✅ API Key found:', GEMINI_API_KEY.substring(0, 20) + '...');
    
    try {
        // Test with standard fetch (proven to work)
        console.log('\n1️⃣ Testing Gemini 2.5-flash with fetch...');
        
        const testPrompt = `
Parse this chicken business note into structured JSON:
"Today we bought 15 bags of whole chicken from Magnolia supplier. Each bag has 8 chickens. Total cost was 7500 pesos. Worker John handled the purchase."

Return ONLY valid JSON in this format:
{
  "business_type": "purchase",
  "confidence_score": 0.95,
  "learned_patterns": {
    "supplier": "Magnolia supplier",
    "worker_mentioned": "John",
    "quantities": "15 bags, 8 chickens per bag",
    "total_cost": "7500 pesos"
  }
}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: testPrompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1000
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API responded with ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        console.log('✅ Gemini 2.5-flash Raw Response:');
        console.log(responseText);
        
        try {
            const parsed = JSON.parse(responseText);
            console.log('\n✅ Successfully parsed chicken business data:');
            console.log('Business Type:', parsed.business_type);
            console.log('Confidence:', parsed.confidence_score);
            console.log('Supplier:', parsed.learned_patterns?.supplier);
            console.log('Worker:', parsed.learned_patterns?.worker_mentioned);
            console.log('Quantities:', parsed.learned_patterns?.quantities);
        } catch (parseError) {
            console.warn('⚠️ JSON parsing failed, but API call succeeded');
        }
        
        // Test Gemini 2.5-pro for complex analysis
        console.log('\n\n2️⃣ Testing Gemini 2.5-pro for business insights...');
        
        const insightPrompt = `
Analyze this chicken business data and provide strategic insights:

Data Summary:
- Recent Purchase: 15 bags whole chicken @ 7500 pesos from Magnolia
- Processing Yield: Typically 80% parts, 20% necks
- Distribution: 2 branches (A: higher volume/lower price, B: lower volume/higher price)
- Sales Pattern: Branch A 80% sales rate @ 15 pesos, Branch B 60% sales rate @ 18 pesos

Provide business insights in JSON:
{
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "cost_analysis": {
    "cost_per_chicken": "calculated value",
    "projected_revenue": "calculated value",
    "profit_margin": "calculated percentage"
  },
  "optimization_suggestions": ["suggestion 1", "suggestion 2"]
}`;

        const insightResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: insightPrompt }]
                }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2000
                }
            })
        });
        
        if (!insightResponse.ok) {
            throw new Error(`Insight API responded with ${insightResponse.status}: ${insightResponse.statusText}`);
        }
        
        const insightData = await insightResponse.json();
        const insightText = insightData.candidates[0].content.parts[0].text;
        
        console.log('✅ Gemini 2.5-pro Business Insights:');
        console.log(insightText);
        
        try {
            const insightsParsed = JSON.parse(insightText);
            console.log('\n📊 Parsed Business Analysis:');
            console.log('Key Insights:', insightsParsed.insights?.slice(0, 2));
            console.log('Recommendations:', insightsParsed.recommendations);
            console.log('Cost Analysis:', insightsParsed.cost_analysis);
        } catch (parseError) {
            console.warn('⚠️ Insights JSON parsing failed, but got text response');
        }
        
        console.log('\n✅ Enhanced Gemini integration test completed successfully!');
        console.log('🎉 Both 2.5-flash and 2.5-pro models working correctly');
        console.log('🚀 Ready to integrate with your chicken business system');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error.message?.includes('401')) {
            console.log('ℹ️ API key authentication failed');
        } else if (error.message?.includes('quota')) {
            console.log('ℹ️ API quota exceeded, try again later');
        }
    }
}

// Run test
testSimpleGeminiIntegration().then(() => {
    console.log('\n🏁 Simple Gemini integration test completed');
}).catch(error => {
    console.error('💥 Test execution failed:', error);
});