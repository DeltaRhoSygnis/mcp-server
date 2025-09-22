/**
 * Optimized AI Service
 * Provides efficient AI integration with caching, rate limiting, and optimized context
 */

import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { Sale, ForecastDataPoint, AIInsights, Expense, Product, ParsedSaleFromAI } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import { performanceMonitor } from '../utils/monitoring';

/**
 * Optimized business context for AI
 */
interface OptimizedBusinessContext {
  salesSummary: {
    totalRevenue: number;
    transactionCount: number;
    averageOrderValue: number;
    topProducts: Array<{ name: string; revenue: number; quantity: number }>;
    dailyTrends: Array<{ date: string; sales: number }>;
  };
  expensesSummary: {
    totalExpenses: number;
    categories: Record<string, number>;
    recentExpenses: Array<{ description: string; amount: number; date: string }>;
  };
  productsSummary: {
    totalProducts: number;
    lowStockItems: Array<{ name: string; stock: number }>;
    categories: string[];
    priceRange: { min: number; max: number };
  };
}

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Rate limiting interface
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Optimized AI Service class
 */
export class OptimizedAIService {
  private static instance: OptimizedAIService;
  private ai: GoogleGenAI | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private rateLimits = new Map<string, RateLimitEntry>();
  
  // Configuration
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
  private readonly MAX_CACHE_SIZE = 100;

  private constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
    
    if (apiKey && apiKey !== 'undefined') {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("Gemini API key not configured. AI features will be disabled.");
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OptimizedAIService {
    if (!OptimizedAIService.instance) {
      OptimizedAIService.instance = new OptimizedAIService();
    }
    return OptimizedAIService.instance;
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.ai !== null;
  }

  /**
   * Prepare optimized business context
   */
  private prepareBusinessContext(sales: Sale[], expenses: Expense[], products: Product[]): OptimizedBusinessContext {
    const timerId = performanceMonitor.startTimer('ai_prepare_context');

    try {
      // Optimize sales data (last 30 days only)
      const recentSales = sales.slice(0, 30);
      const totalRevenue = recentSales.reduce((sum, s) => sum + s.total, 0);
      const transactionCount = recentSales.length;
      const averageOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

      // Top products by revenue
      const productRevenue = new Map<string, { revenue: number; quantity: number; name: string }>();
      recentSales.forEach(sale => {
        sale.items.forEach(item => {
          const existing = productRevenue.get(item.productId) || { revenue: 0, quantity: 0, name: item.name };
          existing.revenue += item.price * item.quantity;
          existing.quantity += item.quantity;
          existing.name = item.name;
          productRevenue.set(item.productId, existing);
        });
      });

      const topProducts = Array.from(productRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Daily trends (last 7 days)
      const dailyTrends = this.calculateDailyTrends(recentSales).slice(-7);

      // Optimize expenses data
      const recentExpenses = expenses.slice(0, 10);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const categories = this.categorizeExpenses(expenses);

      // Optimize products data
      const lowStockItems = products
        .filter(p => p.stock < 10)
        .map(p => ({ name: p.name, stock: p.stock }))
        .slice(0, 10);

      const productCategories = [...new Set(products.map(p => p.category))];
      const prices = products.map(p => p.price);
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices)
      };

      performanceMonitor.endTimer(timerId, true);

      return {
        salesSummary: {
          totalRevenue,
          transactionCount,
          averageOrderValue,
          topProducts,
          dailyTrends
        },
        expensesSummary: {
          totalExpenses,
          categories,
          recentExpenses: recentExpenses.map(e => ({
            description: e.description.substring(0, 50), // Truncate long descriptions
            amount: e.amount,
            date: e.date.split('T')[0] // Date only
          }))
        },
        productsSummary: {
          totalProducts: products.length,
          lowStockItems,
          categories: productCategories,
          priceRange
        }
      };
    } catch (error: any) {
      performanceMonitor.endTimer(timerId, false, error.message);
      throw error;
    }
  }

  /**
   * Calculate daily sales trends
   */
  private calculateDailyTrends(sales: Sale[]): Array<{ date: string; sales: number }> {
    const dailySales = new Map<string, number>();
    
    sales.forEach(sale => {
      const date = sale.date.split('T')[0];
      dailySales.set(date, (dailySales.get(date) || 0) + sale.total);
    });

    return Array.from(dailySales.entries())
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Categorize expenses for summary
   */
  private categorizeExpenses(expenses: Expense[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    expenses.forEach(expense => {
      // Simple categorization based on description keywords
      const desc = expense.description.toLowerCase();
      let category = 'Other';
      
      if (desc.includes('supply') || desc.includes('ingredient') || desc.includes('food')) {
        category = 'Supplies';
      } else if (desc.includes('utility') || desc.includes('electric') || desc.includes('water')) {
        category = 'Utilities';
      } else if (desc.includes('rent') || desc.includes('lease')) {
        category = 'Rent';
      } else if (desc.includes('marketing') || desc.includes('advertising')) {
        category = 'Marketing';
      } else if (desc.includes('maintenance') || desc.includes('repair')) {
        category = 'Maintenance';
      }
      
      categories[category] = (categories[category] || 0) + expense.amount;
    });

    return categories;
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(operation: string): Promise<void> {
    const now = Date.now();
    const key = `rate_limit_${operation}`;
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return;
    }

    if (entry.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      throw ErrorHandler.handleBusinessLogicError(
        'rate-limit-exceeded',
        'Too many AI requests. Please wait a moment before trying again.',
        { operation, resetTime: entry.resetTime }
      );
    }

    entry.count++;
  }

  /**
   * Get from cache or execute function
   */
  private async getFromCacheOrExecute<T>(
    key: string,
    executor: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
      performanceMonitor.logMetric('ai_cache_hit', 1, { key });
      return cached.data;
    }

    performanceMonitor.logMetric('ai_cache_miss', 1, { key });
    
    const result = await executor();
    
    // Clean cache if it's getting too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanCache();
    }

    this.cache.set(key, {
      data: result,
      timestamp: now,
      expiresAt: now + ttl
    });

    return result;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        toDelete.push(key);
      }
    }

    // If still too many, remove oldest entries
    if (this.cache.size - toDelete.length >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const additionalToDelete = entries
        .slice(0, this.cache.size - this.MAX_CACHE_SIZE + 10)
        .map(([key]) => key);
      
      toDelete.push(...additionalToDelete);
    }

    toDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get AI assistant response with optimization
   */
  async getAssistantResponse(
    query: string,
    history: { text: string; sender: 'user' | 'ai' }[],
    sales: Sale[],
    expenses: Expense[],
    products: Product[]
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw ErrorHandler.handleBusinessLogicError(
        'ai-service-unavailable',
        'AI service is not available. Please check your configuration.'
      );
    }

    const timerId = performanceMonitor.startTimer('ai_assistant_response');

    try {
      await this.checkRateLimit('assistant');

      // Create cache key based on query and recent data
      const contextHash = this.createContextHash(query, sales.slice(0, 5), expenses.slice(0, 3));
      const cacheKey = `assistant_${contextHash}`;

      return await this.getFromCacheOrExecute(cacheKey, async () => {
        const context = this.prepareBusinessContext(sales, expenses, products);
        
        const systemInstruction = `You are a helpful business assistant for Charnoks Manager POS system.
        
        Current Business Summary:
        - Revenue: ${context.salesSummary.totalRevenue.toFixed(2)} from ${context.salesSummary.transactionCount} transactions
        - Average Order: ${context.salesSummary.averageOrderValue.toFixed(2)}
        - Total Expenses: ${context.expensesSummary.totalExpenses.toFixed(2)}
        - Products: ${context.productsSummary.totalProducts} items, ${context.productsSummary.lowStockItems.length} low stock
        - Top Products: ${context.salesSummary.topProducts.map(p => p.name).join(', ')}
        
        Provide helpful, actionable insights based on this data. Keep responses concise and business-focused.`;

        const model = this.ai!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            ...history.slice(-6).map(msg => ({ // Limit history to last 6 messages
              role: msg.sender === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }]
            })),
            { role: 'user', parts: [{ text: query }] }
          ],
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 500 // Limit response length
          }
        });

        const response = await model;
        if (!response.text) {
          throw new Error("AI assistant did not provide a response.");
        }

        performanceMonitor.endTimer(timerId, true);
        return response.text();
      });

    } catch (error: any) {
      performanceMonitor.endTimer(timerId, false, error.message);
      throw ErrorHandler.handleFirebaseError(error, {
        operation: 'ai_assistant_response',
        query: query.substring(0, 100)
      });
    }
  }

  /**
   * Get sales forecast with caching
   */
  async getSalesForecast(sales: Sale[]): Promise<ForecastDataPoint[]> {
    if (!this.isAvailable()) {
      throw ErrorHandler.handleBusinessLogicError(
        'ai-service-unavailable',
        'AI forecasting service is not available.'
      );
    }

    const timerId = performanceMonitor.startTimer('ai_sales_forecast');

    try {
      await this.checkRateLimit('forecast');

      const contextHash = this.createContextHash('forecast', sales.slice(0, 30));
      const cacheKey = `forecast_${contextHash}`;

      return await this.getFromCacheOrExecute(cacheKey, async () => {
        const recentSales = sales.slice(0, 30);
        const dailyTrends = this.calculateDailyTrends(recentSales);
        
        const prompt = `Based on this sales trend data, provide a 7-day forecast:
        ${JSON.stringify(dailyTrends.slice(-14))}
        
        Consider patterns, seasonality, and recent trends.`;

        const response = await this.ai!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  predictedSales: { type: Type.NUMBER }
                },
                required: ["day", "predictedSales"]
              }
            },
            temperature: 0.3
          }
        });

        if (!response.text) {
          throw new Error("AI forecast response was empty.");
        }

        const forecastData = JSON.parse(response.text());
        performanceMonitor.endTimer(timerId, true);
        return forecastData;

      }, 15 * 60 * 1000); // Cache for 15 minutes

    } catch (error: any) {
      performanceMonitor.endTimer(timerId, false, error.message);
      throw ErrorHandler.handleFirebaseError(error, {
        operation: 'ai_sales_forecast'
      });
    }
  }

  /**
   * Parse sale from voice with optimization
   */
  async parseSaleFromVoice(transcript: string, products: Product[]): Promise<ParsedSaleFromAI> {
    if (!this.isAvailable()) {
      throw ErrorHandler.handleBusinessLogicError(
        'ai-service-unavailable',
        'Voice parsing service is not available.'
      );
    }

    const timerId = performanceMonitor.startTimer('ai_voice_parsing');

    try {
      await this.checkRateLimit('voice_parsing');

      // Optimize product list for AI context
      const productNames = products
        .filter(p => p.stock > 0) // Only available products
        .map(p => p.name)
        .slice(0, 50) // Limit to 50 most relevant products
        .join(', ');

      const prompt = `Parse this voice order into structured data:
      
      Available products: ${productNames}
      
      Voice transcript: "${transcript}"
      
      Extract items and payment amount. Match product names closely.`;

      const response = await this.ai!.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING },
                    quantity: { type: Type.INTEGER }
                  },
                  required: ["productName", "quantity"]
                }
              },
              payment: { type: Type.NUMBER }
            },
            required: ["items", "payment"]
          },
          temperature: 0.1
        }
      });

      if (!response.text) {
        throw new Error("Voice parsing response was empty.");
      }

      const parsedData = JSON.parse(response.text()) as ParsedSaleFromAI;
      performanceMonitor.endTimer(timerId, true);
      return parsedData;

    } catch (error: any) {
      performanceMonitor.endTimer(timerId, false, error.message);
      throw ErrorHandler.handleBusinessLogicError(
        'voice-parsing-failed',
        'Could not understand the voice input. Please try speaking more clearly.',
        { transcript: transcript.substring(0, 100) }
      );
    }
  }

  /**
   * Get business insights with caching
   */
  async getBusinessInsights(sales: Sale[], expenses: Expense[]): Promise<AIInsights> {
    if (!this.isAvailable()) {
      throw ErrorHandler.handleBusinessLogicError(
        'ai-service-unavailable',
        'Business insights service is not available.'
      );
    }

    const timerId = performanceMonitor.startTimer('ai_business_insights');

    try {
      await this.checkRateLimit('insights');

      const contextHash = this.createContextHash('insights', sales.slice(0, 20), expenses.slice(0, 10));
      const cacheKey = `insights_${contextHash}`;

      return await this.getFromCacheOrExecute(cacheKey, async () => {
        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalSales - totalExpenses;

        const prompt = `Analyze this business performance and provide insights:
        
        - Total Sales: ${totalSales.toFixed(2)}
        - Total Expenses: ${totalExpenses.toFixed(2)}
        - Net Profit: ${netProfit.toFixed(2)}
        - Transactions: ${sales.length}
        
        Provide 2-3 insights, risks, and opportunities each.`;

        const response = await this.ai!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                insights: { type: Type.ARRAY, items: { type: Type.STRING } },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                opportunities: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["insights", "risks", "opportunities"]
            },
            temperature: 0.7
          }
        });

        if (!response.text) {
          throw new Error("Business insights response was empty.");
        }

        const insights = JSON.parse(response.text());
        performanceMonitor.endTimer(timerId, true);
        return insights;

      }, 30 * 60 * 1000); // Cache for 30 minutes

    } catch (error: any) {
      performanceMonitor.endTimer(timerId, false, error.message);
      throw ErrorHandler.handleFirebaseError(error, {
        operation: 'ai_business_insights'
      });
    }
  }

  /**
   * Create hash for caching context
   */
  private createContextHash(...data: any[]): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.rateLimits.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    rateLimitStatus: Record<string, { count: number; resetTime: number }>;
  } {
    const rateLimitStatus: Record<string, { count: number; resetTime: number }> = {};
    
    for (const [key, value] of this.rateLimits.entries()) {
      rateLimitStatus[key] = { count: value.count, resetTime: value.resetTime };
    }

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      rateLimitStatus
    };
  }
}

// Export singleton instance
export const optimizedAIService = OptimizedAIService.getInstance();

// Convenience functions
export const getAIAssistantResponse = (
  query: string,
  history: { text: string; sender: 'user' | 'ai' }[],
  sales: Sale[],
  expenses: Expense[],
  products: Product[]
) => optimizedAIService.getAssistantResponse(query, history, sales, expenses, products);

export const getSalesForecast = (sales: Sale[]) => 
  optimizedAIService.getSalesForecast(sales);

export const parseSaleFromVoice = (transcript: string, products: Product[]) => 
  optimizedAIService.parseSaleFromVoice(transcript, products);

export const getBusinessInsights = (sales: Sale[], expenses: Expense[]) => 
  optimizedAIService.getBusinessInsights(sales, expenses);