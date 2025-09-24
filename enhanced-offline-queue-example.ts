/**
 * Enhanced Offline Queue System for MCP Client
 * Advanced queueing with priority, retry logic, and batch processing
 */

interface QueuedOperation {
  id: string;
  type: 'note_processing' | 'business_advice' | 'stock_update' | 'voice_stream';
  priority: 'high' | 'medium' | 'low';
  data: any;
  attempts: number;
  maxRetries: number;
  createdAt: string;
  scheduledFor?: string; // For delayed operations
  dependencies?: string[]; // Wait for other operations
}

interface QueueStats {
  pending: number;
  failed: number;
  completed: number;
  totalSize: number;
}

export class EnhancedOfflineQueue {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private batchSize = 5; // Process 5 operations at once
  private retryDelays = [1000, 5000, 15000, 60000]; // Progressive delays

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MCPOfflineQueue', 2);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Operations queue
        if (!db.objectStoreNames.contains('operations')) {
          const store = db.createObjectStore('operations', { keyPath: 'id' });
          store.createIndex('priority', 'priority');
          store.createIndex('status', 'status');
          store.createIndex('type', 'type');
          store.createIndex('scheduledFor', 'scheduledFor');
        }
        
        // Operation results cache
        if (!db.objectStoreNames.contains('results_cache')) {
          const cacheStore = db.createObjectStore('results_cache', { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry');
        }
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add operation to queue with priority and dependencies
   */
  async queueOperation(
    type: QueuedOperation['type'],
    data: any,
    options: {
      priority?: 'high' | 'medium' | 'low';
      maxRetries?: number;
      delayUntil?: Date;
      dependsOn?: string[];
    } = {}
  ): Promise<string> {
    if (!this.db) throw new Error('Queue not initialized');

    const operation: QueuedOperation = {
      id: crypto.randomUUID?.() || Date.now().toString(),
      type,
      priority: options.priority || 'medium',
      data,
      attempts: 0,
      maxRetries: options.maxRetries || 3,
      createdAt: new Date().toISOString(),
      scheduledFor: options.delayUntil?.toISOString(),
      dependencies: options.dependsOn
    };

    const transaction = this.db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');
    await store.add(operation);

    console.log(`🗂️ Queued ${type} operation:`, operation.id);
    
    // Trigger sync if online
    if (navigator.onLine) {
      this.processBatch();
    }

    return operation.id;
  }

  /**
   * Process operations in batches with priority ordering
   */
  async processBatch(): Promise<void> {
    if (this.syncInProgress || !this.db) return;
    
    this.syncInProgress = true;
    
    try {
      const readyOperations = await this.getReadyOperations();
      const prioritizedOps = this.prioritizeOperations(readyOperations);
      const batch = prioritizedOps.slice(0, this.batchSize);

      console.log(`🔄 Processing batch of ${batch.length} operations`);

      // Process operations in parallel
      const results = await Promise.allSettled(
        batch.map(op => this.executeOperation(op))
      );

      // Handle results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const operation = batch[i];

        if (result.status === 'fulfilled') {
          await this.markCompleted(operation.id, result.value);
        } else {
          await this.handleFailure(operation, result.reason);
        }
      }

      // Continue if more operations pending
      const remaining = await this.getPendingCount();
      if (remaining > 0) {
        setTimeout(() => this.processBatch(), 1000);
      }

    } finally {
      this.syncInProgress = false;
    }
  }

  private async getReadyOperations(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction(['operations'], 'readonly');
    const store = transaction.objectStore('operations');
    const now = new Date().toISOString();

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const operations = request.result.filter((op: QueuedOperation) => {
          // Check if scheduled time has passed
          if (op.scheduledFor && op.scheduledFor > now) return false;
          
          // Check if dependencies are met
          if (op.dependencies?.length) {
            // Implementation would check if dependency operations are completed
            return false; // Simplified for example
          }
          
          // Check if not exceeding max retries
          return op.attempts < op.maxRetries;
        });
        
        resolve(operations);
      };
    });
  }

  private prioritizeOperations(operations: QueuedOperation[]): QueuedOperation[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return operations.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by creation time (older first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  private async executeOperation(operation: QueuedOperation): Promise<any> {
    console.log(`⚡ Executing ${operation.type}:`, operation.id);

    // Increment attempt counter
    await this.incrementAttempts(operation.id);

    switch (operation.type) {
      case 'note_processing':
        return await mcpClient.processChickenNote(operation.data);
      
      case 'business_advice':
        return await mcpClient.getBusinessAdvice(operation.data);
      
      case 'stock_update':
        return await mcpClient.applyToStock(operation.data.noteId, operation.data.dryRun);
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async handleFailure(operation: QueuedOperation, error: any): Promise<void> {
    console.error(`❌ Operation failed:`, operation.id, error);

    if (operation.attempts >= operation.maxRetries) {
      await this.markFailed(operation.id, error);
      return;
    }

    // Schedule retry with exponential backoff
    const delay = this.retryDelays[Math.min(operation.attempts - 1, this.retryDelays.length - 1)];
    const retryTime = new Date(Date.now() + delay);
    
    await this.rescheduleOperation(operation.id, retryTime);
    console.log(`🔄 Scheduled retry for ${operation.id} at ${retryTime.toLocaleTimeString()}`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    if (!this.db) return { pending: 0, failed: 0, completed: 0, totalSize: 0 };

    const transaction = this.db.transaction(['operations'], 'readonly');
    const store = transaction.objectStore('operations');

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const operations = request.result;
        const stats = operations.reduce((acc, op) => {
          if (op.attempts >= op.maxRetries) acc.failed++;
          else if (op.completed) acc.completed++;
          else acc.pending++;
          return acc;
        }, { pending: 0, failed: 0, completed: 0, totalSize: operations.length });
        
        resolve(stats);
      };
    });
  }

  // Helper methods
  private async incrementAttempts(id: string): Promise<void> {
    // Implementation to increment attempt counter
  }

  private async markCompleted(id: string, result: any): Promise<void> {
    // Implementation to mark operation as completed
  }

  private async markFailed(id: string, error: any): Promise<void> {
    // Implementation to mark operation as failed
  }

  private async rescheduleOperation(id: string, newTime: Date): Promise<void> {
    // Implementation to reschedule operation
  }

  private async getPendingCount(): Promise<number> {
    // Implementation to get count of pending operations
    return 0;
  }
}

// Usage Example
export const offlineQueue = new EnhancedOfflineQueue();

// Initialize when app starts
offlineQueue.initialize();

// Queue high-priority note processing
await offlineQueue.queueOperation('note_processing', {
  content: "Urgent: bought 100 chickens",
  userRole: 'owner'
}, { priority: 'high' });

// Queue with dependency (wait for note to be processed first)
const noteOpId = await offlineQueue.queueOperation('note_processing', noteData);
await offlineQueue.queueOperation('stock_update', { noteId: 'will-be-filled' }, {
  dependsOn: [noteOpId]
});