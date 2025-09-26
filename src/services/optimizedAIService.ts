// Optimized AI Service with caching and data efficiency
import { supabase } from '../config/supabaseConfig';

interface BusinessSummary {
  revenue: number;
  transactions: number;
  expenses: number;
  topProducts: Array<{name: string; count: number}>;
}

class AIServiceOptimized {
  private cache = new Map<string, {data: any; timestamp: number}>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(query: string, userId: string): string {
    return `${userId}-${query.toLowerCase().slice(0, 50)}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async getBusinessSummary(): Promise<BusinessSummary> {
    const cacheKey = 'business-summary';
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      // Use optimized database function
      const { data, error } = await supabase.rpc('get_business_summary', { days_back: 30 });
      
      if (error) throw error;
      
      const summary = data || { revenue: 0, transactions: 0, expenses: 0, topProducts: [] };
      this.cache.set(cacheKey, { data: summary, timestamp: Date.now() });
      
      return summary;
    } catch (error) {
      console.error('Error getting business summary:', error);
      return { revenue: 0, transactions: 0, expenses: 0, topProducts: [] };
    }
  }

  async getAIResponse(query: string, history: any[] = []): Promise<string> {
    const cacheKey = this.getCacheKey(query, 'current-user');
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      const businessData = await this.getBusinessSummary();
      
      const response = await fetch('/api/getAIAssistantResponse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          businessData,
          history: history.slice(-5) // Only send last 5 messages
        })
      });

      if (!response.ok) throw new Error('AI service unavailable');
      
      const result = await response.json();
      const aiResponse = result.response || 'Sorry, I could not process your request.';
      
      // Cache successful responses
      this.cache.set(cacheKey, { data: aiResponse, timestamp: Date.now() });
      
      return aiResponse;
    } catch (error) {
      console.error('AI service error:', error);
      return this.getFallbackResponse(query);
    }
  }

  private getFallbackResponse(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('sales')) {
      return "Focus on your best-selling products and track daily patterns for better sales performance.";
    } else if (lowerQuery.includes('expense')) {
      return "Review expenses regularly and look for cost-saving opportunities to improve profitability.";
    } else {
      return "I'm here to help with business insights. Try asking about sales, expenses, or product performance.";
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const aiService = new AIServiceOptimized();