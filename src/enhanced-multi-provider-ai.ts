/**
 * Enhanced Multi-Provider AI Proxy
 * Supports NVIDIA DeepSeek, Cerebras, Groq, Mistral + existing providers
 * Optimized for Render deployment with intelligent load balancing
 */

import OpenAI from 'openai';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIProvider {
  name: string;
  client: any;
  models: string[];
  maxTokens: number;
  costPerToken: number;
  rateLimit: number; // requests per minute
  latency: number; // average response time in ms
  reliability: number; // success rate 0-1
  features: string[]; // capabilities like 'reasoning', 'streaming', 'vision'
}

interface AIRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  model?: string;
  priority?: 'speed' | 'quality' | 'cost' | 'reasoning';
  context?: any;
}

interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokens: number;
  latency: number;
  reasoning?: string;
  usage: any;
}

export class EnhancedMultiProviderAI {
  private providers: Map<string, AIProvider> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  constructor() {
    this.initializeProviders();
    this.startRateLimitReset();
  }

  private initializeProviders() {
    // NVIDIA DeepSeek - Reasoning Specialist
    if (process.env.NVIDIA_API_KEY) {
      this.providers.set('nvidia-deepseek', {
        name: 'NVIDIA DeepSeek',
        client: new OpenAI({
          apiKey: process.env.NVIDIA_API_KEY,
          baseURL: 'https://integrate.api.nvidia.com/v1',
        }),
        models: ['deepseek-ai/deepseek-r1'],
        maxTokens: 4096,
        costPerToken: 0.000002, // Estimated
        rateLimit: 600, // High limit for enterprise
        latency: 2000,
        reliability: 0.95,
        features: ['reasoning', 'analysis', 'complex-logic']
      });
    }

    // Cerebras - Speed Champion
    if (process.env.CEREBRAS_API_KEY) {
      this.providers.set('cerebras', {
        name: 'Cerebras',
        client: new Cerebras({
          apiKey: process.env.CEREBRAS_API_KEY
        }),
        models: ['qwen-3-235b-a22b-instruct-2507'],
        maxTokens: 20000,
        costPerToken: 0.000001, // Very competitive
        rateLimit: 1000, // High throughput
        latency: 500, // Ultra-fast
        reliability: 0.98,
        features: ['streaming', 'high-throughput', 'real-time']
      });
    }

    // Groq - Lightning Fast
    if (process.env.GROQ_API_KEY) {
      this.providers.set('groq', {
        name: 'Groq',
        client: new OpenAI({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: 'https://api.groq.com/openai/v1',
        }),
        models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'whisper-large-v3'],
        maxTokens: 8192,
        costPerToken: 0.0000005,
        rateLimit: 30, // Limited on free tier
        latency: 300, // Very fast
        reliability: 0.92,
        features: ['speed', 'audio', 'whisper']
      });
    }

    // Mistral - European Powerhouse
    if (process.env.MINSTRAL_API_KEY) {
      this.providers.set('mistral', {
        name: 'Mistral',
        client: new OpenAI({
          apiKey: process.env.MINSTRAL_API_KEY,
          baseURL: 'https://api.mistral.ai/v1',
        }),
        models: ['mistral-large-latest', 'mistral-medium-latest'],
        maxTokens: 4096,
        costPerToken: 0.000008,
        rateLimit: 60, // Moderate limits
        latency: 1500,
        reliability: 0.94,
        features: ['multilingual', 'analysis', 'coding']
      });
    }

    // Keep existing Google Gemini
    if (process.env.GEMINI_API_KEY) {
      this.providers.set('gemini', {
        name: 'Google Gemini',
        client: new GoogleGenerativeAI(process.env.GEMINI_API_KEY),
        models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-flash'],
        maxTokens: 2048,
        costPerToken: 0.000001,
        rateLimit: 60,
        latency: 1000,
        reliability: 0.96,
        features: ['vision', 'multimodal', 'reliable']
      });
    }

    // OpenRouter as fallback
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter', {
        name: 'OpenRouter',
        client: new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
        }),
        models: ['anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b'],
        maxTokens: 4096,
        costPerToken: 0.000003,
        rateLimit: 100,
        latency: 2000,
        reliability: 0.93,
        features: ['variety', 'fallback', 'claude']
      });
    }
  }

  /**
   * Intelligent provider selection based on request requirements
   */
  private selectOptimalProvider(request: AIRequest): string {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([name, provider]) => this.canMakeRequest(name))
      .map(([name, provider]) => ({ name, ...provider }));

    if (availableProviders.length === 0) {
      throw new Error('No available AI providers');
    }

    // Priority-based selection
    switch (request.priority) {
      case 'reasoning':
        // Prefer providers with reasoning capabilities
        const reasoningProviders = availableProviders.filter(p => 
          p.features.includes('reasoning') || p.features.includes('complex-logic')
        );
        if (reasoningProviders.length > 0) {
          return reasoningProviders.sort((a, b) => b.reliability - a.reliability)[0].name;
        }
        break;

      case 'speed':
        // Prefer fastest providers
        return availableProviders.sort((a, b) => a.latency - b.latency)[0].name;

      case 'cost':
        // Prefer cheapest providers
        return availableProviders.sort((a, b) => a.costPerToken - b.costPerToken)[0].name;

      case 'quality':
        // Prefer most reliable providers
        return availableProviders.sort((a, b) => b.reliability - a.reliability)[0].name;
    }

    // Default: Balance of speed, cost, and reliability
    const scores = availableProviders.map(provider => ({
      name: provider.name,
      score: (
        (1 / provider.latency) * 1000 + // Speed score
        (1 / provider.costPerToken) * 100000 + // Cost efficiency
        provider.reliability * 100 // Reliability score
      )
    }));

    return scores.sort((a, b) => b.score - a.score)[0].name;
  }

  /**
   * Check if provider can make a request (within rate limits)
   */
  private canMakeRequest(providerName: string): boolean {
    const provider = this.providers.get(providerName);
    if (!provider) return false;

    const currentCount = this.requestCounts.get(providerName) || 0;
    return currentCount < provider.rateLimit;
  }

  /**
   * Make AI request with automatic provider selection and fallback
   */
  async makeRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Try up to 3 different providers
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const providerName = this.selectOptimalProvider(request);
        const provider = this.providers.get(providerName)!;

        console.log(`🤖 Using ${provider.name} for AI request (attempt ${attempt + 1})`);

        const response = await this.executeRequest(providerName, request);
        
        // Increment request count
        this.requestCounts.set(providerName, (this.requestCounts.get(providerName) || 0) + 1);

        return {
          ...response,
          provider: providerName,
          latency: Date.now() - startTime
        };

      } catch (error) {
        console.error(`❌ Provider attempt ${attempt + 1} failed:`, error.message);
        lastError = error as Error;
        
        // Remove failed provider temporarily
        if (attempt < 2) {
          const failedProvider = this.selectOptimalProvider(request);
          this.requestCounts.set(failedProvider, 999999); // Temporarily exhaust
        }
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Execute request with specific provider
   */
  private async executeRequest(providerName: string, request: AIRequest): Promise<Partial<AIResponse>> {
    const provider = this.providers.get(providerName)!;

    switch (providerName) {
      case 'nvidia-deepseek':
        return this.executeNVIDIA(provider, request);
      
      case 'cerebras':
        return this.executeCerebras(provider, request);
      
      case 'groq':
        return this.executeGroq(provider, request);
      
      case 'mistral':
        return this.executeMistral(provider, request);
      
      case 'gemini':
        return this.executeGemini(provider, request);
      
      case 'openrouter':
        return this.executeOpenRouter(provider, request);
      
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  private async executeNVIDIA(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const completion = await provider.client.chat.completions.create({
      model: request.model || provider.models[0],
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.maxTokens || 2048, provider.maxTokens),
      stream: false
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      reasoning: completion.choices[0]?.message?.reasoning_content,
      model: request.model || provider.models[0],
      tokens: completion.usage?.total_tokens || 0,
      usage: completion.usage
    };
  }

  private async executeCerebras(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    if (request.stream) {
      return this.executeCerebrasStreaming(provider, request);
    }

    const completion = await provider.client.chat.completions.create({
      messages: [{ role: "user", content: request.prompt }],
      model: request.model || provider.models[0],
      stream: false,
      max_completion_tokens: Math.min(request.maxTokens || 2048, provider.maxTokens),
      temperature: request.temperature || 0.7,
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      model: request.model || provider.models[0],
      tokens: completion.usage?.total_tokens || 0,
      usage: completion.usage
    };
  }

  private async executeCerebrasStreaming(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const stream = await provider.client.chat.completions.create({
      messages: [{ role: "user", content: request.prompt }],
      model: request.model || provider.models[0],
      stream: true,
      max_completion_tokens: Math.min(request.maxTokens || 2048, provider.maxTokens),
      temperature: request.temperature || 0.7,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk.choices[0]?.delta?.content || '';
    }

    return {
      content: fullResponse,
      model: request.model || provider.models[0],
      tokens: fullResponse.length / 4, // Rough estimate
      usage: { prompt_tokens: request.prompt.length / 4, completion_tokens: fullResponse.length / 4 }
    };
  }

  private async executeGroq(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const completion = await provider.client.chat.completions.create({
      model: request.model || provider.models[0],
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.maxTokens || 1024, provider.maxTokens),
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      model: request.model || provider.models[0],
      tokens: completion.usage?.total_tokens || 0,
      usage: completion.usage
    };
  }

  private async executeMistral(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const completion = await provider.client.chat.completions.create({
      model: request.model || provider.models[0],
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.maxTokens || 2048, provider.maxTokens),
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      model: request.model || provider.models[0],
      tokens: completion.usage?.total_tokens || 0,
      usage: completion.usage
    };
  }

  private async executeGemini(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const model = provider.client.getGenerativeModel({ 
      model: request.model || provider.models[0] 
    });

    const result = await model.generateContent(request.prompt);
    const response = await result.response;

    return {
      content: response.text(),
      model: request.model || provider.models[0],
      tokens: response.usageMetadata?.totalTokenCount || 0,
      usage: response.usageMetadata
    };
  }

  private async executeOpenRouter(provider: AIProvider, request: AIRequest): Promise<Partial<AIResponse>> {
    const completion = await provider.client.chat.completions.create({
      model: request.model || provider.models[0],
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature || 0.7,
      max_tokens: Math.min(request.maxTokens || 2048, provider.maxTokens),
    });

    return {
      content: completion.choices[0]?.message?.content || '',
      model: request.model || provider.models[0],
      tokens: completion.usage?.total_tokens || 0,
      usage: completion.usage
    };
  }

  /**
   * Reset rate limit counters every minute
   */
  private startRateLimitReset() {
    setInterval(() => {
      this.requestCounts.clear();
      this.lastReset = new Date();
      console.log('🔄 Rate limits reset for all providers');
    }, 60000);
  }

  /**
   * Get provider status and capabilities
   */
  getProviderStatus() {
    const status = Array.from(this.providers.entries()).map(([name, provider]) => ({
      name: provider.name,
      available: this.canMakeRequest(name),
      requestCount: this.requestCounts.get(name) || 0,
      rateLimit: provider.rateLimit,
      features: provider.features,
      reliability: provider.reliability,
      avgLatency: provider.latency
    }));

    return {
      providers: status,
      totalProviders: this.providers.size,
      availableProviders: status.filter(p => p.available).length,
      lastReset: this.lastReset
    };
  }

  /**
   * Specialized methods for different use cases
   */
  async processChickenNote(note: string): Promise<AIResponse> {
    return this.makeRequest({
      prompt: `Analyze this chicken business note and extract structured data: "${note}"`,
      priority: 'reasoning',
      maxTokens: 1024
    });
  }

  async getBusinessAdvice(context: string): Promise<AIResponse> {
    return this.makeRequest({
      prompt: `As a chicken business advisor, provide advice based on: ${context}`,
      priority: 'quality',
      maxTokens: 2048
    });
  }

  async quickResponse(question: string): Promise<AIResponse> {
    return this.makeRequest({
      prompt: question,
      priority: 'speed',
      maxTokens: 512
    });
  }

  async detailedAnalysis(data: string): Promise<AIResponse> {
    return this.makeRequest({
      prompt: `Provide detailed business analysis: ${data}`,
      priority: 'reasoning',
      maxTokens: 4096
    });
  }
}

// Export singleton instance
export const enhancedMultiProviderAI = new EnhancedMultiProviderAI();