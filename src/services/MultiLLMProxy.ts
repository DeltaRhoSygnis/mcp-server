/**
 * Multi-LLM Proxy for MCP Server
 * Routes requests across Gemini, Cohere, Hugging Face, and OpenRouter
 * Handles rate limits and fallbacks based on task type and quotas
 */

import AdvancedGeminiProxy, { GeminiResponse, TaskRequest } from '../advanced-gemini-proxy.js';
import { CohereClient } from 'cohere-ai';
import { HfInference } from '@huggingface/inference';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import { Anthropic } from '@anthropic-ai/sdk'; // Optional dependency

export interface LLMOptions {
  provider?: 'gemini' | 'cohere' | 'hf' | 'openrouter';
  taskType: TaskRequest;
  maxTokens?: number;
  temperature?: number;
}

export class MultiLLMProxy extends AdvancedGeminiProxy {
  private cohere: CohereClient | null = null;
  private hf: HfInference | null = null;
  private openai: OpenAI | null = null;
  private anthropic: any | null = null; // Optional Anthropic SDK
  private gemini: GoogleGenerativeAI;
  private providerUsage: Map<string, { requests: number; tokens: number; resetTime: number }> = new Map();

  constructor() {
    super(); // Inherit Gemini functionality
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    if (process.env.OPENAI_API_KEY) this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // if (process.env.ANTHROPIC_API_KEY) this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Cohere
    if (process.env.COHERE_API_KEY) {
      this.cohere = new CohereClient({
        token: process.env.COHERE_API_KEY,
      });
      console.log('✅ Cohere initialized');
    }

    // Hugging Face
    if (process.env.HF_TOKEN) {
      this.hf = new HfInference(process.env.HF_TOKEN);
      console.log('✅ Hugging Face initialized');
    }

    // OpenRouter (uses OpenAI-compatible API)
    if (process.env.OPENROUTER_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      console.log('✅ OpenRouter initialized');
    }

    // Initialize usage trackers
    ['gemini', 'cohere', 'hf', 'openrouter'].forEach(provider => {
      this.providerUsage.set(provider, { requests: 0, tokens: 0, resetTime: Date.now() + 60000 });
    });
  }

  // Normalize options between LLMOptions and parent class config format
  private normalizeOptions(config: any): LLMOptions & any {
    // Handle both formats - LLMOptions and parent GeminiConfig
    return {
      provider: config.provider || 'gemini',
      taskType: config.taskType || config.taskRequest || {
        type: 'text',
        complexity: 'medium',
        priority: 'medium'
      },
      maxTokens: config.maxTokens || config.maxOutputTokens || 1000,
      temperature: config.temperature || 0.7,
      ...config // Pass through any other properties
    };
  }

  /**
   * Main routing method: Generate text with provider fallback
   */
  // Enhanced generateText with multi-LLM support
  async generateText(
    prompt: string,
    config: any = {}
  ): Promise<GeminiResponse> {
    // Support both old LLMOptions format and new parent class format
    const options = this.normalizeOptions(config);
    const { provider = 'gemini', taskType, maxTokens = 1000, temperature = 0.7 } = options;
    const startTime = Date.now();

    try {
      // Check rate limits and fallback if needed
      const rateCheck = this.checkProviderLimit(provider);
      if (!rateCheck.allowed) {
        console.warn(`Rate limited on ${provider}, falling back to ${rateCheck.fallback}`);
        return this.generateText(prompt, { ...config, provider: rateCheck.fallback });
      }

      let response: GeminiResponse;

      switch (provider) {
        case 'cohere':
          response = await this.callCohere(prompt, { maxTokens, temperature, taskType });
          break;
        case 'hf':
          response = await this.callHuggingFace(prompt, { maxTokens, temperature, taskType });
          break;
        case 'openrouter':
          response = await this.callOpenRouter(prompt, { maxTokens, temperature, taskType });
          break;
        default:
          // Gemini (inherited) - pass through with proper config format
          response = await super.generateText(prompt, {
            ...config,
            taskType,
            maxOutputTokens: maxTokens,
            temperature
          });
          break;
      }

      // Update usage tracking
      this.updateProviderUsage(provider, response.metadata?.tokensUsed || 0);

      // Log the call (using inherited method)
      // await this.logRequest(provider, prompt, response, true, undefined, Date.now() - startTime); // Commented out: private method

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      // await this.logRequest(provider, prompt, null, false, error instanceof Error ? error.message : String(error), duration); // Commented out: private method
      
      // Fallback on error
      const fallbackProvider = this.getFallbackProvider(provider);
      if (fallbackProvider !== provider) {
        console.warn(`Error with ${provider}, trying fallback: ${fallbackProvider}`);
        return this.generateText(prompt, { ...options, provider: fallbackProvider });
      }
      
      throw error;
    }
  }

  /**
   * Generate embeddings with provider routing
   */
  async generateEmbeddings(
    texts: string[], 
    options: { 
      provider?: 'gemini' | 'hf'; 
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
    const { provider = 'gemini', batchSize = 10 } = options;

    if (provider === 'hf' && this.hf) {
      // HF for embeddings (cheaper/faster)
      const embeddings: number[][] = [];
      for (const text of texts) {
        const response = await this.hf.featureExtraction({
          model: 'sentence-transformers/all-MiniLM-L6-v2', // Efficient, 384 dims
          inputs: text,
        });
        embeddings.push(response as unknown as number[]); // HF returns array
      }
      return { 
        embeddings, 
        dimensions: 384, 
        model: 'all-MiniLM-L6-v2',
        metadata: { 
          processingTime: Date.now() - Date.now(), 
          requestId: options.requestId || 'hf-' + Date.now() 
        }
      };
    }

    // Fallback to Gemini (inherited)
    return super.generateEmbeddings(texts, { batchSize });
  }

  // Provider-specific implementations

  private async callCohere(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.cohere) throw new Error('Cohere not configured');
    const startTime = Date.now();

    const model = taskType.complexity === 'simple' ? 'command-r' : 'command-r-plus'; // command-r for structured
    const response = await this.cohere.generate({
      model,
      prompt,
      maxTokens: maxTokens,
      temperature,
      numGenerations: 1,
    });

    const text = response.generations[0]?.text || '';
    const tokensUsed = text.length / 4; // Approximate token count

    return {
      text,
      model,
      success: true,
      metadata: { 
        tokensUsed, 
        processingTime: Date.now() - startTime,
        requestId: 'cohere-' + Date.now()
      }
    };
  }

  private async callHuggingFace(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.hf) throw new Error('Hugging Face not configured');
    const startTime = Date.now();

    // For text gen: Use lightweight model
    const model = 'gpt2'; // Default model for HuggingFace
    const response = await this.hf.textGeneration({
      model,
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        do_sample: true,
        repetition_penalty: 1.1,
      },
    });

    const text = Array.isArray(response) ? response[0].generated_text : response.generated_text;
    const tokensUsed = text.length / 4; // Approximate

    return {
      text,
      model,
      success: true,
      metadata: { 
        tokensUsed, 
        processingTime: Date.now() - startTime,
        requestId: 'hf-' + Date.now()
      }
    };
  }

  private async callOpenRouter(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.openai) throw new Error('OpenRouter not configured');
    const startTime = Date.now();

    // Route to free/cheap model based on task
    const model = taskType.complexity === 'simple' ? 'deepseek/deepseek-r1:free' : 'x-ai/grok-beta'; // Adjust per limits
    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    const text = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    return {
      text,
      model,
      success: true,
      metadata: { 
        tokensUsed, 
        processingTime: Date.now() - startTime,
        requestId: 'openrouter-' + Date.now()
      }
    };
  }

  // Rate limiting and fallback logic

  private checkProviderLimit(provider: string): { allowed: boolean; fallback: string } {
    const usage = this.providerUsage.get(provider);
    if (!usage) return { allowed: true, fallback: 'gemini' };

    const now = Date.now();
    if (now >= usage.resetTime) {
      usage.requests = 0;
      usage.tokens = 0;
      usage.resetTime = now + 60000; // 1 min window
    }

    // Provider-specific limits (from your MD)
    const limits = {
      gemini: { rpm: 10, tpm: 250000 }, // e.g., 2.5-flash
      cohere: { rpm: 20, tpm: 1000000 }, // Shared
      hf: { rpm: 300, tpm: 500000 }, // Registered
      openrouter: { rpm: 20, tpm: 100000 }, // Free tier
    };

    const limit = limits[provider as keyof typeof limits];
    const overRequests = usage.requests >= limit.rpm;
    const overTokens = usage.tokens >= limit.tpm;

    if (overRequests || overTokens) {
      return { allowed: false, fallback: this.getFallbackProvider(provider) };
    }

    return { allowed: true, fallback: 'gemini' };
  }

  private updateProviderUsage(provider: string, tokensUsed: number): void {
    const usage = this.providerUsage.get(provider)!;
    usage.requests += 1;
    usage.tokens += tokensUsed;
  }

  private getFallbackProvider(current: string): string {
    const chain: Record<string, string> = {
      gemini: 'cohere',
      cohere: 'hf',
      hf: 'openrouter',
      openrouter: 'gemini', // Loop back if all fail
    };
    return chain[current] || 'gemini';
  }

  // Health check for all providers
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    models: Record<string, { status: 'healthy' | 'unhealthy'; latency?: number; error?: string }>;
  }> {
    const parentHealth = await super.healthCheck();
    const models = { ...parentHealth.models };
    
    // Cohere
    if (this.cohere) {
      try {
        const startTime = Date.now();
        await this.cohere.generate({ model: 'command-r', prompt: 'test', maxTokens: 5 });
        models.cohere = { status: 'healthy', latency: Date.now() - startTime };
      } catch (error) {
        models.cohere = { status: 'unhealthy', error: String(error) };
      }
    }

    // Determine overall health
    const healthyCount = Object.values(models).filter(m => m.status === 'healthy').length;
    const totalCount = Object.keys(models).length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) overall = 'healthy';
    else if (healthyCount > 0) overall = 'degraded';
    else overall = 'unhealthy';

    return { overall, models };
  }
}

export default MultiLLMProxy;
