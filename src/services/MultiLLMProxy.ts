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
import { Anthropic } from '@anthropic-ai/sdk';

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
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenerativeAI;
  private providerUsage: Map<string, { requests: number; tokens: number; resetTime: number }> = new Map();

  constructor() {
    super(); // Inherit Gemini functionality
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    if (process.env.OPENAI_API_KEY) this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (process.env.ANTHROPIC_API_KEY) this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

  /**
   * Main routing method: Generate text with provider fallback
   */
  async generateText(prompt: string, options: LLMOptions = {}): Promise<GeminiResponse> {
    const { provider = 'gemini', taskType, maxTokens = 1000, temperature = 0.7 } = options;
    const startTime = Date.now();

    try {
      // Check rate limits and fallback if needed
      const rateCheck = this.checkProviderLimit(provider);
      if (!rateCheck.allowed) {
        console.warn(`Rate limited on ${provider}, falling back to ${rateCheck.fallback}`);
        return this.generateText(prompt, { ...options, provider: rateCheck.fallback });
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
          // Gemini (inherited)
          response = await super.generateText(prompt, { taskType, maxTokens, temperature });
          break;
      }

      // Update usage tracking
      this.updateProviderUsage(provider, response.metadata?.tokensUsed || 0);

      // Log the call (using inherited method)
      await this.logRequest(provider, prompt, response, true, undefined, Date.now() - startTime);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.logRequest(provider, prompt, null, false, error instanceof Error ? error.message : String(error), duration);
      
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
  async generateEmbeddings(texts: string[], options: { provider?: 'gemini' | 'hf'; batchSize?: number } = {}): Promise<{ embeddings: number[][]; model: string }> {
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
      return { embeddings, model: 'all-MiniLM-L6-v2' };
    }

    // Fallback to Gemini (inherited)
    return super.generateEmbeddings(texts, { batchSize });
  }

  // Provider-specific implementations

  private async callCohere(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.cohere) throw new Error('Cohere not configured');

    const model = taskType.complexity === 'simple' ? 'command-r' : 'command-r-plus'; // command-r for structured
    const response = await this.cohere.generate({
      model,
      prompt,
      max_tokens: maxTokens,
      temperature,
      num_generations: 1,
    });

    const text = response.generations[0]?.text || '';
    const tokensUsed = response.generations[0]?.token_count || 0;

    return {
      text,
      model,
      success: true,
      metadata: { tokensUsed, processingTime: Date.now() - (this as any).startTime } // Inherit timing
    };
  }

  private async callHuggingFace(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.hf) throw new Error('Hugging Face not configured');

    // For text gen: Use lightweight model
    const model = taskType.type === 'analysis' ? 'microsoft/DialoGPT-medium' : 'gpt2'; // Or Gemma if available
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
      metadata: { tokensUsed, processingTime: Date.now() - (this as any).startTime }
    };
  }

  private async callOpenRouter(prompt: string, { maxTokens, temperature, taskType }: { maxTokens: number; temperature: number; taskType: TaskRequest }): Promise<GeminiResponse> {
    if (!this.openai) throw new Error('OpenRouter not configured');

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
      metadata: { tokensUsed, processingTime: Date.now() - (this as any).startTime }
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
  async healthCheck(): Promise<Record<string, { status: 'healthy' | 'unhealthy'; error?: string }>> {
    const checks: Record<string, any> = {};
    
    // Gemini (inherited)
    checks.gemini = await super.healthCheck();

    // Cohere
    if (this.cohere) {
      try {
        await this.cohere.generate({ model: 'command-r', prompt: 'test' });
        checks.cohere = { status: 'healthy' };
      } catch (error) {
        checks.cohere = { status: 'unhealthy', error: String(error) };
      }
    }

    // Similar for HF and OpenRouter...
    // (Implement quick tests)

    return checks;
  }
}

export default MultiLLMProxy;
