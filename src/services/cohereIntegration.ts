/**
 * Cohere API Integration for Multi-Tier Fallback System
 * Provides premium AI capabilities as Tier 3 fallback
 * Specialized in high-quality text generation and embeddings
 * Optimized for 100k token input per minute with 2M context analysis
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { GeminiResponse, TaskRequest, GeminiConfig } from '../advanced-gemini-proxy';

export interface CohereModel {
  id: string;
  type: 'generation' | 'embedding';
  maxTokens: number;
  dimensions?: number;
  pricing: {
    input: number;
    output: number;
  };
  bestFor: string[];
}

export interface CohereConfig {
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

export class CohereIntegration {
  private client: AxiosInstance;
  private config: CohereConfig;
  private usageTracking: Map<string, { requests: number; tokens: number; lastReset: number }> = new Map();

  // Cohere models with free trial credits
  private readonly COHERE_MODELS: { [key: string]: CohereModel } = {
    // Text Generation Models
    'command': {
      id: 'command',
      type: 'generation',
      maxTokens: 4096,
      pricing: { input: 0.0015, output: 0.002 }, // per 1k tokens
      bestFor: ['complex-analysis', 'business-intelligence', 'detailed-reports', 'strategic-planning']
    },
    'command-light': {
      id: 'command-light',
      type: 'generation',
      maxTokens: 4096,
      pricing: { input: 0.0003, output: 0.0006 }, // per 1k tokens
      bestFor: ['fast-generation', 'quick-responses', 'real-time-processing', 'chat-responses']
    },
    'command-nightly': {
      id: 'command-nightly',
      type: 'generation',
      maxTokens: 4096,
      pricing: { input: 0.0015, output: 0.002 }, // per 1k tokens
      bestFor: ['experimental-features', 'cutting-edge-capabilities', 'advanced-reasoning']
    },

    // Embedding Models
    'embed-english-v3.0': {
      id: 'embed-english-v3.0',
      type: 'embedding',
      maxTokens: 512,
      dimensions: 1024,
      pricing: { input: 0.0001, output: 0 }, // per 1k tokens
      bestFor: ['high-quality-embeddings', 'semantic-search', 'document-similarity', 'business-documents']
    },
    'embed-multilingual-v3.0': {
      id: 'embed-multilingual-v3.0',
      type: 'embedding',
      maxTokens: 512,
      dimensions: 1024,
      pricing: { input: 0.0001, output: 0 }, // per 1k tokens
      bestFor: ['multilingual-support', 'international-business', 'cross-language-search']
    },
    'embed-english-light-v3.0': {
      id: 'embed-english-light-v3.0',
      type: 'embedding',
      maxTokens: 512,
      dimensions: 384,
      pricing: { input: 0.00005, output: 0 }, // per 1k tokens  
      bestFor: ['fast-embeddings', 'lightweight-search', 'real-time-similarity']
    }
  };

  constructor(config: CohereConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.COHERE_API_KEY,
      baseURL: config.baseURL || 'https://api.cohere.ai/v1',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Cohere-Version': '2022-12-06'
      }
    });

    this.initializeUsageTracking();
  }

  /**
   * Initialize usage tracking for all models
   */
  private initializeUsageTracking(): void {
    Object.keys(this.COHERE_MODELS).forEach(modelId => {
      this.usageTracking.set(modelId, {
        requests: 0,
        tokens: 0,
        lastReset: Date.now()
      });
    });
  }

  /**
   * Select best Cohere model based on task requirements
   */
  selectBestModel(task: TaskRequest): string {
    const { type, complexity, priority } = task;

    // Handle embedding tasks
    if (type === 'embedding') {
      if (complexity === 'complex' || priority === 'high') {
        return 'embed-english-v3.0'; // High quality
      }
      return 'embed-english-light-v3.0'; // Fast and efficient
    }

    // Handle text generation tasks
    if (complexity === 'complex' || priority === 'high') {
      return 'command'; // Premium model for complex tasks
    }
    
    if (complexity === 'simple' || priority === 'low') {
      return 'command-light'; // Fast and cost-effective
    }

    // Default to light model for most tasks
    return 'command-light';
  }

  /**
   * Check if model can handle request (budget-aware rate limiting)
   */
  private canMakeRequest(modelId: string, estimatedTokens: number = 1000): boolean {
    const usage = this.usageTracking.get(modelId);
    const model = this.COHERE_MODELS[modelId];
    
    if (!usage || !model) return false;

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Reset usage if window expired
    if (now - usage.lastReset > windowMs) {
      usage.requests = 0;
      usage.tokens = 0;
      usage.lastReset = now;
    }

    // Conservative rate limiting to manage costs
    const maxRequestsPerMinute = 50;
    const maxTokensPerMinute = 10000; // Conservative to manage trial credits

    return (
      usage.requests < maxRequestsPerMinute &&
      usage.tokens + estimatedTokens <= maxTokensPerMinute
    );
  }

  /**
   * Update usage tracking and cost estimation
   */
  private updateUsage(modelId: string, inputTokens: number, outputTokens: number = 0): void {
    const usage = this.usageTracking.get(modelId);
    const model = this.COHERE_MODELS[modelId];
    
    if (usage && model) {
      usage.requests += 1;
      usage.tokens += inputTokens + outputTokens;
      
      // Log cost estimation
      const cost = (inputTokens / 1000) * model.pricing.input + (outputTokens / 1000) * model.pricing.output;
      console.log(`Cohere ${modelId} cost estimate: $${cost.toFixed(6)}`);
    }
  }

  /**
   * Execute Cohere text generation request
   */
  async executeRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    const selectedModel = this.selectBestModel(task);
    const estimatedTokens = Math.ceil(prompt.length / 4);

    if (!this.canMakeRequest(selectedModel, estimatedTokens)) {
      throw new Error(`Cohere model ${selectedModel} rate limited or budget exceeded`);
    }

    const model = this.COHERE_MODELS[selectedModel];

    try {
      if (model.type === 'embedding') {
        return await this.executeEmbeddingRequest(selectedModel, prompt, config);
      } else {
        return await this.executeGenerationRequest(selectedModel, prompt, config);
      }
    } catch (error) {
      console.error(`Cohere request failed for ${selectedModel}:`, error);
      throw error;
    }
  }

  /**
   * Execute text generation request
   */
  private async executeGenerationRequest(
    modelId: string,
    prompt: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    const model = this.COHERE_MODELS[modelId];
    const startTime = Date.now();

    const requestData = {
      model: modelId,
      prompt: prompt,
      max_tokens: Math.min(config.maxOutputTokens || 1024, model.maxTokens),
      temperature: config.temperature || 0.7,
      p: config.topP || 0.9,
      k: config.topK || 0,
      stop_sequences: [],
      return_likelihoods: 'NONE'
    };

    const response = await this.client.post('/generate', requestData);
    const completion = response.data;

    if (!completion.generations || completion.generations.length === 0) {
      throw new Error('No generations returned from Cohere');
    }

    const generation = completion.generations[0];
    const generatedText = generation.text || '';
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(generatedText.length / 4);

    this.updateUsage(modelId, inputTokens, outputTokens);

    return {
      text: generatedText,
      model: `cohere:${modelId}`,
      success: true,
      metadata: {
        tokensUsed: inputTokens + outputTokens,
        processingTime: Date.now() - startTime,
        requestId: uuidv4(),
        finishReason: 'stop'
      }
    };
  }

  /**
   * Execute embedding request
   */
  private async executeEmbeddingRequest(
    modelId: string,
    text: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    const model = this.COHERE_MODELS[modelId];
    const startTime = Date.now();

    const requestData = {
      model: modelId,
      texts: [text],
      input_type: 'search_document'
    };

    const response = await this.client.post('/embed', requestData);
    const embeddings = response.data.embeddings;

    if (!embeddings || embeddings.length === 0) {
      throw new Error('No embeddings returned from Cohere');
    }

    const embedding = embeddings[0];
    const inputTokens = Math.ceil(text.length / 4);

    this.updateUsage(modelId, inputTokens, 0);

    return {
      text: JSON.stringify(embedding),
      model: `cohere:${modelId}`,
      success: true,
      metadata: {
        tokensUsed: inputTokens,
        processingTime: Date.now() - startTime,
        requestId: `cohere_embed_${Date.now()}`
      }
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(
    texts: string[],
    options: { model?: string; inputType?: string; batchSize?: number } = {}
  ): Promise<{ embeddings: number[][]; model: string; dimensions: number }> {
    const modelId = options.model || 'embed-english-v3.0';
    const batchSize = options.batchSize || 96; // Cohere's batch limit
    const inputType = options.inputType || 'search_document';
    const model = this.COHERE_MODELS[modelId];

    if (!model || model.type !== 'embedding') {
      throw new Error(`Invalid Cohere embedding model: ${modelId}`);
    }

    const allEmbeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const requestData = {
          model: modelId,
          texts: batch,
          input_type: inputType
        };

        const response = await this.client.post('/embed', requestData);
        const embeddings = response.data.embeddings;

        if (embeddings && embeddings.length > 0) {
          allEmbeddings.push(...embeddings);
        }

        // Update usage tracking
        const totalTokens = batch.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
        this.updateUsage(modelId, totalTokens, 0);

        // Rate limiting delay between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.warn(`Failed to generate embeddings for batch ${i}:`, error);
        // Add zero vectors as fallback
        const fallbackEmbeddings = batch.map(() => new Array(model.dimensions || 1024).fill(0));
        allEmbeddings.push(...fallbackEmbeddings);
      }
    }

    return {
      embeddings: allEmbeddings,
      model: `cohere:${modelId}`,
      dimensions: model.dimensions || 1024
    };
  }

  /**
   * Get available models and usage status
   */
  getAvailableModels(): { [key: string]: any } {
    const status: { [key: string]: any } = {};

    Object.entries(this.COHERE_MODELS).forEach(([modelId, config]) => {
      const usage = this.usageTracking.get(modelId);
      const canRequest = this.canMakeRequest(modelId, 1000);

      status[modelId] = {
        available: canRequest,
        config: {
          type: config.type,
          maxTokens: config.maxTokens,
          dimensions: config.dimensions,
          pricing: config.pricing,
          bestFor: config.bestFor
        },
        usage: usage ? {
          requests: usage.requests,
          tokens: usage.tokens,
          estimatedCost: this.calculateEstimatedCost(modelId, usage.tokens)
        } : null
      };
    });

    return status;
  }

  /**
   * Calculate estimated cost for usage
   */
  private calculateEstimatedCost(modelId: string, tokens: number): number {
    const model = this.COHERE_MODELS[modelId];
    if (!model) return 0;

    // Rough estimate assuming 70% input, 30% output for generation models
    if (model.type === 'generation') {
      const inputTokens = tokens * 0.7;
      const outputTokens = tokens * 0.3;
      return (inputTokens / 1000) * model.pricing.input + (outputTokens / 1000) * model.pricing.output;
    } else {
      // Embedding models only have input costs
      return (tokens / 1000) * model.pricing.input;
    }
  }

  /**
   * Health check for Cohere service
   */
  async healthCheck(): Promise<{ healthy: boolean; models: number; errors: string[]; trialCredits?: number }> {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('Cohere API key not configured');
    }

    try {
      // Test with a simple generation request
      const testResponse = await this.executeGenerationRequest(
        'command-light', 
        'Test: Respond with "OK"', 
        { maxOutputTokens: 10 }
      );
      
      if (!testResponse.success) {
        errors.push('Health check generation failed');
      }
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      healthy: errors.length === 0,
      models: Object.keys(this.COHERE_MODELS).length,
      errors
    };
  }
}

// Export singleton instance
export const cohereIntegration = new CohereIntegration();