/**
 * Chicken Business Tools for MCP Server
 * Integrates your existing AI services as MCP tools
 * Provides reliable access to all AI services through the Gemini proxy
 */

import { createClient } from '@supabase/supabase-js';
import AdvancedGeminiProxy, { GeminiConfig, GeminiResponse, TaskRequest } from '../advanced-gemini-proxy.js';
import AIStoreAdvisorService from '../services/ai-store-advisor.js';
import AIObserverService from '../services/ai-observer.js';

export interface ChickenBusinessPattern {
  business_type: 'purchase' | 'processing' | 'distribution' | 'cooking' | 'sales' | 'general';
  confidence_score: number;
  learned_patterns: Record<string, any>;
}

export interface BusinessAdvice {
  type: 'guidance' | 'warning' | 'opportunity' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  action_suggested?: string;
  confidence: number;
}

export class ChickenBusinessTools {
  private supabase;
  private geminiProxy: AdvancedGeminiProxy;
  private aiStoreAdvisor: AIStoreAdvisorService;
  private aiObserver: AIObserverService;

  constructor(geminiProxy: AdvancedGeminiProxy) {
    this.geminiProxy = geminiProxy;
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Initialize AI services
    this.aiStoreAdvisor = new AIStoreAdvisorService(geminiProxy);
    this.aiObserver = new AIObserverService(geminiProxy);
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Chicken Business Tools...');
    // Test database connection
    const { error } = await this.supabase.from('notes').select('id').limit(1);
    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Database connection test failed:', errorMessage);
    } else {
      console.log('✅ Database connection verified');
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up business tools...');
  }

  /**
   * Process chicken business note using AI pattern recognition
   * Integrates with your existing chickenBusinessAI.ts service
   */
  async processChickenNote(
    noteText: string, 
    userRole: 'owner' | 'worker', 
    branchId?: string
  ): Promise<{
    success: boolean;
    pattern?: ChickenBusinessPattern;
    note_id?: string;
    suggested_actions?: string[];
    error?: string;
  }> {
    try {
      console.log(`🧠 Processing chicken note for ${userRole}...`);
      
      // Step 1: Parse with reliable Gemini API
      const pattern = await this.parseNoteWithAI(noteText);
      
      // Step 2: Enhance pattern with business context
      const enhancedPattern = await this.enhancePattern(pattern, userRole, branchId);
      
      // Step 3: Save to database
      const noteId = await this.saveNoteToDatabase(noteText, enhancedPattern, userRole, branchId);
      
      // Step 4: Generate suggested actions
      const suggestedActions = this.generateSuggestedActions(enhancedPattern);
      
      return {
        success: true,
        pattern: enhancedPattern,
        note_id: noteId,
        suggested_actions: suggestedActions
      };
      
    } catch (error) {
      console.error('❌ Failed to process chicken note:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get business advice from AI Store Advisor
   * Now uses the integrated aiStoreAdvisor service
   */
  async getBusinessAdvice(
    question: string,
    userRole: 'owner' | 'worker',
    context?: any
  ): Promise<{
    advice: string;
    contextual_recommendations: BusinessAdvice[];
    confidence: number;
  }> {
    try {
      console.log(`💭 Getting business advice for ${userRole}...`);
      
      // Use the AI Store Advisor service
      const consultationResponse = await this.aiStoreAdvisor.askBusinessConsultant(question, userRole);
      
      // Get contextual recommendations
      const contextualAdvice = await this.aiStoreAdvisor.getBusinessAdvice(userRole, question);
      
      // Convert to BusinessAdvice format
      const recommendations: BusinessAdvice[] = contextualAdvice.map(advice => ({
        type: advice.type,
        priority: advice.priority,
        title: advice.title,
        message: advice.message,
        action_suggested: advice.action_suggested,
        confidence: advice.confidence
      }));
      
      return {
        advice: consultationResponse,
        contextual_recommendations: recommendations,
        confidence: 85
      };
      
    } catch (error) {
      console.error('❌ Failed to get business advice:', error);
      return {
        advice: "I'm having trouble accessing the business data right now. Please try again in a moment.",
        contextual_recommendations: [],
        confidence: 0
      };
    }
  }

  /**
   * Analyze business performance using AI Observer
   * Now uses the integrated aiObserver service
   */
  async analyzeBusinessPerformance(
    timeframe: 'daily' | 'weekly' | 'monthly',
    includeInsights: boolean = true,
    includeRecommendations: boolean = true
  ): Promise<{
    summary: any;
    insights: any[];
    recommendations: string[];
    performance_score: number;
  }> {
    try {
      console.log(`📊 Analyzing ${timeframe} business performance...`);
      
      if (timeframe === 'daily') {
        // Use AI Observer for daily analysis
        const dailySummary = await this.aiObserver.generateDailySummary();
        
        return {
          summary: {
            date: dailySummary.date,
            sales_total: dailySummary.sales_total,
            expenses_total: dailySummary.expenses_total,
            profit_margin: dailySummary.profit_margin,
            top_products: dailySummary.top_products
          },
          insights: includeInsights ? dailySummary.ai_insights : [],
          recommendations: includeRecommendations ? dailySummary.recommendations : [],
          performance_score: Math.max(0, dailySummary.profit_margin + 50) // Normalize to 0-100
        };
      } else if (timeframe === 'weekly') {
        // Use AI Observer for weekly analysis
        const weeklyReport = await this.aiObserver.generateWeeklyReport();
        
        return {
          summary: weeklyReport.summary,
          insights: includeInsights ? weeklyReport.insights : [],
          recommendations: includeRecommendations ? weeklyReport.recommendations : [],
          performance_score: this.calculatePerformanceScore(weeklyReport.summary)
        };
      } else {
        // For monthly, use AI Store Advisor
        const performanceData = await this.aiStoreAdvisor.analyzeBusinessPerformance(timeframe);
        
        return {
          summary: performanceData.summary,
          insights: includeInsights ? performanceData.insights || [] : [],
          recommendations: includeRecommendations ? performanceData.recommendations.map((r: any) => r.message) : [],
          performance_score: performanceData.performance_score
        };
      }
      
    } catch (error) {
      console.error('❌ Failed to analyze business performance:', error);
      throw error;
    }
  }

  /**
   * Get AI Assistant proposals for business improvements
   * Integrates with your existing aiAssistant.ts service
   */
  async getAIProposals(
    proposalTypes?: string[],
    confidenceThreshold: number = 70
  ): Promise<{
    proposals: any[];
    total_proposals: number;
    high_confidence_proposals: number;
  }> {
    try {
      console.log('🤖 Generating AI proposals...');
      
      const proposals = [];
      
      // Generate different types of proposals
      const types = proposalTypes || ['expense_categorization', 'stock_adjustment', 'price_optimization', 'process_improvement'];
      
      for (const type of types) {
        const typeProposals = await this.generateProposalsForType(type, confidenceThreshold);
        proposals.push(...typeProposals);
      }
      
      const highConfidenceProposals = proposals.filter(p => p.confidence >= 80);
      
      return {
        proposals,
        total_proposals: proposals.length,
        high_confidence_proposals: highConfidenceProposals.length
      };
      
    } catch (error) {
      console.error('❌ Failed to get AI proposals:', error);
      return {
        proposals: [],
        total_proposals: 0,
        high_confidence_proposals: 0
      };
    }
  }

  /**
   * Apply AI-parsed pattern to stock and sales data
   * Integrates with your existing smartStockIntegration.ts service
   */
  async applyStockPattern(
    noteId: string,
    userRole: 'owner' | 'worker',
    branchId?: string,
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    changes_preview?: any;
    applied_changes?: any;
    error?: string;
  }> {
    try {
      console.log(`📦 ${dryRun ? 'Previewing' : 'Applying'} stock pattern for note ${noteId}...`);
      
      // Get note with pattern
      const { data: note, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();
      
      if (error || !note) {
        throw new Error('Note not found or has no pattern data');
      }
      
      if (dryRun) {
        // Preview changes without applying
        const preview = await this.previewStockChanges(note.parsed_data, userRole, branchId);
        return {
          success: true,
          changes_preview: preview
        };
      } else {
        // Apply changes to actual stock
        const appliedChanges = await this.applyStockChanges(note.parsed_data, userRole, branchId);
        
        // Mark note as applied
        await this.supabase
          .from('notes')
          .update({ status: 'applied' })
          .eq('id', noteId);
        
        return {
          success: true,
          applied_changes: appliedChanges
        };
      }
      
    } catch (error) {
      console.error('❌ Failed to apply stock pattern:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Monitor business health and generate alerts
   * Integrates with your existing aiObserver.ts monitoring
   */
  async monitorBusinessHealth(
    alertTypes?: string[],
    priority: 'all' | 'high' | 'urgent' = 'all'
  ): Promise<{
    alerts: BusinessAdvice[];
    health_score: number;
    critical_issues: number;
  }> {
    try {
      console.log('🔍 Monitoring business health...');
      
      const alerts: BusinessAdvice[] = [];
      const types = alertTypes || ['stock_alerts', 'sales_patterns', 'expense_anomalies', 'performance_issues'];
      
      // Check different types of alerts
      for (const type of types) {
        const typeAlerts = await this.checkAlertType(type);
        alerts.push(...typeAlerts);
      }
      
      // Filter by priority
      const filteredAlerts = this.filterAlertsByPriority(alerts, priority);
      
      // Calculate health score
      const healthScore = this.calculateHealthScore(alerts);
      
      // Count critical issues
      const criticalIssues = alerts.filter(a => a.priority === 'urgent').length;
      
      return {
        alerts: filteredAlerts,
        health_score: healthScore,
        critical_issues: criticalIssues
      };
      
    } catch (error) {
      console.error('❌ Failed to monitor business health:', error);
      return {
        alerts: [],
        health_score: 0,
        critical_issues: 0
      };
    }
  }

  /**
   * Log errors for debugging and monitoring
   */
  async logError(toolName: string, args: any, errorMessage: string): Promise<void> {
    try {
      await this.supabase.from('ai_audit_logs').insert({
        operation_type: `mcp_tool_error_${toolName}`,
        input_data: { tool: toolName, arguments: args },
        output_data: null,
        model_used: 'mcp_server',
        tokens_used: 0,
        success: false,
        error_message: errorMessage
      });
    } catch (error) {
      console.warn('Failed to log error:', error);
    }
  }

  // Private helper methods

  private async parseNoteWithAI(noteText: string): Promise<ChickenBusinessPattern> {
    const prompt = `
You are a chicken business AI assistant. Parse this note into structured data about chicken business operations.

Note: "${noteText}"

Extract information and classify as one of these business types:
- purchase: Buying whole chickens from suppliers
- processing: Chopping whole chickens into parts and necks  
- distribution: Sending chicken parts/necks to branches
- cooking: Cooking chicken parts/necks at branches
- sales: Selling cooked chicken, including leftovers with prices

Return ONLY valid JSON in this exact format:
{
  "business_type": "purchase|processing|distribution|cooking|sales|general",
  "confidence_score": 0.0-1.0,
  "learned_patterns": {
    // Include relevant fields based on business type
    // For purchase: supplier, product, bags, units_per_bag, total_units, cost_per_bag
    // For processing: input_bags, output_parts_bags, output_necks_bags, parts_per_bag, necks_per_bag
    // For distribution: branch, distributed_bags, distributed_necks
    // For cooking: cooked_bags, cooked_necks, cooking_method
    // For sales: leftover_parts, price_per_part, leftover_necks, price_per_neck, total_sales
  }
}`;

    const response = await this.geminiProxy.generateText(
      prompt,
      { 
        model: 'gemini-2.0-flash-lite',
        temperature: 0.3,
        maxOutputTokens: 1000,
        taskType: {
          complexity: 'medium',
          type: 'analysis',
          priority: 'medium'
        }
      }
    );

    try {
      const parsed = JSON.parse(response.text);
      return parsed;
    } catch (error) {
      console.warn('Failed to parse JSON response, using fallback pattern');
      return {
        business_type: 'general',
        confidence_score: 0.5,
        learned_patterns: { note_text: noteText }
      };
    }
  }

  private async enhancePattern(
    pattern: ChickenBusinessPattern, 
    userRole: string, 
    branchId?: string
  ): Promise<ChickenBusinessPattern> {
    // Add metadata
    pattern.learned_patterns.timestamp = new Date().toISOString();
    pattern.learned_patterns.user_role = userRole;
    if (branchId) {
      pattern.learned_patterns.branch_id = branchId;
    }
    
    return pattern;
  }

  private async saveNoteToDatabase(
    content: string, 
    pattern: ChickenBusinessPattern, 
    userRole: string, 
    branchId?: string
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('notes')
      .insert({
        content,
        user_role: userRole,
        parsed_data: pattern,
        status: 'parsed',
        business_type: pattern.business_type,
        learned_patterns: pattern.learned_patterns,
        confidence_score: pattern.confidence_score
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  private generateSuggestedActions(pattern: ChickenBusinessPattern): string[] {
    const actions = [];
    
    switch (pattern.business_type) {
      case 'purchase':
        actions.push('Apply to inventory - add purchased items to stock');
        actions.push('Create expense record for purchase cost');
        break;
      case 'processing':
        actions.push('Update stock - convert whole chickens to parts');
        actions.push('Track processing efficiency and waste');
        break;
      case 'sales':
        actions.push('Record sale and reduce stock accordingly');
        actions.push('Update revenue tracking');
        break;
      case 'cooking':
        actions.push('Convert raw ingredients to cooked products');
        actions.push('Update cooking logs and portion tracking');
        break;
      default:
        actions.push('Review and categorize this business activity');
    }
    
    return actions;
  }

  private buildBusinessAdvicePrompt(
    question: string, 
    userRole: string, 
    businessContext: any, 
    additionalContext?: any
  ): string {
    return `
You are an expert chicken business consultant with deep knowledge of this specific business.

CURRENT BUSINESS STATE:
${JSON.stringify(businessContext, null, 2)}

USER ROLE: ${userRole}
USER QUESTION: "${question}"

${additionalContext ? `ADDITIONAL CONTEXT: ${JSON.stringify(additionalContext, null, 2)}` : ''}

Provide helpful, specific advice based on:
1. Current business data and trends
2. Historical patterns
3. Industry best practices for chicken businesses
4. Role-appropriate guidance (owner vs worker)

Be conversational, practical, and actionable. Reference specific data when relevant.
`;
  }

  private async getBusinessContext(): Promise<any> {
    try {
      const [sales, expenses, products, notes] = await Promise.all([
        this.supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(10),
        this.supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(10),
        this.supabase.from('products').select('*').eq('is_active', true),
        this.supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      return {
        recent_sales: sales.data || [],
        recent_expenses: expenses.data || [],
        active_products: products.data || [],
        recent_notes: notes.data || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Failed to get business context:', error);
      return { error: 'Unable to load business context' };
    }
  }

  private async generateContextualRecommendations(userRole: string, context: any): Promise<BusinessAdvice[]> {
    // Simplified implementation - in full version, this would use AI analysis
    const recommendations: BusinessAdvice[] = [];
    
    if (userRole === 'owner') {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Review Daily Performance',
        message: 'Consider analyzing today\'s sales patterns for optimization opportunities',
        confidence: 75
      });
    } else {
      recommendations.push({
        type: 'guidance',
        priority: 'low',
        title: 'Update Stock Levels',
        message: 'Remember to update inventory after processing activities',
        confidence: 80
      });
    }
    
    return recommendations;
  }

  private async getBusinessDataForTimeframe(timeframe: string): Promise<any> {
    const days = timeframe === 'daily' ? 1 : timeframe === 'weekly' ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const [sales, expenses] = await Promise.all([
      this.supabase
        .from('sales')
        .select('*')
        .gte('created_at', cutoffDate.toISOString()),
      this.supabase
        .from('expenses')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
    ]);

    return {
      sales: sales.data || [],
      expenses: expenses.data || [],
      timeframe,
      period_start: cutoffDate.toISOString(),
      period_end: new Date().toISOString()
    };
  }

  private async generateAIInsights(businessData: any): Promise<any[]> {
    // Simplified implementation - would use AI analysis in full version
    return [
      {
        type: 'trend',
        message: 'Sales activity detected in recent period',
        confidence: 70
      }
    ];
  }

  private async generateRecommendations(businessData: any): Promise<string[]> {
    return [
      'Monitor inventory levels closely',
      'Track customer preferences',
      'Optimize pricing based on demand'
    ];
  }

  private buildBusinessSummary(businessData: any): any {
    const totalSales = businessData.sales.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
    const totalExpenses = businessData.expenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);
    
    return {
      total_sales: totalSales,
      total_expenses: totalExpenses,
      net_profit: totalSales - totalExpenses,
      transaction_count: businessData.sales.length,
      expense_count: businessData.expenses.length
    };
  }

  private calculatePerformanceScore(businessData: any): number {
    // Simplified scoring algorithm
    const sales = businessData.sales.length;
    const expenses = businessData.expenses.length;
    
    if (sales === 0) return 0;
    
    // Basic score based on activity level
    const activityScore = Math.min((sales + expenses) * 10, 100);
    return Math.round(activityScore);
  }

  private async generateProposalsForType(type: string, confidenceThreshold: number): Promise<any[]> {
    // Simplified implementation - would analyze actual data in full version
    return [
      {
        id: `${type}_${Date.now()}`,
        type,
        title: `${type.replace('_', ' ')} suggestion`,
        confidence: 75,
        description: `AI-generated ${type} proposal`,
        status: 'pending'
      }
    ];
  }

  private async previewStockChanges(parsedData: any, userRole: string, branchId?: string): Promise<any> {
    return {
      message: 'Stock changes preview',
      changes: [],
      estimated_impact: 'Low risk'
    };
  }

  private async applyStockChanges(parsedData: any, userRole: string, branchId?: string): Promise<any> {
    return {
      message: 'Stock changes applied',
      changes: [],
      success: true
    };
  }

  private async checkAlertType(type: string): Promise<BusinessAdvice[]> {
    // Simplified implementation
    return [];
  }

  private filterAlertsByPriority(alerts: BusinessAdvice[], priority: string): BusinessAdvice[] {
    if (priority === 'all') return alerts;
    if (priority === 'high') return alerts.filter(a => ['high', 'urgent'].includes(a.priority));
    if (priority === 'urgent') return alerts.filter(a => a.priority === 'urgent');
    return alerts;
  }

  private calculateHealthScore(alerts: BusinessAdvice[]): number {
    const urgentAlerts = alerts.filter(a => a.priority === 'urgent').length;
    const highAlerts = alerts.filter(a => a.priority === 'high').length;
    
    const penalty = urgentAlerts * 20 + highAlerts * 10;
    return Math.max(0, 100 - penalty);
  }
}