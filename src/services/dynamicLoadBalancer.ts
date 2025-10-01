/**
 * Dynamic Load Balancing System for Multi-Tier AI Fallback
 * Intelligently routes requests across Gemini 2.5/2.0, OpenRouter, HuggingFace, and Cohere
 * Optimized for 100k token input per minute with 2M context window analysis
 * Production-ready with comprehensive monitoring and failover capabilities
 */

import GeminiProxy, { TaskRequest, GeminiResponse, GeminiConfig } from '../advanced-gemini-proxy';
import { OpenRouterIntegration } from './openRouterIntegration';
import { HuggingFaceIntegration } from './huggingFaceIntegration';
import { CohereIntegration } from './cohereIntegration';

export interface LoadBalancingConfig {
  preferredTier?: 1 | 2 | 3;
  maxRetries?: number;
  fallbackDelay?: number;
  healthCheckInterval?: number;
  costOptimization?: boolean;
  priorityRouting?: boolean;
}

export interface ProviderHealth {
  healthy: boolean;
  latency: number;
  successRate: number;
  lastChecked: number;
  errors: string[];
  capacity: number; // 0-100 percentage
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  tokensProcessed: number;
  costEstimate: number;
  tierUsage: { [tier: number]: number };
}

export class DynamicLoadBalancer {
  private geminiProxy: GeminiProxy;
  private openRouterIntegration: OpenRouterIntegration;
  private huggingFaceIntegration: HuggingFaceIntegration;
  private cohereIntegration: CohereIntegration;
  
  private config: LoadBalancingConfig;
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private requestMetrics: RequestMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Tier definitions for intelligent routing
  private readonly TIER_DEFINITIONS = {
    1: {
      name: 'Gemini Premium',
      providers: ['gemini-2.5-flash', 'gemini-2.5-flash-preview', 'gemini-2.5-flash-lite'],
      maxConcurrency: 100,
      costMultiplier: 1.0,
      priority: ['high', 'critical']
    },
    2: {
      name: 'Gemini Standard',
      providers: ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite'],
      maxConcurrency: 80,
      costMultiplier: 0.8,
      priority: ['medium', 'high']
    },
    3: {
      name: 'External APIs',
      providers: ['openrouter', 'huggingface', 'cohere'],
      maxConcurrency: 50,
      costMultiplier: 0.3,
      priority: ['low', 'medium']
    }
  };

  constructor(config: LoadBalancingConfig = {}) {
    this.config = {
      preferredTier: config.preferredTier || 1,
      maxRetries: config.maxRetries || 3,
      fallbackDelay: config.fallbackDelay || 1000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      costOptimization: config.costOptimization || true,
      priorityRouting: config.priorityRouting || true,
      ...config
    };

    // Initialize services
    this.geminiProxy = new GeminiProxy();
    this.openRouterIntegration = new OpenRouterIntegration();
    this.huggingFaceIntegration = new HuggingFaceIntegration();
    this.cohereIntegration = new CohereIntegration();

    // Initialize metrics
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      tokensProcessed: 0,
      costEstimate: 0,
      tierUsage: { 1: 0, 2: 0, 3: 0 }
    };

    this.initializeHealthChecks();
    this.startHealthMonitoring();
  }

  /**
   * Initialize health status for all providers
   */
  private initializeHealthChecks(): void {
    const providers = [
      'gemini-2.5-flash', 'gemini-2.5-flash-preview', 'gemini-2.5-flash-lite',
      'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite',
      'openrouter', 'huggingface', 'cohere'
    ];

    providers.forEach(provider => {
      this.providerHealth.set(provider, {
        healthy: true,
        latency: 0,
        successRate: 100,
        lastChecked: Date.now(),
        errors: [],
        capacity: 100
      });
    });
  }

  /**
   * Start continuous health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform comprehensive health checks across all tiers
   */
  private async performHealthChecks(): Promise<void> {
    const healthChecks = [
      this.checkGeminiHealth(),
      this.checkOpenRouterHealth(),
      this.checkHuggingFaceHealth(),
      this.checkCohereHealth()
    ];

    try {
      await Promise.allSettled(healthChecks);
    } catch (error) {
      console.warn('Health check completed with some failures:', error);
    }
  }

  private async checkGeminiHealth(): Promise<void> {
    try {
      const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
      
      for (const model of geminiModels) {
        const startTime = Date.now();
        try {
          const response = await this.geminiProxy.executeRequest(
            { type: 'text', complexity: 'medium', priority: 'medium' },
            'Health check test',
            { model: model, maxOutputTokens: 10 }
          );
          
          const latency = Date.now() - startTime;
          this.updateProviderHealth(model, true, latency, null);
        } catch (error) {
          this.updateProviderHealth(model, false, 0, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.warn('Gemini health check failed:', error);
    }
  }

  private async checkOpenRouterHealth(): Promise<void> {
    try {
      const startTime = Date.now();
      const health = await this.openRouterIntegration.healthCheck();
      const latency = Date.now() - startTime;
      
      this.updateProviderHealth('openrouter', health.healthy, latency, health.errors);
    } catch (error) {
      this.updateProviderHealth('openrouter', false, 0, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async checkHuggingFaceHealth(): Promise<void> {
    try {
      const startTime = Date.now();
      const health = await this.huggingFaceIntegration.healthCheck();
      const latency = Date.now() - startTime;
      
      this.updateProviderHealth('huggingface', health.healthy, latency, health.errors);
    } catch (error) {
      this.updateProviderHealth('huggingface', false, 0, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private async checkCohereHealth(): Promise<void> {
    try {
      const startTime = Date.now();
      const health = await this.cohereIntegration.healthCheck();
      const latency = Date.now() - startTime;
      
      this.updateProviderHealth('cohere', health.healthy, latency, health.errors);
    } catch (error) {
      this.updateProviderHealth('cohere', false, 0, [error instanceof Error ? error.message : String(error)]);
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(
    provider: string,
    healthy: boolean,
    latency: number,
    errors: string[] | string | null
  ): void {
    const health = this.providerHealth.get(provider);
    if (!health) return;

    const errorArray = errors ? (Array.isArray(errors) ? errors : [errors]) : [];

    // Update health metrics with exponential smoothing
    health.healthy = healthy;
    health.latency = health.latency * 0.7 + latency * 0.3;
    health.lastChecked = Date.now();
    health.errors = errorArray;

    // Update success rate
    if (healthy) {
      health.successRate = Math.min(100, health.successRate * 0.95 + 5);
      health.capacity = Math.min(100, health.capacity + 10);
    } else {
      health.successRate = Math.max(0, health.successRate * 0.9);
      health.capacity = Math.max(0, health.capacity - 20);
    }

    this.providerHealth.set(provider, health);
  }

  /**
   * Intelligent request routing with tier-based fallback
   */
  async routeRequest(
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig = {}
  ): Promise<GeminiResponse> {
    const startTime = Date.now();
    this.requestMetrics.totalRequests++;

    try {
      // Determine optimal routing strategy
      const routingPlan = this.createRoutingPlan(task, config);
      
      for (const route of routingPlan) {
        try {
          const response = await this.executeWithProvider(route.provider, route.tier, task, prompt, config);
          
          // Update metrics on success
          const latency = Date.now() - startTime;
          this.updateRequestMetrics(true, latency, route.tier, response.metadata?.tokensUsed || 0);
          
          return {
            ...response,
            metadata: {
              ...response.metadata
            }
          };
        } catch (error) {
          console.warn(`Provider ${route.provider} failed:`, error instanceof Error ? error.message : String(error));
          
          // Add delay before trying next provider
          if (route !== routingPlan[routingPlan.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, this.config.fallbackDelay));
          }
        }
      }

      // All providers failed
      this.updateRequestMetrics(false, Date.now() - startTime, 0, 0);
      throw new Error('All providers failed - no available fallback options');

    } catch (error) {
      this.requestMetrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Create intelligent routing plan based on task requirements
   */
  private createRoutingPlan(task: TaskRequest, config: GeminiConfig): Array<{ provider: string; tier: number; reason: string }> {
    const plan: Array<{ provider: string; tier: number; reason: string }> = [];

    // Priority-based routing for critical tasks
    if (task.priority === 'high') {
      // Tier 1: Best Gemini models first
      plan.push(
        { provider: 'gemini-2.5-flash', tier: 1, reason: 'high-priority-premium' },
        { provider: 'gemini-2.5-flash-preview', tier: 1, reason: 'high-priority-backup' }
      );
    }

    // Cost-optimized routing
    if (this.config.costOptimization && (task.priority === 'low' || task.complexity === 'simple')) {
      plan.push(
        { provider: 'openrouter', tier: 3, reason: 'cost-optimized-primary' },
        { provider: 'huggingface', tier: 3, reason: 'cost-optimized-secondary' }
      );
    }

    // Standard routing plan
    if (plan.length === 0) {
      // Start with preferred tier
      if (this.config.preferredTier === 1) {
        plan.push(
          { provider: 'gemini-2.5-flash', tier: 1, reason: 'preferred-tier-1' },
          { provider: 'gemini-2.0-flash', tier: 2, reason: 'tier-2-fallback' },
          { provider: 'cohere', tier: 3, reason: 'tier-3-fallback' }
        );
      } else if (this.config.preferredTier === 2) {
        plan.push(
          { provider: 'gemini-2.0-flash', tier: 2, reason: 'preferred-tier-2' },
          { provider: 'gemini-2.5-flash', tier: 1, reason: 'tier-1-upgrade' },
          { provider: 'openrouter', tier: 3, reason: 'tier-3-fallback' }
        );
      } else {
        plan.push(
          { provider: 'openrouter', tier: 3, reason: 'preferred-tier-3' },
          { provider: 'huggingface', tier: 3, reason: 'tier-3-alternative' },
          { provider: 'gemini-2.0-flash', tier: 2, reason: 'tier-2-upgrade' }
        );
      }
    }

    // Filter out unhealthy providers and add alternatives
    const healthyPlan = plan.filter(route => {
      const health = this.providerHealth.get(route.provider);
      return health && health.healthy && health.capacity > 20;
    });

    // Add emergency fallbacks if healthy plan is too short
    if (healthyPlan.length < 2) {
      const backupProviders = ['cohere', 'huggingface', 'openrouter'];
      for (const provider of backupProviders) {
        const health = this.providerHealth.get(provider);
        if (health && health.healthy && !healthyPlan.find(p => p.provider === provider)) {
          healthyPlan.push({ provider, tier: 3, reason: 'emergency-fallback' });
        }
      }
    }

    return healthyPlan.length > 0 ? healthyPlan : plan; // Return original plan if no healthy providers
  }

  /**
   * Execute request with specific provider
   */
  private async executeWithProvider(
    provider: string,
    tier: number,
    task: TaskRequest,
    prompt: string,
    config: GeminiConfig
  ): Promise<GeminiResponse> {
    switch (provider) {
      case 'openrouter':
        return await this.openRouterIntegration.executeRequest(task, prompt, config);
      
      case 'huggingface':
        return await this.huggingFaceIntegration.executeRequest(task, prompt, config);
      
      case 'cohere':
        return await this.cohereIntegration.executeRequest(task, prompt, config);
      
      default:
        // Gemini models
        return await this.geminiProxy.executeRequest(task, prompt, { ...config, model: provider });
    }
  }

  /**
   * Update request metrics
   */
  private updateRequestMetrics(success: boolean, latency: number, tier: number, tokens: number): void {
    if (success) {
      this.requestMetrics.successfulRequests++;
    } else {
      this.requestMetrics.failedRequests++;
    }

    // Update average latency with exponential smoothing
    this.requestMetrics.averageLatency = 
      this.requestMetrics.averageLatency * 0.9 + latency * 0.1;

    this.requestMetrics.tokensProcessed += tokens;
    this.requestMetrics.tierUsage[tier] = (this.requestMetrics.tierUsage[tier] || 0) + 1;

    // Rough cost estimation
    const costPerToken = tier === 1 ? 0.0001 : tier === 2 ? 0.00005 : 0.00001;
    this.requestMetrics.costEstimate += tokens * costPerToken;
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    health: { [provider: string]: ProviderHealth };
    metrics: RequestMetrics;
    config: LoadBalancingConfig;
    uptime: number;
  } {
    return {
      health: Object.fromEntries(this.providerHealth),
      metrics: { ...this.requestMetrics },
      config: { ...this.config },
      uptime: process.uptime()
    };
  }

  /**
   * Get optimal provider recommendations
   */
  getProviderRecommendations(task: TaskRequest): Array<{ provider: string; score: number; reasoning: string }> {
    const recommendations: Array<{ provider: string; score: number; reasoning: string }> = [];

    this.providerHealth.forEach((health, provider) => {
      let score = 0;
      let reasoning = [];

      // Base health score (0-40 points)
      if (health.healthy) {
        score += 20;
        reasoning.push('healthy');
      }
      score += (health.successRate / 100) * 20;

      // Latency score (0-20 points)
      const latencyScore = Math.max(0, 20 - (health.latency / 100));
      score += latencyScore;
      if (health.latency < 1000) reasoning.push('low-latency');

      // Capacity score (0-20 points)
      score += (health.capacity / 100) * 20;
      if (health.capacity > 80) reasoning.push('high-capacity');

      // Task-specific bonuses (0-20 points)
      if (task.priority === 'high' && provider.includes('gemini-2.5')) {
        score += 10;
        reasoning.push('priority-optimized');
      }
      if (task.complexity === 'simple' && ['openrouter', 'huggingface'].includes(provider)) {
        score += 10;
        reasoning.push('cost-optimized');
      }

      recommendations.push({
        provider,
        score: Math.round(score),
        reasoning: reasoning.join(', ')
      });
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<LoadBalancingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health monitoring if interval changed
    if (newConfig.healthCheckInterval) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance
export const dynamicLoadBalancer = new DynamicLoadBalancer();