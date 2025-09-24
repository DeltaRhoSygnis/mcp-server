/**
 * PRODUCTION Request Batching System for Charnoks Chicken Business
 * Production-ready request batching specifically designed for chicken business operations
 * Optimizes: Note Processing, Stock Updates, Business Advice, Context Searches
 */

import { MCPClient, MCPResponse, ChickenNote, BusinessAdviceRequest } from './mcpClient';

export interface ChickenBusinessBatchRequest {
  id: string;
  type: 'parse_chicken_note' | 'get_business_advice' | 'apply_to_stock' | 'forecast_stock' | 'search_business_context';
  data: any;
  userRole: 'owner' | 'worker';
  branchId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  resolve: (result: MCPResponse) => void;
  reject: (error: Error) => void;
  timeout?: number;
  metadata?: {
    estimatedCost?: number;
    processingTime?: number;
    relatedRequestIds?: string[];
  };
}

export interface BatchGroup {
  type: ChickenBusinessBatchRequest['type'];
  requests: ChickenBusinessBatchRequest[];
  totalCost: number;
  averagePriority: number;
  userRoles: Set<string>;
  branchIds: Set<string>;
}

export interface BatchMetrics {
  totalRequests: number;
  batchedRequests: number;
  individualRequests: number;
  averageBatchSize: number;
  timesSaved: number;
  costSavings: number;
  successRate: number;
  lastBatchTime: Date;
}

/**
 * Production Request Batching System for Charnoks Chicken Business
 */
export class ChickenBusinessBatcher {
  private mcpClient: MCPClient;
  private pendingRequests: Map<string, ChickenBusinessBatchRequest> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private batchWindow = 150; // 150ms batch window (optimized for business operations)
  private maxBatchSize = 8; // Conservative batch size for chicken business
  private maxBatchWait = 500; // Maximum wait time before forcing batch
  private metrics: BatchMetrics;

  // Batch configurations for different operation types
  private batchConfigs = {
    'parse_chicken_note': {
      maxBatchSize: 5, // Process up to 5 notes at once
      window: 200, // 200ms window for note collection
      canBatch: true,
      costPerOperation: 0.50
    },
    'get_business_advice': {
      maxBatchSize: 3, // Limit advice requests to maintain quality
      window: 300, // Longer window for advice batching
      canBatch: true,
      costPerOperation: 1.00
    },
    'apply_to_stock': {
      maxBatchSize: 10, // Stock updates can be batched efficiently
      window: 100, // Quick batching for inventory operations
      canBatch: true,
      costPerOperation: 0.25
    },
    'forecast_stock': {
      maxBatchSize: 2, // Forecasts are resource-intensive
      window: 500, // Longer window due to complexity
      canBatch: false, // Forecasts typically don't batch well
      costPerOperation: 2.00
    },
    'search_business_context': {
      maxBatchSize: 8, // Searches can be batched effectively
      window: 100, // Quick response needed for searches
      canBatch: true,
      costPerOperation: 0.10
    }
  };

  constructor() {
    this.mcpClient = new MCPClient();
    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      individualRequests: 0,
      averageBatchSize: 0,
      timesSaved: 0,
      costSavings: 0,
      successRate: 0,
      lastBatchTime: new Date()
    };
    
    this.setupPeriodicMetricsUpdate();
  }

  /**
   * Submit request for batching (main entry point)
   */
  async submitRequest<T>(
    type: ChickenBusinessBatchRequest['type'],
    data: any,
    options: {
      userRole: 'owner' | 'worker';
      branchId?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      timeout?: number;
    }
  ): Promise<MCPResponse> {
    const requestId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📦 Submitting request for batching: ${requestId} (${type})`);

    this.metrics.totalRequests++;

    return new Promise<MCPResponse>((resolve, reject) => {
      const request: ChickenBusinessBatchRequest = {
        id: requestId,
        type,
        data,
        userRole: options.userRole,
        branchId: options.branchId || 'main',
        priority: options.priority || this.getDefaultPriority(type),
        timestamp: Date.now(),
        resolve,
        reject,
        timeout: options.timeout || 30000,
        metadata: {
          estimatedCost: this.batchConfigs[type]?.costPerOperation || 0.50,
          processingTime: Date.now()
        }
      };

      // Check if this operation type can be batched
      const config = this.batchConfigs[type];
      if (!config.canBatch) {
        console.log(`⚡ Processing immediately (no batching): ${type}`);
        this.processImmediately(request);
        return;
      }

      // Add to pending requests
      this.pendingRequests.set(requestId, request);

      // Setup timeout for individual request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          console.warn(`⏰ Request timeout: ${requestId}`);
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timeout after ${options.timeout}ms`));
        }
      }, options.timeout || 30000);

      // Schedule batch processing
      this.scheduleBatch(type);
    });
  }

  /**
   * Convenience methods for specific chicken business operations
   */
  async batchParseChickenNotes(notes: ChickenNote[], userRole: 'owner' | 'worker'): Promise<MCPResponse[]> {
    console.log(`🐔 Batching ${notes.length} chicken notes for parsing`);
    
    const promises = notes.map(note => 
      this.submitRequest('parse_chicken_note', note, { userRole })
    );
    
    return Promise.all(promises);
  }

  async batchApplyToStock(applications: {noteId: string; dryRun: boolean}[], userRole: 'owner' | 'worker'): Promise<MCPResponse[]> {
    console.log(`📦 Batching ${applications.length} stock applications`);
    
    const promises = applications.map(app => 
      this.submitRequest('apply_to_stock', app, { userRole, priority: 'high' })
    );
    
    return Promise.all(promises);
  }

  async batchBusinessAdvice(requests: BusinessAdviceRequest[]): Promise<MCPResponse[]> {
    console.log(`💡 Batching ${requests.length} business advice requests`);
    
    const promises = requests.map(req => 
      this.submitRequest('get_business_advice', req, { userRole: req.userRole })
    );
    
    return Promise.all(promises);
  }

  async batchContextSearches(queries: string[], userRole: 'owner' | 'worker'): Promise<MCPResponse[]> {
    console.log(`🔍 Batching ${queries.length} context searches`);
    
    const promises = queries.map(query => 
      this.submitRequest('search_business_context', { query }, { userRole })
    );
    
    return Promise.all(promises);
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(type: ChickenBusinessBatchRequest['type']): void {
    const config = this.batchConfigs[type];
    
    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Check if we should process immediately based on batch size
    const typeRequests = Array.from(this.pendingRequests.values()).filter(req => req.type === type);
    if (typeRequests.length >= config.maxBatchSize) {
      console.log(`🚀 Processing batch immediately (size limit reached): ${type}`);
      this.processBatches();
      return;
    }

    // Schedule batch processing
    this.batchTimer = setTimeout(() => {
      this.processBatches();
    }, Math.min(config.window, this.maxBatchWait));
  }

  /**
   * Process all pending batches
   */
  private async processBatches(): Promise<void> {
    if (this.pendingRequests.size === 0) return;

    console.log(`⚡ Processing batches (${this.pendingRequests.size} pending requests)`);
    
    // Group requests by type and context
    const groups = this.groupRequests();
    
    // Process each group
    const processingPromises = groups.map(group => this.processBatchGroup(group));
    await Promise.allSettled(processingPromises);

    // Update metrics
    this.metrics.lastBatchTime = new Date();
    
    // Clear processed requests
    this.pendingRequests.clear();
    
    console.log(`✅ Batch processing completed`);
  }

  /**
   * Group requests by type and compatibility
   */
  private groupRequests(): BatchGroup[] {
    const groups: Map<string, BatchGroup> = new Map();

    for (const request of this.pendingRequests.values()) {
      const config = this.batchConfigs[request.type];
      if (!config.canBatch) {
        // Process non-batchable requests immediately
        this.processImmediately(request);
        continue;
      }

      // Create group key based on type and compatibility
      const groupKey = `${request.type}_${request.userRole}_${request.branchId}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          type: request.type,
          requests: [],
          totalCost: 0,
          averagePriority: 0,
          userRoles: new Set(),
          branchIds: new Set()
        });
      }

      const group = groups.get(groupKey)!;
      
      // Check batch size limit
      if (group.requests.length < config.maxBatchSize) {
        group.requests.push(request);
        group.totalCost += request.metadata?.estimatedCost || 0;
        group.userRoles.add(request.userRole);
        group.branchIds.add(request.branchId);
      } else {
        // Process immediately if batch is full
        this.processImmediately(request);
      }
    }

    // Calculate average priority for each group
    for (const group of groups.values()) {
      const priorityValues = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      const totalPriority = group.requests.reduce((sum, req) => sum + priorityValues[req.priority], 0);
      group.averagePriority = totalPriority / group.requests.length;
    }

    return Array.from(groups.values());
  }

  /**
   * Process a group of similar requests
   */
  private async processBatchGroup(group: BatchGroup): Promise<void> {
    console.log(`🔄 Processing batch group: ${group.type} (${group.requests.length} requests)`);

    try {
      let results: MCPResponse[];

      switch (group.type) {
        case 'parse_chicken_note':
          results = await this.batchProcessNotes(group.requests);
          break;
        
        case 'get_business_advice':
          results = await this.batchProcessAdvice(group.requests);
          break;
        
        case 'apply_to_stock':
          results = await this.batchProcessStockUpdates(group.requests);
          break;
        
        case 'search_business_context':
          results = await this.batchProcessSearches(group.requests);
          break;
        
        default:
          // Fallback to individual processing
          results = await this.processIndividually(group.requests);
      }

      // Resolve all requests in the group
      group.requests.forEach((request, index) => {
        const result = results[index] || { success: false, error: 'Batch processing failed' };
        request.resolve(result);
      });

      // Update metrics
      this.metrics.batchedRequests += group.requests.length;
      this.metrics.costSavings += this.calculateBatchSavings(group);

      console.log(`✅ Batch group processed: ${group.type} (${group.requests.length} requests)`);

    } catch (error) {
      console.error(`❌ Batch group failed: ${group.type}`, error);
      
      // Reject all requests in the group
      group.requests.forEach(request => {
        request.reject(error as Error);
      });
    }
  }

  /**
   * Batch process chicken notes
   */
  private async batchProcessNotes(requests: ChickenBusinessBatchRequest[]): Promise<MCPResponse[]> {
    console.log(`🐔 Batch processing ${requests.length} chicken notes`);

    // Optimize by combining similar notes or processing in parallel
    const promises = requests.map(async (request) => {
      const note = request.data as ChickenNote;
      return this.mcpClient.processChickenNote(note);
    });

    return Promise.all(promises);
  }

  /**
   * Batch process business advice requests
   */
  private async batchProcessAdvice(requests: ChickenBusinessBatchRequest[]): Promise<MCPResponse[]> {
    console.log(`💡 Batch processing ${requests.length} business advice requests`);

    // For advice, we can potentially combine related questions
    const promises = requests.map(async (request) => {
      const adviceRequest = request.data as BusinessAdviceRequest;
      return this.mcpClient.getBusinessAdvice(adviceRequest);
    });

    return Promise.all(promises);
  }

  /**
   * Batch process stock updates
   */
  private async batchProcessStockUpdates(requests: ChickenBusinessBatchRequest[]): Promise<MCPResponse[]> {
    console.log(`📦 Batch processing ${requests.length} stock updates`);

    // Stock updates can be optimized by grouping by product type
    const promises = requests.map(async (request) => {
      const stockData = request.data as { noteId: string; dryRun: boolean };
      return this.mcpClient.applyToStock(stockData.noteId, stockData.dryRun);
    });

    return Promise.all(promises);
  }

  /**
   * Batch process context searches
   */
  private async batchProcessSearches(requests: ChickenBusinessBatchRequest[]): Promise<MCPResponse[]> {
    console.log(`🔍 Batch processing ${requests.length} context searches`);

    // Searches can be optimized by combining similar queries
    const promises = requests.map(async (request) => {
      const searchData = request.data as { query: string };
      return this.mcpClient.searchBusinessContext(searchData.query);
    });

    return Promise.all(promises);
  }

  /**
   * Process requests individually (fallback)
   */
  private async processIndividually(requests: ChickenBusinessBatchRequest[]): Promise<MCPResponse[]> {
    console.log(`⚡ Processing ${requests.length} requests individually`);

    const promises = requests.map(request => this.processImmediately(request));
    return Promise.all(promises);
  }

  /**
   * Process a single request immediately
   */
  private async processImmediately(request: ChickenBusinessBatchRequest): Promise<MCPResponse> {
    console.log(`⚡ Processing immediately: ${request.id} (${request.type})`);

    try {
      let result: MCPResponse;

      switch (request.type) {
        case 'parse_chicken_note':
          result = await this.mcpClient.processChickenNote(request.data as ChickenNote);
          break;
        
        case 'get_business_advice':
          result = await this.mcpClient.getBusinessAdvice(request.data as BusinessAdviceRequest);
          break;
        
        case 'apply_to_stock':
          const stockData = request.data as { noteId: string; dryRun: boolean };
          result = await this.mcpClient.applyToStock(stockData.noteId, stockData.dryRun);
          break;
        
        case 'forecast_stock':
          const forecastData = request.data as { salesHistory: any[] };
          result = await this.mcpClient.getForecast(forecastData.salesHistory);
          break;
        
        case 'search_business_context':
          const searchData = request.data as { query: string };
          result = await this.mcpClient.searchBusinessContext(searchData.query);
          break;
        
        default:
          throw new Error(`Unknown operation type: ${request.type}`);
      }

      this.metrics.individualRequests++;
      request.resolve(result);
      return result;

    } catch (error) {
      console.error(`❌ Individual processing failed: ${request.id}`, error);
      const errorResult = { success: false, error: (error as Error).message };
      request.reject(error as Error);
      return errorResult;
    }
  }

  /**
   * Get default priority for operation type
   */
  private getDefaultPriority(type: ChickenBusinessBatchRequest['type']): 'low' | 'medium' | 'high' | 'critical' {
    const priorityMap = {
      'apply_to_stock': 'critical',
      'parse_chicken_note': 'high',
      'get_business_advice': 'medium',
      'search_business_context': 'low',
      'forecast_stock': 'low'
    };
    return priorityMap[type] || 'medium';
  }

  /**
   * Calculate savings from batching
   */
  private calculateBatchSavings(group: BatchGroup): number {
    // Estimate savings based on reduced overhead and parallel processing
    const baseOverhead = 100; // 100ms overhead per individual request
    const batchOverhead = 150; // 150ms overhead for entire batch
    const savedTime = (group.requests.length * baseOverhead) - batchOverhead;
    
    // Convert time savings to cost savings (rough estimate)
    const costPerSecond = 0.001; // 0.1 centavo per second saved
    return Math.max(0, savedTime * costPerSecond / 1000);
  }

  /**
   * Setup periodic metrics update
   */
  private setupPeriodicMetricsUpdate(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 60000); // Update every minute
  }

  /**
   * Update batch metrics
   */
  private updateMetrics(): void {
    const totalProcessed = this.metrics.batchedRequests + this.metrics.individualRequests;
    if (totalProcessed > 0) {
      this.metrics.averageBatchSize = this.metrics.batchedRequests / Math.max(1, this.metrics.totalRequests - this.metrics.individualRequests);
      this.metrics.successRate = ((totalProcessed - 0) / totalProcessed) * 100; // Assuming all processed requests succeed for now
    }

    // Log metrics periodically
    if (this.metrics.totalRequests > 0 && this.metrics.totalRequests % 10 === 0) {
      console.log('📊 Batch Metrics:', {
        totalRequests: this.metrics.totalRequests,
        batchedRequests: this.metrics.batchedRequests,
        batchingRate: `${((this.metrics.batchedRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`,
        avgBatchSize: this.metrics.averageBatchSize.toFixed(1),
        costSavings: `₱${this.metrics.costSavings.toFixed(2)}`
      });
    }
  }

  /**
   * Get current batch metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Force process all pending requests
   */
  async flushPending(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.pendingRequests.size > 0) {
      console.log(`🚿 Flushing ${this.pendingRequests.size} pending requests`);
      await this.processBatches();
    }
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clear all pending requests (emergency stop)
   */
  clearPending(): void {
    for (const request of this.pendingRequests.values()) {
      request.reject(new Error('Batch processing cancelled'));
    }
    this.pendingRequests.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    console.log('🛑 All pending requests cleared');
  }
}

// Default instance for chicken business
export const chickenBusinessBatcher = new ChickenBusinessBatcher();

export default ChickenBusinessBatcher;