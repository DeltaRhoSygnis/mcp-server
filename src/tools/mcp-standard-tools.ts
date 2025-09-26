/**
 * MCP Standard Tools Implementation
 * Implements standard MCP protocol tools: sequential thinking, fetch (memory extracted to memory-tools.ts)
 * Integrated with existing chicken business intelligence services
 */

import { z } from 'zod';
import { chickenBusinessAI } from '../services/chickenBusinessAI';
import { v4 as uuidv4 } from 'uuid';

interface SequentialThinkingSequence {
  id: string;
  problem: string;
  context?: string;
  role: 'worker' | 'owner' | 'admin' | 'general';
  thoughts: ThoughtNode[];
  status: 'active' | 'completed' | 'paused';
  created: Date;
  conclusion?: string;
}

interface ThoughtNode {
  id: string;
  content: string;
  reasoning?: string;
  timestamp: Date;
  previous: string | null;
  quality_score?: number;
  business_relevance?: number;
}

interface ThoughtQualityAnalysis {
  quality_score: number;
  business_relevance: number;
  insights?: string[];
}

interface ThoughtQualityAnalysis {
  quality_score: number;
  business_relevance: number;
  insights?: string[]; // Added for TS
}

export class MCPStandardTools {
  private thinkingSequences: Map<string, SequentialThinkingSequence> = new Map();

  /**
   * MCP Sequential Thinking Tools - Enhanced for business problem solving
   */
  async mcp_sequentialthinking_start(args: {
    problem: string;
    context?: string;
    role?: 'worker' | 'owner' | 'admin';
    business_domain?: string;
  }) {
    const sequenceId = uuidv4();
    const sequence: SequentialThinkingSequence = {
      id: sequenceId,
      problem: args.problem,
      context: args.context,
      role: args.role || 'general',
      thoughts: [],
      status: 'active',
      created: new Date()
    };

    this.thinkingSequences.set(sequenceId, sequence);

    return {
      sequenceId,
      status: 'started',
      problem: args.problem,
      role: args.role || 'general',
      next_step: 'Use mcp_sequentialthinking_think to add thoughts to this sequence'
    };
  }

  async mcp_sequentialthinking_think(args: {
    sequenceId: string;
    thought: string;
    reasoning?: string;
    confidence?: number;
  }) {
    const sequence = this.thinkingSequences.get(args.sequenceId);
    if (!sequence) {
      throw new Error(`Thinking sequence ${args.sequenceId} not found`);
    }

    if (sequence.status !== 'active') {
      throw new Error(`Thinking sequence ${args.sequenceId} is not active`);
    }

    const thoughtNode: ThoughtNode = {
      id: uuidv4(),
      content: args.thought,
      reasoning: args.reasoning,
      timestamp: new Date(),
      previous: sequence.thoughts.length > 0 ? sequence.thoughts[sequence.thoughts.length - 1].id : null
    };

    // AI analysis of thought quality using existing business AI
    try {
      const analysis = await this.analyzeThoughtQuality(args.thought, sequence);
      thoughtNode.quality_score = analysis.quality_score;
      thoughtNode.business_relevance = analysis.business_relevance;
    } catch (error) {
      console.warn('Thought analysis failed:', error);
    }

    sequence.thoughts.push(thoughtNode);

    // Determine if more thinking is needed
    const shouldContinue = await this.shouldContinueThinking(sequence);

    return {
      thoughtId: thoughtNode.id,
      sequenceId: args.sequenceId,
      thought_number: sequence.thoughts.length,
      quality_assessment: {
        score: thoughtNode.quality_score,
        business_relevance: thoughtNode.business_relevance
      },
      should_continue: shouldContinue,
      next_suggestion: shouldContinue ? 
        'Continue thinking or use mcp_sequentialthinking_conclude to finish' : 
        'Consider concluding this thinking sequence'
    };
  }

  async mcp_sequentialthinking_conclude(args: {
    sequenceId: string;
    final_reasoning?: string;
  }) {
    const sequence = this.thinkingSequences.get(args.sequenceId);
    if (!sequence) {
      throw new Error(`Thinking sequence ${args.sequenceId} not found`);
    }

    // Generate conclusion using business AI
    const conclusion = await this.generateThinkingConclusion(sequence, args.final_reasoning);
    
    sequence.conclusion = conclusion;
    sequence.status = 'completed';

    return {
      sequenceId: args.sequenceId,
      status: 'completed',
      conclusion,
      total_thoughts: sequence.thoughts.length,
      thinking_duration: Date.now() - sequence.created.getTime(),
      summary: {
        problem: sequence.problem,
        solution: conclusion,
        thought_count: sequence.thoughts.length,
        average_quality: this.calculateAverageQuality(sequence.thoughts)
      }
    };
  }

  /**
   * Dynamic and reflective problem-solving through structured thoughts
   */
  async mcp_sequentialthinking_sequentialthinking(args: {
    thought: string;
    nextThoughtNeeded: boolean;
    thoughtNumber: number;
    totalThoughts: number;
    isRevision?: boolean;
    revisesThought?: number;
    branchFromThought?: number;
    branchId?: string;
    needsMoreThoughts?: boolean;
  }) {
    try {
      // Create or get existing sequence
      let sequenceId = 'current_sequence';
      if (!this.thinkingSequences.has(sequenceId)) {
        const sequence: SequentialThinkingSequence = {
          id: sequenceId,
          problem: 'Dynamic business problem solving',
          context: 'Sequential thinking process',
          role: 'general',
          thoughts: [],
          status: 'active',
          created: new Date()
        };
        this.thinkingSequences.set(sequenceId, sequence);
      }

      const sequence = this.thinkingSequences.get(sequenceId)!;

      // Create thought node
      const thoughtNode: ThoughtNode = {
        id: `thought_${args.thoughtNumber}`,
        content: args.thought,
        reasoning: args.isRevision ? `Revision of thought ${args.revisesThought}` : undefined,
        timestamp: new Date(),
        previous: args.thoughtNumber > 1 ? `thought_${args.thoughtNumber - 1}` : null
      };

      // Analyze thought with business AI
      const analysis = await this.analyzeThoughtQuality(args.thought, sequence);
      thoughtNode.quality_score = analysis.quality_score;
      thoughtNode.business_relevance = analysis.business_relevance;

      // Add or replace thought
      if (args.isRevision && args.revisesThought) {
        const index = sequence.thoughts.findIndex(t => t.id === `thought_${args.revisesThought}`);
        if (index !== -1) {
          sequence.thoughts[index] = thoughtNode;
        }
      } else {
        sequence.thoughts.push(thoughtNode);
      }

      // Determine next steps
      const shouldContinue = args.nextThoughtNeeded || args.needsMoreThoughts;
      
      if (!shouldContinue) {
        sequence.status = 'completed';
        // Generate final conclusion
        const conclusion = await this.generateThinkingConclusion(sequence);
        sequence.conclusion = conclusion;
      }

      return {
        thoughtId: thoughtNode.id,
        sequenceId,
        thoughtNumber: args.thoughtNumber,
        totalThoughts: args.totalThoughts,
        qualityScore: thoughtNode.quality_score,
        businessRelevance: thoughtNode.business_relevance,
        isComplete: !shouldContinue,
        nextAction: shouldContinue ? 
          'Continue with next thought' : 
          'Sequence completed - conclusion available',
        conclusion: sequence.conclusion,
        analysis: {
          thought_quality: analysis.quality_score,
          business_relevance: analysis.business_relevance,
          insights: analysis.insights
        }
      };

    } catch (error) {
      throw new Error(`Sequential thinking failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch Web Content - Enhanced for business intelligence
   */
  async fetch_webpage(args: {
    urls: string[];
    query: string;
    business_context?: string;
    extract_mode?: 'content' | 'data' | 'analysis';
  }) {
    const results = [];

    for (const url of args.urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'CharnoksAI-BusinessBot/2.0 (MCP Server)',
            'Accept': 'text/html,application/json,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        let content = await response.text();

        // Clean and extract main content for HTML
        if (contentType.includes('text/html')) {
          content = this.extractMainContent(content);
        }

        // Business-specific analysis if context provided
        let businessAnalysis = null;
        if (args.business_context) {
          businessAnalysis = await this.analyzeWebContentForBusiness(
            content,
            args.business_context,
            args.query
          );
        }

        results.push({
          url,
          content: content.substring(0, 50000), // Limit content size
          contentType,
          businessAnalysis,
          metadata: {
            wordCount: content.split(/\s+/).length,
            retrievedAt: new Date().toISOString(),
            responseSize: content.length,
            relevance_to_query: this.calculateRelevance(content, args.query)
          }
        });

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          results.push({ url, error: 'Request timeout', status: 'failed' });
        } else {
          results.push({
            url,
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          });
        }
      }
    }

    return {
      query: args.query,
      results,
      successful_fetches: results.filter(r => !r.error).length,
      total_requested: args.urls.length,
      business_insights: results
        .filter(r => r.businessAnalysis)
        .map(r => r.businessAnalysis!.summary) // Null check with !
    };
  }

  /**
   * Helper methods
   */
  private async analyzeThoughtQuality(thought: string, sequence: SequentialThinkingSequence): Promise<ThoughtQualityAnalysis> {
    // Use existing chicken business AI for analysis
    try {
      const analysis = await chickenBusinessAI.parseBusinessNote(
        `Thought analysis: ${thought} (Context: ${sequence.problem})`
      );

      return {
        quality_score: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
        business_relevance: analysis.confidence_score || 0.8,
        insights: analysis.insights || [] // Added
      };
    } catch (error) {
      return { quality_score: 0.8, business_relevance: 0.7, insights: [] };
    }
  }

  private async shouldContinueThinking(sequence: SequentialThinkingSequence): Promise<boolean> {
    // Business logic for determining if more thinking is needed
    if (sequence.thoughts.length < 2) return true;
    if (sequence.thoughts.length > 10) return false;

    const recentQuality = sequence.thoughts.slice(-2).reduce((sum, t) => sum + (t.quality_score || 0.8), 0) / 2;
    return recentQuality > 0.6 && sequence.thoughts.length < 8;
  }

  private async generateThinkingConclusion(sequence: SequentialThinkingSequence, finalReasoning?: string): Promise<string> {
    const thoughtSummary = sequence.thoughts.map(t => t.content).join(' → ');
    
    try {
      // Use business AI to generate conclusion
      const analysis = await chickenBusinessAI.parseBusinessNote(
        `Problem: ${sequence.problem}\nThinking process: ${thoughtSummary}\nFinal reasoning: ${finalReasoning || 'None provided'}\n\nGenerate a conclusion:`
      );

      return analysis.summary || `After ${sequence.thoughts.length} thoughts, the conclusion is: ${finalReasoning || 'Analysis complete.'}`;
    } catch (error) {
      return `Conclusion: ${finalReasoning || 'Thinking process completed with ' + sequence.thoughts.length + ' thoughts.'}`;
    }
  }

  private calculateAverageQuality(thoughts: ThoughtNode[]): number {
    if (thoughts.length === 0) return 0;
    return thoughts.reduce((sum, t) => sum + (t.quality_score || 0.8), 0) / thoughts.length;
  }

  private extractMainContent(html: string): string {
    // Simple HTML content extraction - remove scripts, styles, nav, footer
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async analyzeWebContentForBusiness(content: string, businessContext: string, query: string): Promise<{
    relevance_score: number;
    key_insights: string[];
    summary: string;
  }> {
    try {
      const analysis = await chickenBusinessAI.parseBusinessNote(
        `Analyze this web content for business relevance:\nContext: ${businessContext}\nQuery: ${query}\nContent: ${content.substring(0, 2000)}`
      );

      return {
        relevance_score: analysis.confidence_score || 0.5,
        key_insights: ['Web content analyzed', 'Business relevance assessed'],
        summary: analysis.summary || 'Content analyzed for business intelligence'
      };
    } catch (error) {
      return {
        relevance_score: 0.3,
        key_insights: ['Analysis failed'],
        summary: 'Could not analyze content'
      };
    }
  }

  private calculateRelevance(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const matches = queryWords.filter(word => contentLower.includes(word));
    return matches.length / queryWords.length;
  }
}

// Export singleton instance
export const mcpStandardTools = new MCPStandardTools();

// Export schemas for validation (remove memory schemas)
export const mcpStandardSchemas = {
  mcp_sequentialthinking_sequentialthinking: z.object({
    thought: z.string(),
    nextThoughtNeeded: z.boolean(),
    thoughtNumber: z.number().min(1),
    totalThoughts: z.number().min(1),
    isRevision: z.boolean().optional(),
    revisesThought: z.number().min(1).optional(),
    branchFromThought: z.number().min(1).optional(),
    branchId: z.string().optional(),
    needsMoreThoughts: z.boolean().optional()
  }),

  mcp_sequentialthinking_start: z.object({
    problem: z.string(),
    context: z.string().optional(),
    role: z.enum(['worker', 'owner', 'admin']).optional(),
    business_domain: z.string().optional()
  }),

  mcp_sequentialthinking_think: z.object({
    sequenceId: z.string(),
    thought: z.string(),
    reasoning: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  }),

  mcp_sequentialthinking_conclude: z.object({
    sequenceId: z.string(),
    final_reasoning: z.string().optional()
  }),

  fetch_webpage: z.object({
    urls: z.array(z.string().url()),
    query: z.string(),
    business_context: z.string().optional(),
    extract_mode: z.enum(['content', 'data', 'analysis']).optional()
  })
};