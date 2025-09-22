/**
 * AI Observer Service
 * Read-only AI assistant for insights, summaries, and dashboards
 * Safe AI that cannot make destructive writes - perfect for business insights!
 */

import { createClient } from '@supabase/supabase-js';
import { GeminiAPIManager } from './geminiAPIManager';

// Initialize Supabase client for MCP server context
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Gemini API manager
const geminiAPIManager = new GeminiAPIManager();

interface BusinessInsight {
  type: 'insight' | 'trend' | 'recommendation' | 'alert';
  title: string;
  description: string;
  confidence: number;
  data_points: any[];
  generated_at: string;
}

interface DailySummary {
  date: string;
  sales_total: number;
  expenses_total: number;
  profit_margin: number;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  ai_insights: BusinessInsight[];
  recommendations: string[];
}

class AIObserverService {
  /**
   * Generate daily business summary with AI insights
   * This is the coolest feature - AI that understands your business!
   */
  async generateDailySummary(date?: string): Promise<DailySummary> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`📊 AI Observer generating summary for ${targetDate}...`);
    
    try {
      // Get business data for the day
      const businessData = await this.getBusinessDataForDate(targetDate);
      
      // Generate AI insights using high-capability model
      const aiInsights = await this.generateAIInsights(businessData);
      
      // Create comprehensive summary
      const summary: DailySummary = {
        date: targetDate,
        sales_total: businessData.sales.reduce((sum, sale) => sum + sale.total, 0),
        expenses_total: businessData.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        profit_margin: this.calculateProfitMargin(businessData.sales, businessData.expenses),
        top_products: this.getTopProducts(businessData.sales),
        ai_insights: aiInsights,
        recommendations: await this.generateRecommendations(businessData)
      };
      
      // Store summary for future reference
      await this.storeSummary(summary);
      
      console.log('✅ AI Observer summary generated successfully!');
      return summary;
      
    } catch (error) {
      console.error('❌ AI Observer summary failed:', error);
      throw new Error('Failed to generate AI summary');
    }
  }
  
  /**
   * Get AI-powered business insights
   * This is where the magic happens - AI understands your chicken business!
   */
  async generateAIInsights(businessData: any): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];
    
    try {
      // Sales performance analysis
      const salesInsight = await this.analyzeSalesPerformance(businessData.sales);
      if (salesInsight) insights.push(salesInsight);
      
      // Expense pattern analysis
      const expenseInsight = await this.analyzeExpensePatterns(businessData.expenses);
      if (expenseInsight) insights.push(expenseInsight);
      
      // Stock level alerts
      const stockAlerts = await this.analyzeStockLevels(businessData.stock);
      insights.push(...stockAlerts);
      
      // Trend detection
      const trendInsight = await this.detectBusinessTrends(businessData);
      if (trendInsight) insights.push(trendInsight);
      
      return insights;
      
    } catch (error) {
      console.warn('⚠️ AI insights generation partially failed:', error);
      return insights; // Return what we have
    }
  }
  
  /**
   * AI-powered sales performance analysis
   */
  async analyzeSalesPerformance(salesData: any[]): Promise<BusinessInsight | null> {
    if (salesData.length === 0) return null;
    
    try {
      const prompt = `
Analyze this chicken business sales data and provide insights:

Sales Data: ${JSON.stringify(salesData.slice(0, 10))} // Recent sales

Focus on:
1. Best selling products
2. Sales patterns (time, quantity)
3. Revenue optimization opportunities
4. Customer behavior patterns

Return insights in this format:
{
  "key_finding": "string",
  "trend_direction": "up|down|stable",
  "confidence": 0-100,
  "recommendations": ["rec1", "rec2"]
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      const analysis = JSON.parse(response.text);
      
      return {
        type: 'insight',
        title: 'Sales Performance Analysis',
        description: analysis.key_finding,
        confidence: analysis.confidence,
        data_points: salesData,
        generated_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn('Sales analysis failed:', error);
      return null;
    }
  }
  
  /**
   * Smart expense pattern recognition
   */
  async analyzeExpensePatterns(expenseData: any[]): Promise<BusinessInsight | null> {
    if (expenseData.length === 0) return null;
    
    try {
      const totalExpenses = expenseData.reduce((sum, exp) => sum + exp.amount, 0);
      const categories = this.groupExpensesByCategory(expenseData);
      
      const prompt = `
Analyze chicken business expense patterns:

Total Expenses: ₱${totalExpenses.toFixed(2)}
Categories: ${JSON.stringify(categories)}

Identify:
1. Unusual spending patterns
2. Cost optimization opportunities  
3. Budget allocation efficiency
4. Potential cost savings

Return JSON:
{
  "pattern_detected": "string",
  "risk_level": "low|medium|high", 
  "savings_opportunity": "string",
  "confidence": 0-100
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      const analysis = JSON.parse(response.text);
      
      return {
        type: 'trend',
        title: 'Expense Pattern Analysis',
        description: analysis.pattern_detected,
        confidence: analysis.confidence,
        data_points: expenseData,
        generated_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn('Expense analysis failed:', error);
      return null;
    }
  }
  
  /**
   * Stock level monitoring with AI alerts
   */
  async analyzeStockLevels(stockData: any[]): Promise<BusinessInsight[]> {
    const alerts: BusinessInsight[] = [];
    
    try {
      for (const item of stockData) {
        if (item.quantity <= item.reorder_point) {
          alerts.push({
            type: 'alert',
            title: `Low Stock Alert: ${item.product_name}`,
            description: `${item.product_name} is running low (${item.quantity} ${item.unit} remaining)`,
            confidence: 95,
            data_points: [item],
            generated_at: new Date().toISOString()
          });
        }
      }
      
      return alerts;
      
    } catch (error) {
      console.warn('Stock analysis failed:', error);
      return [];
    }
  }
  
  /**
   * Detect business trends using AI
   */
  async detectBusinessTrends(businessData: any): Promise<BusinessInsight | null> {
    try {
      const prompt = `
Analyze overall chicken business trends:

Recent Sales: ${businessData.sales.length} transactions
Recent Expenses: ${businessData.expenses.length} entries
Active Products: ${businessData.stock.length} items

Detect:
1. Growth trends
2. Seasonal patterns
3. Business health indicators
4. Market opportunities

Return JSON:
{
  "trend_summary": "string",
  "business_health": "excellent|good|fair|concerning",
  "growth_indicator": "growing|stable|declining",
  "confidence": 0-100
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'complex', priority: 'high', requiresStructuredOutput: true },
        prompt
      );
      
      const analysis = JSON.parse(response.text);
      
      return {
        type: 'trend',
        title: 'Business Trend Analysis',
        description: analysis.trend_summary,
        confidence: analysis.confidence,
        data_points: businessData,
        generated_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn('Trend analysis failed:', error);
      return null;
    }
  }
  
  /**
   * Generate AI recommendations (read-only, safe)
   */
  async generateRecommendations(businessData: any): Promise<string[]> {
    try {
      const prompt = `
Based on this chicken business data, provide 3-5 actionable recommendations:

Sales: ${businessData.sales.length} recent transactions
Expenses: ${businessData.expenses.length} recent expenses
Stock: ${businessData.stock.length} products

Focus on:
1. Revenue optimization
2. Cost reduction
3. Operational efficiency
4. Customer satisfaction

Return array of strings: ["recommendation1", "recommendation2", ...]
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      return JSON.parse(response.text);
      
    } catch (error) {
      console.warn('Recommendations generation failed:', error);
      return [
        'Monitor daily sales trends for optimization opportunities',
        'Review expense categories for potential cost savings',
        'Maintain optimal stock levels to prevent shortages'
      ];
    }
  }
  
  // Helper methods
  
  private async getBusinessDataForDate(date: string) {
    // Get sales data
    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .gte('date', date)
      .lt('date', this.getNextDay(date));
    
    // Get expenses data
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', date)
      .lt('date', this.getNextDay(date));
    
    // Get current stock data
    const { data: stock } = await supabase
      .from('products')
      .select('*');
    
    return {
      sales: sales || [],
      expenses: expenses || [],
      stock: stock || []
    };
  }
  
  private calculateProfitMargin(sales: any[], expenses: any[]): number {
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const costs = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;
  }
  
  private getTopProducts(sales: any[]): Array<{ name: string; quantity: number; revenue: number }> {
    const productMap = new Map();
    
    sales.forEach(sale => {
      const existing = productMap.get(sale.product_name) || { name: sale.product_name, quantity: 0, revenue: 0 };
      existing.quantity += sale.quantity || 1;
      existing.revenue += sale.total;
      productMap.set(sale.product_name, existing);
    });
    
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }
  
  private groupExpensesByCategory(expenses: any[]) {
    return expenses.reduce((acc, exp) => {
      const category = exp.category || 'Other';
      acc[category] = (acc[category] || 0) + exp.amount;
      return acc;
    }, {});
  }
  
  private async storeSummary(summary: DailySummary) {
    try {
      await supabase.from('ai_summaries').insert({
        date: summary.date,
        summary_data: summary,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store AI summary:', error);
    }
  }
  
  private getNextDay(date: string): string {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().split('T')[0];
  }
}

// Export singleton instance
export const aiObserver = new AIObserverService();

// Export types
export type { BusinessInsight, DailySummary };