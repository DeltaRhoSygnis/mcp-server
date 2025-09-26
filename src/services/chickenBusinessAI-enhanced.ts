/**
 * Enhanced ChickenBusinessAI Service
 * Advanced AI-powered parsing with Gemini 2.5 series models and memory integration
 * Patterns inspired by advanced MCP server implementations
 */

import { supabase } from '../config/supabaseConfig';
import { chickenMemoryService } from './chickenMemoryService';
import { MultiLLMProxy } from './MultiLLMProxy';

export interface ChickenBusinessPattern {
  business_type: 'purchase' | 'processing' | 'distribution' | 'cooking' | 'sales' | 'general';
  confidence_score: number;
  learned_patterns: Record<string, any>;
  metadata?: {
    model?: string;
    library?: string;
    performance?: string;
  };
}

export class EnhancedChickenBusinessAI {
  private proxy: MultiLLMProxy;

  constructor(proxy: MultiLLMProxy) {
    this.proxy = proxy;
  }
  
  /**
   * Parse note with enhanced AI and memory context
   */
  async parseNote(noteText: string): Promise<{
    success: boolean;
    data?: ChickenBusinessPattern;
    error?: string;
    suggestions?: string[];
  }> {
    try {
      console.log('🧠 Starting enhanced chicken business parsing...');
      
      // Get memory context for intelligent parsing
      const memoryContext = await this.getMemoryContext(noteText);
      
      // Parse with enhanced Gemini 2.5 models
      const pattern = await this.parseWithEnhancedGemini(noteText, memoryContext);
      
      // Store the pattern in memory for future context
      await this.storePatternInMemory(pattern, noteText);
      
      // Generate intelligent suggestions
      const suggestions = await this.generateIntelligentSuggestions(pattern);
      
      console.log('✅ Enhanced parsing completed:', {
        type: pattern.business_type,
        confidence: pattern.confidence_score,
        model: pattern.metadata?.model
      });
      
      return {
        success: true,
        data: pattern,
        suggestions
      };
      
    } catch (error) {
      console.error('❌ Enhanced parsing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get relevant memory context for intelligent parsing
   */
  private async getMemoryContext(noteText: string): Promise<string> {
    try {
      // Extract key terms for memory search
      const keyTerms = this.extractKeyTerms(noteText);
      
      // Search memory for relevant patterns
      const memoryResults = await Promise.all(
        keyTerms.map(term => chickenMemoryService.searchBusinessContext(term))
      );
      
      // Build context from memory results
      const context = memoryResults
        .flat()
        .slice(0, 5) // Limit to top 5 results
        .map((result: any) => `${result.type}: ${JSON.stringify(result.data)}`)
        .join('\n');
      
      return context;
    } catch (error) {
      console.warn('⚠️ Failed to get memory context:', error);
      return '';
    }
  }
  
  /**
   * Parse using enhanced Gemini 2.5 models with memory context
   */
  private async parseWithEnhancedGemini(noteText: string, memoryContext: string): Promise<ChickenBusinessPattern> {
    const enhancedPrompt = `
You are an advanced chicken business AI with access to historical patterns and context.

HISTORICAL CONTEXT:
${memoryContext}

CURRENT NOTE TO ANALYZE:
"${noteText}"

Using the historical context, intelligently parse this note for chicken business operations.

Business Types:
- purchase: Buying whole chickens from suppliers
- processing: Converting whole chickens to cuts/products
- sale: Selling products to customers
- transfer: Moving inventory between branches

Return valid JSON with the structure: {
  business_type: string,
  confidence_score: number,
  learned_patterns: object
}`;

    try {
      const response = await this.proxy.generateText(enhancedPrompt, {
        taskType: {
          complexity: 'medium',
          type: 'text',
          priority: 'high'
        },
        temperature: 0.3,
        maxTokens: 1000
      });
      const result = JSON.parse(response.text);
      return {
        ...result,
        metadata: {
          model: response.model || 'gemini-2.0-flash',
          library: 'multiLLMProxy',
          performance: response.metadata?.processingTime
        }
      };
    } catch (error) {
      console.warn('Enhanced Gemini parsing failed:', error);
      return this.parseWithBasicGemini(noteText);
    }
  }

  private getWorkflowSuggestions(pattern: ChickenBusinessPattern): string[] {
    const suggestions: string[] = [];
    
    switch (pattern.business_type) {
      case 'purchase':
        suggestions.push('🔄 Next: Track processing yields and waste ratios');
        break;
      case 'processing':
        suggestions.push('🚚 Next: Record distribution to branches');
        break;
      case 'distribution':
        suggestions.push('🍳 Next: Track cooking operations at branches');
        break;
      case 'cooking':
        suggestions.push('💰 Next: Record sales and leftover management');
        break;
      case 'sales':
        suggestions.push('📊 Consider analyzing profit margins and customer patterns');
        break;
    }
    
    return suggestions;
  }
  
  /**
   * Extract key terms for memory search
   */
  private extractKeyTerms(text: string): string[] {
    const commonTerms = ['magnolia', 'branch', 'worker', 'bags', 'parts', 'necks', 'cook', 'sale'];
    const words = text.toLowerCase().split(/\s+/);
    
    return words.filter(word => 
      word.length > 3 && 
      (commonTerms.includes(word) || /^\d+/.test(word))
    );
  }
  
  /**
   * Get business insights using enhanced models
   */
  async getBusinessInsights(timeframe: 'today' | 'week' | 'month' = 'week'): Promise<{
    insights: string[];
    recommendations: string[];
    performance?: any;
  }> {
    try {
      console.log('🔍 Generating business insights...');
      
      // TODO: Get recent patterns from memory when chickenMemoryService is available
      // For now, generate insights based on available data
      const recentPatterns: ChickenBusinessPattern[] = []; // Placeholder until memory service is fixed
      
      // Analyze patterns with enhanced AI
      const analysis = await this.analyzeBusinessPatterns(recentPatterns);
      
      // Generate AI-powered insights for the timeframe
      const aiInsightsPrompt = `Generate business insights for a chicken business for the ${timeframe} timeframe. Provide insights array and recommendations array as JSON.`;
      
      const aiResponse = await this.proxy.generateText(aiInsightsPrompt, {
        temperature: 0.4,
        maxTokens: 800,
        taskType: {
          complexity: 'medium',
          type: 'text',
          priority: 'medium'
        }
      });
      
      const aiAnalysis = JSON.parse(aiResponse.text);
      
      return {
        insights: [...analysis.insights, ...(aiAnalysis.insights || [])],
        recommendations: [...analysis.recommendations, ...(aiAnalysis.recommendations || [])],
        performance: analysis.performance
      };
      
    } catch (error) {
      console.error('❌ Failed to generate business insights:', error);
      return {
        insights: ['Unable to generate insights at this time'],
        recommendations: ['Check system connectivity and try again']
      };
    }
  }
  
  /**
   * Analyze business patterns with AI
   */
  private async analyzeBusinessPatterns(patterns: any[]): Promise<{
    insights: string[];
    recommendations: string[];
    performance: any;
  }> {
    // This would use enhanced Gemini models to analyze patterns
    // For now, returning basic analysis structure
    
    const insights = [
      `📊 Analyzed ${patterns.length} recent operations`,
      `🎯 Average confidence score: ${patterns.reduce((acc, p) => acc + (p.confidence_score || 0), 0) / patterns.length}`
    ];
    
    const recommendations = [
      '🔄 Continue tracking all workflow stages',
      '📈 Monitor supplier consistency and pricing'
    ];
    
    const performance = {
      total_operations: patterns.length,
      avg_confidence: patterns.reduce((acc, p) => acc + (p.confidence_score || 0), 0) / patterns.length,
      operation_types: patterns.reduce((acc, p) => {
        acc[p.business_type] = (acc[p.business_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return { insights, recommendations, performance };
  }

  /**
   * Fallback parsing method when enhanced parsing fails
   */
  private async parseWithBasicGemini(noteText: string): Promise<ChickenBusinessPattern> {
    try {
      const basicPrompt = `Parse this chicken business note and return JSON with business_type, confidence_score, and learned_patterns:

"${noteText}"

Business types: purchase, processing, distribution, cooking, sales, general`;

      const response = await this.proxy.generateText(basicPrompt, {
        temperature: 0.5,
        maxTokens: 500,
        taskType: {
          complexity: 'simple',
          type: 'text',
          priority: 'low'
        }
      });

      const result = JSON.parse(response.text);
      return {
        business_type: result.business_type || 'general',
        confidence_score: result.confidence_score || 0.5,
        learned_patterns: result.learned_patterns || {},
        metadata: {
          model: 'gemini-2.0-flash',
          library: 'basic_fallback'
        }
      };
    } catch (error) {
      console.warn('Basic parsing also failed:', error);
      return {
        business_type: 'general',
        confidence_score: 0.3,
        learned_patterns: { raw_text: noteText },
        metadata: {
          model: 'fallback',
          library: 'error_recovery'
        }
      };
    }
  }

  /**
   * Store pattern in memory for future context
   */
  private async storePatternInMemory(pattern: ChickenBusinessPattern, noteText: string): Promise<void> {
    try {
      await chickenMemoryService.learnFromPattern({
        ...pattern,
        learned_patterns: {
          ...pattern.learned_patterns,
          original_text: noteText,
          timestamp: new Date().toISOString()
        }
      });
      console.log('📚 Pattern stored successfully:', {
        type: pattern.business_type,
        confidence: pattern.confidence_score,
        noteLength: noteText.length
      });
    } catch (error) {
      console.warn('⚠️ Failed to store pattern in memory:', error);
    }
  }

  /**
   * Generate intelligent suggestions based on pattern
   */
  private async generateIntelligentSuggestions(pattern: ChickenBusinessPattern): Promise<string[]> {
    try {
      const workflowSuggestions = this.getWorkflowSuggestions(pattern);
      
      // Add AI-generated suggestions based on pattern
      const aiPrompt = `Based on this chicken business pattern, suggest 2-3 specific actionable next steps:
Business Type: ${pattern.business_type}
Confidence: ${pattern.confidence_score}
Patterns: ${JSON.stringify(pattern.learned_patterns)}

Return as array of strings.`;

      const response = await this.proxy.generateText(aiPrompt, {
        temperature: 0.7,
        maxTokens: 300,
        taskType: {
          complexity: 'simple',
          type: 'text',
          priority: 'low'
        }
      });

      const aiSuggestions = JSON.parse(response.text) || [];
      return [...workflowSuggestions, ...aiSuggestions];
      
    } catch (error) {
      console.warn('⚠️ Failed to generate AI suggestions:', error);
      return this.getWorkflowSuggestions(pattern);
    }
  }

  // Additional methods for compatibility
  async getRecentPatterns(): Promise<ChickenBusinessPattern[]> {
    try {
      // This would normally get recent patterns from memory service
      // For now, return sample patterns
      return [
        {
          business_type: 'sales',
          confidence_score: 0.85,
          learned_patterns: { recent_activity: 'active' }
        }
      ];
    } catch (error) {
      console.warn('Failed to get recent patterns:', error);
      return [];
    }
  }

  async parseAndApplyNote(noteText: string, userRole: string = 'worker'): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const parseResult = await this.parseNote(noteText);
      
      if (parseResult.success && parseResult.data) {
        // Apply business logic based on the parsed pattern
        const applied = await this.applyBusinessPattern(parseResult.data, userRole);
        
        return {
          success: true,
          data: {
            pattern: parseResult.data,
            applied: applied,
            suggestions: parseResult.suggestions
          }
        };
      }
      
      return parseResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async applyBusinessPattern(pattern: ChickenBusinessPattern, userRole: string): Promise<boolean> {
    try {
      // Store the pattern and create business observations
      await chickenMemoryService.addObservation(
        `${pattern.business_type}_operation`,
        `User (${userRole}) performed ${pattern.business_type} operation with ${pattern.confidence_score} confidence`,
        'user_input'
      );
      
      return true;
    } catch (error) {
      console.warn('Failed to apply business pattern:', error);
      return false;
    }
  }
}

// Export enhanced singleton instance - requires MultiLLMProxy to be initialized first
// This should be initialized with a MultiLLMProxy instance when used
export const createEnhancedChickenBusinessAI = (proxy: MultiLLMProxy) => new EnhancedChickenBusinessAI(proxy);