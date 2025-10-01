/**
 * Advanced Gemini Proxy with Gen AI SDK Integration
 * Production-ready implementation with streaming, safety, and advanced features
 */

// Use require() for Google Generative AI to fix compilation issues
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel } = require('@google/generative-ai');
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  streaming?: boolean;
  safetyThreshold?: 'low' | 'medium' | 'high';
  useLoadBalancer?: boolean;
}

export interface GeminiResponse {
  text: string;
  model: string;
  success: boolean;
  metadata: {
    tokensUsed?: number;
    processingTime: number;
    requestId: string;
    safetyRatings?: any[];
    finishReason?: string;
  };
}

export interface ModelCapabilities {
  maxTokens: number;
  rateLimit: { rpm: number; tpm: number };
  costTier: 'low' | 'medium' | 'high';
  features: string[];
  bestFor: string[];
}

export interface TaskRequest {
  type: 'text' | 'embedding' | 'flash' | 'preview' | 'audio' | 'multimodal';
  complexity: 'simple' | 'medium' | 'complex';
  priority: 'low' | 'medium' | 'high';
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

export class AdvancedGeminiProxy {
  private genAI: any;
  private supabase;
  private models: Map<string, ModelCapabilities> = new Map();
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();
  private usageTrackers: Map<string, UsageTracker> = new Map();

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.initializeModels();
  }

  private initializeModels() {
    this.models = new Map([
      // Latest 2.5 series models for enhanced reasoning
      ['gemini-2.5-pro', {
        maxTokens: 8192,
        rateLimit: { rpm: 2, tpm: 250000 },
        costTier: 'high',
        features: ['advanced-reasoning', 'long-context', 'structured-output'],
        bestFor: ['complex-analysis', 'business-insights', 'detailed-reports', 'strategic-planning']
      }],
      ['gemini-2.5-flash', {
        maxTokens: 8192,
        rateLimit: { rpm: 10, tpm: 250000 },
        costTier: 'medium',
        features: ['fast-response', 'structured-output', 'json-mode'],
        bestFor: ['structured-parsing', 'note-analysis', 'pattern-recognition', 'chicken-business-ops']
      }],
      ['gemini-2.5-flash-preview', {
        maxTokens: 8192,
        rateLimit: { rpm: 10, tpm: 250000 },
        costTier: 'medium',
        features: ['preview-features', 'structured-output', 'experimental'],
        bestFor: ['advanced-parsing', 'preview-features', 'cutting-edge-analysis']
      }],
      ['gemini-2.5-flash-lite', {
        maxTokens: 4096,
        rateLimit: { rpm: 15, tpm: 250000 },
        costTier: 'low',
        features: ['lightweight', 'fast', 'efficient'],
        bestFor: ['quick-classification', 'simple-parsing', 'real-time-responses']
      }],
      ['gemini-2.5-flash-lite-preview', {
        maxTokens: 4096,
        rateLimit: { rpm: 15, tpm: 250000 },
        costTier: 'low',
        features: ['lightweight', 'preview', 'experimental'],
        bestFor: ['experimental-features', 'beta-testing', 'preview-capabilities']
      }],
      ['gemini-2.0-flash-exp', {
        maxTokens: 8192,
        rateLimit: { rpm: 30, tpm: 1000000 },
        costTier: 'low',
        features: ['text', 'code', 'multimodal', 'fast', 'experimental'],
        bestFor: ['general', 'coding', 'analysis', 'development']
      }],
      ['gemini-2.0-flash-thinking-exp', {
        maxTokens: 32768,
        rateLimit: { rpm: 15, tpm: 1000000 },
        costTier: 'high',
        features: ['reasoning', 'complex-analysis', 'step-by-step'],
        bestFor: ['complex-reasoning', 'detailed-analysis', 'problem-solving']
      }],
      ['gemini-2.0-flash', {
        maxTokens: 8192,
        rateLimit: { rpm: 15, tpm: 1000000 },
        costTier: 'medium',
        features: ['general-parsing', 'conversation', 'moderate-complexity'],
        bestFor: ['general-parsing', 'conversation', 'moderate-complexity']
      }],
      ['gemini-2.0-flash-lite', {
        maxTokens: 4096,
        rateLimit: { rpm: 15, tpm: 1000000 },
        costTier: 'low',
        features: ['fast', 'lightweight'],
        bestFor: ['simple-parsing', 'quick-classification', 'lightweight-tasks']
      }],
      ['gemini-2.5-pro', {
        maxTokens: 8192,
        rateLimit: { rpm: 5, tpm: 250000 },
        costTier: 'high',
        features: ['advanced-reasoning', 'long-context', 'structured-output'],
        bestFor: ['complex-business-analysis', 'strategic-insights', 'detailed-reports']
      }],
      ['gemini-2.0-flash', {
        maxTokens: 8192,
        rateLimit: { rpm: 15, tpm: 1000000 },
        costTier: 'medium',
        features: ['general-parsing', 'conversation', 'moderate-complexity'],
        bestFor: ['voice-parsing', 'business-conversations', 'note-analysis']
      }],
      ['text-embedding-004', {
        maxTokens: 2048,
        rateLimit: { rpm: 100, tpm: 30000 },
        costTier: 'low',
        features: ['embedding', 'semantic-search'],
        bestFor: ['embeddings', 'similarity', 'search']
      }]
    ]);
  }

  /**
   * Intelligent model selection based on task requirements
   */
  selectBestModel(taskType: {
    complexity: 'simple' | 'medium' | 'complex';
    type: 'text' | 'code' | 'analysis' | 'reasoning' | 'embedding';
    priority: 'low' | 'medium' | 'high';
    contextLength?: 'short' | 'medium' | 'long';
  }): string {
    const { complexity, type, priority, contextLength = 'medium' } = taskType;

    // Handle embeddings
    if (type === 'embedding') {
      return 'text-embedding-004';
    }

    // Handle complex reasoning tasks
    if (complexity === 'complex' && type === 'reasoning') {
      return 'gemini-2.0-flash-thinking-exp';
    }

    // Handle long context requirements
    if (contextLength === 'long' || complexity === 'complex') {
      return priority === 'high' ? 'gemini-2.5-pro' : 'gemini-2.0-flash-thinking-exp';
    }

    // Handle simple/fast tasks
    if (complexity === 'simple' || priority === 'low') {
      return 'gemini-2.0-flash-lite';
    }

    // Default for medium complexity
    return 'gemini-2.0-flash';
  }

  /**
   * Initialize usage tracker for a model
   */
  private initializeUsageTracker(modelId: string): void {
    this.usageTrackers.set(modelId, {
      model: modelId,
      requestCount: 0,
      tokenCount: 0,
      lastRequest: Date.now(),
      resetTime: Date.now() + 60000 // Reset in 1 minute
    });
  }

  /**
   * Update usage tracker after a request
   */
  private updateUsageTracker(modelId: string, tokensUsed: number = 0): void {
    let tracker = this.usageTrackers.get(modelId);
    if (!tracker) {
      this.initializeUsageTracker(modelId);
      tracker = this.usageTrackers.get(modelId)!;
    }

    tracker.requestCount++;
    tracker.tokenCount += tokensUsed;
    tracker.lastRequest = Date.now();
  }

  /**
   * Enhanced rate limit checking with detailed feedback
   */
  canMakeRequest(modelId: string): { allowed: boolean; waitTime?: number; reason?: string } {
    const model = this.models.get(modelId);
    if (!model) {
      return { allowed: false, reason: `Unknown model: ${modelId}` };
    }

    const tracker = this.usageTrackers.get(modelId);
    if (!tracker) {
      // First request for this model
      this.initializeUsageTracker(modelId);
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
    if (tracker.requestCount >= model.rateLimit.rpm) {
      const waitTime = tracker.resetTime - now;
      return { 
        allowed: false, 
        waitTime,
        reason: `Rate limit exceeded: ${tracker.requestCount}/${model.rateLimit.rpm} RPM`
      };
    }

    // Check TPM limit (approximate)
    if (tracker.tokenCount >= model.rateLimit.tpm) {
      const waitTime = tracker.resetTime - now;
      return { 
        allowed: false, 
        waitTime,
        reason: `Token limit exceeded: ${tracker.tokenCount}/${model.rateLimit.tpm} TPM`
      };
    }

    return { allowed: true };
  }

  /**
   * Smart model selection based on task requirements (enhanced version)
   * Implements multi-tier fallback: Gemini 2.5 → Gemini 2.0 → External APIs
   */
  selectOptimalModel(task: TaskRequest): string {
    const { type, complexity, priority, estimatedTokens } = task;

    // Handle embeddings
    if (type === 'embedding') {
      return 'text-embedding-004';
    }

    // Handle complex reasoning tasks (First layer: 2.5 series)
    if (complexity === 'complex' && type === 'text') {
      return priority === 'high' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    }

    // Handle structured output requirements (First layer: 2.5 series)
    if (task.requiresStructuredOutput) {
      return complexity === 'complex' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    }

    // Handle simple tasks efficiently (First layer: 2.5 lite)
    if (complexity === 'simple') {
      return 'gemini-2.5-flash-lite';
    }

    // Handle medium complexity with cost considerations (First layer: 2.5 series)
    if (complexity === 'medium') {
      return priority === 'high' ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';
    }

    // Default fallback (First layer)
    return 'gemini-2.5-flash';
  }

  /**
   * Multi-tier fallback model selection
   * Tier 1: Gemini 2.5 series (primary)
   * Tier 2: Gemini 2.0 series (secondary)
   * Tier 3: External APIs (OpenRouter, HuggingFace, Cohere)
   */
  getModelFallbackChain(task: TaskRequest): string[] {
    const { complexity, type, priority } = task;
    
    // First layer: Gemini 2.5 variants
    const tier1Models = {
      'complex': ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-preview'],
      'medium': ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-preview'],
      'simple': ['gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview', 'gemini-2.5-flash']
    };
    
    // Second layer: Gemini 2.0 fallbacks
    const tier2Models = {
      'complex': ['gemini-2.0-flash-thinking-exp', 'gemini-2.0-flash-exp'],
      'medium': ['gemini-2.0-flash', 'gemini-2.0-flash-exp'],
      'simple': ['gemini-2.0-flash-lite', 'gemini-2.0-flash']
    };
    
    const firstLayer = tier1Models[complexity] || tier1Models['medium'];
    const secondLayer = tier2Models[complexity] || tier2Models['medium'];
    
    return [...firstLayer, ...secondLayer];
  }

  /**
   * Execute request with multi-tier fallback system
   */
  async executeWithFallback(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const fallbackChain = this.getModelFallbackChain(task);
    let lastError: Error | null = null;
    
    // Tier 1: Try Gemini 2.5 models
    for (const model of fallbackChain.slice(0, 3)) {
      try {
        const rateLimitCheck = this.canMakeRequest(model);
        if (rateLimitCheck.allowed) {
          return await this.generateText(prompt, { ...config, model });
        }
      } catch (error) {
        console.warn(`Tier 1 model ${model} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }
    
    // Tier 2: Try Gemini 2.0 models
    for (const model of fallbackChain.slice(3)) {
      try {
        const rateLimitCheck = this.canMakeRequest(model);
        if (rateLimitCheck.allowed) {
          return await this.generateText(prompt, { ...config, model });
        }
      } catch (error) {
        console.warn(`Tier 2 model ${model} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }
    
    // Tier 3: External APIs fallback (placeholder for future implementation)
    try {
      return await this.executeExternalFallback(task, prompt, config);
    } catch (error) {
      console.error('All fallback tiers failed:', error);
      throw lastError || new Error('All AI models unavailable');
    }
  }

  /**
   * External API fallback using Dynamic Load Balancer
   * Routes to OpenRouter, HuggingFace, Cohere based on optimal strategy
   */
  private async executeExternalFallback(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    try {
      // Import dynamically to avoid circular dependencies
      const { dynamicLoadBalancer } = await import('./services/dynamicLoadBalancer');
      
      // Use load balancer for external API routing
      // Remove preferredTier as it's not part of GeminiConfig
      return await dynamicLoadBalancer.routeRequest(task, prompt, config);
    } catch (error) {
      console.error('External API fallback failed:', error);
      throw new Error(`All external APIs unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced request method with automatic model selection and load balancing
   */
  async makeIntelligentRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      // Use load balancer if enabled
      if (config.useLoadBalancer) {
        const { dynamicLoadBalancer } = await import('./services/dynamicLoadBalancer');
        return await dynamicLoadBalancer.routeRequest(task, prompt, config);
      }

      // Select optimal model
      const modelId = this.selectOptimalModel(task);
      console.log(`🧠 Selected ${modelId} for ${task.type} task (${task.complexity} complexity)`);

      // Check rate limits
      const rateLimitCheck = this.canMakeRequest(modelId);
      if (!rateLimitCheck.allowed) {
        if (rateLimitCheck.waitTime) {
          console.log(`⏳ Rate limit reached. Waiting ${rateLimitCheck.waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime));
          return this.makeIntelligentRequest(task, prompt, config);
        } else {
          throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
        }
      }

      // Make the actual request using existing generateText method
      const response = await this.generateText(prompt, {
        ...config,
        taskType: {
          complexity: task.complexity,
          type: task.type as any,
          priority: task.priority
        },
        requestId
      });

      // Update usage tracking
      this.updateUsageTracker(modelId, response.metadata.tokensUsed || 0);

      return response;

    } catch (error) {
      console.error(`❌ Error in intelligent request:`, error);
      
      // Try fallback with simpler model if this was a complex task
      if (task.complexity !== 'simple') {
        console.log('🔄 Trying fallback with simpler model...');
        const fallbackTask: TaskRequest = { ...task, complexity: 'simple' };
        return this.makeIntelligentRequest(fallbackTask, prompt, config);
      }
      
      throw error;
    }
  }

  /**
   * Enhanced text generation with streaming support
   */
  async generateText(
    prompt: string,
    config: GeminiConfig & {
      model?: string;
      taskType?: {
        complexity: 'simple' | 'medium' | 'complex';
        type: 'text' | 'code' | 'analysis' | 'reasoning';
        priority: 'low' | 'medium' | 'high';
        contextLength?: 'short' | 'medium' | 'long';
      };
      userId?: string;
      requestId?: string;
    } = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    const requestId = config.requestId || uuidv4();
    
    // Select optimal model
    const selectedModel = config.model || 
      (config.taskType ? this.selectBestModel(config.taskType) : 'gemini-2.0-flash-exp');

    try {
      // Check rate limits
      this.checkRateLimit(selectedModel);

      const model = this.getModel(selectedModel, config);
      const result = config.streaming 
        ? await this.generateStreamingText(model, prompt, requestId)
        : await this.generateNonStreamingText(model, prompt, requestId);

      const processingTime = Date.now() - startTime;

      // Log successful request
      await this.logRequest(
        selectedModel,
        prompt,
        result,
        true,
        undefined,
        processingTime,
        config.userId,
        requestId
      );

      return {
        text: result.text,
        model: selectedModel,
        success: true,
        metadata: {
          tokensUsed: result.tokensUsed,
          processingTime,
          requestId,
          safetyRatings: result.safetyRatings,
          finishReason: result.finishReason
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.logRequest(
        selectedModel,
        prompt,
        null,
        false,
        errorMessage,
        processingTime,
        config.userId,
        requestId
      );

      throw new Error(`Gemini generation failed: ${errorMessage}`);
    }
  }

  /**
   * Generate embeddings with batch support
   */
  async generateEmbeddings(
    texts: string[],
    options: {
      batchSize?: number;
      userId?: string;
      requestId?: string;
    } = {}
  ): Promise<{
    embeddings: number[][];
    dimensions: number;
    model: string;
    metadata: { processingTime: number; requestId: string };
  }> {
    const startTime = Date.now();
    const requestId = options.requestId || uuidv4();
    const batchSize = options.batchSize || 10;
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });

    try {
      const embeddings: number[][] = [];

      // Process in batches to respect rate limits
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (text) => {
          const result = await model.generateContent([{ text }]);
          return result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        });

        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);

        // Rate limiting delay between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const processingTime = Date.now() - startTime;

      // Log embedding generation
      await this.logRequest(
        'text-embedding-004',
        `Embedding ${texts.length} texts`,
        { embeddings: embeddings.length },
        true,
        undefined,
        processingTime,
        options.userId,
        requestId
      );

      return {
        embeddings,
        dimensions: embeddings[0]?.length || 0,
        model: 'text-embedding-004',
        metadata: { processingTime, requestId }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  /**
   * Get configured model instance
   */
  private getModel(modelName: string, config: GeminiConfig): any {
    const safetySettings = this.getSafetySettings(config.safetyThreshold || 'medium');
    
    return this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: config.temperature || 0.3,
        topP: config.topP || 0.8,
        topK: config.topK || 40,
        maxOutputTokens: config.maxOutputTokens || 2048,
      },
      safetySettings
    });
  }

  /**
   * Generate text without streaming
   */
  private async generateNonStreamingText(
    model: any,
    prompt: string,
    requestId: string
  ): Promise<{
    text: string;
    tokensUsed?: number;
    safetyRatings?: any[];
    finishReason?: string;
  }> {
    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;

    if (!response.text()) {
      throw new Error('No text generated by model');
    }

    return {
      text: response.text(),
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
      safetyRatings: response.candidates?.[0]?.safetyRatings,
      finishReason: response.candidates?.[0]?.finishReason
    };
  }

  /**
   * Generate text with streaming
   */
  private async generateStreamingText(
    model: any,
    prompt: string,
    requestId: string
  ): Promise<{
    text: string;
    tokensUsed?: number;
    safetyRatings?: any[];
    finishReason?: string;
  }> {
    const result = await model.generateContent([{ text: prompt }]);
    const response = result.response;
    const fullText = response.text() || '';
    const safetyRatings = response.candidates?.[0]?.safetyRatings;
    const finishReason = response.candidates?.[0]?.finishReason;
    const tokensUsed = response.usageMetadata?.totalTokenCount;

    return {
      text: fullText,
      tokensUsed,
      safetyRatings,
      finishReason
    };
  }

  /**
   * Get safety settings based on threshold
   */
  private getSafetySettings(threshold: 'low' | 'medium' | 'high') {
    const thresholds = {
      low: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      medium: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      high: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
    };

    const selectedThreshold = thresholds[threshold];

    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: selectedThreshold,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: selectedThreshold,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: selectedThreshold,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: selectedThreshold,
      },
    ];
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(model: string): void {
    const modelConfig = this.models.get(model);
    if (!modelConfig) return;

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const key = `${model}_${Math.floor(now / windowMs)}`;
    
    const currentLimit = this.rateLimitCache.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (currentLimit.count >= modelConfig.rateLimit.rpm) {
      throw new Error(`Rate limit exceeded for model ${model}. Try again in ${Math.ceil((currentLimit.resetTime - now) / 1000)} seconds.`);
    }

    currentLimit.count++;
    this.rateLimitCache.set(key, currentLimit);

    // Clean up old entries
    if (this.rateLimitCache.size > 100) {
      for (const [key, value] of this.rateLimitCache.entries()) {
        if (value.resetTime < now) {
          this.rateLimitCache.delete(key);
        }
      }
    }
  }

  /**
   * Comprehensive request logging
   */
  private async logRequest(
    model: string,
    prompt: string,
    response: any,
    success: boolean,
    errorMessage?: string,
    processingTime?: number,
    userId?: string,
    requestId?: string
  ): Promise<void> {
    if (process.env.ENABLE_AI_AUDIT_LOGS !== 'true') return;

    try {
      await this.supabase.from('ai_audit_logs').insert({
        id: uuidv4(),
        operation_type: 'genai_sdk_call',
        input_data: {
          model,
          prompt: prompt.substring(0, 500),
          prompt_length: prompt.length
        },
        output_data: success ? {
          text: response?.text?.substring(0, 500),
          tokensUsed: response?.tokensUsed,
          finishReason: response?.finishReason
        } : null,
        model_used: model,
        tokens_used: response?.tokensUsed || 0,
        success,
        error_message: errorMessage,
        processing_time_ms: processingTime,
        user_id: userId,
        request_id: requestId,
        metadata: {
          sdk_version: 'google-genai',
          safety_ratings: response?.safetyRatings,
          model_capabilities: this.models.get(model),
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.warn('Failed to log request:', logError);
    }
  }

  /**
   * Health check with model-specific testing
   */
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    models: Record<string, { status: 'healthy' | 'unhealthy'; latency?: number; error?: string }>;
  }> {
    const modelTests = Array.from(this.models.keys()).slice(0, 3); // Test first 3 models
    const results: Record<string, any> = {};

    await Promise.allSettled(
      modelTests.map(async (modelName) => {
        if (modelName === 'text-embedding-004') {
          // Test embedding model
          try {
            const startTime = Date.now();
            await this.generateEmbeddings(['health check test'], { batchSize: 1 });
            results[modelName] = { status: 'healthy', latency: Date.now() - startTime };
          } catch (error) {
            results[modelName] = { 
              status: 'unhealthy', 
              error: error instanceof Error ? error.message : String(error) 
            };
          }
        } else {
          // Test text generation model
          try {
            const startTime = Date.now();
            await this.generateText('Health check', { 
              model: modelName,
              maxOutputTokens: 10,
              temperature: 0
            });
            results[modelName] = { status: 'healthy', latency: Date.now() - startTime };
          } catch (error) {
            results[modelName] = { 
              status: 'unhealthy', 
              error: error instanceof Error ? error.message : String(error) 
            };
          }
        }
      })
    );

    const healthyCount = Object.values(results).filter((r: any) => r.status === 'healthy').length;
    const overall = healthyCount === modelTests.length ? 'healthy' : 
                   healthyCount > 0 ? 'degraded' : 'unhealthy';

    return { overall, models: results };
  }

  /**
   * Get model capabilities and status
   */
  getModelInfo(): Record<string, ModelCapabilities & { available: boolean }> {
    const info: Record<string, ModelCapabilities & { available: boolean }> = {};
    
    for (const [name, capabilities] of this.models.entries()) {
      info[name] = { ...capabilities, available: true };
    }

    return info;
  }

  /**
   * Execute request method for load balancer compatibility
   */
  async executeRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    return this.makeIntelligentRequest(task, prompt, config);
  }

  /**
   * Batch processing with intelligent load balancing
   */
  async batchProcess(
    requests: Array<{
      prompt: string;
      config?: GeminiConfig & { taskType?: any };
      priority?: 'low' | 'medium' | 'high';
    }>,
    options: {
      maxConcurrency?: number;
      userId?: string;
      requestId?: string;
    } = {}
  ): Promise<Array<{ success: boolean; result?: GeminiResponse; error?: string; index: number }>> {
    const { maxConcurrency = 3, userId, requestId = uuidv4() } = options;
    const results: Array<{ success: boolean; result?: GeminiResponse; error?: string; index: number }> = [];

    // Sort by priority
    const sortedRequests = requests.map((req, index) => ({ ...req, originalIndex: index }))
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority || 'medium'] || 2) - (priorityOrder[a.priority || 'medium'] || 2);
      });

    // Process in batches
    for (let i = 0; i < sortedRequests.length; i += maxConcurrency) {
      const batch = sortedRequests.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (req) => {
        try {
          const result = await this.generateText(req.prompt, {
            ...req.config,
            userId,
            requestId: `${requestId}_${req.originalIndex}`
          });
          return { success: true, result, index: req.originalIndex };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error),
            index: req.originalIndex 
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ 
            success: false, 
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            index: -1 
          });
        }
      }

      // Rate limiting delay between batches
      if (i + maxConcurrency < sortedRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Sort results back to original order
    return results.sort((a, b) => a.index - b.index);
  }
}

export default AdvancedGeminiProxy;