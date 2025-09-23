/**
 * Production-Ready MCP Server with Gen AI SDK Integration
 * Comprehensive implementation for Charnoks chicken business intelligence
 */

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import AdvancedGeminiProxy from './advanced-gemini-proxy.js';
import { aiStoreAdvisor } from './services/aiStoreAdvisor';
import { aiObserver } from './services/aiObserver';
import { parseStockNote } from './services/geminiService';
import { chickenBusinessAI } from './services/chickenBusinessAI';
import { embeddingService } from './services/embeddingService';
import jwt from 'jsonwebtoken';
import { rateLimitMiddleware } from '../services/rateLimitService'; // New import
import WebSocket from 'ws';
import http from 'http';
import { migrate } from './migrate';
const cluster = require('cluster');

// Load environment variables
dotenv.config();

// Types for enhanced functionality
interface ChickenBusinessNote {
  id?: string;
  local_uuid?: string;
  branch_id: string;
  author_id: string;
  content: string;
  parsed?: any;
  status: 'pending' | 'parsed' | 'confirmed' | 'synced';
  created_at?: string;
}

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  anonKey?: string;
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  implementation: (args: any, context: RequestContext) => Promise<any>;
}

interface RequestContext {
  userId?: string;
  requestId: string;
  userRole?: string;
  branchId?: string;
}

class EnhancedSupabaseClient {
  private client: SupabaseClient;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false },
      db: {
        schema: 'public'
      }
    });
  }

  /**
   * Get the Supabase client for memory operations
   */
  get memoryClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Enhanced note parsing with embedding generation
   */
  async parseNote(
    note: ChickenBusinessNote, 
    geminiProxy: AdvancedGeminiProxy
  ): Promise<{
    note_id: string;
    parsed: any;
    embedding_id?: string;
    status: string;
  }> {
    try {
      // Insert note with pending status
      const { data: noteData, error: noteError } = await this.client
        .from('notes')
        .insert({
          id: uuidv4(),
          local_uuid: note.local_uuid,
          branch_id: note.branch_id,
          author_id: note.author_id,
          content: note.content,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Generate embedding
      const embeddingResult = await geminiProxy.generateEmbeddings([note.content], {
        userId: note.author_id,
        requestId: `embed_${noteData.id}`
      });

      const embedding = embeddingResult.embeddings[0];

      // Store embedding
      const { data: embeddingData, error: embeddingError } = await this.client
        .from('note_embeddings')
        .insert({
          id: uuidv4(),
          note_id: noteData.id,
          embedding: embedding,
          model_used: 'text-embedding-004',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (embeddingError) console.warn('Embedding storage failed:', embeddingError);

      // Parse content with AI
      const parsePrompt = `Parse this chicken business note into structured JSON:

Content: "${note.content}"
Branch ID: ${note.branch_id}

Extract and structure:
1. Purchases: [{item, quantity, unit_price, total_cost, supplier, date}]
2. Sales: [{product, quantity, unit_price, total_revenue, customer, date}]
3. Inventory Changes: [{item, change_type, quantity, reason, location}]
4. Expenses: [{category, amount, description, date, receipt_number}]
5. Stock Observations: [{item, current_stock, notes, concerns}]
6. Feed Usage: [{feed_type, quantity_used, remaining_stock}]
7. Health Notes: [{observation, affected_count, action_taken}]
8. Financial Summary: {total_income, total_expenses, net_change}
9. Action Items: [string] (follow-up tasks)
10. Quality Notes: [string] (observations about product quality)

Return valid JSON only. Be precise with numbers, dates, and classifications.`;

      const parseResult = await geminiProxy.generateText(parsePrompt, {
        taskType: {
          complexity: 'medium',
          type: 'analysis',
          priority: 'medium'
        },
        temperature: 0.2,
        maxOutputTokens: 3000,
        userId: note.author_id,
        requestId: `parse_${noteData.id}`
      });

      let parsed;
      try {
        parsed = JSON.parse(parseResult.text);
      } catch (parseError) {
        // If JSON parsing fails, create structured response
        parsed = {
          raw_content: note.content,
          ai_analysis: parseResult.text,
          parsing_error: 'Could not parse as structured JSON',
          suggestions: 'Manual review required'
        };
      }

      // Update note with parsed content
      const { error: updateError } = await this.client
        .from('notes')
        .update({
          parsed: parsed,
          status: 'parsed',
          updated_at: new Date().toISOString()
        })
        .eq('id', noteData.id);

      if (updateError) throw updateError;

      return {
        note_id: noteData.id,
        parsed: parsed,
        embedding_id: embeddingData?.id,
        status: 'parsed'
      };

    } catch (error) {
      console.error('Note parsing failed:', error);
      throw new Error(`Note parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Intelligent note search using embeddings
   */
  async searchSimilarNotes(
    query: string,
    options: {
      branchId?: string;
      limit?: number;
      threshold?: number;
      userId?: string;
    } = {}
  ): Promise<Array<{
    id: string;
    content: string;
    parsed: any;
    similarity: number;
    created_at: string;
  }>> {
    try {
      // This would use a stored procedure for vector similarity search
      // For now, we'll use a simplified text-based search
      const { data, error } = await this.client
        .rpc('search_notes_by_content', {
          search_query: query,
          branch_filter: options.branchId,
          result_limit: options.limit || 5
        });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Similar notes search failed:', error);
      return [];
    }
  }

  /**
   * Generate business summary report
   */
  async generateBusinessSummary(
    branchId: string,
    dateRange: { from: string; to: string },
    geminiProxy: AdvancedGeminiProxy,
    userId?: string
  ): Promise<any> {
    try {
      // Fetch relevant data
      const { data: notes, error: notesError } = await this.client
        .from('notes')
        .select('*')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .eq('status', 'parsed');

      if (notesError) throw notesError;

      const { data: operations, error: opsError } = await this.client
        .from('operations')
        .select('*')
        .eq('branch_id', branchId)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to);

      if (opsError) console.warn('Operations fetch failed:', opsError);

      // Aggregate data for AI analysis
      const summary_data = {
        notes_count: notes?.length || 0,
        operations_count: operations?.length || 0,
        notes: notes?.map(n => ({
          content: n.content?.substring(0, 200),
          parsed: n.parsed,
          date: n.created_at
        })) || [],
        operations: operations?.map(o => ({
          type: o.operation_type,
          details: o.operation_details,
          date: o.created_at
        })) || []
      };

      // Generate AI summary
      const summaryPrompt = `Generate a comprehensive business analysis report for this chicken business branch.

Date Range: ${dateRange.from} to ${dateRange.to}
Branch ID: ${branchId}

Data Summary:
${JSON.stringify(summary_data, null, 2)}

Provide analysis including:
1. Executive Summary
2. Financial Performance
   - Revenue trends
   - Expense analysis
   - Profit margins
   - Cost per unit analysis
3. Operational Insights
   - Production efficiency
   - Inventory management
   - Feed consumption patterns
   - Health incidents
4. Market Analysis
   - Sales patterns
   - Customer behavior
   - Pricing trends
5. Risk Assessment
   - Operational risks
   - Financial risks
   - Health/safety concerns
6. Recommendations
   - Short-term actions
   - Long-term strategic advice
   - Cost optimization opportunities
7. Key Performance Indicators
   - Production metrics
   - Financial ratios
   - Efficiency indicators

Format as a structured business report with clear sections and actionable insights.`;

      const summaryResult = await geminiProxy.generateText(summaryPrompt, {
        taskType: {
          complexity: 'complex',
          type: 'analysis',
          priority: 'high'
        },
        temperature: 0.1,
        maxOutputTokens: 4000,
        userId,
        requestId: `summary_${branchId}_${Date.now()}`
      });

      // Store summary
      const { data: summaryData, error: summaryError } = await this.client
        .from('summaries')
        .insert({
          id: uuidv4(),
          branch_id: branchId,
          summary_type: 'business_analysis',
          date_from: dateRange.from,
          date_to: dateRange.to,
          content: summaryResult.text,
          metadata: {
            notes_analyzed: notes?.length || 0,
            operations_analyzed: operations?.length || 0,
            generated_by: 'ai_assistant',
            model_used: summaryResult.model
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (summaryError) console.warn('Summary storage failed:', summaryError);

      return {
        summary: summaryResult.text,
        metadata: {
          summary_id: summaryData?.id,
          data_points: {
            notes: notes?.length || 0,
            operations: operations?.length || 0
          },
          date_range: dateRange,
          processing_time: summaryResult.metadata.processingTime
        }
      };

    } catch (error) {
      throw new Error(`Business summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Batch sync operations
   */
  async syncOperations(
    operations: Array<{
      local_uuid: string;
      operation_type: string;
      operation_details: any;
      branch_id: string;
      author_id: string;
    }>,
    userId?: string
  ): Promise<Array<{
    local_uuid: string;
    status: 'success' | 'error';
    server_id?: string;
    error?: string;
  }>> {
    const results = [];

    for (const operation of operations) {
      try {
        const { data, error } = await this.client
          .from('operations')
          .upsert({
            id: uuidv4(),
            local_uuid: operation.local_uuid,
            operation_type: operation.operation_type,
            operation_details: operation.operation_details,
            branch_id: operation.branch_id,
            author_id: operation.author_id,
            synced_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        results.push({
          local_uuid: operation.local_uuid,
          status: 'success' as const,
          server_id: data.id
        });

      } catch (error) {
        results.push({
          local_uuid: operation.local_uuid,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  async getClient(): Promise<SupabaseClient> {
    return this.client;
  }
}

function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers['mcp-auth-token'];
  if (!authHeader) return res.status(401).json({ error: { code: 401, message: 'No token provided' } });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const JWT_SECRET = process.env.JWT_SECRET || process.env.MCP_AUTH_TOKEN || 'fallback-secret';
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch (err) {
    res.status(403).json({ error: { code: 403, message: 'Invalid token', details: (err as Error).message } });
  }
}

class ProductionMCPServer {
  private app: express.Application = express();
  private geminiProxy!: AdvancedGeminiProxy;
  private supabaseClient!: EnhancedSupabaseClient;
  private mcpServer!: Server;
  private tools: Map<string, MCPToolDefinition> = new Map();
  private wss!: WebSocket.Server;
  private streamBuffers = new Map<string, {chunks: string[], timeout: NodeJS.Timeout}>(); // Per streamId

  constructor() {
    this.validateEnvironment();
    this.initializeServices();
    // Migrate DB on init
    migrate().then((result) => {
      if (!result.success) {
        console.warn('DB Migration warning:', result.message);
      } else {
        console.log('DB Migration successful');
      }
    }).catch((err) => {
      console.error('DB Migration error:', err);
    });
    this.setupExpress();
    this.setupSecurity(); // New call
    this.setupMCP();
    this.registerTools();
  }

  private validateEnvironment(): void {
    const required = [
      'GEMINI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
  }

  private initializeServices(): void {
    this.geminiProxy = new AdvancedGeminiProxy();
    this.supabaseClient = new EnhancedSupabaseClient({
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
    });
    this.tools = new Map();
  }

  private setupExpress(): void {
    this.app = express();

    // Middleware
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-MCP-Token']
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use('/api/', rateLimit({
      windowMs: 60 * 1000,
      max: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '50'),
      message: { error: 'Rate limit exceeded' }
    }));

    // Request tracking
    this.app.use((req, res, next) => {
      req.requestId = req.headers['x-request-id'] as string || uuidv4();
      req.startTime = Date.now();
      next();
    });

    this.setupRoutes();
  }

  private setupSecurity(): void {
    const JWT_SECRET = process.env.JWT_SECRET || process.env.MCP_AUTH_TOKEN || 'fallback-secret';

    // /auth endpoint
    this.app.post('/auth', (req: Request, res: Response) => {
      const { token } = req.body;
      if (token !== process.env.MCP_AUTH_TOKEN) {
        return res.status(401).json({ error: { code: 401, message: 'Invalid token' } });
      }
      const payload = { userId: 'default', role: 'owner', branch: 'main' };
      const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: jwtToken });
    });

    // Middleware chain for /api/tools
    this.app.use('/api/tools', authenticateJWT, rateLimitMiddleware);
  }

  private setupMCP(): void {
    this.mcpServer = new Server(
      {
        name: 'charnoks-production-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  private registerTools(): void {
    // Parse chicken business note
    this.registerTool({
      name: 'parse_chicken_note',
      description: 'Parse and analyze chicken business notes with AI-powered extraction',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Note content to parse' },
          branch_id: { type: 'string', description: 'Branch identifier' },
          author_id: { type: 'string', description: 'Author user ID' },
          local_uuid: { type: 'string', description: 'Local UUID for tracking' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' }
        },
        required: ['content', 'branch_id', 'author_id']
      },
      implementation: async (args, context) => {
        const note: ChickenBusinessNote = {
          local_uuid: args.local_uuid || uuidv4(),
          branch_id: args.branch_id,
          author_id: args.author_id,
          content: args.content,
          status: 'pending'
        };

        // Use parseStockNote for structured parsing
        const parsed = await parseStockNote(note.content);

        // Save parsed note
        const { data: noteData, error: noteError } = await this.supabaseClient.memoryClient
          .from('notes')
          .insert({
            ...note,
            parsed_data: parsed,
            status: 'parsed'
          })
          .select()
          .single();

        if (noteError) throw noteError;

        return {
          success: true,
          note_id: noteData.id,
          parsed_data: parsed,
          message: 'Note parsed successfully with AI'
        };
      }
    });

    // Generate business analysis
    this.registerTool({
      name: 'generate_business_analysis',
      description: 'Generate comprehensive business analysis reports',
      inputSchema: {
        type: 'object',
        properties: {
          branch_id: { type: 'string', description: 'Branch to analyze' },
          date_from: { type: 'string', description: 'Start date (ISO format)' },
          date_to: { type: 'string', description: 'End date (ISO format)' },
          analysis_type: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
        },
        required: ['branch_id', 'date_from', 'date_to']
      },
      implementation: async (args, context) => {
        return await this.supabaseClient.generateBusinessSummary(
          args.branch_id,
          { from: args.date_from, to: args.date_to },
          this.geminiProxy,
          context.userId
        );
      }
    });

    // Search similar notes
    this.registerTool({
      name: 'search_similar_notes',
      description: 'Search for similar notes using AI-powered semantic search',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          branch_id: { type: 'string', description: 'Optional branch filter' },
          limit: { type: 'number', default: 5, description: 'Maximum results' }
        },
        required: ['query']
      },
      implementation: async (args, context) => {
        return await this.supabaseClient.searchSimilarNotes(args.query, {
          branchId: args.branch_id,
          limit: args.limit,
          userId: context.userId
        });
      }
    });

    // Sync operations
    this.registerTool({
      name: 'sync_operations',
      description: 'Batch sync operations from local storage to server',
      inputSchema: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                local_uuid: { type: 'string' },
                operation_type: { type: 'string' },
                operation_details: { type: 'object' },
                branch_id: { type: 'string' },
                author_id: { type: 'string' }
              },
              required: ['local_uuid', 'operation_type', 'operation_details', 'branch_id', 'author_id']
            }
          }
        },
        required: ['operations']
      },
      implementation: async (args, context) => {
        return await this.supabaseClient.syncOperations(args.operations, context.userId);
      }
    });

    // Generate embeddings
    this.registerTool({
      name: 'generate_embeddings',
      description: 'Generate embeddings for text content',
      inputSchema: {
        type: 'object',
        properties: {
          texts: { type: 'array', items: { type: 'string' }, description: 'Texts to embed' },
          batch_size: { type: 'number', default: 10, description: 'Processing batch size' }
        },
        required: ['texts']
      },
      implementation: async (args, context) => {
        return await this.geminiProxy.generateEmbeddings(args.texts, {
          batchSize: args.batch_size,
          userId: context.userId,
          requestId: context.requestId
        });
      }
    });

    // Batch AI processing
    this.registerTool({
      name: 'batch_ai_processing',
      description: 'Process multiple AI requests in batch with load balancing',
      inputSchema: {
        type: 'object',
        properties: {
          requests: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                task_type: { 
                  type: 'object',
                  properties: {
                    complexity: { type: 'string', enum: ['simple', 'medium', 'complex'] },
                    type: { type: 'string', enum: ['text', 'code', 'analysis', 'reasoning'] },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'] }
                  }
                },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['prompt']
            }
          },
          max_concurrency: { type: 'number', default: 3 }
        },
        required: ['requests']
      },
      implementation: async (args, context) => {
        return await this.geminiProxy.batchProcess(args.requests, {
          maxConcurrency: args.max_concurrency,
          userId: context.userId,
          requestId: context.requestId
        });
      }
    });

    // Business Memory Tools
    this.registerTool({
      name: 'store_business_entity',
      description: 'Store business entities (suppliers, customers, workers, branches, products) in memory',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Entity name' },
          entityType: { 
            type: 'string', 
            enum: ['supplier', 'customer', 'worker', 'branch', 'product', 'business_period'],
            description: 'Type of business entity'
          },
          attributes: { 
            type: 'object', 
            description: 'Additional entity attributes',
            additionalProperties: true
          }
        },
        required: ['name', 'entityType']
      },
      implementation: async (args, context) => {
        // Store entity in Supabase business_entities table
        const { data, error } = await this.supabaseClient.memoryClient
          .from('business_entities')
          .upsert({
            name: args.name,
            entity_type: args.entityType,
            attributes: args.attributes || {},
            created_by: context.userId,
            last_updated: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to store business entity: ${error.message}`);
        }

        return {
          success: true,
          entity_id: data.id,
          message: `Successfully stored ${args.entityType}: ${args.name}`
        };
      }
    });

    this.registerTool({
      name: 'create_business_relation',
      description: 'Create relationships between business entities',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source entity name' },
          to: { type: 'string', description: 'Target entity name' },
          relationType: { type: 'string', description: 'Type of relationship (e.g., supplies, processes_into, works_at)' },
          metadata: { 
            type: 'object', 
            description: 'Additional relationship metadata',
            additionalProperties: true
          }
        },
        required: ['from', 'to', 'relationType']
      },
      implementation: async (args, context) => {
        // Store relation in Supabase business_relations table
        const { data, error } = await this.supabaseClient.memoryClient
          .from('business_relations')
          .insert({
            from_entity: args.from,
            to_entity: args.to,
            relation_type: args.relationType,
            metadata: args.metadata || {},
            created_by: context.userId,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create business relation: ${error.message}`);
        }

        return {
          success: true,
          relation_id: data.id,
          message: `Successfully created relation: ${args.from} --${args.relationType}--> ${args.to}`
        };
      }
    });

    this.registerTool({
      name: 'add_business_observation',
      description: 'Add observations about business entities for learning',
      inputSchema: {
        type: 'object',
        properties: {
          entityName: { type: 'string', description: 'Name of the entity being observed' },
          observation: { type: 'string', description: 'The observation text' },
          confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence level (0-1)' },
          source: { 
            type: 'string', 
            enum: ['ai_learning', 'user_input', 'system_analysis'],
            description: 'Source of the observation'
          }
        },
        required: ['entityName', 'observation', 'source']
      },
      implementation: async (args, context) => {
        // Store observation in Supabase business_observations table
        const { data, error } = await this.supabaseClient.memoryClient
          .from('business_observations')
          .insert({
            entity_name: args.entityName,
            observation: args.observation,
            confidence: args.confidence || 1.0,
            source: args.source,
            created_by: context.userId,
            timestamp: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to add business observation: ${error.message}`);
        }

        return {
          success: true,
          observation_id: data.id,
          message: `Successfully added observation for ${args.entityName}`
        };
      }
    });

    this.registerTool({
      name: 'search_business_context',
      description: 'Search memory for relevant business context',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          entityTypes: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Filter by entity types'
          },
          limit: { type: 'number', default: 10, description: 'Maximum results' }
        },
        required: ['query']
      },
      implementation: async (args, context) => {
        // Search across entities, relations, and observations
        const searchResults: {
          entities: any[];
          relations: any[];
          observations: any[];
        } = {
          entities: [],
          relations: [],
          observations: []
        };

        // Search entities
        let entityQuery = this.supabaseClient.memoryClient
          .from('business_entities')
          .select('*')
          .or(`name.ilike.%${args.query}%,attributes->>description.ilike.%${args.query}%`)
          .limit(args.limit || 10);

        if (args.entityTypes && args.entityTypes.length > 0) {
          entityQuery = entityQuery.in('entity_type', args.entityTypes);
        }

        const { data: entities } = await entityQuery;
        searchResults.entities = entities || [];

        // Search relations
        const { data: relations } = await this.supabaseClient.memoryClient
          .from('business_relations')
          .select('*')
          .or(`from_entity.ilike.%${args.query}%,to_entity.ilike.%${args.query}%,relation_type.ilike.%${args.query}%`)
          .limit(args.limit || 10);

        searchResults.relations = relations || [];

        // Search observations
        const { data: observations } = await this.supabaseClient.memoryClient
          .from('business_observations')
          .select('*')
          .or(`entity_name.ilike.%${args.query}%,observation.ilike.%${args.query}%`)
          .order('timestamp', { ascending: false })
          .limit(args.limit || 10);

        searchResults.observations = observations || [];

        // Enhance with embeddings
        const similar = await embeddingService.searchSimilar(args.query, args.limit || 10);
        searchResults.embeddings = similar;

        return {
          success: true,
          query: args.query,
          results: searchResults,
          total_found: searchResults.entities.length + searchResults.relations.length + searchResults.observations.length + similar.length
        };
      }
    });

    this.registerTool({
      name: 'learn_from_pattern',
      description: 'Learn from chicken business patterns and store knowledge',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'object',
            properties: {
              business_type: { 
                type: 'string',
                enum: ['purchase', 'processing', 'distribution', 'cooking', 'sales', 'general']
              },
              confidence_score: { type: 'number', minimum: 0, maximum: 1 },
              learned_patterns: { 
                type: 'object',
                additionalProperties: true
              }
            },
            required: ['business_type', 'confidence_score', 'learned_patterns']
          },
          noteText: { type: 'string', description: 'Original note text for context' }
        },
        required: ['pattern']
      },
      implementation: async (args, context) => {
        const pattern = args.pattern;
        const results = [];

        // Use chickenBusinessAI to learn
        await chickenBusinessAI.learnPattern(pattern);

        // Store supplier information
        if (pattern.learned_patterns.supplier) {
          const entityResult = await this.tools.get('store_business_entity')?.implementation({
            name: `${pattern.learned_patterns.supplier}_Supplier`,
            entityType: 'supplier',
            attributes: {
              cost_per_bag: pattern.learned_patterns.cost_per_bag,
              source: 'ai_learning'
            }
          }, context);
          results.push(entityResult);

          // Add observation about cost
          if (pattern.learned_patterns.cost_per_bag) {
            const obsResult = await this.tools.get('add_business_observation')?.implementation({
              entityName: `${pattern.learned_patterns.supplier}_Supplier`,
              observation: `Cost per bag: ${pattern.learned_patterns.cost_per_bag} pesos`,
              source: 'ai_learning',
              confidence: pattern.confidence_score
            }, context);
            results.push(obsResult);
          }
        }

        // Store worker information
        if (pattern.learned_patterns.worker_mentioned) {
          const entityResult = await this.tools.get('store_business_entity')?.implementation({
            name: `Worker_${pattern.learned_patterns.worker_mentioned}`,
            entityType: 'worker',
            attributes: { source: 'ai_learning' }
          }, context);
          results.push(entityResult);

          const obsResult = await this.tools.get('add_business_observation')?.implementation({
            entityName: `Worker_${pattern.learned_patterns.worker_mentioned}`,
            observation: `Involved in ${pattern.business_type} operation`,
            source: 'ai_learning',
            confidence: pattern.confidence_score
          }, context);
          results.push(obsResult);
        }

        // Store branch information
        if (pattern.learned_patterns.branch_mentioned) {
          const entityResult = await this.tools.get('store_business_entity')?.implementation({
            name: `Branch_${pattern.learned_patterns.branch_mentioned}`,
            entityType: 'branch',
            attributes: { source: 'ai_learning' }
          }, context);
          results.push(entityResult);
        }

        // Store general business operation observation
        const generalObsResult = await this.tools.get('add_business_observation')?.implementation({
          entityName: 'Business_Operations',
          observation: `${pattern.business_type} operation completed with confidence ${pattern.confidence_score}`,
          source: 'ai_learning',
          confidence: pattern.confidence_score
        }, context);
        results.push(generalObsResult);

        return {
          success: true,
          pattern_type: pattern.business_type,
          learning_results: results,
          message: `Learned pattern using chickenBusinessAI`
        };
      }
    });

    this.registerTool({
      name: 'initialize_business_knowledge',
      description: 'Initialize basic business knowledge graph with common entities and relationships',
      inputSchema: {
        type: 'object',
        properties: {
          force_reset: { type: 'boolean', default: false, description: 'Force reset existing knowledge' }
        }
      },
      implementation: async (args, context) => {
        const results = [];

        // Core suppliers
        const suppliers = [
          {
            name: 'Magnolia_Supplier',
            entityType: 'supplier',
            attributes: {
              delivery_schedule: 'Tuesday and Friday',
              product_type: 'whole_chickens',
              units_per_bag: 10,
              typical_price: 1200,
              reliability: 'high'
            }
          },
          {
            name: 'San_Miguel_Supplier',
            entityType: 'supplier',
            attributes: {
              product_type: 'whole_chickens',
              reliability: 'medium'
            }
          }
        ];

        // Core products
        const products = [
          {
            name: 'Whole_Chicken',
            entityType: 'product',
            attributes: {
              unit: 'piece',
              typical_bag_size: 10
            }
          },
          {
            name: 'Chicken_Parts',
            entityType: 'product',
            attributes: {
              unit: 'piece',
              derived_from: 'whole_chicken'
            }
          },
          {
            name: 'Chicken_Necks',
            entityType: 'product',
            attributes: {
              unit: 'piece',
              derived_from: 'whole_chicken'
            }
          }
        ];

        // Store entities
        for (const entity of [...suppliers, ...products]) {
          const result = await this.tools.get('store_business_entity')?.implementation(entity, context);
          if (result) results.push(result);
        }

        // Create relationships
        const relations = [
          {
            from: 'Magnolia_Supplier',
            to: 'Whole_Chicken',
            relationType: 'supplies'
          },
          {
            from: 'Whole_Chicken',
            to: 'Chicken_Parts',
            relationType: 'processes_into'
          },
          {
            from: 'Whole_Chicken',
            to: 'Chicken_Necks',
            relationType: 'processes_into'
          }
        ];

        for (const relation of relations) {
          const result = await this.tools.get('create_business_relation')?.implementation(relation, context);
          if (result) results.push(result);
        }

        return {
          success: true,
          initialized_entities: suppliers.length + products.length,
          initialized_relations: relations.length,
          results: results,
          message: 'Successfully initialized basic business knowledge graph'
        };
      }
    });

    // Add new tool: Get business advice
    this.registerTool({
      name: 'get_business_advice',
      description: 'Get AI-powered business advice for owner or worker',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Specific business question' },
          userRole: { type: 'string', enum: ['owner', 'worker'], description: 'User role' },
          context: { type: 'object', description: 'Optional business context' }
        },
        required: ['question', 'userRole']
      },
      implementation: async (args, context) => {
        const advice = await aiStoreAdvisor.getBusinessAdvice(args.userRole, args.question, args.context);
        return {
          advice: advice.advice,
          recommendations: advice.contextual_recommendations,
          confidence: advice.confidence
        };
      }
    });

    // Add new tool: Analyze sales data
    this.registerTool({
      name: 'analyze_sales_data',
      description: 'Analyze sales data and generate performance insights',
      inputSchema: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
          includeInsights: { type: 'boolean', default: true },
          includeRecommendations: { type: 'boolean', default: true },
          salesData: { type: 'array', items: { type: 'object' }, description: 'Optional sales data' }
        },
        required: ['timeframe']
      },
      implementation: async (args, context) => {
        const analysis = await aiObserver.analyzeBusinessPerformance(
          args.timeframe,
          args.includeInsights,
          args.includeRecommendations
        );
        return analysis;
      }
    });

    // Add note_collection tool for Part A workflow
    this.registerTool({
      name: 'note_collection',
      description: 'Collect and save chicken business notes from owner or worker',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Note content' },
          userRole: { type: 'string', enum: ['owner', 'worker'], description: 'User role' },
          branchId: { type: 'string', description: 'Optional branch ID' },
          local_uuid: { type: 'string', description: 'Optional local UUID' }
        },
        required: ['content', 'userRole']
      },
      implementation: async (args, context) => {
        const note: ChickenBusinessNote = {
          local_uuid: args.local_uuid || uuidv4(),
          branch_id: args.branchId || 'main',
          author_id: context.userId || 'anonymous',
          content: args.content,
          status: 'pending'
        };

        const { data, error } = await this.supabaseClient.memoryClient
          .from('notes')
          .insert(note)
          .select()
          .single();

        if (error) throw new Error(`Failed to save note: ${error.message}`);

        return {
          success: true,
          note_id: data.id,
          message: 'Note collected and saved successfully',
          next_step: 'Use parse_chicken_note tool to analyze this note'
        };
      }
    });

    // In registerTools, add apply_to_stock tool:
    this.registerTool({
      name: 'apply_to_stock',
      description: 'Apply parsed note data to stock, sales, and expenses',
      inputSchema: {
        type: 'object',
        properties: {
          note_id: { type: 'string', description: 'ID of parsed note' },
          dry_run: { type: 'boolean', default: false, description: 'Preview changes without applying' },
          user_id: { type: 'string', description: 'User ID for records' }
        },
        required: ['note_id']
      },
      implementation: async (args, context) => {
        const { data: note, error: noteError } = await this.supabaseClient.memoryClient
          .from('notes')
          .select('*')
          .eq('id', args.note_id)
          .eq('status', 'parsed')
          .single();

        if (noteError || !note) throw new Error('Parsed note not found');

        const parsedData = note.parsed_data;

        if (args.dry_run) {
          // Preview
          return { preview: true, changes: this.calculateStockChanges(parsedData) };
        }

        // Apply purchases
        if (parsedData.purchases) {
          for (const purchase of parsedData.purchases) {
            const { data: product } = await this.supabaseClient.memoryClient
              .from('products')
              .select('*')
              .ilike('name', `%${purchase.product}%`)
              .single();

            if (product) {
              await this.supabaseClient.memoryClient
                .from('products')
                .update({ stock: product.stock + (purchase.bags * (purchase.units_per_bag || 1)) })
                .eq('id', product.id);
            } else {
              await this.supabaseClient.memoryClient
                .from('products')
                .insert({
                  name: purchase.product,
                  price: purchase.unit_price || 50,
                  stock: purchase.bags * (purchase.units_per_bag || 1),
                  category: 'chicken'
                });
            }

            // Record expense
            await this.supabaseClient.memoryClient
              .from('expenses')
              .insert({
                description: `Purchase: ${purchase.bags} bags ${purchase.product}`,
                amount: purchase.total_cost || (purchase.bags * 500),
                category: 'purchases',
                user_id: args.user_id || context.userId
              });
          }
        }

        // Apply sales (similar for cooking/transfers)
        if (parsedData.sales) {
          for (const sale of parsedData.sales) {
            const { data: product } = await this.supabaseClient.memoryClient
              .from('products')
              .select('*')
              .ilike('name', '%chicken%')
              .single();

            if (product && product.stock >= sale.quantity) {
              // Record sale
              await this.supabaseClient.memoryClient
                .from('sales')
                .insert({
                  items: [{ product_id: product.id, quantity: sale.quantity, price: sale.unit_price }],
                  total: sale.total_revenue,
                  payment: sale.total_revenue,
                  worker_id: args.user_id || context.userId
                });

              // Update stock
              await this.supabaseClient.memoryClient
                .from('products')
                .update({ stock: product.stock - sale.quantity })
                .eq('id', product.id);
            }
          }
        }

        // Mark applied
        await this.supabaseClient.memoryClient
          .from('notes')
          .update({ status: 'applied' })
          .eq('id', args.note_id);

        return { success: true, message: 'Stock/sales updated from note' };
      }
    });

    // Helper method (add to class):
    private calculateStockChanges(parsedData: any): any {
      // Preview logic (sum changes)
      return { estimated_stock_change: 0, new_sales: parsedData.sales?.length || 0 };
    }

    // Add new tool: Generate stock forecast
    this.registerTool({
      name: 'forecast_stock',
      description: 'Generate AI-powered stock forecast based on sales history',
      inputSchema: {
        type: 'object',
        properties: {
          salesHistory: { type: 'array', items: { type: 'object' }, description: 'Recent sales data' },
          forecastDays: { type: 'number', default: 7, description: 'Days to forecast' },
          includeConfidence: { type: 'boolean', default: true }
        },
        required: ['salesHistory']
      },
      implementation: async (args, context) => {
        // Use integrated forecast logic (from geminiService)
        const prompt = `Based on sales: ${JSON.stringify(args.salesHistory.slice(0, 30))}, forecast next ${args.forecastDays} days stock needs. Return JSON array [{day: 'Day 1', predictedSales: number, confidence: 0-1}].`;

        const response = await this.geminiProxy.generateText(prompt, {
          model: 'gemini-2.0-flash',
          temperature: 0.5,
          maxOutputTokens: 500,
          taskType: { complexity: 'medium', type: 'forecast', priority: 'high' },
          responseSchema: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, predictedSales: { type: 'number' }, confidence: { type: 'number' } } } }
        });

        const forecast = JSON.parse(response.text);

        return {
          forecast,
          summary: `Predicted total sales: ${forecast.reduce((sum, f) => sum + f.predictedSales, 0).toFixed(2)}`,
          confidence: args.includeConfidence ? forecast.reduce((avg, f) => avg + f.confidence, 0) / forecast.length : undefined
        };
      }
    });

    // Add WebSocket support: Import ws; in start(): Create httpServer = require('http').createServer(app); wss = new WebSocket.Server({ server: httpServer }); wss.on('connection', handleConnection); httpServer.listen(PORT); add handleConnection (ws.on('message', parse JSON {toolName, params}, if 'live_voice_stream' call tool impl with ws for streaming response); registerTool('live_voice_stream', schema {streamId: string, transcriptChunk: string, products?: array}, impl: buffer chunks per streamId, fuzzy via voice_parse, Gemini stream: generateText(prompt with chunk/prior, stream: true, on chunk ws.send({partialParse: ...})); timeout 5s for final structured).
    this.registerTool({
      name: 'live_voice_stream',
      description: 'Stream voice for real-time parsing with fuzzy correction',
      inputSchema: {
        type: 'object',
        properties: {
          streamId: { type: 'string' },
          transcriptChunk: { type: 'string', maxLength: 500 },
          products: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } }
        },
        required: ['streamId', 'transcriptChunk']
      },
      implementation: async (args, context) => {
        // For non-WS calls, buffer single chunk or error
        return { error: { code: 400, message: 'Use WebSocket for streaming' } };
      }
    });

    this.registerTool({
      name: 'query_ai_logs',
      description: 'Aggregate AI audit logs for analytics (usage trends, errors)',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          aggregate: { type: 'string', enum: ['count', 'avg_tokens', 'error_rate'] }
        },
        required: ['from', 'to', 'aggregate']
      },
      implementation: async (args, context) => {
        const { data, error } = await this.supabaseClient.memoryClient
          .from('ai_audit_logs')
          .select('tool_name, count(*), avg(tokens_used)')
          .gte('timestamp', args.from)
          .lte('timestamp', args.to)
          .group('tool_name');
        if (error) throw error;
        const usage = data.reduce((acc, row) => ({ ...acc, [row.tool_name]: row.count }), {});
        const avgTokens = data.reduce((sum, row) => sum + (row.avg || 0), 0) / data.length || 0;
        const errorRate = data.filter(row => row.error).length / data.length || 0;
        return { usage, avgTokens, errorRate: args.aggregate === 'error_rate' ? errorRate : undefined };
      }
    });

    // ...existing private methods...
  }

  private registerTool(tool: MCPToolDefinition): void {
    this.tools.set(tool.name, tool);

    // Register with MCP server
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);

      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        const context: RequestContext = {
          requestId: uuidv4(),
          userId: 'mcp-client' // This would be extracted from request context
        };

        const result = await tool.implementation(args, context);

        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupRoutes(): void {
    // Health check with comprehensive status
    this.app.get('/health', async (req, res) => {
      try {
        const [geminiHealth, supabaseHealth] = await Promise.allSettled([
          this.geminiProxy.healthCheck(),
          (async () => {
            try {
              const client = await this.supabaseClient.getClient();
              await client.from('notes').select('id').limit(1);
              return { status: 'healthy' };
            } catch (error: any) {
              return { status: 'unhealthy', error: error.message };
            }
          })()
        ]);

        const geminiResult = geminiHealth.status === 'fulfilled' ? geminiHealth.value : { overall: 'unhealthy' };
        const supabaseResult = supabaseHealth.status === 'fulfilled' ? supabaseHealth.value : { status: 'unhealthy' };

        const overall = geminiResult.overall === 'healthy' && supabaseResult.status === 'healthy';

        res.status(overall ? 200 : 503).json({
          status: overall ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          uptime: process.uptime(),
          services: {
            gemini: geminiResult,
            supabase: supabaseResult
          },
          models: this.geminiProxy.getModelInfo()
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Health check failed'
        });
      }
    });

    // List available tools
    this.app.get('/api/tools', (req, res) => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      res.json({ tools, count: tools.length });
    });

    // Execute tool
    this.app.post('/api/tools/call', async (req, res) => {
      try {
        const { name, arguments: args } = req.body;
        const tool = this.tools.get(name);

        if (!tool) {
          return res.status(404).json({ error: `Tool not found: ${name}` });
        }

        const context: RequestContext = {
          requestId: req.requestId || 'unknown',
          userId: req.headers['x-user-id'] as string
        };

        const result = await tool.implementation(args, context);

        res.json({
          success: true,
          result,
          metadata: {
            tool: name,
            requestId: context.requestId,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error('Tool execution error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
          requestId: req.requestId
        });
      }
    });

    // Model information
    this.app.get('/api/models', (req, res) => {
      res.json({
        models: this.geminiProxy.getModelInfo(),
        default_selection_strategy: 'intelligent_auto_selection'
      });
    });

    // Error handlers
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId
      });
    });

    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /health',
          'GET /api/tools',
          'POST /api/tools/call',
          'GET /api/models'
        ]
      });
    });
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Production MCP Server...');

      // Validate services
      await this.geminiProxy.healthCheck();
      console.log('✅ Gemini AI service connected');

      const client = await this.supabaseClient.getClient();
      await client.from('notes').select('id').limit(1);
      console.log('✅ Supabase database connected');

      // Start HTTP server
      const PORT = process.env.PORT || 3002;
      const httpServer = http.createServer(this.app);
      this.wss = new WebSocket.Server({ server: httpServer });

      this.wss.on('connection', (ws: WebSocket, req) => {
        console.log('WebSocket connected');
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.toolName === 'live_voice_stream') {
              this.handleStreamMessage(ws, data.params);
            } else {
              ws.send(JSON.stringify({ error: { code: 400, message: 'Invalid tool for WS' } }));
            }
          } catch (err) {
            ws.send(JSON.stringify({ error: { code: 400, message: 'Invalid message' } }));
          }
        });
        ws.on('close', () => console.log('WebSocket disconnected'));
      });

      httpServer.listen(PORT, () => {
        console.log(`🌐 HTTP/WS server listening on port ${PORT}`);
        console.log(`📋 Health: http://localhost:${PORT}/health`);
        console.log(`🛠️  Tools: http://localhost:${PORT}/api/tools`);
        console.log(`🤖 Models: http://localhost:${PORT}/api/models`);
      });

      // Skip stdio MCP in workers (primary only, or share via IPC)
      // For WS sticky sessions, use load balancer (e.g., Heroku router round-robin, or nginx proxy with ip_hash)
      if (cluster.isPrimary) {
        // Start MCP server for stdio transport
        const transport = new StdioServerTransport();
        await this.mcpServer.connect(transport);
        console.log('🔗 MCP server connected via stdio');
      }

      console.log('✅ Production MCP Server is ready!');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private handleStreamMessage(ws: WebSocket, params: {streamId: string, transcriptChunk: string, products?: any[]}) {
    const buffer = this.streamBuffers.get(params.streamId) || { chunks: [], timeout: null };
    buffer.chunks.push(params.transcriptChunk);
    clearTimeout(buffer.timeout);

    // Partial fuzzy parse
    const partialTranscript = buffer.chunks.join(' ');
    const fuzzyResult = this.voiceParseFuzzy(partialTranscript, params.products || []); // Call voice_parse logic
    ws.send(JSON.stringify({ partialParse: fuzzyResult, confidence: 0.7 })); // Example

    // Gemini stream for correction
    const prompt = `Parse ongoing voice transcript: "${partialTranscript}" for chicken sales. Use fuzzy context.`;
    this.geminiProxy.generateText(prompt, { stream: true, maxTokens: 200 }).then(stream => {
      stream.on('data', (chunk) => ws.send(JSON.stringify({ streamChunk: chunk.text })));
    });

    // Timeout for final
    buffer.timeout = setTimeout(() => {
      const finalTranscript = buffer.chunks.join(' ');
      const finalParse = this.executeTool('voice_parse', { transcript: finalTranscript, products: params.products }, { user: {} }); // From tools
      ws.send(JSON.stringify({ final: finalParse, streamId: params.streamId }));
      this.streamBuffers.delete(params.streamId);
    }, 5000);

    this.streamBuffers.set(params.streamId, buffer);
  }

  private voiceParseFuzzy(transcript: string, products: any[]): any {
    // Stub: Integrate voice_parse fuzzy logic (e.g., match 'chikin' to 'Whole_Chicken')
    return { items: [], payment: 0 };
  }
}

export { ProductionMCPServer, authenticateJWT };

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ProductionMCPServer();
  server.start().catch(console.error);
}

// Middleware for user rate limiting
const userRateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 requests per windowMs
  message: {
    error: {
      code: 429,
      message: 'Too many requests, please slow down.',
      schema: 'MCP-RateLimit-Error'
    }
  }
});

// Apply middleware
app.use('/api/tools', userRateLimitMiddleware); // From rateLimitService

// In callTool function (existing tool executor):
const callTool = async (toolName: string, params: any, req: Request) => {
  try {
    const validatedParams = validateInput(toolName, params); // Import from chicken-business-tools
    const tool = tools[toolName];
    if (!tool) throw new Error('Tool not found');
    // Role check (existing or add)
    const result = await tool(validatedParams, req); // Pass req for user
    return result;
  } catch (err: any) {
    const errorCode = err.message.includes('Validation') ? 422 : 500;
    const mcpError = {
      error: {
        code: errorCode,
        message: err.message,
        schema: 'MCP-Error'
      }
    };
    monitoring.logError(toolName, err.message, { params, userId: req.user?.userId }, 'ai_audit_logs');
    throw mcpError; // Or res.json in endpoint
  }
};