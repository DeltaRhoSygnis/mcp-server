/**
 * Enhanced Gemini API Manager
 * Integrates @google/genai library with smart model selection, rate limiting, and optimal usage
 * Patterns inspired by advanced MCP server implementations
 */

import { GoogleGenAI } from '@google/genai';

interface GeminiModel {
  id: string;
  name: string;
  rpm: number; // Requests per minute
  tpm: number; // Tokens per minute  
  rpc: number; // Requests per call (for batch endpoints)
  costTier: 'free' | 'low' | 'medium' | 'high';
  useCase: string[];
  maxTokens?: number;
  supportedFeatures?: string[];
}

interface TaskRequest {
  type: 'text' | 'embedding' | 'flash' | 'preview' | 'audio' | 'multimodal';
  complexity: 'simple' | 'medium' | 'complex';
  priority: 'low' | 'normal' | 'high';
  estimatedTokens?: number;
  requiresStructuredOutput?: boolean;
}

interface UsageTracker {
  model: string;
  requestCount: number;
  tokenCount: number;
  lastRequest: number;
  resetTime: number;
}

/**
 * Enhanced Gemini Models Configuration with advanced features
 */
const GEMINI_MODELS: Record<string, GeminiModel> = {
  // Latest 2.5 series models for enhanced reasoning
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    rpm: 2,
    tpm: 250000,
    rpc: 100,
    costTier: 'high',
    useCase: ['complex-analysis', 'business-insights', 'detailed-reports', 'strategic-planning'],
    supportedFeatures: ['advanced-reasoning', 'long-context', 'structured-output']
  },
  
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash',
    rpm: 10,
    tpm: 250000,
    rpc: 1000,
    costTier: 'medium',
    useCase: ['structured-parsing', 'note-analysis', 'pattern-recognition', 'chicken-business-ops'],
    supportedFeatures: ['fast-response', 'structured-output', 'json-mode']
  },
  
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite', 
    rpm: 15,
    tpm: 1000000,
    rpc: 200,
    costTier: 'low',
    useCase: ['simple-parsing', 'quick-classification', 'lightweight-tasks']
  },
  
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    rpm: 15,
    tpm: 1000000,
    rpc: 300,
    costTier: 'medium',
    useCase: ['general-parsing', 'conversation', 'moderate-complexity']
  },
  
  'gemini-2.0-flash-exp': {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Experimental',
    rpm: 30,
    tpm: 1000000,
    rpc: 0, // Not specified for experimental
    costTier: 'free',
    useCase: ['experimental-features', 'testing', 'development']
  },
  
  // Live models
  'gemini-2.0-flash-live': {
    id: 'gemini-2.0-flash-live',
    name: 'Gemini 2.0 Flash Live',
    rpm: 3,
    tpm: 1000000,
    rpc: 0,
    costTier: 'high',
    useCase: ['real-time-processing', 'live-analysis']
  },
  
  // Multimodal generation models
  'gemini-2.5-flash-preview-tts': {
    id: 'gemini-2.5-flash-preview-tts',
    name: 'Gemini 2.5 Flash Preview TTS',
    rpm: 3,
    tpm: 15000,
    rpc: 15,
    costTier: 'high',
    useCase: ['text-to-speech', 'audio-generation']
  },
  
  'gemini-2.0-flash-preview-image': {
    id: 'gemini-2.0-flash-preview-image',
    name: 'Gemini 2.0 Flash Preview Image Generation',
    rpm: 10,
    tpm: 200000,
    rpc: 100,
    costTier: 'high',
    useCase: ['image-generation', 'visual-content']
  },
  
  // Other models
  'gamma-3-36': {
    id: 'gamma-3-36',
    name: 'Gamma 3.36',
    rpm: 30,
    tpm: 15000,
    rpc: 14400,
    costTier: 'medium',
    useCase: ['specialized-tasks', 'gamma-processing']
  },
  
  'gemini-embedding': {
    id: 'text-embedding-004',
    name: 'Gemini Embedding',
    rpm: 100,
    tpm: 30000,
    rpc: 1000,
    costTier: 'low',
    useCase: ['embeddings', 'similarity-search', 'rag']
  }
};

class GeminiAPIManager {
  private usageTrackers: Map<string, UsageTracker> = new Map();
  private apiKey: string;
  private googleGenAI: GoogleGenAI | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ No Gemini API key provided');
    } else {
      try {
        this.googleGenAI = new GoogleGenAI({ apiKey: this.apiKey });
        console.log('✅ GoogleGenAI client initialized with @google/genai library');
      } catch (error) {
        console.warn('⚠️ Failed to initialize @google/genai client, falling back to fetch:', error);
      }
    }
  }
  
  /**
   * Select the optimal model for a given task
   */
  selectOptimalModel(task: TaskRequest): string {
    // For chicken business use cases, map to appropriate models
    switch (task.type) {
      case 'embedding':
        return 'gemini-embedding';
        
      case 'text':
        if (task.complexity === 'simple' && !task.requiresStructuredOutput) {
          return 'gemini-2.0-flash-lite'; // Fastest, cheapest for simple tasks
        } else if (task.complexity === 'medium' || task.requiresStructuredOutput) {
          return 'gemini-2.5-flash'; // Good balance for structured parsing
        } else {
          return 'gemini-2.5-pro'; // Complex analysis
        }
        
      case 'flash':
        return task.complexity === 'simple' ? 'gemini-2.0-flash-lite' : 'gemini-2.0-flash';
        
      case 'preview':
        return 'gemini-2.0-flash-exp'; // Use experimental for testing
        
      case 'audio':
        return 'gemini-2.5-flash-preview-tts';
        
      case 'multimodal':
        return 'gemini-2.0-flash-preview-image';
        
      default:
        return 'gemini-2.0-flash'; // Safe default
    }
  }
  
  /**
   * Check if we can make a request without hitting rate limits
   */
  canMakeRequest(modelId: string): { allowed: boolean; waitTime?: number } {
    const model = GEMINI_MODELS[modelId];
    if (!model) {
      return { allowed: false };
    }
    
    const tracker = this.usageTrackers.get(modelId);
    if (!tracker) {
      // First request for this model
      this.initializeTracker(modelId);
      return { allowed: true };
    }
    
    const now = Date.now();
    
    // Reset tracker if minute has passed
    if (now >= tracker.resetTime) {
      tracker.requestCount = 0;
      tracker.tokenCount = 0;
      tracker.resetTime = now + 60000; // Reset in 1 minute
    }
    
    // Check RPM limit
    if (tracker.requestCount >= model.rpm) {
      const waitTime = tracker.resetTime - now;
      return { allowed: false, waitTime };
    }
    
    return { allowed: true };
  }
  
  /**
   * Make an API request with automatic model selection and rate limiting
   */
  async makeRequest(task: TaskRequest, prompt: string, options: any = {}): Promise<any> {
    const modelId = this.selectOptimalModel(task);
    const model = GEMINI_MODELS[modelId];
    
    // Check rate limits
    const rateLimitCheck = this.canMakeRequest(modelId);
    if (!rateLimitCheck.allowed) {
      if (rateLimitCheck.waitTime) {
        console.log(`⏳ Rate limit reached for ${model.name}. Waiting ${rateLimitCheck.waitTime}ms...`);
        await this.sleep(rateLimitCheck.waitTime);
      } else {
        throw new Error(`Rate limit exceeded for model ${model.name}`);
      }
    }
    
    // Update usage tracking
    this.updateUsageTracker(modelId);
    
    console.log(`🤖 Using ${model.name} for ${task.type} task (${task.complexity} complexity)`);
    
    try {
      const response = await this.callGeminiAPI(modelId, prompt, options);
      return response;
    } catch (error) {
      console.error(`❌ Error with ${model.name}:`, error);
      
      // Try fallback model if available
      if (task.complexity !== 'simple') {
        console.log('🔄 Trying fallback model...');
        const fallbackTask = { ...task, complexity: 'simple' as const };
        return this.makeRequest(fallbackTask, prompt, options);
      }
      
      throw error;
    }
  }
  
  /**
   * Enhanced parsing using @google/genai library for better performance
   */
  async parseChickenNoteEnhanced(noteText: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): Promise<any> {
    if (this.googleGenAI) {
      try {
        // Use 2.5 series models for enhanced reasoning
        const modelId = complexity === 'complex' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        const model = this.googleGenAI.getGenerativeModel({ model: modelId });
        
        const prompt = this.buildChickenNotePrompt(noteText);
        
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
            responseMimeType: "application/json"
          }
        });
        
        const response = await result.response;
        console.log('✅ Enhanced parsing successful with', modelId);
        
        return {
          text: response.text(),
          metadata: {
            model: modelId,
            library: '@google/genai',
            performance: 'enhanced'
          }
        };
      } catch (error) {
        console.warn('⚠️ Enhanced parsing failed, falling back to standard method:', error);
      }
    }
    
    // Fallback to original method
    return this.parseChickenNote(noteText, complexity);
  }

  /**
   * Legacy parsing method (keeping for compatibility)
   */
  async parseChickenNote(noteText: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): Promise<any> {
    const task: TaskRequest = {
      type: 'text',
      complexity,
      priority: 'normal',
      requiresStructuredOutput: true,
      estimatedTokens: noteText.length * 1.5 // Rough estimate
    };
    
    const prompt = this.buildChickenNotePrompt(noteText);
    
    return this.makeRequest(task, prompt, {
      responseMimeType: "application/json",
      temperature: 0.3, // Low temperature for consistent parsing
      maxOutputTokens: 1000
    });
  }
  
  /**
   * Generate embeddings for similarity search
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const task: TaskRequest = {
      type: 'embedding',
      complexity: 'simple',
      priority: 'normal'
    };
    
    const response = await this.makeRequest(task, text, {
      model: 'text-embedding-004'
    });
    
    return response.embedding?.values || [];
  }
  
  /**
   * Get business insights using high-capability model
   */
  async getBusinessInsights(salesData: any[], expenseData: any[]): Promise<any> {
    const task: TaskRequest = {
      type: 'text',
      complexity: 'complex',
      priority: 'high',
      requiresStructuredOutput: true
    };
    
    const prompt = this.buildInsightsPrompt(salesData, expenseData);
    
    return this.makeRequest(task, prompt, {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 2000
    });
  }
  
  /**
   * Get current usage statistics
   */
  getUsageStats(): Record<string, { requests: number; tokens: number; model: string }> {
    const stats: Record<string, any> = {};
    
    for (const [modelId, tracker] of this.usageTrackers) {
      const model = GEMINI_MODELS[modelId];
      stats[modelId] = {
        requests: tracker.requestCount,
        tokens: tracker.tokenCount,
        model: model.name,
        rpm_limit: model.rpm,
        tpm_limit: model.tpm,
        usage_percentage: (tracker.requestCount / model.rpm) * 100
      };
    }
    
    return stats;
  }
  
  // Private helper methods
  
  private initializeTracker(modelId: string): void {
    this.usageTrackers.set(modelId, {
      model: modelId,
      requestCount: 0,
      tokenCount: 0,
      lastRequest: 0,
      resetTime: Date.now() + 60000
    });
  }
  
  private updateUsageTracker(modelId: string, tokens: number = 100): void {
    const tracker = this.usageTrackers.get(modelId);
    if (tracker) {
      tracker.requestCount++;
      tracker.tokenCount += tokens;
      tracker.lastRequest = Date.now();
    }
  }
  
  private async callGeminiAPI(modelId: string, prompt: string, options: any): Promise<any> {
    const url = `${this.baseUrl}/${modelId}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature || 0.5,
        maxOutputTokens: options.maxOutputTokens || 1024,
        responseMimeType: options.responseMimeType || "text/plain"
      }
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No response from Gemini API');
    }
    
    return {
      text: data.candidates[0].content.parts[0].text,
      metadata: {
        model: modelId,
        tokensUsed: data.usageMetadata || {}
      }
    };
  }
  
  private buildChickenNotePrompt(noteText: string): string {
    return `
You are an AI assistant for a chicken business. Parse this business note into structured JSON.

Note: "${noteText}"

Return JSON with this exact structure:
{
  "business_type": "purchase|processing|distribution|cooking|sales",
  "confidence_score": 0-100,
  "items": [
    {
      "product": "string",
      "quantity": number,
      "unit": "string",
      "price": number,
      "category": "string"
    }
  ],
  "learned_patterns": {
    "supplier_mentioned": "string or null",
    "location_mentioned": "string or null", 
    "time_indicator": "string or null"
  }
}

Focus on chicken business operations: feed purchases, live chicken processing, meat sales, cooking operations.
`;
  }
  
  private buildInsightsPrompt(salesData: any[], expenseData: any[]): string {
    const totalSales = salesData.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExpenses = expenseData.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    return `
You are a business consultant for a chicken restaurant. Analyze this data and provide insights.

Sales Data: Total ₱${totalSales.toFixed(2)}
Expense Data: Total ₱${totalExpenses.toFixed(2)}
Net Profit: ₱${(totalSales - totalExpenses).toFixed(2)}

Return JSON with this structure:
{
  "insights": ["insight1", "insight2", "insight3"],
  "risks": ["risk1", "risk2"], 
  "opportunities": ["opportunity1", "opportunity2"],
  "recommendations": ["rec1", "rec2"]
}
`;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const geminiAPIManager = new GeminiAPIManager();

// Export class for direct instantiation
export { GeminiAPIManager };

// Export types for use in other files
export type { TaskRequest, GeminiModel, UsageTracker };
export { GEMINI_MODELS };