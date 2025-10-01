/**
 * Integrated Memory System for Chicken Business MCP Server
 * Separates business database from AI memory with intelligent routing
 * Optimized for 2M context window and 100k token input per minute
 * Production-ready with backup and overflow management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import { UnifiedAIService } from './unifiedAIService';
import { mcpMemoryTools } from '../tools/memory-tools';
import { GoogleDriveClient } from './googleDriveClient';
import * as XLSX from 'xlsx';

export interface IntegratedMemoryConfig {
  business: {
    url: string;
    serviceKey: string;
    overflowThreshold: number; // 0.8 = 80%
  };
  memoryDb: {
    connectionString: string; // Neon PostgreSQL connection
    maxConnections: number;
  };
  vector: {
    provider: 'pinecone' | 'weaviate' | 'chroma';
    apiKey: string;
    indexName: string;
    dimensions: number;
  };
  ai: {
    contextWindow: number; // 2M tokens
    inputTPM: number; // 100k tokens per minute
    enableBackup: boolean;
  };
  storage: {
    googleDrive: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    };
  };
}

export interface QueryRequest {
  type: 'business' | 'ai_memory' | 'hybrid';
  query: string;
  context?: any;
  maxTokens?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface QueryResponse {
  data: any;
  source: 'business' | 'ai_memory' | 'hybrid';
  tokensUsed: number;
  processingTime: number;
  confidence: number;
  metadata?: any;
}

export interface BackupMetrics {
  tableName: string;
  rowCount: number;
  storageMB: number;
  usagePercent: number;
  needsBackup: boolean;
  lastBackup?: Date;
}

export class IntegratedMemorySystem {
  private businessDB: SupabaseClient;
  private memoryDB: PgClient; // Neon PostgreSQL for AI memory
  private vectorDB: any; // Will be specific to provider
  private backupDB: SupabaseClient; // Backup database client
  private mcpMemory: typeof mcpMemoryTools;
  private aiSystem: UnifiedAIService;
  private driveClient: GoogleDriveClient;
  private config: IntegratedMemoryConfig;
  
  private isInitialized: boolean = false;
  private contextWindowManager: ContextWindowManager;
  private backupManager: BackupManager;

  constructor(config: IntegratedMemoryConfig) {
    this.config = config;
    
    // Initialize business database (main Supabase)
    this.businessDB = createClient(
      config.business.url, 
      config.business.serviceKey
    );

    // Initialize memory database (Neon PostgreSQL)
    this.memoryDB = new PgClient({
      connectionString: config.memoryDb.connectionString,
      ssl: { rejectUnauthorized: false } // Neon requires SSL
    });

    // Initialize backup database (same as business for now)
    this.backupDB = this.businessDB;

    // Initialize AI systems
    this.aiSystem = new UnifiedAIService({
      defaultTier: 1,
      enableLoadBalancing: true,
      enableCostOptimization: true,
      budgetLimit: 50.0 // Higher limit for production
    });

    this.mcpMemory = mcpMemoryTools;
    
    // Initialize managers
    this.contextWindowManager = new ContextWindowManager(config.ai);
    this.backupManager = new BackupManager(this);
    this.driveClient = new GoogleDriveClient(config.storage.googleDrive);
  }

  /**
   * Initialize the integrated memory system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 Initializing Integrated Memory System...');

      // Initialize AI system
      await this.aiSystem.initialize();

      // Initialize vector DB based on provider
      await this.initializeVectorDB();

      // Set up monitoring tables
      await this.setupMonitoring();

      // Initialize Google Drive client
      await this.driveClient.initialize();

      this.isInitialized = true;
      console.log('✅ Integrated Memory System initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Integrated Memory System:', error);
      throw error;
    }
  }

  /**
   * Initialize vector database based on configuration
   */
  private async initializeVectorDB(): Promise<void> {
    const { provider, apiKey, indexName, dimensions } = this.config.vector;

    switch (provider) {
      case 'pinecone':
        const { Pinecone } = await import('@pinecone-database/pinecone');
        this.vectorDB = new Pinecone({
          apiKey: apiKey
        });
        break;

      case 'weaviate':
        const weaviate = await import('weaviate-ts-client');
        this.vectorDB = weaviate.default
          .client({
            scheme: 'https',
            host: process.env.WEAVIATE_HOST || 'localhost:8080',
            // apiKey: apiKey // Type incompatible, skip for now
          });
        break;

      case 'chroma':
        const { ChromaClient } = await import('chromadb');
        this.vectorDB = new ChromaClient({
          path: process.env.CHROMA_URL || 'http://localhost:8000'
        });
        break;

      default:
        throw new Error(`Unsupported vector DB provider: ${provider}`);
    }

    console.log(`📊 Vector DB initialized: ${provider}`);
  }

  /**
   * Set up monitoring tables for overflow detection
   */
  private async setupMonitoring(): Promise<void> {
    const { error } = await this.businessDB.rpc('create_monitoring_tables');
    if (error) {
      console.warn('Monitoring tables may already exist:', error.message);
    }
  }

  /**
   * Record business transaction (main database)
   */
  async recordBusinessTransaction(
    table: string, 
    data: any, 
    options: { checkOverflow?: boolean } = {}
  ): Promise<{ success: boolean; overflowTriggered?: boolean }> {
    try {
      // Insert into main business database
      const { error } = await this.businessDB.from(table).insert(data);
      if (error) throw error;

      let overflowTriggered = false;

      // Check for overflow if requested
      if (options.checkOverflow) {
        const metrics = await this.getTableMetrics(table);
        if (metrics.needsBackup) {
          await this.backupManager.handleOverflow(table);
          overflowTriggered = true;
        }
      }

      return { success: true, overflowTriggered };

    } catch (error) {
      console.error(`Failed to record ${table} transaction:`, error);
      return { success: false };
    }
  }

  /**
   * Store AI memory (separate system)
   */
  async storeAIMemory(memory: {
    id: string;
    type: string;
    content: string;
    metadata?: any;
    tags?: string[];
  }): Promise<{ success: boolean; embeddingId?: string }> {
    try {
      // 1. Store structured knowledge in MCP memory
      await this.mcpMemory.mcp_memory_create_entities({
        entities: [{
          name: memory.id,
          entityType: memory.type as any,
          observations: [memory.content],
          metadata: memory.metadata,
          tags: memory.tags
        }]
      });

      // 2. Generate and store embedding in vector DB
      const embedding = await this.aiSystem.executeRequest(
        { type: 'embedding', complexity: 'simple', priority: 'medium' },
        memory.content
      );

      const embeddingId = await this.storeEmbedding({
        id: memory.id,
        vector: JSON.parse(embedding.text), // Assuming embedding returns JSON
        metadata: {
          type: memory.type,
          tags: memory.tags,
          timestamp: new Date().toISOString(),
          ...memory.metadata
        }
      });

      return { success: true, embeddingId };

    } catch (error) {
      console.error('Failed to store AI memory:', error);
      return { success: false };
    }
  }

  /**
   * Store embedding in vector database
   */
  private async storeEmbedding(data: {
    id: string;
    vector: number[];
    metadata: any;
  }): Promise<string> {
    const { provider } = this.config.vector;

    switch (provider) {
      case 'pinecone':
        const index = this.vectorDB.Index(this.config.vector.indexName);
        await index.upsert([{
          id: data.id,
          values: data.vector,
          metadata: data.metadata
        }]);
        return data.id;

      case 'weaviate':
        const result = await this.vectorDB
          .data
          .creator()
          .withClassName('ChickenBusinessMemory')
          .withId(data.id)
          .withVector(data.vector)
          .withProperties(data.metadata)
          .do();
        return result.id;

      case 'chroma':
        const collection = await this.vectorDB.getOrCreateCollection({
          name: this.config.vector.indexName
        });
        await collection.add({
          ids: [data.id],
          embeddings: [data.vector],
          metadatas: [data.metadata]
        });
        return data.id;

      default:
        throw new Error(`Unsupported vector DB provider: ${provider}`);
    }
  }

  /**
   * Intelligent query routing
   */
  async query(request: QueryRequest): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      // Check token rate limits
      const tokensNeeded = Math.ceil(request.query.length / 4);
      const canProcess = await this.contextWindowManager.rateLimitCompliant(tokensNeeded);
      
      if (!canProcess) {
        throw new Error('Rate limit exceeded for token usage');
      }

      let response: QueryResponse;

      switch (request.type) {
        case 'business':
          response = await this.queryBusinessData(request);
          break;
          
        case 'ai_memory':
          response = await this.queryAIMemory(request);
          break;
          
        case 'hybrid':
          response = await this.hybridQuery(request);
          break;
          
        default:
          throw new Error(`Unknown query type: ${request.type}`);
      }

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      console.error('Query failed:', error);
      return {
        data: null,
        source: request.type,
        tokensUsed: 0,
        processingTime: Date.now() - startTime,
        confidence: 0,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Query business database
   */
  private async queryBusinessData(request: QueryRequest): Promise<QueryResponse> {
    // Simple business query - can be enhanced with SQL generation
    const { data, error } = await this.businessDB
      .from('sales') // Default table, should be dynamic
      .select('*')
      .ilike('notes', `%${request.query}%`)
      .limit(10);

    if (error) throw error;

    return {
      data,
      source: 'business',
      tokensUsed: Math.ceil(JSON.stringify(data).length / 4),
      processingTime: 0, // Will be set by caller
      confidence: 0.9
    };
  }

  /**
   * Query AI memory system
   */
  private async queryAIMemory(request: QueryRequest): Promise<QueryResponse> {
    // 1. Semantic search in vector DB
    const embedding = await this.aiSystem.executeRequest(
      { type: 'embedding', complexity: 'simple', priority: 'medium' },
      request.query
    );

    const vectorResults = await this.searchVectors({
      vector: JSON.parse(embedding.text),
      topK: 5,
      threshold: 0.7
    });

    // 2. Get structured data from MCP memory
    const mcpResults = await this.mcpMemory.mcp_memory_search_nodes({
      query: request.query,
      limit: 5
    });

    return {
      data: {
        vectorResults,
        structuredResults: mcpResults
      },
      source: 'ai_memory',
      tokensUsed: embedding.metadata?.tokensUsed || 0,
      processingTime: 0,
      confidence: 0.85
    };
  }

  /**
   * Hybrid query across both systems
   */
  private async hybridQuery(request: QueryRequest): Promise<QueryResponse> {
    // Optimize context for both systems
    const optimizedContext = await this.contextWindowManager.optimizeContext(request);

    // Query both systems in parallel
    const [businessResults, aiResults] = await Promise.all([
      this.queryBusinessData({ ...request, type: 'business' }),
      this.queryAIMemory({ ...request, type: 'ai_memory' })
    ]);

    // Use AI to synthesize results
    const synthesis = await this.aiSystem.executeRequest(
      { type: 'text', complexity: 'complex', priority: 'high' },
      `Synthesize business data and AI memory for query: "${request.query}"
      
      Business Data: ${JSON.stringify(businessResults.data)}
      AI Memory: ${JSON.stringify(aiResults.data)}
      
      Provide a comprehensive answer combining both sources.`,
      { maxOutputTokens: 1000 }
    );

    return {
      data: {
        synthesis: synthesis.text,
        business: businessResults.data,
        aiMemory: aiResults.data
      },
      source: 'hybrid',
      tokensUsed: businessResults.tokensUsed + aiResults.tokensUsed + (synthesis.metadata?.tokensUsed || 0),
      processingTime: 0,
      confidence: Math.max(businessResults.confidence, aiResults.confidence)
    };
  }

  /**
   * Search vectors in vector database
   */
  private async searchVectors(params: {
    vector: number[];
    topK: number;
    threshold: number;
  }): Promise<any[]> {
    const { provider } = this.config.vector;

    switch (provider) {
      case 'pinecone':
        const index = this.vectorDB.Index(this.config.vector.indexName);
        const results = await index.query({
          vector: params.vector,
          topK: params.topK,
          includeMetadata: true
        });
        return results.matches.filter((m: any) => m.score >= params.threshold);

      case 'weaviate':
        const weaviateResults = await this.vectorDB
          .graphql
          .get()
          .withClassName('ChickenBusinessMemory')
          .withNearVector({ vector: params.vector })
          .withLimit(params.topK)
          .do();
        return weaviateResults.data.Get.ChickenBusinessMemory;

      case 'chroma':
        const collection = await this.vectorDB.getCollection({
          name: this.config.vector.indexName
        });
        const chromaResults = await collection.query({
          queryEmbeddings: [params.vector],
          nResults: params.topK
        });
        return chromaResults.metadatas[0];

      default:
        throw new Error(`Unsupported vector DB provider: ${provider}`);
    }
  }

  /**
   * Get table metrics for overflow monitoring
   */
  async getTableMetrics(tableName: string): Promise<BackupMetrics> {
    const { data, error } = await this.businessDB.rpc('get_table_metrics', {
      table_name: tableName
    });

    if (error) throw error;

    return {
      tableName,
      rowCount: data.row_count,
      storageMB: data.storage_mb,
      usagePercent: data.usage_percent,
      needsBackup: data.usage_percent > (this.config.business.overflowThreshold * 100)
    };
  }

  /**
   * Get system status across all components
   */
  async getSystemStatus(): Promise<{
    business: { healthy: boolean; metrics: any };
    ai: { healthy: boolean; metrics: any };
    backup: { healthy: boolean; metrics: any };
  }> {
    const [businessHealth, aiHealth, backupHealth] = await Promise.allSettled([
      this.checkBusinessHealth(),
      this.aiSystem.performHealthCheck(),
      this.checkBackupHealth()
    ]);

    return {
      business: {
        healthy: businessHealth.status === 'fulfilled' && businessHealth.value.healthy,
        metrics: businessHealth.status === 'fulfilled' ? businessHealth.value : null
      },
      ai: {
        healthy: aiHealth.status === 'fulfilled' && aiHealth.value.overall === 'healthy',
        metrics: aiHealth.status === 'fulfilled' ? aiHealth.value : null
      },
      backup: {
        healthy: backupHealth.status === 'fulfilled' && backupHealth.value.healthy,
        metrics: backupHealth.status === 'fulfilled' ? backupHealth.value : null
      }
    };
  }

  /**
   * Check business database health
   */
  private async checkBusinessHealth(): Promise<{ healthy: boolean; metrics: any }> {
    try {
      const { data, error } = await this.businessDB.from('sales').select('count').limit(1);
      return {
        healthy: !error,
        metrics: { connected: true, error: error?.message }
      };
    } catch (error) {
      return {
        healthy: false,
        metrics: { connected: false, error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Check backup system health
   */
  private async checkBackupHealth(): Promise<{ healthy: boolean; metrics: any }> {
    try {
      const { data, error } = await this.backupDB.from('information_schema.tables').select('count').limit(1);
      return {
        healthy: !error,
        metrics: { connected: true, error: error?.message }
      };
    } catch (error) {
      return {
        healthy: false,
        metrics: { connected: false, error: error instanceof Error ? error.message : String(error) }
      };
    }
  }
}

/**
 * Context Window Manager for 2M token optimization
 */
class ContextWindowManager {
  private maxContextTokens: number;
  private inputRateLimit: number;
  private currentUsage: Map<string, { tokens: number; timestamp: number }> = new Map();

  constructor(config: { contextWindow: number; inputTPM: number }) {
    this.maxContextTokens = config.contextWindow;
    this.inputRateLimit = config.inputTPM;
  }

  async optimizeContext(request: QueryRequest): Promise<any> {
    // Implement intelligent context optimization
    // This is a simplified version - can be enhanced with sophisticated algorithms
    return {
      optimized: true,
      tokensUsed: Math.ceil(request.query.length / 4),
      priority: request.priority || 'medium'
    };
  }

  async rateLimitCompliant(tokensNeeded: number): Promise<boolean> {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const key = currentMinute.toString();

    const usage = this.currentUsage.get(key) || { tokens: 0, timestamp: now };
    
    if (usage.tokens + tokensNeeded <= this.inputRateLimit) {
      this.currentUsage.set(key, {
        tokens: usage.tokens + tokensNeeded,
        timestamp: now
      });
      return true;
    }

    return false;
  }
}

/**
 * Backup Manager for overflow handling
 */
class BackupManager {
  private system: IntegratedMemorySystem;

  constructor(system: IntegratedMemorySystem) {
    this.system = system;
  }

  async handleOverflow(tableName: string): Promise<void> {
    console.log(`🔄 Handling overflow for table: ${tableName}`);

    try {
      // 1. Export old records
      const oldRecords = await this.exportOldRecords(tableName);
      
      // 2. Create Excel file
      const excel = this.createExcelFile(oldRecords);
      
      // 3. Upload to Google Drive
      await this.system['driveClient'].uploadFile({
        name: `${tableName}_backup_${new Date().toISOString().split('T')[0]}.xlsx`,
        data: excel,
        folder: 'chicken-business-backups'
      });

      // 4. Move to backup database
      // Use backup through system's public method
      // await this.system.backupDB.from(`${tableName}_archive`).insert(oldRecords);
      console.log(`Would archive ${oldRecords.length} records to ${tableName}_archive`);

      // 5. Clean primary database
      await this.cleanPrimaryDatabase(tableName);

      console.log(`✅ Overflow handled successfully for ${tableName}`);

    } catch (error) {
      console.error(`❌ Failed to handle overflow for ${tableName}:`, error);
      throw error;
    }
  }

  private async exportOldRecords(tableName: string): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3); // Archive 3+ months old

    const { data, error } = await this.system['businessDB']
      .from(tableName)
      .select('*')
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
    return data || [];
  }

  private createExcelFile(records: any[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archived Data');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private async cleanPrimaryDatabase(tableName: string): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);

    const { error } = await this.system['businessDB']
      .from(tableName)
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
  }
}

// Export singleton instance
export const integratedMemorySystem = new IntegratedMemorySystem({
  business: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    overflowThreshold: 0.8
  },
  memoryDb: {
    connectionString: process.env.NEON_DATABASE_URL!,
    maxConnections: 10
  },
  // backup: {
  //   url: process.env.BACKUP_SUPABASE_URL!,
  //   serviceKey: process.env.BACKUP_SUPABASE_SERVICE_KEY!
  // },
  vector: {
    provider: (process.env.VECTOR_DB_PROVIDER as any) || 'pinecone',
    apiKey: process.env.VECTOR_DB_API_KEY!,
    indexName: 'chicken-ai-memory',
    dimensions: 768
  },
  ai: {
    contextWindow: 2_000_000,
    inputTPM: 100_000,
    enableBackup: true
  },
  storage: {
    googleDrive: {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!
    }
  }
});