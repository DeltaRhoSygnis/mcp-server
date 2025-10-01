/**
 * HuggingFace API Integration for Multi-Tier Fallback System
 * Provides free inference API models as Tier 3 fallback
 * Specialized in embeddings, conversational AI, and instruction following
 * Optimized for 100k token input per minute with 2M context analysis
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { GeminiResponse, TaskRequest, GeminiConfig } from '../advanced-gemini-proxy';

export interface HuggingFaceModel {
  id: string;
  task: string;
  maxTokens: number;
  dimensions?: number; // For embedding models
  languages?: string[];
  bestFor: string[];
  apiEndpoint: string;
}

export interface HuggingFaceConfig {
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

export class HuggingFaceIntegration {
  private client: AxiosInstance;
  private config: HuggingFaceConfig;
  private usageTracking: Map<string, { requests: number; tokens: number; lastReset: number }> = new Map();

  // Free inference API models optimized for chicken business
  private readonly FREE_MODELS: { [key: string]: HuggingFaceModel } = {
    // Text Generation Models
    'microsoft/DialoGPT-large': {
      id: 'microsoft/DialoGPT-large',
      task: 'text-generation',
      maxTokens: 1024,
      bestFor: ['conversational-ai', 'chat-responses', 'customer-support'],
      apiEndpoint: '/models/microsoft/DialoGPT-large'
    },
    'google/flan-t5-large': {
      id: 'google/flan-t5-large',
      task: 'text2text-generation',
      maxTokens: 512,
      bestFor: ['instruction-following', 'task-completion', 'business-automation'],
      apiEndpoint: '/models/google/flan-t5-large'
    },
    'facebook/blenderbot-400M-distill': {
      id: 'facebook/blenderbot-400M-distill',
      task: 'conversational',
      maxTokens: 512,
      bestFor: ['quick-responses', 'simple-conversations', 'customer-chat'],
      apiEndpoint: '/models/facebook/blenderbot-400M-distill'
    },
    'microsoft/DialoGPT-medium': {
      id: 'microsoft/DialoGPT-medium',
      task: 'text-generation',
      maxTokens: 1024,
      bestFor: ['medium-conversations', 'balanced-responses', 'worker-assistance'],
      apiEndpoint: '/models/microsoft/DialoGPT-medium'
    },

    // Embedding Models (High Priority for Vector Operations)
    'sentence-transformers/all-mpnet-base-v2': {
      id: 'sentence-transformers/all-mpnet-base-v2',
      task: 'feature-extraction',
      maxTokens: 384,
      dimensions: 768,
      bestFor: ['high-quality-embeddings', 'semantic-search', 'document-similarity'],
      apiEndpoint: '/models/sentence-transformers/all-mpnet-base-v2'
    },
    'sentence-transformers/all-MiniLM-L6-v2': {
      id: 'sentence-transformers/all-MiniLM-L6-v2',
      task: 'feature-extraction',
      maxTokens: 256,
      dimensions: 384,
      bestFor: ['fast-embeddings', 'lightweight-search', 'quick-similarity'],
      apiEndpoint: '/models/sentence-transformers/all-MiniLM-L6-v2'
    },
    'sentence-transformers/multi-qa-MiniLM-L6-cos-v1': {
      id: 'sentence-transformers/multi-qa-MiniLM-L6-cos-v1',
      task: 'feature-extraction',
      maxTokens: 256,
      dimensions: 384,
      bestFor: ['question-answering', 'customer-queries', 'faq-matching'],
      apiEndpoint: '/models/sentence-transformers/multi-qa-MiniLM-L6-cos-v1'
    },

    // Specialized Models
    'microsoft/DialoGPT-small': {
      id: 'microsoft/DialoGPT-small',
      task: 'text-generation',
      maxTokens: 512,
      bestFor: ['lightweight-chat', 'quick-responses', 'simple-queries'],
      apiEndpoint: '/models/microsoft/DialoGPT-small'
    }
  };

  constructor(config: HuggingFaceConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY,
      baseURL: config.baseURL || 'https://api-inference.huggingface.co',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.initializeUsageTracking();
  }

  /**
   * Initialize usage tracking for all models
   */
  private initializeUsageTracking(): void {
    Object.keys(this.FREE_MODELS).forEach(modelId => {
      this.usageTracking.set(modelId, {
        requests: 0,
        tokens: 0,
        lastReset: Date.now()
      });
    });
  }

  /**
   * Select best model based on task requirements
   */
  selectBestModel(task: TaskRequest): string {
    const { type, complexity } = task;

    // Handle embedding tasks
    if (type === 'embedding') {
      if (complexity === 'complex') {
        return 'sentence-transformers/all-mpnet-base-v2'; // Higher quality
      }
      return 'sentence-transformers/all-MiniLM-L6-v2'; // Faster
    }

    // Handle conversational tasks
    if (task.type === 'text' && complexity === 'simple') {
      return 'facebook/blenderbot-400M-distill'; // Quick responses
    }

    // Handle instruction following
    if (complexity === 'medium') {
      return 'google/flan-t5-large'; // Good at instructions
    }

    // Default conversational model
    return 'microsoft/DialoGPT-large';
  }

  /**
   * Check if model can handle request (simple rate limiting)
   */
  private canMakeRequest(modelId: string): boolean {
    const usage = this.usageTracking.get(modelId);
    if (!usage) return true;

    const now = Date.now();
    const windowMs = 60000; // 1 minute

    // Reset if window expired
    if (now - usage.lastReset > windowMs) {
      usage.requests = 0;
      usage.tokens = 0;
      usage.lastReset = now;
    }

    // Simple rate limiting (adjust based on HuggingFace limits)
    return usage.requests < 100; // Conservative estimate
  }

  /**
   * Update usage tracking
   */
  private updateUsage(modelId: string, tokensUsed: number): void {
    const usage = this.usageTracking.get(modelId);
    if (usage) {
      usage.requests += 1;
      usage.tokens += tokensUsed;
    }
  }

  /**
   * Execute HuggingFace request with model selection
   */
  async executeRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    const selectedModel = this.selectBestModel(task);

    if (!this.canMakeRequest(selectedModel)) {
      throw new Error(`HuggingFace model ${selectedModel} rate limited`);
    }

    try {
      const model = this.FREE_MODELS[selectedModel];
      
      if (model.task === 'feature-extraction') {
        // Handle embedding request
        return await this.executeEmbeddingRequest(selectedModel, prompt, config);
      } else {
        // Handle text generation request
        return await this.executeTextRequest(selectedModel, prompt, config);
      }
    } catch (error) {
      console.error(`HuggingFace request failed for ${selectedModel}:`, error);
      throw error;
    }
  }

  /**
   * Execute embedding request
   */
  private async executeEmbeddingRequest(
    modelId: string,
    text: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    const model = this.FREE_MODELS[modelId];
    
    const response = await this.client.post(model.apiEndpoint, {
      inputs: text,
      options: {
        wait_for_model: true,
        use_cache: false
      }
    });

    const embedding = response.data;
    const tokensUsed = Math.ceil(text.length / 4); // Rough estimate

    this.updateUsage(modelId, tokensUsed);

    return {
      text: JSON.stringify(embedding), // Embedding as JSON string
      model: `huggingface:${modelId}`,
      success: true,
      metadata: {
        tokensUsed,
        processingTime: Date.now() - Date.now(),
        requestId: `hf_embedding_${Date.now()}`
      }
    };
  }

  /**
   * Execute text generation request
   */
  private async executeTextRequest(
    modelId: string,
    prompt: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    const model = this.FREE_MODELS[modelId];
    const startTime = Date.now();

    const requestData: any = {
      inputs: prompt,
      parameters: {
        max_new_tokens: Math.min(config.maxOutputTokens || 512, model.maxTokens),
        temperature: config.temperature || 0.7,
        top_p: config.topP || 0.9,
        do_sample: true,
        return_full_text: false
      },
      options: {
        wait_for_model: true,
        use_cache: false
      }
    };

    // Special handling for different model types
    if (model.task === 'conversational') {
      requestData.inputs = {
        text: prompt,
        past_user_inputs: [],
        generated_responses: []
      };
    }

    const response = await this.client.post(model.apiEndpoint, requestData);
    let generatedText = '';

    // Parse response based on model type
    if (model.task === 'conversational') {
      generatedText = response.data.generated_text || '';
    } else if (Array.isArray(response.data)) {
      generatedText = response.data[0]?.generated_text || '';
    } else {
      generatedText = response.data.generated_text || response.data[0]?.generated_text || '';
    }

    const tokensUsed = Math.ceil((prompt.length + generatedText.length) / 4);
    this.updateUsage(modelId, tokensUsed);

    return {
      text: generatedText,
      model: `huggingface:${modelId}`,
      success: true,
      metadata: {
        tokensUsed,
        processingTime: Date.now() - startTime,
        requestId: `hf_text_${Date.now()}`
      }
    };
  }

  /**
   * Generate embeddings using HuggingFace models
   */
  async generateEmbeddings(
    texts: string[],
    options: { model?: string; batchSize?: number } = {}
  ): Promise<{ embeddings: number[][]; model: string; dimensions: number }> {
    const modelId = options.model || 'sentence-transformers/all-mpnet-base-v2';
    const batchSize = options.batchSize || 10;
    const model = this.FREE_MODELS[modelId];

    if (!model || model.task !== 'feature-extraction') {
      throw new Error(`Invalid embedding model: ${modelId}`);
    }

    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      for (const text of batch) {
        try {
          const response = await this.executeEmbeddingRequest(modelId, text, {});
          const embedding = JSON.parse(response.text);
          embeddings.push(embedding);
        } catch (error) {
          console.warn(`Failed to generate embedding for text ${i}:`, error);
          // Add zero vector as fallback
          embeddings.push(new Array(model.dimensions || 768).fill(0));
        }
      }

      // Rate limiting delay
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      embeddings,
      model: `huggingface:${modelId}`,
      dimensions: model.dimensions || 768
    };
  }

  /**
   * Get available models and their status
   */
  getAvailableModels(): { [key: string]: any } {
    const status: { [key: string]: any } = {};

    Object.entries(this.FREE_MODELS).forEach(([modelId, config]) => {
      const usage = this.usageTracking.get(modelId);
      const canRequest = this.canMakeRequest(modelId);

      status[modelId] = {
        available: canRequest,
        config: {
          task: config.task,
          maxTokens: config.maxTokens,
          dimensions: config.dimensions,
          bestFor: config.bestFor
        },
        usage: usage ? {
          requests: usage.requests,
          tokens: usage.tokens
        } : null
      };
    });

    return status;
  }

  /**
   * Health check for HuggingFace service
   */
  async healthCheck(): Promise<{ healthy: boolean; models: number; errors: string[] }> {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('HuggingFace API key not configured');
    }

    try {
      // Test with a simple embedding request
      const testModel = 'sentence-transformers/all-MiniLM-L6-v2';
      await this.executeEmbeddingRequest(testModel, 'test', {});
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      healthy: errors.length === 0,
      models: Object.keys(this.FREE_MODELS).length,
      errors
    };
  }
}

// Export singleton instance
export const huggingFaceIntegration = new HuggingFaceIntegration();