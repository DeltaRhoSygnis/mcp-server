/**
 * OpenRouter API Integration for Multi-Tier Fallback System
 * Provides free tier models as Tier 3 fallback for Gemini models
 * Optimized for 100k token input per minute with 2M context window analysis
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { GeminiResponse, TaskRequest, GeminiConfig } from '../advanced-gemini-proxy';

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: number;
    completion: number;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    max_completion_tokens?: number;
  };
}

export interface OpenRouterConfig {
  apiKey?: string;
  appName?: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

export class OpenRouterIntegration {
  private client: AxiosInstance;
  private config: OpenRouterConfig;
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private usageTracking: Map<string, { tokens: number; requests: number; lastReset: number }> = new Map();

  // Free tier models optimized for chicken business operations
  private readonly FREE_MODELS = {
    // High-performance free models
    'meta-llama/llama-3.2-11b-vision-instruct:free': {
      contextLength: 131072,
      tpmLimit: 50000,
      rpmLimit: 20,
      bestFor: ['business-analysis', 'visual-processing', 'complex-reasoning'],
      fallbackPriority: 1
    },
    'google/gemma-2-9b-it:free': {
      contextLength: 8192,
      tpmLimit: 75000,
      rpmLimit: 30,
      bestFor: ['structured-parsing', 'json-extraction', 'data-analysis'],
      fallbackPriority: 2
    },
    'microsoft/phi-3-mini-128k-instruct:free': {
      contextLength: 128000,
      tpmLimit: 60000,
      rpmLimit: 25,
      bestFor: ['long-context', 'document-analysis', 'comprehensive-reports'],
      fallbackPriority: 3
    },
    'qwen/qwen-2.5-7b-instruct:free': {
      contextLength: 32768,
      tpmLimit: 40000,
      rpmLimit: 20,
      bestFor: ['reasoning', 'planning', 'workflow-optimization'],
      fallbackPriority: 4
    },
    'openchat/openchat-7b:free': {
      contextLength: 8192,
      tpmLimit: 30000,
      rpmLimit: 15,
      bestFor: ['conversational-ai', 'customer-support', 'chat-responses'],
      fallbackPriority: 5
    },
    'meta-llama/llama-3.2-3b-instruct:free': {
      contextLength: 131072,
      tpmLimit: 100000,
      rpmLimit: 50,
      bestFor: ['fast-processing', 'simple-tasks', 'high-throughput'],
      fallbackPriority: 6
    }
  };

  constructor(config: OpenRouterConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      appName: config.appName || 'CharnoksChickenMCP',
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/PSYGER02/mcpserver',
        'X-Title': this.config.appName
      }
    });

    this.initializeUsageTracking();
  }

  /**
   * Initialize usage tracking for all free models
   */
  private initializeUsageTracking(): void {
    Object.keys(this.FREE_MODELS).forEach(modelId => {
      this.usageTracking.set(modelId, {
        tokens: 0,
        requests: 0,
        lastReset: Date.now()
      });
    });
  }

  /**
   * Select best available free model based on task requirements
   */
  selectBestFreeModel(task: TaskRequest): string {
    const { complexity, type, estimatedTokens = 1000 } = task;
    
    // Filter models by availability and token capacity
    const availableModels = Object.entries(this.FREE_MODELS)
      .filter(([modelId, config]) => {
        const usage = this.usageTracking.get(modelId);
        return usage && this.canMakeRequest(modelId, estimatedTokens);
      })
      .sort((a, b) => a[1].fallbackPriority - b[1].fallbackPriority);

    // Select based on task complexity and type
    if (complexity === 'complex') {
      return availableModels.find(([_, config]) => 
        config.bestFor.includes('business-analysis') || 
        config.bestFor.includes('complex-reasoning')
      )?.[0] || 'meta-llama/llama-3.2-11b-vision-instruct:free';
    }
    
    if (type === 'text' && estimatedTokens > 10000) {
      return availableModels.find(([_, config]) => 
        config.bestFor.includes('long-context')
      )?.[0] || 'microsoft/phi-3-mini-128k-instruct:free';
    }
    
    if (complexity === 'simple') {
      return availableModels.find(([_, config]) => 
        config.bestFor.includes('fast-processing')
      )?.[0] || 'meta-llama/llama-3.2-3b-instruct:free';
    }

    // Default fallback
    return availableModels[0]?.[0] || 'google/gemma-2-9b-it:free';
  }

  /**
   * Check if model can handle the request based on rate limits
   */
  private canMakeRequest(modelId: string, estimatedTokens: number): boolean {
    const modelConfig = this.FREE_MODELS[modelId as keyof typeof this.FREE_MODELS];
    const usage = this.usageTracking.get(modelId);
    
    if (!modelConfig || !usage) return false;

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Reset usage if window expired
    if (now - usage.lastReset > windowMs) {
      usage.tokens = 0;
      usage.requests = 0;
      usage.lastReset = now;
    }

    // Check limits
    return (
      usage.requests < modelConfig.rpmLimit &&
      usage.tokens + estimatedTokens <= modelConfig.tpmLimit
    );
  }

  /**
   * Update usage tracking after request
   */
  private updateUsage(modelId: string, tokensUsed: number): void {
    const usage = this.usageTracking.get(modelId);
    if (usage) {
      usage.tokens += tokensUsed;
      usage.requests += 1;
    }
  }

  /**
   * Execute OpenRouter API request with fallback chain
   */
  async executeRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    let selectedModel = this.selectBestFreeModel(task);
    let lastError: Error | null = null;

    // Try multiple models in priority order
    const modelOptions = Object.keys(this.FREE_MODELS)
      .sort((a, b) => this.FREE_MODELS[a as keyof typeof this.FREE_MODELS].fallbackPriority - this.FREE_MODELS[b as keyof typeof this.FREE_MODELS].fallbackPriority);

    for (const modelId of modelOptions) {
      if (!this.canMakeRequest(modelId, task.estimatedTokens || 1000)) {
        continue;
      }

      try {
        const response = await this.makeAPIRequest(modelId, prompt, config);
        
        // Update usage tracking
        this.updateUsage(modelId, response.metadata.tokensUsed || 0);
        
        return {
          text: response.text,
          model: `openrouter:${modelId}`,
          success: true,
          metadata: {
            ...response.metadata,
            processingTime: Date.now() - startTime,
            requestId: `openrouter_${Date.now()}`,
            provider: 'openrouter'
          }
        };
      } catch (error) {
        console.warn(`OpenRouter model ${modelId} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw lastError || new Error('All OpenRouter models unavailable');
  }

  /**
   * Make actual API request to OpenRouter
   */
  private async makeAPIRequest(
    modelId: string,
    prompt: string,
    config: GeminiConfig
  ): Promise<{ text: string; metadata: any }> {
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url: '/chat/completions',
      data: {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxOutputTokens || 4096,
        temperature: config.temperature || 0.7,
        top_p: config.topP || 0.9,
        stream: false
      }
    };

    const response = await this.client.request(requestConfig);
    const completion = response.data;

    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('No completion choices returned');
    }

    const choice = completion.choices[0];
    const text = choice.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    return {
      text,
      metadata: {
        tokensUsed,
        finishReason: choice.finish_reason,
        model: modelId,
        provider: 'openrouter'
      }
    };
  }

  /**
   * Get available models and their current status
   */
  async getAvailableModels(): Promise<{ [key: string]: any }> {
    const status: { [key: string]: any } = {};
    
    Object.entries(this.FREE_MODELS).forEach(([modelId, config]) => {
      const usage = this.usageTracking.get(modelId);
      const canRequest = this.canMakeRequest(modelId, 1000);
      
      status[modelId] = {
        available: canRequest,
        usage: usage ? {
          tokens: usage.tokens,
          requests: usage.requests,
          limits: {
            tpm: config.tpmLimit,
            rpm: config.rpmLimit
          }
        } : null,
        config: {
          contextLength: config.contextLength,
          bestFor: config.bestFor,
          priority: config.fallbackPriority
        }
      };
    });

    return status;
  }

  /**
   * Health check for OpenRouter service
   */
  async healthCheck(): Promise<{ healthy: boolean; models: number; errors: string[] }> {
    const errors: string[] = [];
    let healthyModels = 0;

    if (!this.config.apiKey) {
      errors.push('OpenRouter API key not configured');
    }

    try {
      // Test with a simple request to fastest model
      const testModel = 'meta-llama/llama-3.2-3b-instruct:free';
      if (this.canMakeRequest(testModel, 100)) {
        await this.makeAPIRequest(testModel, 'Test: Respond with "OK"', { maxOutputTokens: 10 });
        healthyModels++;
      }
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      healthy: errors.length === 0 && healthyModels > 0,
      models: Object.keys(this.FREE_MODELS).length,
      errors
    };
  }
}

// Export singleton instance
export const openRouterIntegration = new OpenRouterIntegration();