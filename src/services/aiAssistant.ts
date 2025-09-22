/**
 * AI Assistant Service
 * Smart AI that proposes actions with human approval workflow
 * This is the "write-approved" AI that suggests changes but doesn't execute them
 */

import { supabase } from '../src/supabaseConfig';
import { geminiAPIManager } from './geminiAPIManager';
import { offlineDB } from './offlineService';

interface AIProposal {
  id: string;
  type: 'expense_categorization' | 'stock_adjustment' | 'price_optimization' | 'reorder_suggestion' | 'process_improvement';
  title: string;
  description: string;
  proposed_action: any;
  confidence: number;
  reasoning: string;
  data_source: any;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  created_by: 'ai_assistant';
  expires_at: string;
}

interface ApprovalRequest {
  proposal_id: string;
  human_decision: 'approve' | 'reject';
  human_notes?: string;
  approved_by: string;
  approved_at: string;
}

class AIAssistantService {
  /**
   * Main AI Assistant - analyzes data and proposes helpful actions
   * This is the cool part - AI that actually helps your business!
   */
  async analyzeAndPropose(): Promise<AIProposal[]> {
    console.log('🤖 AI Assistant analyzing business data for improvement opportunities...');
    
    const proposals: AIProposal[] = [];
    
    try {
      // Check for uncategorized expenses
      const expenseProposals = await this.proposeExpenseCategorization();
      proposals.push(...expenseProposals);
      
      // Check for stock issues
      const stockProposals = await this.proposeStockAdjustments();
      proposals.push(...stockProposals);
      
      // Check for pricing opportunities
      const priceProposals = await this.proposePriceOptimizations();
      proposals.push(...priceProposals);
      
      // Check for process improvements
      const processProposals = await this.proposeProcessImprovements();
      proposals.push(...processProposals);
      
      // Store all proposals for human review
      await this.storeProposals(proposals);
      
      console.log(`✅ AI Assistant generated ${proposals.length} improvement proposals`);
      return proposals;
      
    } catch (error) {
      console.error('❌ AI Assistant analysis failed:', error);
      return [];
    }
  }
  
  /**
   * Propose expense categorization for uncategorized items
   */
  async proposeExpenseCategorization(): Promise<AIProposal[]> {
    const proposals: AIProposal[] = [];
    
    try {
      // Get uncategorized expenses
      const { data: uncategorizedExpenses } = await supabase
        .from('expenses')
        .select('*')
        .or('category.is.null,category.eq.""')
        .limit(10);
      
      if (!uncategorizedExpenses || uncategorizedExpenses.length === 0) {
        return proposals;
      }
      
      for (const expense of uncategorizedExpenses) {
        const categorization = await this.suggestExpenseCategory(expense);
        
        if (categorization && categorization.confidence > 70) {
          proposals.push({
            id: `exp_cat_${expense.id}_${Date.now()}`,
            type: 'expense_categorization',
            title: `Categorize "${expense.description}"`,
            description: `AI suggests categorizing this ₱${expense.amount} expense as "${categorization.category}"`,
            proposed_action: {
              expense_id: expense.id,
              new_category: categorization.category,
              confidence: categorization.confidence
            },
            confidence: categorization.confidence,
            reasoning: categorization.reasoning,
            data_source: expense,
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: 'ai_assistant',
            expires_at: this.getExpiryDate(7) // Expires in 7 days
          });
        }
      }
      
      return proposals;
      
    } catch (error) {
      console.warn('Expense categorization proposals failed:', error);
      return [];
    }
  }
  
  /**
   * Suggest stock adjustments based on sales patterns
   */
  async proposeStockAdjustments(): Promise<AIProposal[]> {
    const proposals: AIProposal[] = [];
    
    try {
      // Get current stock levels
      const { data: products } = await supabase
        .from('products')
        .select('*');
      
      if (!products) return proposals;
      
      // Get recent sales data for analysis
      const { data: recentSales } = await supabase
        .from('sales')
        .select('*')
        .gte('date', this.getDaysAgo(30))
        .order('date', { ascending: false });
      
      const stockAnalysis = await this.analyzeStockNeeds(products, recentSales || []);
      
      for (const suggestion of stockAnalysis.suggestions) {
        if (suggestion.confidence > 75) {
          proposals.push({
            id: `stock_adj_${suggestion.product_id}_${Date.now()}`,
            type: 'stock_adjustment',
            title: `${suggestion.action} for ${suggestion.product_name}`,
            description: suggestion.description,
            proposed_action: {
              product_id: suggestion.product_id,
              action_type: suggestion.action,
              recommended_quantity: suggestion.recommended_quantity,
              current_quantity: suggestion.current_quantity,
              reasoning: suggestion.reasoning
            },
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            data_source: { product: suggestion.product_data, sales: recentSales },
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: 'ai_assistant',
            expires_at: this.getExpiryDate(5)
          });
        }
      }
      
      return proposals;
      
    } catch (error) {
      console.warn('Stock adjustment proposals failed:', error);
      return [];
    }
  }
  
  /**
   * Propose price optimizations based on sales performance
   */
  async proposePriceOptimizations(): Promise<AIProposal[]> {
    const proposals: AIProposal[] = [];
    
    try {
      // Get products with sales data
      const { data: productsWithSales } = await supabase
        .from('sales')
        .select('product_name, price, quantity, total, date')
        .gte('date', this.getDaysAgo(30));
      
      if (!productsWithSales || productsWithSales.length === 0) {
        return proposals;
      }
      
      const priceAnalysis = await this.analyzePricingOpportunities(productsWithSales);
      
      for (const opportunity of priceAnalysis.opportunities) {
        if (opportunity.confidence > 70) {
          proposals.push({
            id: `price_opt_${opportunity.product_name}_${Date.now()}`,
            type: 'price_optimization',
            title: `Price optimization for ${opportunity.product_name}`,
            description: opportunity.description,
            proposed_action: {
              product_name: opportunity.product_name,
              current_price: opportunity.current_price,
              suggested_price: opportunity.suggested_price,
              expected_impact: opportunity.expected_impact
            },
            confidence: opportunity.confidence,
            reasoning: opportunity.reasoning,
            data_source: productsWithSales,
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: 'ai_assistant',
            expires_at: this.getExpiryDate(14)
          });
        }
      }
      
      return proposals;
      
    } catch (error) {
      console.warn('Price optimization proposals failed:', error);
      return [];
    }
  }
  
  /**
   * Propose process improvements based on patterns
   */
  async proposeProcessImprovements(): Promise<AIProposal[]> {
    const proposals: AIProposal[] = [];
    
    try {
      // Analyze recent business operations
      const businessPatterns = await this.analyzeBusinessPatterns();
      
      const improvementSuggestions = await this.generateProcessImprovements(businessPatterns);
      
      for (const suggestion of improvementSuggestions) {
        if (suggestion.confidence > 60) {
          proposals.push({
            id: `process_imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'process_improvement',
            title: suggestion.title,
            description: suggestion.description,
            proposed_action: {
              improvement_type: suggestion.type,
              implementation_steps: suggestion.steps,
              expected_benefit: suggestion.benefit
            },
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            data_source: businessPatterns,
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: 'ai_assistant',
            expires_at: this.getExpiryDate(30)
          });
        }
      }
      
      return proposals;
      
    } catch (error) {
      console.warn('Process improvement proposals failed:', error);
      return [];
    }
  }
  
  /**
   * Human approval workflow - approve or reject AI proposals
   */
  async processHumanDecision(approval: ApprovalRequest): Promise<{ success: boolean; message: string }> {
    try {
      // Get the proposal
      const { data: proposal } = await supabase
        .from('ai_proposals')
        .select('*')
        .eq('id', approval.proposal_id)
        .single();
      
      if (!proposal) {
        return { success: false, message: 'Proposal not found' };
      }
      
      if (proposal.status !== 'pending') {
        return { success: false, message: 'Proposal already processed' };
      }
      
      // Update proposal status
      const { error: updateError } = await supabase
        .from('ai_proposals')
        .update({
          status: approval.human_decision === 'approve' ? 'approved' : 'rejected',
          human_notes: approval.human_notes,
          approved_by: approval.approved_by,
          approved_at: approval.approved_at
        })
        .eq('id', approval.proposal_id);
      
      if (updateError) {
        return { success: false, message: 'Failed to update proposal' };
      }
      
      // If approved, execute the action
      if (approval.human_decision === 'approve') {
        const executionResult = await this.executeApprovedAction(proposal);
        return {
          success: executionResult.success,
          message: `Proposal approved and ${executionResult.success ? 'executed successfully' : 'execution failed'}`
        };
      }
      
      return { success: true, message: 'Proposal rejected by human' };
      
    } catch (error) {
      console.error('Human decision processing failed:', error);
      return { success: false, message: 'Failed to process decision' };
    }
  }
  
  /**
   * Execute approved AI actions safely
   */
  async executeApprovedAction(proposal: AIProposal): Promise<{ success: boolean; message: string }> {
    try {
      switch (proposal.type) {
        case 'expense_categorization':
          return await this.executeExpenseCategorization(proposal.proposed_action);
          
        case 'stock_adjustment':
          return await this.executeStockAdjustment(proposal.proposed_action);
          
        case 'price_optimization':
          return await this.executePriceOptimization(proposal.proposed_action);
          
        default:
          return { success: false, message: 'Unknown action type' };
      }
    } catch (error) {
      console.error('Action execution failed:', error);
      return { success: false, message: 'Execution failed' };
    }
  }
  
  // AI Analysis Methods (the smart parts!)
  
  private async suggestExpenseCategory(expense: any) {
    try {
      const prompt = `
Categorize this chicken business expense:

Description: "${expense.description}"
Amount: ₱${expense.amount}
Date: ${expense.date}

Common categories: Feed, Supplies, Utilities, Transportation, Equipment, Marketing, Labor, Other

Return JSON:
{
  "category": "suggested_category",
  "confidence": 0-100,
  "reasoning": "why this category fits"
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'simple', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      return JSON.parse(response.text);
      
    } catch (error) {
      console.warn('Category suggestion failed:', error);
      return null;
    }
  }
  
  private async analyzeStockNeeds(products: any[], sales: any[]) {
    try {
      const prompt = `
Analyze stock needs for chicken business:

Current Products: ${JSON.stringify(products.slice(0, 5))}
Recent Sales: ${JSON.stringify(sales.slice(0, 10))}

For each product, determine if we need to:
1. Reorder (running low)
2. Reduce stock (slow moving)
3. Maintain current levels

Return JSON:
{
  "suggestions": [
    {
      "product_id": "id",
      "product_name": "name",
      "action": "reorder|reduce|maintain", 
      "current_quantity": number,
      "recommended_quantity": number,
      "confidence": 0-100,
      "reasoning": "explanation"
    }
  ]
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      return JSON.parse(response.text);
      
    } catch (error) {
      console.warn('Stock analysis failed:', error);
      return { suggestions: [] };
    }
  }
  
  private async analyzePricingOpportunities(salesData: any[]) {
    try {
      const prompt = `
Analyze pricing opportunities for chicken business:

Sales Data: ${JSON.stringify(salesData.slice(0, 15))}

Look for:
1. Products selling very fast (can increase price)
2. Products selling slowly (may need price reduction)
3. Optimal pricing based on demand patterns

Return JSON:
{
  "opportunities": [
    {
      "product_name": "name",
      "current_price": number,
      "suggested_price": number,
      "confidence": 0-100,
      "reasoning": "explanation",
      "expected_impact": "increase/decrease revenue"
    }
  ]
}
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      return JSON.parse(response.text);
      
    } catch (error) {
      console.warn('Pricing analysis failed:', error);
      return { opportunities: [] };
    }
  }
  
  private async analyzeBusinessPatterns() {
    // Get recent business data for pattern analysis
    const { data: recentNotes } = await supabase
      .from('notes')
      .select('*')
      .gte('created_at', this.getDaysAgo(30))
      .order('created_at', { ascending: false })
      .limit(50);
    
    return {
      notes: recentNotes || [],
      note_count: recentNotes?.length || 0,
      analysis_date: new Date().toISOString()
    };
  }
  
  private async generateProcessImprovements(patterns: any) {
    try {
      const prompt = `
Based on chicken business patterns, suggest process improvements:

Recent Activity: ${patterns.note_count} business notes
Pattern Data: ${JSON.stringify(patterns).substring(0, 1000)}

Suggest 1-3 process improvements that could:
1. Save time
2. Reduce costs  
3. Improve quality
4. Increase revenue

Return JSON array:
[
  {
    "title": "improvement title",
    "description": "what to improve",
    "type": "efficiency|cost|quality|revenue",
    "confidence": 0-100,
    "reasoning": "why this helps",
    "steps": ["step1", "step2"],
    "benefit": "expected benefit"
  }
]
`;

      const response = await geminiAPIManager.makeRequest(
        { type: 'text', complexity: 'medium', priority: 'normal', requiresStructuredOutput: true },
        prompt
      );
      
      return JSON.parse(response.text);
      
    } catch (error) {
      console.warn('Process improvement generation failed:', error);
      return [];
    }
  }
  
  // Execution methods
  
  private async executeExpenseCategorization(action: any) {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ category: action.new_category })
        .eq('id', action.expense_id);
      
      return { 
        success: !error, 
        message: error ? error.message : 'Expense categorized successfully' 
      };
    } catch (error) {
      return { success: false, message: 'Categorization failed' };
    }
  }
  
  private async executeStockAdjustment(action: any) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          quantity: action.recommended_quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', action.product_id);
      
      return { 
        success: !error, 
        message: error ? error.message : 'Stock adjusted successfully' 
      };
    } catch (error) {
      return { success: false, message: 'Stock adjustment failed' };
    }
  }
  
  private async executePriceOptimization(action: any) {
    try {
      // In a real system, you'd update product prices
      // For now, just log the suggestion
      console.log('Price optimization executed:', action);
      return { success: true, message: 'Price optimization noted' };
    } catch (error) {
      return { success: false, message: 'Price optimization failed' };
    }
  }
  
  // Helper methods
  
  private async storeProposals(proposals: AIProposal[]) {
    if (proposals.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('ai_proposals')
        .insert(proposals);
      
      if (error) {
        console.warn('Failed to store AI proposals:', error);
      }
    } catch (error) {
      console.warn('Proposal storage failed:', error);
    }
  }
  
  private getExpiryDate(days: number): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry.toISOString();
  }
  
  private getDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
}

// Export singleton instance
export const aiAssistant = new AIAssistantService();

// Export types
export type { AIProposal, ApprovalRequest };