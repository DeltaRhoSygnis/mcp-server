/**
 * ChickenBusinessAI Service
 * AI-powered parsing and learning system for chicken business operations
 * Handles: Purchase → Processing → Distribution → Cooking → Sales workflow
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

// Constants
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export interface ChickenBusinessPattern {
  business_type: 'purchase' | 'processing' | 'distribution' | 'cooking' | 'sales' | 'general';
  confidence_score: number;
  learned_patterns: {
    // Purchase patterns
    supplier?: string;
    product?: string;
    bags?: number;
    units_per_bag?: number;
    total_units?: number;
    cost_per_bag?: number;
    
    // Processing patterns
    input_bags?: number;
    output_parts_bags?: number;
    output_necks_bags?: number;
    parts_per_bag?: number;
    necks_per_bag?: number;
    yield_ratio?: number;
    
    // Distribution patterns
    branch?: string;
    distributed_bags?: number;
    distributed_necks?: number;
    
    // Cooking patterns
    cooked_bags?: number;
    cooked_necks?: number;
    cooking_method?: string;
    
    // Sales patterns
    leftover_parts?: number;
    price_per_part?: number;
    leftover_necks?: number;
    price_per_neck?: number;
    total_sales?: number;
    
    // General metadata
    timestamp?: string;
    worker_mentioned?: string;
    branch_mentioned?: string;
  };
}

interface AIProcessingResult {
  success: boolean;
  pattern?: ChickenBusinessPattern;
  note_id?: string;
  should_update_stock?: boolean;
  suggested_actions?: string[];
  error?: string;
}

/**
 * Enhanced ChickenBusinessAI class with advanced Gemini integration
 */
export class ChickenBusinessAI {

  /**
   * Ensure memory service is connected
   */
  private async ensureMemoryConnection(): Promise<void> {
    try {
      console.log('🔌 Connecting to memory service...');
      await chickenMemoryService.initialize();
    } catch (error) {
      console.warn('⚠️ Memory service connection failed:', error);
    }
  }

  /**
   * Enhanced parsing with memory context using advanced Gemini models
   */
  private async parseWithGeminiAndMemory(noteText: string, memoryContext: string, userRole: 'owner' | 'worker' = 'worker'): Promise<ChickenBusinessPattern> {
    try {
      console.log('🤖 Parsing with memory-enhanced Gemini 2.5 model...');
      
      // Enhanced prompt with memory context
      const enhancedPrompt = `
You are a chicken business AI assistant with access to business memory and context.

MEMORY CONTEXT:
${memoryContext}

Current Note: "${noteText}"

Use the memory context to make more intelligent parsing decisions. For example:
- If "magnolia" is mentioned and memory shows typical pricing/schedule, include that context
- If a worker is mentioned and memory shows their specialties, factor that in
- If patterns suggest typical quantities/ratios, use those for validation

Parse this note into structured data about chicken business operations.

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
    // For purchase: supplier, product, bags, units_per_bag, total_units, cost_per_bag
    // For processing: input_bags, output_parts_bags, output_necks_bags, parts_per_bag, necks_per_bag, yield_ratio
    // For distribution: branch, distributed_bags, distributed_necks
    // For cooking: cooked_bags, cooked_necks, cooking_method
    // For sales: leftover_parts, price_per_part, leftover_necks, price_per_neck, total_sales
    // Always include: worker_mentioned, branch_mentioned if found
  }
}`;

      // Use the unified AI service with MCP routing
      const response = await unifiedAI.parseChickenNote(enhancedPrompt, userRole);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to parse note');
      }
      
      const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      
      console.log('✅ Memory-enhanced parsing successful:', {
        source: response.source,
        success: response.success,
        confidence: parsed.confidence_score,
        type: parsed.business_type,
        memoryUsed: memoryContext.length > 0
      });
      
      return parsed;
    } catch (error) {
      console.warn('🔄 Memory-enhanced parsing failed, trying fallback...');
      return this.parseWithGemini(noteText, userRole);
    }
  }

  /**
   * Generate intelligent suggestions using memory insights
   */
  private async generateIntelligentSuggestedActions(pattern: ChickenBusinessPattern): Promise<string[]> {
    const suggestions = this.generateSuggestedActions(pattern);
    
    try {
      // Add memory-based intelligent suggestions
      const memoryInsights = await this.getMemoryInsights(pattern);
      suggestions.push(...memoryInsights);
      
    } catch (error) {
      console.warn('⚠️ Failed to get memory insights for suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Get insights from memory for intelligent suggestions
   */
  private async getMemoryInsights(pattern: ChickenBusinessPattern): Promise<string[]> {
    const insights: string[] = [];
    
    // Get supplier insights
    if (pattern.learned_patterns.supplier) {
      // TODO: Fix memory service integration
      // const supplierContext = await chickenMemoryService.searchBusinessContext(
      //   `${pattern.learned_patterns.supplier}_Supplier`
      // );
      const supplierContext: any[] = []; // Temporary fallback
      
      if (supplierContext.length > 0) {
        insights.push(`💡 ${pattern.learned_patterns.supplier} supplier context available for optimization`);
      }
    }
    
    // Get worker insights
    if (pattern.learned_patterns.worker_mentioned) {
      // TODO: Fix memory service integration
      // const workerContext = await chickenMemoryService.searchBusinessContext(
      //   `Worker_${pattern.learned_patterns.worker_mentioned}`
      // );
      const workerContext: any[] = []; // Temporary fallback
      
      if (workerContext.length > 0) {
        insights.push(`👨‍💼 Worker ${pattern.learned_patterns.worker_mentioned} has recorded performance data`);
      }
    }
    
    // Business pattern insights
    // TODO: Fix memory service integration
    // const businessContext = await chickenMemoryService.searchBusinessContext('Business_Operations');
    const businessContext: any[] = []; // Temporary fallback
    if (businessContext.length > 0) {
      insights.push('📈 Historical patterns suggest optimization opportunities');
    }
    
    return insights;
  }

  /**
   * Main entry point: Process a chicken business note with memory-enhanced AI
   * Your vision: "Owner: Buy magnolia whole chicken 20 bags (10 chickens per bag)"
   */
  async processChickenNote(
    noteText: string, 
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<AIProcessingResult> {
    try {
      console.log('🧠 ChickenBusinessAI processing note with memory:', noteText.substring(0, 50) + '...');
      
      // Step 0: Initialize memory service if needed
      await this.ensureMemoryConnection();
      
      // TODO: Fix memory service integration
      // const memoryContext = await chickenMemoryService.getContextForNote(noteText);
      const memoryContext = '';
      console.log('🔍 Memory context (temporarily disabled):', memoryContext);
      
      // Step 2: Parse note with Gemini AI (enhanced with memory context)
      const pattern = await this.parseWithGeminiAndMemory(noteText, memoryContext, userRole);
      
      // Step 3: Validate and enhance pattern
      const enhancedPattern = await this.enhancePattern(pattern, userRole, branchId);
      
      // Step 4: Save to notes table with AI fields
      const noteId = await this.saveAINote(noteText, enhancedPattern, userRole, branchId);
      
      // Step 5: Learn from this pattern (update both historical knowledge AND memory)
      await this.learnFromPattern(enhancedPattern);
      // TODO: Fix memory service integration
      // await chickenMemoryService.learnFromPattern(enhancedPattern);
      console.log('📚 Memory pattern learning (temporarily disabled):', enhancedPattern.business_type);
      
      // Step 6: Generate intelligent suggested actions using memory
      const suggestedActions = await this.generateIntelligentSuggestedActions(enhancedPattern);
      
      return {
        success: true,
        pattern: enhancedPattern,
        note_id: noteId,
        should_update_stock: this.shouldUpdateStock(enhancedPattern),
        suggested_actions: suggestedActions
      };
      
    } catch (error) {
      console.error('❌ ChickenBusinessAI failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Apply AI pattern to actual stock/sales/expenses
   * Phase 2 integration - connects patterns to real business data
   */
  async applyPatternToStock(
    noteId: string,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<{ success: boolean; results?: StockIntegrationResult; error?: string }> {
    try {
      console.log('📊 Applying pattern to stock for note:', noteId);

      // 1. Get the note with AI pattern
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .select('business_type, learned_patterns, confidence_score')
        .eq('id', noteId)
        .single();

      if (noteError) throw noteError;

      if (!note.business_type || !note.learned_patterns) {
        throw new Error('Note has no AI pattern to apply');
      }

      // 2. Check if already applied
      const status = await smartStockIntegration.getIntegrationStatus(noteId);
      if (status.applied) {
        return {
          success: true,
          results: status.results,
          error: 'Pattern already applied to stock'
        };
      }

      // 3. Apply pattern to stock
      const pattern: ChickenBusinessPattern = {
        business_type: note.business_type,
        confidence_score: note.confidence_score,
        learned_patterns: note.learned_patterns
      };

      const results = await smartStockIntegration.applyPatternToStock(pattern, userRole, branchId);

      // 4. Mark as applied
      if (results.success) {
        await smartStockIntegration.markAsApplied(noteId, results);
      }

      return {
        success: results.success,
        results,
        error: results.errors?.[0]
      };

    } catch (error) {
      console.error('❌ Failed to apply pattern to stock:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  /**
   * Parse note using Gemini AI with chicken business context
   */
  private async parseWithGemini(noteText: string, userRole: 'owner' | 'worker' = 'worker'): Promise<ChickenBusinessPattern> {
    try {
      console.log('🤖 Parsing with unified AI service...');
      
      // Use the unified AI service for routing
      const response = await unifiedAI.parseChickenNote(noteText, userRole);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to parse note');
      }
      
      const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      
      console.log('✅ Unified AI parsing successful:', {
        source: response.source,
        confidence: parsed.confidence_score,
        type: parsed.business_type
      });
      
      return parsed;
    } catch (error) {
      console.warn('🔄 Smart parsing failed, trying fallback method...');
      return this.fallbackGeminiParsing(noteText);
    }
  }

  /**
   * Fallback to original Gemini method if smart manager fails
   */
  private async fallbackGeminiParsing(noteText: string): Promise<ChickenBusinessPattern> {
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
    // For purchase: supplier, product, bags, units_per_bag, total_units, cost_per_bag
    // For processing: input_bags, output_parts_bags, output_necks_bags, parts_per_bag, necks_per_bag, yield_ratio
    // For distribution: branch, distributed_bags, distributed_necks
    // For cooking: cooked_bags, cooked_necks, cooking_method
    // For sales: leftover_parts, price_per_part, leftover_necks, price_per_neck, total_sales
    // Always include: worker_mentioned, branch_mentioned if found
  }
}

Examples:
"Buy magnolia whole chicken 20 bags, 10 chickens per bag" → purchase type with supplier, bags, units_per_bag
"Chopped 200 chickens into 35 bags parts (40 each) and 10 neck bags (20 each)" → processing type with yield ratios
"Send Branch1: 3 bags + 1 neck bag" → distribution type with branch and quantities
"Branch1 cooked 1 bag" → cooking type with branch and quantity
"Leftovers: 20 pieces @35 pesos, 10 necks @15 pesos" → sales type with quantities and prices
`;

    try {
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            topP: 0.8,
            topK: 10
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) {
        throw new Error('No response from Gemini AI');
      }

      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsedPattern = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsedPattern.business_type || !parsedPattern.learned_patterns) {
        throw new Error('Invalid pattern structure from AI');
      }

      // Ensure confidence score is valid
      if (typeof parsedPattern.confidence_score !== 'number') {
        parsedPattern.confidence_score = 0.7; // Default confidence
      }

      return parsedPattern;
      
    } catch (error) {
      console.warn('🤖 Gemini parsing failed, using fallback:', error);
      
      // Fallback: Simple pattern matching for basic cases
      return this.fallbackPatternMatching(noteText);
    }
  }
  
  /**
   * Fallback pattern matching when Gemini AI fails
   */
  private fallbackPatternMatching(noteText: string): ChickenBusinessPattern {
    const text = noteText.toLowerCase();
    
    // Purchase patterns
    if (text.includes('buy') || text.includes('bought') || text.includes('purchase')) {
      const bagMatch = text.match(/(\d+)\s*bags?/);
      const supplierMatch = text.match(/(magnolia|san miguel|bounty|fresh)/i);
      
      return {
        business_type: 'purchase',
        confidence_score: 0.6,
        learned_patterns: {
          supplier: supplierMatch?.[1] || 'unknown',
          bags: bagMatch ? parseInt(bagMatch[1]) : 0,
          product: text.includes('chicken') ? 'whole chicken' : 'unknown'
        }
      };
    }
    
    // Processing patterns
    if (text.includes('chop') || text.includes('process') || text.includes('parts')) {
      return {
        business_type: 'processing',
        confidence_score: 0.6,
        learned_patterns: {
          // Extract basic numbers if possible
        }
      };
    }
    
    // Distribution patterns
    if (text.includes('branch') || text.includes('send') || text.includes('deliver')) {
      return {
        business_type: 'distribution',
        confidence_score: 0.6,
        learned_patterns: {
          branch: 'unknown'
        }
      };
    }
    
    // Cooking patterns
    if (text.includes('cook') || text.includes('fry') || text.includes('grill')) {
      return {
        business_type: 'cooking',
        confidence_score: 0.6,
        learned_patterns: {
          cooking_method: 'cook'
        }
      };
    }
    
    // Sales patterns
    if (text.includes('leftover') || text.includes('sell') || text.includes('peso') || text.includes('@')) {
      return {
        business_type: 'sales',
        confidence_score: 0.6,
        learned_patterns: {
          // Try to extract prices
        }
      };
    }
    
    // Default: general note
    return {
      business_type: 'general',
      confidence_score: 0.3,
      learned_patterns: {}
    };
  }
  
  /**
   * Enhance pattern with context and validation
   */
  private async enhancePattern(
    pattern: ChickenBusinessPattern, 
    userRole: 'owner' | 'worker', 
    branchId?: string
  ): Promise<ChickenBusinessPattern> {
    
    // Add user context
    if (!pattern.learned_patterns.worker_mentioned && userRole) {
      pattern.learned_patterns.worker_mentioned = userRole;
    }
    
    // Add branch context
    if (branchId && !pattern.learned_patterns.branch_mentioned) {
      pattern.learned_patterns.branch_mentioned = branchId;
    }
    
    // Add timestamp
    pattern.learned_patterns.timestamp = new Date().toISOString();
    
    // Validate and normalize data
    if (pattern.business_type === 'purchase' && pattern.learned_patterns.bags && pattern.learned_patterns.units_per_bag) {
      pattern.learned_patterns.total_units = pattern.learned_patterns.bags * pattern.learned_patterns.units_per_bag;
    }
    
    if (pattern.business_type === 'processing') {
      // Calculate yield ratio if we have input and output
      const input = pattern.learned_patterns.input_bags || 0;
      const outputParts = pattern.learned_patterns.output_parts_bags || 0;
      const outputNecks = pattern.learned_patterns.output_necks_bags || 0;
      
      if (input > 0 && (outputParts > 0 || outputNecks > 0)) {
        pattern.learned_patterns.yield_ratio = (outputParts + outputNecks) / input;
      }
    }
    
    return pattern;
  }
  
  /**
   * Save AI-enhanced note to database
   */
  private async saveAINote(
    noteText: string, 
    pattern: ChickenBusinessPattern, 
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<string> {
    const noteData = {
      content: noteText,
      business_type: pattern.business_type,
      learned_patterns: pattern.learned_patterns,
      confidence_score: pattern.confidence_score,
      branch_id: branchId,
      local_uuid: crypto.randomUUID(),
      user_role: userRole,
      created_by: null, // Will be set by auth
      status: 'parsed'
    };
    
    try {
      if (connectionService.online) {
        // Save to Supabase
        const { data, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select('id')
          .single();
        
        if (error) throw error;
        
        // Also save to IndexedDB for offline access
        await offlineDB.save('notes', { ...noteData, id: data.id, sync_status: 'synced' });
        
        return data.id;
      } else {
        // Save to IndexedDB only (will sync later)
        const id = await offlineDB.save('notes', { ...noteData, sync_status: 'pending' });
        return String(id);
      }
    } catch (error) {
      console.error('❌ Failed to save AI note:', error);
      
      // Fallback to IndexedDB
      const id = await offlineDB.save('notes', { ...noteData, sync_status: 'pending' });
      return String(id);
    }
  }
  
  /**
   * Learn from this pattern to improve future parsing
   */
  private async learnFromPattern(pattern: ChickenBusinessPattern): Promise<void> {
    try {
      // Store pattern learnings in IndexedDB for quick access
      const learningData = {
        pattern_type: pattern.business_type,
        confidence: pattern.confidence_score,
        patterns: pattern.learned_patterns,
        timestamp: new Date().toISOString(),
        local_uuid: crypto.randomUUID()
      };
      
      await offlineDB.save('ai_learnings', learningData);
      
      // TODO: In Phase 3, this will update conversion ratios, supplier patterns, etc.
      console.log('📚 Learning from pattern:', pattern.business_type);
      
    } catch (error) {
      console.warn('⚠️ Failed to store learning:', error);
    }
  }
  
  /**
   * Generate suggested actions based on parsed pattern
   */
  private generateSuggestedActions(pattern: ChickenBusinessPattern): string[] {
    const actions: string[] = [];
    
    switch (pattern.business_type) {
      case 'purchase':
        actions.push('💰 Update inventory with new chicken stock');
        actions.push('📊 Track supplier performance');
        if (pattern.learned_patterns.cost_per_bag) {
          actions.push('💲 Record purchase expense');
        }
        break;
        
      case 'processing':
        actions.push('🔄 Update parts inventory');
        actions.push('📉 Reduce whole chicken stock');
        actions.push('📈 Add processed parts to inventory');
        break;
        
      case 'distribution':
        actions.push('🚚 Update branch inventory');
        actions.push('📦 Create transfer record');
        break;
        
      case 'cooking':
        actions.push('🍳 Update cooked inventory');
        actions.push('📉 Reduce raw parts stock');
        break;
        
      case 'sales':
        actions.push('💰 Record sales transaction');
        actions.push('📊 Update leftover pricing');
        if (pattern.learned_patterns.total_sales) {
          actions.push('💲 Add sales revenue');
        }
        break;
        
      default:
        actions.push('📝 Review and categorize note');
    }
    
    return actions;
  }
  
  /**
   * Determine if this pattern should trigger stock updates
   */
  private shouldUpdateStock(pattern: ChickenBusinessPattern): boolean {
    return ['purchase', 'processing', 'distribution', 'cooking', 'sales'].includes(pattern.business_type);
  }
  
  /**
   * Get historical patterns for learning and insights
   */
  async getHistoricalPatterns(businessType?: string, branchId?: string): Promise<ChickenBusinessPattern[]> {
    try {
      let query = supabase
        .from('notes')
        .select('business_type, learned_patterns, confidence_score, created_at, branch_id')
        .not('learned_patterns', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (businessType) {
        query = query.eq('business_type', businessType);
      }
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((item: any) => ({
        business_type: item.business_type,
        confidence_score: item.confidence_score,
        learned_patterns: item.learned_patterns
      }));
      
    } catch (error) {
      console.error('❌ Failed to get historical patterns:', error);
      
      // Fallback to IndexedDB
      try {
        const localNotes = await offlineDB.getAll('notes');
        return localNotes
          .filter(note => note.learned_patterns && (!businessType || note.business_type === businessType))
          .slice(0, 50)
          .map(note => ({
            business_type: note.business_type,
            confidence_score: note.confidence_score,
            learned_patterns: note.learned_patterns
          }));
      } catch (localError) {
        console.error('❌ Failed to get local patterns:', localError);
        return [];
      }
    }
  }
  
  /**
   * Get AI insights and suggestions for the business
   */
  async getBusinessInsights(branchId?: string): Promise<{
    totalPatterns: number;
    mostCommonType: string;
    averageConfidence: number;
    suggestions: string[];
  }> {
    try {
      const patterns = await this.getHistoricalPatterns(undefined, branchId);
      
      if (patterns.length === 0) {
        return {
          totalPatterns: 0,
          mostCommonType: 'none',
          averageConfidence: 0,
          suggestions: ['Start adding notes to build AI intelligence!']
        };
      }
      
      // Calculate insights
      const typeCounts = patterns.reduce((acc, p) => {
        acc[p.business_type] = (acc[p.business_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostCommonType = Object.entries(typeCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      const averageConfidence = patterns.reduce((sum, p) => sum + p.confidence_score, 0) / patterns.length;
      
      const suggestions = this.generateBusinessSuggestions(patterns, typeCounts);
      
      return {
        totalPatterns: patterns.length,
        mostCommonType,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        suggestions
      };
      
    } catch (error) {
      console.error('❌ Failed to get business insights:', error);
      return {
        totalPatterns: 0,
        mostCommonType: 'error',
        averageConfidence: 0,
        suggestions: ['Error getting insights. Check system status.']
      };
    }
  }
  
  /**
   * Generate business suggestions based on pattern analysis
   */
  private generateBusinessSuggestions(
    patterns: ChickenBusinessPattern[], 
    typeCounts: Record<string, number>
  ): string[] {
    const suggestions: string[] = [];
    
    // Check for missing pattern types
    const expectedTypes = ['purchase', 'processing', 'distribution', 'cooking', 'sales'];
    const missingTypes = expectedTypes.filter(type => !typeCounts[type]);
    
    if (missingTypes.length > 0) {
      suggestions.push(`📝 Consider tracking: ${missingTypes.join(', ')} operations`);
    }
    
    // Check confidence levels
    const lowConfidenceCount = patterns.filter(p => p.confidence_score < 0.7).length;
    if (lowConfidenceCount > patterns.length * 0.3) {
      suggestions.push('🤖 AI confidence is low. Use more specific language in notes');
    }
    
    // Business flow suggestions
    if (typeCounts.purchase && !typeCounts.processing) {
      suggestions.push('🔄 Track chicken processing to optimize yield ratios');
    }
    
    if (typeCounts.processing && !typeCounts.distribution) {
      suggestions.push('🚚 Track distribution to branches for better inventory management');
    }
    
    if (typeCounts.cooking && !typeCounts.sales) {
      suggestions.push('💰 Track sales and leftovers to optimize pricing');
    }
    
    return suggestions;
  }
}

// Export singleton instance
export const chickenBusinessAI = new ChickenBusinessAI();