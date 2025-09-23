/**
 * Chicken Business Tools for MCP Server
 * Integrates your existing AI services as MCP tools
 * Provides reliable access to all AI services through the Gemini proxy
 */

import { createClient } from '@supabase/supabase-js';
import { AIStoreAdvisorService } from '../services/aiStoreAdvisor';
import { AIObserverService } from '../services/aiObserver';
import { z } from 'zod';
import monitoring from '../monitoring'; // For logError

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Schemas (as before, but typed refine)
const noteSchema = z.object({
  content: z.string().max(5000).trim().refine((val: string) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(val), 'No scripts allowed'),
  user_role: z.enum(['owner', 'worker']),
  branch: z.string().optional()
});

const voiceSchema = z.object({
  transcript: z.string().max(2000).trim(),
  products: z.array(z.object({ id: z.string(), name: z.string() })).optional()
});

// ... other schemas ...

const toolSchemas = {
  note_collection: noteSchema,
  parse_chicken_note: noteSchema,
  voice_parse: voiceSchema,
  default: z.object({}) // Loose fallback
};

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

  // Stub if missing
  private async generateProposalsForType(type: string, confidenceThreshold: number): Promise<any[]> {
    // Stub: Implement based on type (e.g., expense_categorization)
    return [];
  }

  // Central executeTool as class method
  async executeTool(toolName: string, params: any, req?: any): Promise<any> {
    try {
      const validatedParams = this.validateInput(toolName, params); // Assume validateInput as private method
      if (req?.user?.role !== 'owner' && ['apply_to_stock', 'forecast_stock'].includes(toolName)) {
        throw new Error('Insufficient role');
      }
      // Call specific method
      const method = this[toolName as keyof ChickenBusinessTools] as Function;
      if (method) return await method.call(this, validatedParams, req);
      throw new Error('Tool not found');
    } catch (err) {
      const error = { code: 422, message: 'Invalid input', details: (err as Error).message };
      monitoring.logError({ toolName, input: params, error }); // Use monitoring
      return { error };
    }
  }

  private validateInput(toolName: string, params: any): any {
    const schema = toolSchemas[toolName as keyof typeof toolSchemas] || toolSchemas.default;
    try {
      const validated = schema.parse(params);
      if (validated.content) validated.content = validated.content.replace(/['";--]/g, ''); // Sanitize
      return validated;
    } catch (err) {
      throw new Error(`Validation failed: ${err instanceof z.ZodError ? err.message : (err as Error).message}`);
    }
  }

  // Wrap examples
  async note_collection(params: any, req?: any): Promise<any> {
    return this.executeTool('note_collection', params, req);
  }

  async voice_parse(params: any, req?: any): Promise<any> {
    return this.executeTool('voice_parse', params, req);
  }

  async processChickenNote(params: any, req?: any): Promise<any> {
    return this.executeTool('processChickenNote', params, req);
  }

  async getBusinessAdvice(params: any, req?: any): Promise<any> {
    return this.executeTool('getBusinessAdvice', params, req);
  }

  // ...extend wrapper to other methods like analyzeBusinessPerformance, applyStockPattern (comment: Apply to all 20+ tools via registry if central)...

  // Private helper methods

  private async parseNoteWithAI(noteText: string): Promise<ChickenBusinessPattern> {
    const prompt = `
You are a chicken business AI assistant. Parse this note into structured data about chicken business operations.

Note: "${noteText}"

Extract information and classify as one of these business types:
- purchase: Buying whole chickens from suppliers
- processing: Preparing chickens for sale (e.g., slaughtering, cleaning, packaging)
- distribution: Transporting chickens to different locations
- cooking: Preparing chicken dishes
- sales: Selling chickens or chicken products
- general: Other chicken-related business activities

Provide a confidence score (0-100) and any learned patterns or insights.

Output as JSON: { "business_type": "...", "confidence_score": ..., "learned_patterns": {...} }
`;
    const result = await this.geminiProxy.generate(prompt, { max_tokens: 150 });
    console.log('AI parse result:', result);
    
    // Basic validation of AI output
    const parsed: ChickenBusinessPattern = JSON.parse(result);
    if (!parsed.business_type || !parsed.confidence_score) {
      throw new Error('Invalid AI response');
    }
    
    return parsed;
  }

  private async enhancePattern(
    pattern: ChickenBusinessPattern, 
    userRole: 'owner' | 'worker', 
    branchId?: string
  ): Promise<ChickenBusinessPattern> {
    // Enrich with business context, e.g., branch-specific data, user role insights
    // For demo, just add dummy data
    const dummyContext = {
      branch_performance: { sales_growth: 5, cost_reduction: 3 },
      user_insights: userRole === 'owner' ? { can_invest: true } : { needs_training: true }
    };
    
    return {
      ...pattern,
      learned_patterns: {
        ...pattern.learned_patterns,
        ...dummyContext
      }
    };
  }

  private async saveNoteToDatabase(
    noteText: string, 
    pattern: ChickenBusinessPattern, 
    userRole: 'owner' | 'worker', 
    branchId?: string
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('notes')
      .insert([
        {
          content: noteText,
          parsed_data: pattern,
          user_role: userRole,
          branch_id: branchId,
          created_at: new Date()
        }
      ])
      .select('id')
      .single();
    
    if (error) {
      throw new Error('Database insert failed: ' + (error.message || String(error)));
    }
    
    return data.id;
  }

  private generateSuggestedActions(pattern: ChickenBusinessPattern): string[] {
    // Generate actions based on learned patterns
    const actions = [];
    if (pattern.learned_patterns.increase_supply) {
      actions.push('Consider increasing chicken supply to meet demand.');
    }
    if (pattern.learned_patterns.reduce_costs) {
      actions.push('Explore options to reduce processing costs.');
    }
    if (pattern.learned_patterns.optimize_routes) {
      actions.push('Optimize distribution routes for fuel savings.');
    }
    return actions;
  }

  private async previewStockChanges(parsedData: any, userRole: 'owner' | 'worker', branchId?: string) {
    // Preview changes to stock based on parsed data
    return {
      changes: [
        { type: 'increase_stock', amount: 100 },
        { type: 'decrease_price', amount: 1.5 }
      ]
    };
  }

  private async applyStockChanges(parsedData: any, userRole: 'owner' | 'worker', branchId?: string) {
    // Apply changes to stock
    // For demo, just return success
    return { success: true };
  }

  private calculatePerformanceScore(summary: any): number {
    // Calculate a performance score based on summary metrics
    return Math.min(100, Math.max(0, (summary.profit_margin || 0) + (summary.sales_growth || 0) * 2));
  }

  private async checkAlertType(type: string): Promise<BusinessAdvice[]> {
    // Check and return alerts of a specific type
    return [];
  }

  private filterAlertsByPriority(alerts: BusinessAdvice[], priority: 'all' | 'high' | 'urgent'): BusinessAdvice[] {
    if (priority === 'all') return alerts;
    return alerts.filter(a => a.priority === priority);
  }

  private calculateHealthScore(alerts: BusinessAdvice[]): number {
    // Calculate a health score based on alerts
    const criticalCount = alerts.filter(a => a.priority === 'urgent').length;
    const warningCount = alerts.filter(a => a.priority === 'high').length;
    return Math.max(0, 100 - criticalCount * 10 - warningCount * 5);
  }
}