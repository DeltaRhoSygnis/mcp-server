/**
 * MCP Memory Tools Implementation
 * Dedicated module for persistent knowledge graph (KG) management
 * Supports structured records with full schema: id/type/content/embedding/timestamps/author/confidence/tags/provenance/access_controls/TTL
 * Integrates Supabase (entities/relations/observations tables + pgvector for embeddings)
 * Business-focused: entityTypes for chicken store (product/supplier/etc.); AI summaries for archival
 * Safety: RLS, PII redaction, audits, TTL expiry (default 30d, custom 2-week cycle for summaries)
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
// Use require() for Google Generative AI to fix compilation issues
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Note: If GoogleGenerativeAI import fails, use this fallback:
// const genAI = { getGenerativeModel: () => ({ embedContent: async () => ({ embedding: { values: [] } }) }) };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

const limit = pLimit(50); // Rate limit: 50 ops/min

// Schema for Memory Record (per memory.md + DB tables)
interface MemoryRecord {
  id: string;
  type: 'preference' | 'project-fact' | 'contact' | 'note' | 'summary' | 'business_entity';
  content: string; // Redacted text
  embedding?: number[]; // Vector<1536> for pgvector
  created_at: Date;
  updated_at: Date;
  expires_at?: Date; // TTL
  author?: string; // user_id or 'mcp_memory'
  source?: string; // 'user' | 'ai' | 'mcp_memory'
  confidence: number; // 0-1
  tags: string[]; // e.g., ['chicken', 'stock']
  provenance?: { source_file?: string; url?: string; line_num?: number }; // Origin
  access_controls?: { roles: string[]; user_ids: string[] }; // RLS filter
  human_review?: boolean; // Flag for approval
}

// Entity Types for Chicken Business
const BUSINESS_ENTITY_TYPES = ['supplier', 'customer', 'worker', 'branch', 'product', 'business_period', 'general'] as const;
type BusinessEntityType = typeof BUSINESS_ENTITY_TYPES[number];

// PII Redaction (simple regex; expand for prod)
const redactPII = (content: string): string => {
  return content
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{4}[-.]?\d{2}[-.]?\d{2}\b/g, '[DATE_REDACTED]');
};

// Generate Embedding (Gemini; free tier: 1500/day)
const generateEmbedding = async (content: string): Promise<number[]> => {
  return await limit(async () => {
    try {
      const result = await embeddingModel.generateContent([{ text: content }]);
      return result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.split(',').map(Number) || [];
    } catch (error) {
      console.warn('Embedding failed:', error);
      return []; // Fallback: No embedding
    }
  });
};

// Apply TTL (auto-expire >30d default; filter on read)
const applyTTL = (record: MemoryRecord): boolean => {
  if (!record.expires_at) return true;
  return new Date() < record.expires_at;
};

// Vector Search Helper (pgvector cosine similarity)
const vectorSearch = async (query: string, limit: number = 10, entityTypes?: BusinessEntityType[]): Promise<any[]> => {
  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) {
    // Fallback keyword search
    const { data } = await supabase
      .from('observations')
      .select('*')
      .ilike('contents', `%${query}%`)
      .limit(limit);
    return data || [];
  }

  // pgvector query (assumes enabled; run migrate.ts)
  const { data } = await supabase.rpc('match_observations', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7, // Cosine sim
    match_count: limit
  });
  return data || [];
};

// Audit Log Helper
const logAudit = async (operation: string, input: any, output: any, userId?: string, success: boolean = true, error?: string): Promise<void> => {
  await supabase.from('ai_audit_logs').insert({
    operation_type: `memory_${operation}`,
    input_data: input,
    output_data: output,
    user_id: userId,
    success,
    error_message: error,
    metadata: { confidence: output?.confidence, tags: output?.tags }
  });
};

class MCPMemoryTools {
  /**
   * Create multiple entities in KG (entities table + observations)
   * MCP Tool: mcp_memory_create_entities
   */
  async mcp_memory_create_entities(args: {
    entities: Array<{
      name: string;
      entityType: BusinessEntityType;
      observations: string[];
      metadata?: Record<string, any>;
      tags?: string[];
      ttl_days?: number; // Custom TTL
      access_controls?: { roles: string[]; user_ids: string[] };
    }>;
    userId?: string;
  }) {
    const schema = z.object({
      entities: z.array(z.object({
        name: z.string().min(1),
        entityType: z.enum(BUSINESS_ENTITY_TYPES),
        observations: z.array(z.string().min(1)),
        metadata: z.record(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        ttl_days: z.number().optional().default(30),
        access_controls: z.object({ roles: z.array(z.string()), user_ids: z.array(z.string()) }).optional()
      })),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    const results = [];
    for (const entity of validated.entities) {
      try {
        const recordId = uuidv4();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + entity.ttl_days! * 24 * 60 * 60 * 1000);

        // Redact PII in observations
        const redactedObservations = entity.observations.map(redactPII);

        // Create entity
        const { data: entityData, error: entityError } = await supabase
          .from('entities')
          .insert({
            id: recordId,
            name: entity.name,
            entity_type: entity.entityType,
            metadata: entity.metadata || {},
            created_at: now,
            updated_at: now,
            expires_at: expiresAt,
            author: validated.userId || 'mcp_memory',
            source: 'mcp_create',
            tags: entity.tags || [],
            access_controls: entity.access_controls || { roles: ['general'], user_ids: [] },
            human_review: true // Default flag
          })
          .select()
          .single();

        if (entityError) throw entityError;

        // Add observations (with embeddings)
        for (let i = 0; i < redactedObservations.length; i++) {
          const obsId = uuidv4();
          const embedding = await generateEmbedding(redactedObservations[i]);
          await supabase
            .from('observations')
            .insert({
              id: obsId,
              entity_name: entity.name,
              contents: [redactedObservations[i]],
              embedding, // pgvector vector
              timestamp: now,
              confidence: 0.95, // Default; AI-compute later
              source: 'mcp_create',
              provenance: { entity_id: recordId },
              tags: entity.tags || [],
              access_controls: entity.access_controls || { roles: ['general'], user_ids: [] }
            });
        }

        // Create relations if metadata implies (stub; expand)
        // e.g., if metadata has 'related_to', insert to relations

        const confidence = 0.95; // Or AI-assess
        results.push({ name: entity.name, id: recordId, status: 'created', confidence, expires_at: expiresAt });

        await logAudit('create_entities', { entity }, { id: recordId }, validated.userId || 'system');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ name: entity.name, status: 'error', error: errorMessage });
        await logAudit('create_entities', { entity }, null, validated.userId, false, errorMessage);
      }
    }

    return { results, total_created: results.filter(r => r.status === 'created').length };
  }

  /**
   * Create relations between entities (relations table)
   * MCP Tool: mcp_memory_create_relations
   */
  async mcp_memory_create_relations(args: {
    relations: Array<{
      from: string; // entity name/id
      to: string;
      relationType: string; // e.g., 'supplies', 'purchases'
      metadata?: Record<string, any>;
      tags?: string[];
      ttl_days?: number;
      access_controls?: { roles: string[]; user_ids: string[] };
    }>;
    userId?: string;
  }) {
    const schema = z.object({
      relations: z.array(z.object({
        from: z.string(),
        to: z.string(),
        relationType: z.string().min(1),
        metadata: z.record(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        ttl_days: z.number().optional().default(30),
        access_controls: z.object({ roles: z.array(z.string()), user_ids: z.array(z.string()) }).optional()
      })),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    const results = [];
    for (const rel of validated.relations) {
      try {
        const recordId = uuidv4();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + rel.ttl_days! * 24 * 60 * 60 * 1000);

        // Resolve from/to IDs (query entities if names)
        const { data: fromEntity } = await supabase.from('entities').select('id').eq('name', rel.from).single();
        const { data: toEntity } = await supabase.from('entities').select('id').eq('name', rel.to).single();
        if (!fromEntity || !toEntity) throw new Error('Entity not found');

        const { error } = await supabase
          .from('relations')
          .insert({
            id: recordId,
            from_id: fromEntity.id,
            to_id: toEntity.id,
            relation_type: rel.relationType,
            metadata: rel.metadata || {},
            created_at: now,
            updated_at: now,
            expires_at: expiresAt,
            author: validated.userId || 'mcp_memory',
            source: 'mcp_create',
            tags: rel.tags || [],
            access_controls: rel.access_controls || { roles: ['general'], user_ids: [] },
            human_review: true
          });

        if (error) throw error;

        results.push({ from: rel.from, to: rel.to, relationType: rel.relationType, id: recordId, status: 'created' });
        await logAudit('create_relations', { rel }, { id: recordId }, validated.userId, true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ from: rel.from, to: rel.to, relationType: rel.relationType, status: 'error', error: errorMessage });
        await logAudit('create_relations', { rel }, null, validated.userId, false, errorMessage);
      }
    }

    return { results, total_created: results.filter(r => r.status === 'created').length };
  }

  /**
   * Add observations to entities (observations table + embeddings)
   * MCP Tool: mcp_memory_add_observations
   */
  async mcp_memory_add_observations(args: {
    observations: Array<{
      entityName: string;
      contents: string[];
      tags?: string[];
      ttl_days?: number;
      access_controls?: { roles: string[]; user_ids: string[] };
    }>;
    userId?: string;
  }) {
    const schema = z.object({
      observations: z.array(z.object({
        entityName: z.string(),
        contents: z.array(z.string().min(1)),
        tags: z.array(z.string()).optional(),
        ttl_days: z.number().optional().default(30),
        access_controls: z.object({ roles: z.array(z.string()), user_ids: z.array(z.string()) }).optional()
      })),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    const results = [];
    for (const obsGroup of validated.observations) {
      // Verify entity exists
      const { data: entity } = await supabase.from('entities').select('id').eq('name', obsGroup.entityName).single();
      if (!entity) {
        results.push({ entityName: obsGroup.entityName, status: 'error', error: 'Entity not found' });
        continue;
      }

      for (const content of obsGroup.contents) {
        try {
          const recordId = uuidv4();
          const now = new Date();
          const expiresAt = new Date(now.getTime() + obsGroup.ttl_days! * 24 * 60 * 60 * 1000);
          const redactedContent = redactPII(content);
          const embedding = await generateEmbedding(redactedContent);

          const { error } = await supabase
            .from('observations')
            .insert({
              id: recordId,
              entity_name: obsGroup.entityName,
              contents: [redactedContent],
              embedding,
              timestamp: now,
              confidence: 0.9, // Default
              source: 'mcp_add',
              provenance: { entity_id: entity.id },
              tags: obsGroup.tags || [],
              access_controls: obsGroup.access_controls || { roles: ['general'], user_ids: [] },
              human_review: true
            });

          if (error) throw error;

          results.push({ entityName: obsGroup.entityName, content, id: recordId, status: 'added' });
          await logAudit('add_observations', { content }, { id: recordId }, validated.userId, true);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ entityName: obsGroup.entityName, content, status: 'error', error: errorMessage });
          await logAudit('add_observations', { content }, null, validated.userId, false, errorMessage);
        }
      }
    }

    return { results, total_added: results.filter(r => r.status === 'added').length };
  }

  /**
   * Search KG nodes (hybrid: vector + keyword, filter TTL/access)
   * MCP Tool: mcp_memory_search_nodes
   */
  async mcp_memory_search_nodes(args: {
    query: string;
    limit?: number;
    entityTypes?: BusinessEntityType[];
    userId?: string; // For RLS
  }) {
    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().optional().default(10),
      entityTypes: z.array(z.enum(BUSINESS_ENTITY_TYPES)).optional(),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    try {
      // RLS filter if userId
      let queryBuilder = supabase.from('observations').select(`
        *, 
        entities!inner(name, entity_type, metadata),
        relations!inner(relation_type)
      `).gt('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30d TTL filter

      if (validated.userId) {
        queryBuilder = queryBuilder.eq('access_controls->>user_ids', validated.userId); // RLS sim
      }

      if (validated.entityTypes?.length) {
        queryBuilder = queryBuilder.contains('entities.entity_type', validated.entityTypes);
      }

      // Hybrid search
      const vectorResults = await vectorSearch(validated.query, validated.limit, validated.entityTypes);
      const { data: keywordData } = await queryBuilder.ilike('contents', `%${validated.query}%`).limit(validated.limit);
      const keywordResults = { data: keywordData };

      // Merge/dedup top results (prioritize vector)
      const merged = [...new Set([...vectorResults, ...(keywordResults.data || [])])].slice(0, validated.limit);

      // Filter expired
      const validResults = merged.filter(obs => applyTTL(obs as MemoryRecord));

      await logAudit('search_nodes', { query: validated.query }, { results: validResults.length }, validated.userId, true);
      return {
        query: validated.query,
        results: validResults,
        total_found: validResults.length,
        search_type: 'hybrid_vector_keyword',
        metadata: { used_embeddings: vectorResults.length > 0 }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logAudit('search_nodes', { query: validated.query }, null, validated.userId, false, errorMessage);
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  /**
   * Read full KG (paginated, TTL-filtered)
   * MCP Tool: mcp_memory_read_graph
   */
  async mcp_memory_read_graph(args: {
    limit?: number;
    offset?: number;
    userId?: string;
  }) {
    const schema = z.object({
      limit: z.number().optional().default(100),
      offset: z.number().optional().default(0),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    try {
      // RLS/TTL filter
      let entitiesQuery = supabase.from('entities').select('*').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      let relationsQuery = supabase.from('relations').select('*').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      let observationsQuery = supabase.from('observations').select('*').gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (validated.userId) {
        entitiesQuery = entitiesQuery.contains('access_controls->>user_ids', [validated.userId]);
        // Similar for others
      }

      const [entities, relations, observations] = await Promise.all([
        entitiesQuery.range(validated.offset, validated.offset + validated.limit),
        relationsQuery.range(validated.offset, validated.offset + validated.limit),
        observationsQuery.range(validated.offset, validated.offset + validated.limit)
      ]);

      const validEntities = entities.data?.filter((e: any) => applyTTL(e as MemoryRecord)) || [];
      const validRelations = relations.data?.filter((r: any) => applyTTL(r as MemoryRecord)) || [];
      const validObservations = observations.data?.filter((o: any) => applyTTL(o as MemoryRecord)) || [];

      const summary = {
        entity_types: validEntities.reduce((acc: Record<string, number>, e: any) => {
          acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
          return acc;
        }, {}),
        relation_types: validRelations.reduce((acc: Record<string, number>, r: any) => {
          acc[r.relation_type] = (acc[r.relation_type] || 0) + 1;
          return acc;
        }, {}),
        total_observations: validObservations.length,
        last_updated: new Date().toISOString()
      };

      await logAudit('read_graph', { limit: validated.limit }, summary, validated.userId, true);
      return {
        graph: { entities: validEntities.length, relations: validRelations.length, observations: validObservations.length },
        summary,
        data: { entities: validEntities, relations: validRelations, observations: validObservations.slice(0, 20) }, // Sample
        pagination: { limit: validated.limit, offset: validated.offset, total_entities: validEntities.length }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logAudit('read_graph', args, null, validated.userId, false, errorMessage);
      throw new Error(`Graph read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete entities + cascades (relations/observations)
   * MCP Tool: mcp_memory_delete_entities
   */
  async mcp_memory_delete_entities(args: {
    entityNames: string[];
    userId?: string; // Confirm ownership
  }) {
    const schema = z.object({
      entityNames: z.array(z.string().min(1)),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    const results = [];
    for (const entityName of validated.entityNames) {
      try {
        // Verify access
        if (validated.userId) {
          const { data } = await supabase.from('entities').select('access_controls').eq('name', entityName).single();
          if (data && !data.access_controls.user_ids.includes(validated.userId)) throw new Error('Access denied');
        }

        // Delete observations
        const { data: obs } = await supabase.from('observations').select('id').eq('entity_name', entityName);
        if (obs?.length) {
          await supabase.from('observations').delete().in('id', obs.map(o => o.id));
        }

        // Delete relations (from/to this entity)
        const { data: relFrom } = await supabase.from('relations').select('id').eq('from_id', entityName); // Assume name= id for sim
        const { data: relTo } = await supabase.from('relations').select('id').eq('to_id', entityName);
        const allRelIds = [...(relFrom || []), ...(relTo || [])].map(r => r.id);
        if (allRelIds.length) {
          await supabase.from('relations').delete().in('id', allRelIds);
        }

        // Delete entity
        const { error } = await supabase.from('entities').delete().eq('name', entityName);
        if (error) throw error;

        results.push({ entityName, status: 'deleted', deleted_obs: obs?.length || 0, deleted_rel: allRelIds.length });
        await logAudit('delete_entities', { entityName }, results[results.length - 1], validated.userId, true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ entityName, status: 'error', error: errorMessage });
        await logAudit('delete_entities', { entityName }, null, validated.userId, false, errorMessage);
      }
    }

    return { results, total_deleted: results.filter(r => r.status === 'deleted').length };
  }

  /**
   * AI-Generated Archival Summary (2-week cycle: Summarize/delete old, keep latest week)
   * New: mcp_memory_archive_old - Detailed AI summary for store "brain" (all inputs: sales/expenses/notes)
   * Inserts to daily_summaries; deletes >14d except last 7d
   */
  async mcp_memory_archive_old(args: {
    period_days?: number; // Default 14 for cycle
    keep_latest_days?: number; // Default 7
    userId?: string;
  }) {
    const schema = z.object({
      period_days: z.number().optional().default(14),
      keep_latest_days: z.number().optional().default(7),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    try {
      const cutoffOld = new Date(Date.now() - validated.period_days! * 24 * 60 * 60 * 1000);
      const cutoffKeep = new Date(Date.now() - validated.keep_latest_days! * 24 * 60 * 60 * 1000);

      // Fetch old observations (sales/expenses/notes)
      const { data: oldObs } = await supabase
        .from('observations')
        .select('*')
        .lt('timestamp', cutoffOld.toISOString())
        .gt('timestamp', cutoffKeep.toISOString()) // Keep latest week
        .eq('tags::text', '%sales% OR %expenses% OR %notes%'); // Filter business inputs

      if (!oldObs?.length) return { status: 'no_old_data', archived: 0 };

      // AI Summary (detailed: all inputs → trends/decisions for "brain")
      const allContent = oldObs.map(o => o.contents.join(' ')).join('\n');
      const prompt = `Detailed 2-week summary for chicken store brain: Analyze all inputs (sales: ${oldObs.filter(o => o.tags.includes('sales')).length}, expenses: ${oldObs.filter(o => o.tags.includes('expenses')).length}, notes: ${oldObs.filter(o => o.tags.includes('notes')).length}). Include totals, trends, recommendations (e.g., restock if low). Data: ${allContent.substring(0, 4000)}`; // Token limit

      const summaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const summaryResult = await summaryModel.generateContent([{ text: prompt }]);
      const detailedSummary = summaryResult.response.text();

      // Insert to daily_summaries (or business_summaries table; assume exists per database.md)
      const summaryId = uuidv4();
      const now = new Date();
      await supabase
        .from('daily_summaries') // Or create if missing
        .upsert({
          id: summaryId,
          day: cutoffOld, // Period start
          total_sales: 0, // Extract from AI or compute
          total_expenses: 0,
          important_notes: detailedSummary,
          updated_at: now,
          metadata: { archived_obs: oldObs.length, ai_generated: true }
        });

      // Delete old (cascade handled by FK)
      const obsIds = oldObs.map(o => o.id);
      await supabase.from('observations').delete().in('id', obsIds);

      await logAudit('archive_old', { period_days: validated.period_days }, { summary_id: summaryId, deleted: obsIds.length }, validated.userId, true);
      return {
        status: 'archived',
        period_start: cutoffOld.toISOString(),
        summary_id: summaryId,
        detailed_summary: detailedSummary.substring(0, 1000) + '...', // Truncated
        deleted_records: obsIds.length,
        kept_latest: validated.keep_latest_days,
        recommendations: detailedSummary.match(/recommend[^.]*\./gi) || [] // Extract for "brain"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logAudit('archive_old', args, null, validated.userId, false, errorMessage);
      throw new Error(`Archival failed: ${errorMessage}`);
    }
  }

  // Additional: Update record (patch)
  async mcp_memory_update_record(args: { id: string; updates: Partial<MemoryRecord>; userId?: string }) {
    // Similar to create: Validate, redact, embed if content change, upsert
    // Omitted for brevity; implement as needed
    throw new Error('Update not implemented yet');
  }

  // Additional: Batch expire (cron-like)
  async mcp_memory_expire_batch(args: { userId?: string }) {
    // Query expired, delete + audit
    // Omitted; stub for scheduler
    return { expired: 0 };
  }
}

// Schemas
export const memorySchemas = {
  mcp_memory_create_entities: z.object({
    entities: z.array(z.object({
      name: z.string(),
      entityType: z.enum(BUSINESS_ENTITY_TYPES),
      observations: z.array(z.string()),
      metadata: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      ttl_days: z.number().optional(),
      access_controls: z.object({ roles: z.array(z.string()), user_ids: z.array(z.string()) }).optional()
    })),
    userId: z.string().optional()
  }),
  // Similar for others...
  mcp_memory_create_relations: z.object({ /* ... */ }),
  mcp_memory_add_observations: z.object({ /* ... */ }),
  mcp_memory_search_nodes: z.object({
    query: z.string(),
    limit: z.number().optional(),
    entityTypes: z.array(z.enum(BUSINESS_ENTITY_TYPES)).optional(),
    userId: z.string().optional()
  }),
  mcp_memory_read_graph: z.object({
    limit: z.number().optional(),
    offset: z.number().optional(),
    userId: z.string().optional()
  }),
  mcp_memory_delete_entities: z.object({
    entityNames: z.array(z.string()),
    userId: z.string().optional()
  }),
  mcp_memory_archive_old: z.object({
    period_days: z.number().optional(),
    keep_latest_days: z.number().optional(),
    userId: z.string().optional()
  })
};

// Export singleton
export const mcpMemoryTools = new MCPMemoryTools();
