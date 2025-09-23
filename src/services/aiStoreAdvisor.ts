/**
 * AI Store Advisor Service
 * The brain of your chicken business - learns patterns, provides guidance, and acts as a business consultant
 * This is the "customer service level AI" for business operations you wanted!
 */

import { createClient } from '@supabase/supabase-js';
import AdvancedGeminiProxy from '../advanced-gemini-proxy';

// Initialize Supabase client for MCP server context
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BusinessMemory {
  pattern_type: string;
  pattern_data: any;
  frequency: number;
  success_rate: number;
  confidence: number;
  last_seen: string;
  created_at: string;
}

interface ContextualAdvice {
  type: 'guidance' | 'warning' | 'opportunity' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  action_suggested?: string;
  data_source: any;
  confidence: number;
}

interface BusinessState {
  current_sales: any[];
  current_expenses: any[];
  current_stock: any[];
  recent_notes: any[];
  worker_activity: any[];
  time_context: string;
  business_hours: boolean;
}

class AIStoreAdvisorService {
  private businessMemory: Map<string, BusinessMemory> = new Map();
  private lastAdviceTime: number = 0;
  private currentBusinessState: BusinessState | null = null;
  private geminiProxy: AdvancedGeminiProxy;

  constructor(geminiProxy: AdvancedGeminiProxy) {
    this.geminiProxy = geminiProxy;
  }

  /**
   * Main AI Store Advisor - your business consultant that understands everything
   */
  async getBusinessAdvice(userRole: 'owner' | 'worker', userQuery?: string): Promise<ContextualAdvice[]> {
    console.log(`🧠 AI Store Advisor analyzing business for ${userRole}...`);
    
    try {
      // Step 1: Load current business state
      await this.loadCurrentBusinessState();
      
      // Step 2: Load and update business memory
      await this.loadBusinessMemory();
      
      // Step 3: Generate contextual advice based on role and current state
      const advice = await this.generateContextualAdvice(userRole, userQuery);
      
      // Step 4: Update memory with new patterns
      await this.updateBusinessMemory(advice);
      
      console.log(`✅ Generated ${advice.length} pieces of business advice`);
      return advice;
      
    } catch (error) {
      console.error('❌ AI Store Advisor failed:', error);
      return this.getFallbackAdvice(userRole);
    }
  }
  
  /**
   * Real-time business consultation - like having a business expert on call
   */
  async askBusinessConsultant(question: string, userRole: 'owner' | 'worker'): Promise<string> {
    console.log(`💭 Business consultant answering: "${question}"`);
    
    try {
      // Get current business context
      await this.loadCurrentBusinessState();
      
      // Build comprehensive business context for AI
      const businessContext = this.buildBusinessContext();
      
      const prompt = `
You are an expert business consultant for a small fried chicken restaurant.
Here is a snapshot of their recent performance:
- Total Sales (last 90 days): ₱${businessContext.sales_summary.total_revenue.toFixed(2)}
- Total Expenses (last 90 days): ₱${businessContext.expense_summary.total_amount.toFixed(2)}
- Net Profit (last 90 days): ₱${(businessContext.sales_summary.total_revenue - businessContext.expense_summary.total_amount).toFixed(2)}

Based on this data, provide smart business insights.
- "insights": Provide 2-3 general observations.
- "risks": Identify 2-3 potential risks or areas of concern.
- "opportunities": Suggest 2-3 growth opportunities or areas for improvement.
`;

      const response = await this.geminiProxy.generateText(prompt, {
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxOutputTokens: 2000,
        taskType: {
          complexity: 'complex',
          type: 'analysis',
          priority: 'high'
        }
      });
      
      // Log the consultation for learning
      await this.logBusinessConsultation(question, response.text, userRole);
      
      return response.text;
      
    } catch (error) {
      console.error('Business consultant error:', error);
      return "I'm having trouble accessing the business data right now. Please try again in a moment.";
    }
  }
  
  /**
   * Proactive business monitoring - AI watches your business and alerts you
   */
  async monitorBusinessHealth(): Promise<ContextualAdvice[]> {
    console.log('🔍 AI monitoring business health...');
    
    const alerts: ContextualAdvice[] = [];
    
    try {
      await this.loadCurrentBusinessState();
      
      if (!this.currentBusinessState) return alerts;
      
      // Check for immediate concerns
      const stockAlerts = await this.checkStockLevels();
      const salesAlerts = await this.checkSalesPatterns();
      const expenseAlerts = await this.checkExpensePatterns();
      const operationalAlerts = await this.checkOperationalEfficiency();
      
      alerts.push(...stockAlerts, ...salesAlerts, ...expenseAlerts, ...operationalAlerts);
      
      // Sort by priority
      alerts.sort((a, b) => {
        const priority = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priority[b.priority] - priority[a.priority];
      });
      
      return alerts.slice(0, 5); // Top 5 most important alerts
      
    } catch (error) {
      console.error('Business monitoring failed:', error);
      return [];
    }
  }
  
  /**
   * Learn from business patterns - builds the AI's memory
   */
  async learnFromBusinessActivity(activity: any): Promise<void> {
    try {
      // Analyze the activity for patterns
      const patterns = await this.extractPatternsFromActivity(activity);
      
      // Update memory with new patterns
      for (const pattern of patterns) {
        const existing = this.businessMemory.get(pattern.pattern_type);
        
        if (existing) {
          // Update existing pattern
          existing.frequency += 1;
          existing.last_seen = new Date().toISOString();
          existing.pattern_data = this.mergePatternData(existing.pattern_data, pattern.pattern_data);
        } else {
          // New pattern discovered
          this.businessMemory.set(pattern.pattern_type, {
            pattern_type: pattern.pattern_type,
            pattern_data: pattern.pattern_data,
            frequency: 1,
            success_rate: 0.8, // Initial assumption
            confidence: pattern.confidence,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        }
      }
      
      // Store updated memory
      await this.saveBusinessMemory();
      
    } catch (error) {
      console.warn('Pattern learning failed:', error);
    }
  }
  
  /**
   * Worker-specific guidance - helps workers with their tasks
   */
  async getWorkerGuidance(workerActivity: any[]): Promise<ContextualAdvice[]> {
    const guidance: ContextualAdvice[] = [];
    
    try {
      // Analyze recent worker activity
      const recentNotes = workerActivity.filter(a => a.type === 'note').slice(0, 10);
      const recentSales = workerActivity.filter(a => a.type === 'sale').slice(0, 10);
      
      if (recentNotes.length > 0) {
        const noteGuidance = await this.analyzeWorkerNotes(recentNotes);
        guidance.push(...noteGuidance);
      }
      
      if (recentSales.length > 0) {
        const salesGuidance = await this.analyzeWorkerSales(recentSales);
        guidance.push(...salesGuidance);
      }
      
      // Check for common worker issues
      const commonIssues = await this.checkCommonWorkerIssues(workerActivity);
      guidance.push(...commonIssues);
      
      return guidance;
      
    } catch (error) {
      console.error('Worker guidance failed:', error);
      return [];
    }
  }
  
  /**
   * Owner-specific insights - strategic business advice
   */
  async getOwnerInsights(): Promise<ContextualAdvice[]> {
    const insights: ContextualAdvice[] = [];
    
    try {
      await this.loadCurrentBusinessState();
      
      if (!this.currentBusinessState) return insights;
      
      // Strategic analysis
      const profitabilityInsights = await this.analyzeProfitability();
      const growthOpportunities = await this.identifyGrowthOpportunities();
      const operationalOptimizations = await this.findOperationalOptimizations();
      const marketInsights = await this.analyzeMarketPosition();
      
      insights.push(
        ...profitabilityInsights,
        ...growthOpportunities, 
        ...operationalOptimizations,
        ...marketInsights
      );
      
      return insights;
      
    } catch (error) {
      console.error('Owner insights failed:', error);
      return [];
    }
  }
  
  // Core business analysis methods
  
  private async loadCurrentBusinessState(): Promise<void> {
    try {
      const [sales, expenses, stock, notes] = await Promise.all([
        this.getRecentSales(),
        this.getRecentExpenses(), 
        this.getCurrentStock(),
        this.getRecentNotes()
      ]);
      
      this.currentBusinessState = {
        current_sales: sales,
        current_expenses: expenses,
        current_stock: stock,
        recent_notes: notes,
        worker_activity: [], // Will be loaded separately
        time_context: this.getTimeContext(),
        business_hours: this.isBusinessHours()
      };
      
    } catch (error) {
      console.error('Failed to load business state:', error);
    }
  }
  
  private async generateContextualAdvice(userRole: 'owner' | 'worker', userQuery?: string): Promise<ContextualAdvice[]> {
    if (!this.currentBusinessState) return [];
    
    const advice: ContextualAdvice[] = [];
    
    try {
      const prompt = `
Analyze this chicken business and provide contextual advice for a ${userRole}.

CURRENT BUSINESS STATE:
Sales Today: ${this.currentBusinessState.current_sales.length} transactions
Expenses Today: ${this.currentBusinessState.current_expenses.length} entries  
Stock Items: ${this.currentBusinessState.current_stock.length} products
Recent Notes: ${this.currentBusinessState.recent_notes.length} notes
Time: ${this.currentBusinessState.time_context}
Business Hours: ${this.currentBusinessState.business_hours}

SPECIFIC REQUEST: ${userQuery || 'General business advice'}

BUSINESS MEMORY:
${this.getMemoryContext()}

Provide 3-5 specific, actionable pieces of advice. For each advice:
1. Consider the current business state
2. Reference historical patterns if relevant
3. Be specific to ${userRole} role
4. Suggest concrete actions

Return JSON array:
[
  {
    "type": "guidance|warning|opportunity|optimization",
    "priority": "low|medium|high|urgent",
    "title": "Brief title",
    "message": "Detailed advice message",
    "action_suggested": "Specific action to take",
    "confidence": 0-100
  }
]
`;

      const response = await this.geminiProxy.generateText(prompt, {
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxOutputTokens: 2000,
        taskType: {
          complexity: 'medium',
          type: 'analysis',
          priority: 'normal'
        }
      });
      
      const aiAdvice = JSON.parse(response.text);
      
      for (const item of aiAdvice) {
        advice.push({
          type: item.type,
          priority: item.priority,
          title: item.title,
          message: item.message,
          action_suggested: item.action_suggested,
          data_source: this.currentBusinessState,
          confidence: item.confidence
        });
      }
      
    } catch (error) {
      console.warn('AI advice generation failed:', error);
    }
    
    return advice;
  }
  
  private buildBusinessContext(): any {
    if (!this.currentBusinessState) return {};
    
    return {
      sales_summary: {
        count: this.currentBusinessState.current_sales.length,
        total_revenue: this.currentBusinessState.current_sales.reduce((sum, sale) => sum + (sale.total || 0), 0),
        top_products: this.getTopProducts(this.currentBusinessState.current_sales)
      },
      expense_summary: {
        count: this.currentBusinessState.current_expenses.length,
        total_amount: this.currentBusinessState.current_expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
        categories: this.groupExpensesByCategory(this.currentBusinessState.current_expenses)
      },
      stock_summary: {
        total_items: this.currentBusinessState.current_stock.length,
        low_stock_items: this.currentBusinessState.current_stock.filter(item => (item.quantity || 0) <= (item.reorder_point || 0)).length,
        out_of_stock: this.currentBusinessState.current_stock.filter(item => (item.quantity || 0) === 0).length
      },
      operational_context: {
        time: this.currentBusinessState.time_context,
        business_hours: this.currentBusinessState.business_hours,
        recent_activity: this.currentBusinessState.recent_notes.length
      }
    };
  }
  
  private getMemoryContext(): string {
    const memoryEntries = Array.from(this.businessMemory.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    return memoryEntries.map(memory => 
      `${memory.pattern_type}: seen ${memory.frequency} times (${memory.confidence}% confidence)`
    ).join('\n');
  }
  
  // Business monitoring methods
  
  private async checkStockLevels(): Promise<ContextualAdvice[]> {
    const alerts: ContextualAdvice[] = [];
    
    if (!this.currentBusinessState) return alerts;
    
    for (const item of this.currentBusinessState.current_stock) {
      if ((item.quantity || 0) <= (item.reorder_point || 0)) {
        alerts.push({
          type: 'warning',
          priority: (item.quantity || 0) === 0 ? 'urgent' : 'high',
          title: `Low Stock: ${item.product_name}`,
          message: `${item.product_name} is ${(item.quantity || 0) === 0 ? 'out of stock' : 'running low'} (${item.quantity} ${item.unit} remaining)`,
          action_suggested: `Reorder ${item.product_name} immediately`,
          data_source: item,
          confidence: 95
        });
      }
    }
    
    return alerts;
  }
  
  private async checkSalesPatterns(): Promise<ContextualAdvice[]> {
    const alerts: ContextualAdvice[] = [];
    
    if (!this.currentBusinessState) return alerts;
    
    const todaySales = this.currentBusinessState.current_sales.length;
    const avgDailySales = await this.getAverageDailySales();
    
    if (todaySales < avgDailySales * 0.7) {
      alerts.push({
        type: 'warning',
        priority: 'medium',
        title: 'Below Average Sales',
        message: `Today's sales (${todaySales}) are ${Math.round((1 - todaySales/avgDailySales) * 100)}% below average`,
        action_suggested: 'Review pricing, check product availability, or run promotions',
        data_source: { today: todaySales, average: avgDailySales },
        confidence: 80
      });
    }
    
    return alerts;
  }
  
  private async checkExpensePatterns(): Promise<ContextualAdvice[]> {
    const alerts: ContextualAdvice[] = [];
    
    if (!this.currentBusinessState) return alerts;
    
    const todayExpenses = this.currentBusinessState.current_expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const avgDailyExpenses = await this.getAverageDailyExpenses();
    
    if (todayExpenses > avgDailyExpenses * 1.5) {
      alerts.push({
        type: 'warning',
        priority: 'medium', 
        title: 'High Expenses Today',
        message: `Today's expenses (₱${todayExpenses.toFixed(2)}) are ${Math.round((todayExpenses/avgDailyExpenses - 1) * 100)}% above average`,
        action_suggested: 'Review expense categories and identify unusual spending',
        data_source: { today: todayExpenses, average: avgDailyExpenses },
        confidence: 85
      });
    }
    
    return alerts;
  }
  
  private async checkOperationalEfficiency(): Promise<ContextualAdvice[]> {
    const alerts: ContextualAdvice[] = [];
    
    // Check for operational patterns in notes
    if (!this.currentBusinessState) return alerts;
    
    const recentNotes = this.currentBusinessState.recent_notes;
    const processingNotes = recentNotes.filter(note => 
      note.content?.toLowerCase().includes('process') || 
      note.content?.toLowerCase().includes('cook') ||
      note.content?.toLowerCase().includes('prepare')
    );
    
    if (processingNotes.length > recentNotes.length * 0.7) {
      alerts.push({
        type: 'opportunity',
        priority: 'medium',
        title: 'High Processing Activity',
        message: 'Lots of processing activity detected. Consider batch processing for efficiency.',
        action_suggested: 'Optimize processing workflow by batching similar tasks',
        data_source: processingNotes,
        confidence: 70
      });
    }
    
    return alerts;
  }
  
  // Pattern learning and memory methods
  
  private async extractPatternsFromActivity(activity: any): Promise<any[]> {
    const patterns = [];
    
    // Extract different types of patterns
    if (activity.type === 'sale') {
      patterns.push({
        pattern_type: `sale_${activity.product_name}_${this.getTimeOfDay()}`,
        pattern_data: {
          product: activity.product_name,
          quantity: activity.quantity,
          price: activity.price,
          time_of_day: this.getTimeOfDay(),
          day_of_week: new Date().getDay()
        },
        confidence: 80
      });
    }
    
    if (activity.type === 'expense') {
      patterns.push({
        pattern_type: `expense_${activity.category}_${this.getTimeOfDay()}`,
        pattern_data: {
          category: activity.category,
          amount: activity.amount,
          time_of_day: this.getTimeOfDay()
        },
        confidence: 75
      });
    }
    
    return patterns;
  }
  
  private async loadBusinessMemory(): Promise<void> {
    try {
      const { data: memories } = await supabase
        .from('business_memory')
        .select('*');
      
      for (const memory of memories || []) {
        this.businessMemory.set(memory.pattern_type, memory);
      }
    } catch (error) {
      console.warn('Failed to load business memory:', error);
    }
  }
  
  private async saveBusinessMemory(): Promise<void> {
    try {
      const memories = Array.from(this.businessMemory.values());
      await supabase
        .from('business_memory')
        .upsert(memories);
    } catch (error) {
      console.warn('Failed to save business memory:', error);
    }
  }
  
  private async updateBusinessMemory(advice: ContextualAdvice[]): Promise<void> {
    // Learn from the advice given to improve future recommendations
    for (const item of advice) {
      const memoryKey = `advice_${item.type}_${item.priority}`;
      const existing = this.businessMemory.get(memoryKey);
      
      if (existing) {
        existing.frequency += 1;
        existing.last_seen = new Date().toISOString();
      } else {
        this.businessMemory.set(memoryKey, {
          pattern_type: memoryKey,
          pattern_data: { advice_type: item.type, priority: item.priority },
          frequency: 1,
          success_rate: 0.8,
          confidence: item.confidence,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }
    }
    
    await this.saveBusinessMemory();
  }
  
  // Helper methods for data access
  
  private async getRecentSales(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('sales')
        .select('*')
        .gte('date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      return data || [];
    } catch (error) {
      console.warn('Failed to load recent sales:', error);
      return [];
    }
  }
  
  private async getRecentExpenses(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      return data || [];
    } catch (error) {
      console.warn('Failed to load recent expenses:', error);
      return [];
    }
  }
  
  private async getCurrentStock(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('product_name');
      
      return data || [];
    } catch (error) {
      console.warn('Failed to load current stock:', error);
      return [];
    }
  }
  
  private async getRecentNotes(): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      
      return data || [];
    } catch (error) {
      console.warn('Failed to load recent notes:', error);
      return [];
    }
  }
  
  private async logBusinessConsultation(question: string, answer: string, userRole: string): Promise<void> {
    try {
      await supabase.from('ai_consultations').insert({
        question,
        answer,
        user_role: userRole,
        business_context: this.buildBusinessContext(),
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log consultation:', error);
    }
  }
  
  // Utility methods
  
  private getTimeContext(): string {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour < 6) return 'early_morning';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }
  
  private getTimeOfDay(): string {
    return this.getTimeContext();
  }
  
  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 6 && hour <= 22; // 6 AM to 10 PM
  }
  
  private getTopProducts(sales: any[]): any[] {
    const productSales = new Map();
    
    for (const sale of sales) {
      const existing = productSales.get(sale.product_name) || { name: sale.product_name, quantity: 0, revenue: 0 };
      existing.quantity += sale.quantity || 1;
      existing.revenue += sale.total || 0;
      productSales.set(sale.product_name, existing);
    }
    
    return Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }
  
  private groupExpensesByCategory(expenses: any[]): any {
    return expenses.reduce((acc, exp) => {
      const category = exp.category || 'Other';
      acc[category] = (acc[category] || 0) + (exp.amount || 0);
      return acc;
    }, {});
  }
  
  private async getAverageDailySales(): Promise<number> {
    // Simplified - in real implementation, calculate from historical data
    return 25; // Average daily sales count
  }
  
  private async getAverageDailyExpenses(): Promise<number> {
    // Simplified - in real implementation, calculate from historical data  
    return 5000; // Average daily expenses in pesos
  }
  
  private mergePatternData(existing: any, newData: any): any {
    // Simple merge - in real implementation, this would be more sophisticated
    return { ...existing, ...newData };
  }
  
  private getFallbackAdvice(userRole: 'owner' | 'worker'): ContextualAdvice[] {
    return [{
      type: 'guidance',
      priority: 'low',
      title: 'AI Advisor Unavailable',
      message: 'The AI advisor is temporarily unavailable. Please check your connection and try again.',
      data_source: {},
      confidence: 100
    }];
  }
  
  // Analysis methods for owner insights
  
  private async analyzeProfitability(): Promise<ContextualAdvice[]> {
    // Implementation for profitability analysis
    return [];
  }
  
  private async identifyGrowthOpportunities(): Promise<ContextualAdvice[]> {
    // Implementation for growth opportunity identification
    return [];
  }
  
  private async findOperationalOptimizations(): Promise<ContextualAdvice[]> {
    // Implementation for operational optimization
    return [];
  }
  
  private async analyzeMarketPosition(): Promise<ContextualAdvice[]> {
    // Implementation for market position analysis
    return [];
  }
  
  private async analyzeWorkerNotes(notes: any[]): Promise<ContextualAdvice[]> {
    // Implementation for worker note analysis
    return [];
  }
  
  private async analyzeWorkerSales(sales: any[]): Promise<ContextualAdvice[]> {
    // Implementation for worker sales analysis
    return [];
  }
  
  private async checkCommonWorkerIssues(activity: any[]): Promise<ContextualAdvice[]> {
    // Implementation for common worker issue detection
    return [];
  }
}

// Export singleton instance
export const aiStoreAdvisor = new AIStoreAdvisorService(new AdvancedGeminiProxy());

// Export types
export type { BusinessMemory, ContextualAdvice, BusinessState };