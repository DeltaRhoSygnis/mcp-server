/**
 * Request Batching System for MCP Client
 * Groups multiple operations into single requests for efficiency
 */

interface BatchOperation {
  id: string;
  operation: string;
  params: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number; // Max time to wait before sending batch
  batchableOperations: string[];
}

export class RequestBatcher {
  private pendingOperations: BatchOperation[] = [];
  private batchTimer?: NodeJS.Timeout;
  private config: BatchConfig;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 10,
      maxWaitTime: config.maxWaitTime || 100, // 100ms
      batchableOperations: config.batchableOperations || [
        'search_business_context',
        'get_business_advice',
        'query_memory',
        'get_stock_status'
      ]
    };
  }

  /**
   * Add operation to batch queue
   */
  async queueOperation(operation: string, params: any): Promise<any> {
    // Check if operation can be batched
    if (!this.config.batchableOperations.includes(operation)) {
      // Execute immediately for non-batchable operations
      return this.executeImmediately(operation, params);
    }

    return new Promise((resolve, reject) => {
      const batchOp: BatchOperation = {
        id: crypto.randomUUID?.() || Date.now().toString(),
        operation,
        params,
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.pendingOperations.push(batchOp);

      // Check if we should flush the batch
      if (this.pendingOperations.length >= this.config.maxBatchSize) {
        this.flushBatch();
      } else if (!this.batchTimer) {
        // Start timer for automatic flush
        this.batchTimer = setTimeout(() => {
          this.flushBatch();
        }, this.config.maxWaitTime);
      }
    });
  }

  /**
   * Execute single operation immediately
   */
  private async executeImmediately(operation: string, params: any): Promise<any> {
    // This would call the actual MCP client method
    console.log(`⚡ Executing immediately: ${operation}`);
    
    switch (operation) {
      case 'process_chicken_note':
        return await mcpClient.processChickenNote(params);
      case 'apply_to_stock':
        return await mcpClient.applyToStock(params.noteId, params.dryRun);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Flush current batch
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingOperations.length === 0) return;

    const batch = [...this.pendingOperations];
    this.pendingOperations = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    console.log(`📦 Flushing batch of ${batch.length} operations`);

    try {
      // Group operations by type for optimal batching
      const groupedOps = this.groupOperationsByType(batch);
      
      // Execute each group
      for (const [opType, operations] of groupedOps) {
        await this.executeBatchGroup(opType, operations);
      }

    } catch (error) {
      console.error('❌ Batch execution failed:', error);
      
      // Reject all operations in the batch
      batch.forEach(op => op.reject(error));
    }
  }

  /**
   * Group operations by type for optimal batching
   */
  private groupOperationsByType(batch: BatchOperation[]): Map<string, BatchOperation[]> {
    const groups = new Map<string, BatchOperation[]>();
    
    for (const op of batch) {
      if (!groups.has(op.operation)) {
        groups.set(op.operation, []);
      }
      groups.get(op.operation)!.push(op);
    }
    
    return groups;
  }

  /**
   * Execute a group of same-type operations
   */
  private async executeBatchGroup(operationType: string, operations: BatchOperation[]): Promise<void> {
    console.log(`🔄 Executing batch group: ${operationType} (${operations.length} ops)`);

    switch (operationType) {
      case 'search_business_context':
        await this.executeBatchedSearch(operations);
        break;
        
      case 'get_business_advice':
        await this.executeBatchedAdvice(operations);
        break;
        
      case 'query_memory':
        await this.executeBatchedMemoryQuery(operations);
        break;
        
      case 'get_stock_status':
        await this.executeBatchedStockQuery(operations);
        break;
        
      default:
        // Execute individually if no batch implementation
        await this.executeIndividually(operations);
    }
  }

  /**
   * Execute batched search operations
   */
  private async executeBatchedSearch(operations: BatchOperation[]): Promise<void> {
    // Combine all search queries into single request
    const queries = operations.map(op => ({
      id: op.id,
      query: op.params.query,
      entityTypes: op.params.entityTypes || ['product', 'supplier', 'customer']
    }));

    try {
      // Make single API call with all queries
      const batchResult = await this.callBatchAPI('search_batch', { queries });
      
      // Distribute results back to individual promises
      for (const op of operations) {
        const result = batchResult.results.find((r: any) => r.id === op.id);
        if (result) {
          op.resolve({ success: true, result: result.data });
        } else {
          op.reject(new Error('No result found for operation'));
        }
      }
      
    } catch (error) {
      operations.forEach(op => op.reject(error));
    }
  }

  /**
   * Execute batched business advice operations
   */
  private async executeBatchedAdvice(operations: BatchOperation[]): Promise<void> {
    // Group similar advice requests
    const adviceGroups = this.groupAdviceByContext(operations);
    
    for (const [contextType, ops] of adviceGroups) {
      try {
        const questions = ops.map(op => ({
          id: op.id,
          question: op.params.question,
          context: op.params.context
        }));

        const batchResult = await this.callBatchAPI('advice_batch', {
          contextType,
          questions
        });

        // Distribute results
        for (const op of ops) {
          const result = batchResult.results.find((r: any) => r.id === op.id);
          if (result) {
            op.resolve({ success: true, result: result.advice });
          } else {
            op.reject(new Error('No advice result found'));
          }
        }
        
      } catch (error) {
        ops.forEach(op => op.reject(error));
      }
    }
  }

  /**
   * Execute batched memory queries
   */
  private async executeBatchedMemoryQuery(operations: BatchOperation[]): Promise<void> {
    const queries = operations.map(op => ({
      id: op.id,
      entityType: op.params.entityType,
      relations: op.params.relations,
      limit: op.params.limit || 10
    }));

    try {
      const batchResult = await this.callBatchAPI('memory_batch', { queries });
      
      for (const op of operations) {
        const result = batchResult.results.find((r: any) => r.id === op.id);
        op.resolve({ success: true, result: result?.data || [] });
      }
      
    } catch (error) {
      operations.forEach(op => op.reject(error));
    }
  }

  /**
   * Execute batched stock status queries
   */
  private async executeBatchedStockQuery(operations: BatchOperation[]): Promise<void> {
    const productIds = [...new Set(operations.map(op => op.params.productId))];
    
    try {
      // Single query for all products
      const batchResult = await this.callBatchAPI('stock_status_batch', { productIds });
      
      // Distribute results to each operation
      for (const op of operations) {
        const productData = batchResult.stockData.find((s: any) => s.productId === op.params.productId);
        op.resolve({ success: true, result: productData });
      }
      
    } catch (error) {
      operations.forEach(op => op.reject(error));
    }
  }

  /**
   * Group advice operations by context similarity
   */
  private groupAdviceByContext(operations: BatchOperation[]): Map<string, BatchOperation[]> {
    const groups = new Map<string, BatchOperation[]>();
    
    for (const op of operations) {
      // Categorize by context type
      const contextType = this.categorizeAdviceContext(op.params.context);
      
      if (!groups.has(contextType)) {
        groups.set(contextType, []);
      }
      groups.get(contextType)!.push(op);
    }
    
    return groups;
  }

  private categorizeAdviceContext(context: any): string {
    if (context?.sales || context?.revenue) return 'sales';
    if (context?.stock || context?.inventory) return 'inventory';
    if (context?.costs || context?.expenses) return 'financial';
    return 'general';
  }

  /**
   * Execute operations individually (fallback)
   */
  private async executeIndividually(operations: BatchOperation[]): Promise<void> {
    console.log(`⚡ Executing ${operations.length} operations individually`);
    
    const results = await Promise.allSettled(
      operations.map(async op => {
        try {
          const result = await this.executeImmediately(op.operation, op.params);
          op.resolve(result);
        } catch (error) {
          op.reject(error);
        }
      })
    );
  }

  /**
   * Make batched API call to MCP server
   */
  private async callBatchAPI(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${mcpClient.baseUrl}/api/batch/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mcpClient.getJWTToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Batch API call failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get batch statistics
   */
  getBatchStats() {
    return {
      pendingOperations: this.pendingOperations.length,
      oldestPending: this.pendingOperations.length > 0 
        ? Date.now() - Math.min(...this.pendingOperations.map(op => op.timestamp))
        : 0,
      batchTimerActive: !!this.batchTimer
    };
  }
}

/**
 * Enhanced MCP Client with request batching
 */
export class BatchedMCPClient extends MCPClient {
  private batcher = new RequestBatcher();

  async searchBusinessContext(query: string, entityTypes?: string[]): Promise<MCPResponse> {
    return this.batcher.queueOperation('search_business_context', { query, entityTypes });
  }

  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPResponse> {
    return this.batcher.queueOperation('get_business_advice', request);
  }

  // Non-batchable operations go through normal path
  async processChickenNote(note: ChickenNote): Promise<MCPResponse> {
    return this.batcher.queueOperation('process_chicken_note', note);
  }

  getBatchStats() {
    return this.batcher.getBatchStats();
  }
}

// Usage example
export const batchedMCPClient = new BatchedMCPClient();

// These will be automatically batched
Promise.all([
  batchedMCPClient.searchBusinessContext('chicken suppliers'),
  batchedMCPClient.searchBusinessContext('whole chicken prices'),
  batchedMCPClient.searchBusinessContext('competitor analysis')
]).then(results => {
  console.log('✅ All searches completed via batching:', results);
});