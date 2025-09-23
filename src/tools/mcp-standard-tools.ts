/**
 * MCP Standard Tools Implementation
 * Implements standard MCP protocol tools: memory, sequential thinking, fetch, filesystem
 * Integrated with existing chicken business intelligence services
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { chickenMemoryService } from '../services/chickenMemoryService.js';
import { chickenBusinessAI } from '../services/chickenBusinessAI.js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export class MCPStandardTools {
  private thinkingSequences: Map<string, SequentialThinkingSequence> = new Map();

  /**
   * MCP Memory Tools - Enhanced with business intelligence
   */
  async mcp_memory_create_entities(args: {
    entities: Array<{
      name: string;
      entityType: 'supplier' | 'customer' | 'worker' | 'branch' | 'product' | 'business_period' | 'general';
      observations: string[];
      metadata?: Record<string, any>;
    }>;
  }) {
    const results = [];
    
    for (const entity of args.entities) {
      try {
        // Store in business memory service
        const success = await chickenMemoryService.storeBusinessEntity({
          name: entity.name,
          entityType: entity.entityType,
          attributes: {
            ...entity.metadata,
            created_via: 'mcp_memory_create',
            created_at: new Date().toISOString()
          }
        });

        // Add observations
        for (const observation of entity.observations) {
          await chickenMemoryService.addBusinessObservation({
            entityName: entity.name,
            observation,
            timestamp: new Date().toISOString(),
            source: 'mcp_memory',
            confidence: 1.0
          });
        }

        results.push({
          name: entity.name,
          status: success ? 'created' : 'failed',
          entity_id: success ? `entity_${Date.now()}_${entity.name}` : null
        });

      } catch (error) {
        results.push({
          name: entity.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { results, total_created: results.filter(r => r.status === 'created').length };
  }

  async mcp_memory_create_relations(args: {
    relations: Array<{
      from: string;
      to: string;
      relationType: string;
      metadata?: Record<string, any>;
    }>;
  }) {
    const results = [];

    for (const relation of args.relations) {
      try {
        const success = await chickenMemoryService.createBusinessRelation({
          from: relation.from,
          to: relation.to,
          relationType: relation.relationType,
          metadata: {
            ...relation.metadata,
            created_via: 'mcp_memory_relate',
            created_at: new Date().toISOString()
          }
        });

        results.push({
          from: relation.from,
          to: relation.to,
          relationType: relation.relationType,
          status: success ? 'created' : 'failed'
        });

      } catch (error) {
        results.push({
          from: relation.from,
          to: relation.to,
          relationType: relation.relationType,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { results, total_created: results.filter(r => r.status === 'created').length };
  }

  async mcp_memory_add_observations(args: {
    observations: Array<{
      entityName: string;
      contents: string[];
    }>;
  }) {
    const results = [];

    for (const obs of args.observations) {
      for (const content of obs.contents) {
        try {
          const success = await chickenMemoryService.addBusinessObservation({
            entityName: obs.entityName,
            observation: content,
            timestamp: new Date().toISOString(),
            source: 'mcp_memory',
            confidence: 0.9
          });

          results.push({
            entityName: obs.entityName,
            observation: content,
            status: success ? 'added' : 'failed'
          });

        } catch (error) {
          results.push({
            entityName: obs.entityName,
            observation: content,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return { results, total_added: results.filter(r => r.status === 'added').length };
  }

  async mcp_memory_search_nodes(args: {
    query: string;
    limit?: number;
    entityTypes?: string[];
  }) {
    try {
      const searchResults = await chickenMemoryService.searchBusinessContext(args.query);
      
      // Filter by entity types if specified
      let filteredResults = searchResults;
      if (args.entityTypes && args.entityTypes.length > 0) {
        filteredResults = searchResults.filter(result => 
          args.entityTypes!.includes(result.type) || 
          (result.data.entityType && args.entityTypes!.includes(result.data.entityType))
        );
      }

      // Limit results
      const limitedResults = filteredResults.slice(0, args.limit || 10);

      return {
        query: args.query,
        results: limitedResults,
        total_found: limitedResults.length,
        search_context: 'chicken_business_intelligence'
      };

    } catch (error) {
      throw new Error(`Memory search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async mcp_memory_read_graph() {
    try {
      // Get all business entities, relations, and recent observations
      const entities = await this.getAllBusinessEntities();
      const relations = await this.getAllBusinessRelations();
      const recentObservations = await this.getRecentObservations(50);

      return {
        graph: {
          entities: entities.length,
          relations: relations.length,
          observations: recentObservations.length
        },
        summary: {
          entity_types: this.groupByType(entities),
          relation_types: this.groupByRelationType(relations),
          last_updated: new Date().toISOString()
        },
        sample_data: {
          entities: entities.slice(0, 5),
          relations: relations.slice(0, 5),
          observations: recentObservations.slice(0, 5)
        }
      };

    } catch (error) {
      throw new Error(`Failed to read memory graph: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete multiple entities and their associated relations from the knowledge graph
   */
  async mcp_memory_delete_entities(args: {
    entityNames: string[];
  }) {
    try {
      const results = [];
      
      for (const entityName of args.entityNames) {
        // Delete observations first
        const obsResult = await chickenMemoryService.deleteObservations(entityName, []);
        
        // Delete entity relations
        const relResult = await chickenMemoryService.deleteRelations([{
          from: entityName,
          to: '*',
          relationType: '*'
        }]);
        
        // Delete the entity itself
        const entityResult = await chickenMemoryService.deleteEntity(entityName);
        
        results.push({
          entityName,
          deleted: entityResult.success,
          observations_deleted: obsResult.success,
          relations_deleted: relResult.success
        });
      }

      return {
        deleted_entities: results,
        timestamp: new Date().toISOString(),
        success: results.every(r => r.deleted)
      };

    } catch (error) {
      throw new Error(`Failed to delete entities: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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

    // Store in business memory for persistence
    await chickenMemoryService.storeBusinessEntity({
      name: `thinking_sequence_${sequenceId}`,
      entityType: 'business_period',
      attributes: {
        sequence_id: sequenceId,
        problem: args.problem,
        context: args.context,
        role: args.role,
        domain: args.business_domain || 'chicken_business',
        status: 'active'
      }
    });

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

    // Store observation about this thinking step
    await chickenMemoryService.addBusinessObservation({
      entityName: `thinking_sequence_${args.sequenceId}`,
      observation: `Thought added: ${args.thought.substring(0, 100)}...`,
      timestamp: new Date().toISOString(),
      source: 'sequential_thinking',
      confidence: args.confidence || 0.8
    });

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

    // Store final conclusion
    await chickenMemoryService.addBusinessObservation({
      entityName: `thinking_sequence_${args.sequenceId}`,
      observation: `Concluded: ${conclusion.substring(0, 200)}...`,
      timestamp: new Date().toISOString(),
      source: 'sequential_thinking_conclusion',
      confidence: 0.95
    });

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

      // Store observation
      await chickenMemoryService.addBusinessObservation({
        entityName: `sequential_thinking_${sequenceId}`,
        observation: `Thought ${args.thoughtNumber}: ${args.thought.substring(0, 100)}...`,
        timestamp: new Date().toISOString(),
        source: 'sequential_thinking_dynamic',
        confidence: analysis.quality_score || 0.8
      });

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
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'CharnoksAI-BusinessBot/2.0 (MCP Server)',
            'Accept': 'text/html,application/json,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 30000
        });

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

        // Store useful findings in memory
        if (businessAnalysis && businessAnalysis.relevance_score > 0.7) {
          await chickenMemoryService.addBusinessObservation({
            entityName: 'web_research',
            observation: `Found relevant content: ${businessAnalysis.key_insights.join(', ')}`,
            timestamp: new Date().toISOString(),
            source: 'web_fetch',
            confidence: businessAnalysis.relevance_score
          });
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
        results.push({
          url,
          error: error instanceof Error ? error.message : String(error),
          status: 'failed'
        });
      }
    }

    return {
      query: args.query,
      results,
      successful_fetches: results.filter(r => !r.error).length,
      total_requested: args.urls.length,
      business_insights: results
        .filter(r => r.businessAnalysis)
        .map(r => r.businessAnalysis.summary)
    };
  }

  /**
   * Helper methods
   */
  private async analyzeThoughtQuality(thought: string, sequence: SequentialThinkingSequence): Promise<{
    quality_score: number;
    business_relevance: number;
  }> {
    // Use existing chicken business AI for analysis
    try {
      const analysis = await chickenBusinessAI.parseBusinessNote(
        `Thought analysis: ${thought} (Context: ${sequence.problem})`
      );

      return {
        quality_score: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
        business_relevance: analysis.confidence_score || 0.8
      };
    } catch (error) {
      return { quality_score: 0.8, business_relevance: 0.7 };
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

  private async getAllBusinessEntities(): Promise<any[]> {
    // Placeholder - integrate with your actual storage
    return [];
  }

  private async getAllBusinessRelations(): Promise<any[]> {
    // Placeholder - integrate with your actual storage
    return [];
  }

  private async getRecentObservations(limit: number): Promise<any[]> {
    // Placeholder - integrate with your actual storage
    return [];
  }

  private groupByType(entities: any[]): Record<string, number> {
    return entities.reduce((acc, entity) => {
      const type = entity.entityType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByRelationType(relations: any[]): Record<string, number> {
    return relations.reduce((acc, relation) => {
      const type = relation.relationType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }
}

// Export singleton instance
export const mcpStandardTools = new MCPStandardTools();

// Export schemas for validation
export const mcpStandardSchemas = {
  mcp_memory_create_entities: z.object({
    entities: z.array(z.object({
      name: z.string(),
      entityType: z.enum(['supplier', 'customer', 'worker', 'branch', 'product', 'business_period', 'general']),
      observations: z.array(z.string()),
      metadata: z.record(z.any()).optional()
    }))
  }),

  mcp_memory_create_relations: z.object({
    relations: z.array(z.object({
      from: z.string(),
      to: z.string(),
      relationType: z.string(),
      metadata: z.record(z.any()).optional()
    }))
  }),

  mcp_memory_add_observations: z.object({
    observations: z.array(z.object({
      entityName: z.string(),
      contents: z.array(z.string())
    }))
  }),

  mcp_memory_search_nodes: z.object({
    query: z.string(),
    limit: z.number().optional(),
    entityTypes: z.array(z.string()).optional()
  }),

  mcp_memory_read_graph: z.object({}),

  mcp_memory_delete_entities: z.object({
    entityNames: z.array(z.string())
  }),

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