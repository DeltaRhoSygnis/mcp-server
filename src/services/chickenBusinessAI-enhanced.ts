/**
 * Enhanced ChickenBusinessAI Service
 * Advanced AI-powered parsing with Gemini 2.5 series models and memory integration
 * Patterns inspired by advanced MCP server implementations
 */

import { supabase } from '../src/supabaseConfig';
import { geminiAPIManager } from './geminiAPIManager';
import { chickenMemoryService } from './chickenMemoryService';
import { MultiLLMProxy } from './MultiLLMProxy';

interface ChickenBusinessPattern {
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
        keyTerms.map(term => chickenMemoryService.searchPatterns(term))
      );
      
      // Build context from memory results
      const context = memoryResults
        .flat()
        .slice(0, 5) // Limit to top 5 results
        .map(result => `${result.business_type}: ${JSON.stringify(result.learned_patterns)}`)
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
- processing/**
 * Enhanced ChickenBusinessAI Service
 * Advanced AI-powered parsing with Gemini 2.5 series models and memory integration
 * Patterns inspired by advanced MCP server implementations
 */

import { supabase } from '../src/supabaseConfig';
import { geminiAPIManager } from './geminiAPIManager';
import { chickenMemoryService } from './chickenMemoryService';
import { MultiLLMProxy } from './MultiLLMProxy';

interface ChickenBusinessPattern {
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
        keyTerms.map(term => chickenMemoryService.searchPatterns(term))
      );
      
      // Build context from memory results
      const context = memoryResults
        .flat()
        .slice(0, 5) // Limit to top 5 results
        .map(result => `${result.business_type}: ${JSON.stringify(result.learned_patterns)}`)
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
- processing
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
      
      // Get recent patterns from memory
      const recentPatterns = await chickenMemoryService.getRecentPatterns(timeframe);
      
      // Analyze patterns with enhanced AI
      const analysis = await this.analyzeBusinessPatterns(recentPatterns);
      
      return {
        insights: analysis.insights,
        recommendations: analysis.recommendations,
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
}

// Export enhanced singleton instance
export const enhancedChickenBusinessAI = new EnhancedChickenBusinessAI();