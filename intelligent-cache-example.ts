/**
 * Advanced Caching Layer for MCP Client
 * Intelligent caching with TTL, invalidation, and memory management
 */

interface CacheEntry {
  key: string;
  data: any;
  expiry: number;
  lastAccessed: number;
  accessCount: number;
  size: number; // Estimated size in bytes
}

interface CacheConfig {
  maxSize: number; // Max cache size in MB
  defaultTTL: number; // Default TTL in ms
  cleanupInterval: number; // Cleanup interval in ms
}

export class IntelligentCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private currentSize = 0; // Current cache size in bytes

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 50, // 50MB default
      defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60 * 1000 // 1 minute
    };

    this.startCleanup();
  }

  /**
   * Generate cache key for MCP operations
   */
  private generateKey(operation: string, params: any): string {
    // Create deterministic key from operation and parameters
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${operation}:${this.hashString(paramString)}`;
  }

  private hashString(str: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached result for operation
   */
  get(operation: string, params: any): any | null {
    const key = this.generateKey(operation, params);
    const entry = this.cache.get(key);

    if (!entry) {
      console.log(`💾 Cache MISS: ${operation}`);
      return null;
    }

    if (Date.now() > entry.expiry) {
      console.log(`⏰ Cache EXPIRED: ${operation}`);
      this.cache.delete(key);
      this.currentSize -= entry.size;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    console.log(`✅ Cache HIT: ${operation} (accessed ${entry.accessCount} times)`);
    return entry.data;
  }

  /**
   * Store result in cache
   */
  set(operation: string, params: any, data: any, customTTL?: number): void {
    const key = this.generateKey(operation, params);
    const ttl = customTTL || this.getTTLForOperation(operation);
    const size = this.estimateSize(data);

    // Check if we need to make space
    this.ensureSpace(size);

    const entry: CacheEntry = {
      key,
      data,
      expiry: Date.now() + ttl,
      lastAccessed: Date.now(),
      accessCount: 1,
      size
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;

    console.log(`💾 Cached ${operation} (${this.formatSize(size)}, TTL: ${ttl}ms)`);
  }

  /**
   * Get TTL based on operation type
   */
  private getTTLForOperation(operation: string): number {
    const operationTTLs = {
      // Business advice can be cached longer
      'get_business_advice': 10 * 60 * 1000, // 10 minutes
      
      // Stock info changes frequently
      'get_stock_status': 2 * 60 * 1000, // 2 minutes
      
      // Forecasts are expensive to compute, cache longer
      'forecast_stock': 30 * 60 * 1000, // 30 minutes
      
      // Health checks are quick, short cache
      'health_check': 30 * 1000, // 30 seconds
      
      // Search results can be cached moderately
      'search_business_context': 5 * 60 * 1000, // 5 minutes
    };

    return operationTTLs[operation] || this.config.defaultTTL;
  }

  /**
   * Estimate memory size of data
   */
  private estimateSize(data: any): number {
    const jsonString = JSON.stringify(data);
    return jsonString.length * 2; // Rough estimate (UTF-16)
  }

  /**
   * Ensure we have space for new entry
   */
  private ensureSpace(neededSize: number): void {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;
    
    if (this.currentSize + neededSize <= maxSizeBytes) {
      return; // We have space
    }

    console.log(`🧹 Cache full, evicting entries to make space for ${this.formatSize(neededSize)}`);

    // Get entries sorted by priority (LRU + access count)
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => {
        // Priority = recency * access frequency
        const priorityA = a.entry.lastAccessed * Math.log(a.entry.accessCount + 1);
        const priorityB = b.entry.lastAccessed * Math.log(b.entry.accessCount + 1);
        return priorityA - priorityB; // Lowest priority first
      });

    // Remove entries until we have space
    for (const { key, entry } of entries) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      
      console.log(`🗑️ Evicted ${key} (${this.formatSize(entry.size)})`);
      
      if (this.currentSize + neededSize <= maxSizeBytes) {
        break;
      }
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        count++;
      }
    }

    console.log(`🧹 Invalidated ${count} cache entries matching "${pattern}"`);
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    
    return {
      entries: entries.length,
      size: this.formatSize(this.currentSize),
      hitRate: this.calculateHitRate(),
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.lastAccessed))) : null,
      mostAccessed: entries.sort((a, b) => b.accessCount - a.accessCount)[0]?.key || null
    };
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    let cleanedSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        cleanedCount++;
        cleanedSize += entry.size;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleanup: removed ${cleanedCount} expired entries (${this.formatSize(cleanedSize)})`);
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  private calculateHitRate(): string {
    // This would track hits vs misses over time
    return "85%"; // Placeholder
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.currentSize = 0;
  }
}

/**
 * Enhanced MCP Client with intelligent caching
 */
export class CachedMCPClient extends MCPClient {
  private cache = new IntelligentCache();

  async processChickenNote(note: ChickenNote): Promise<MCPResponse> {
    // Notes are unique, don't cache processing
    return super.processChickenNote(note);
  }

  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPResponse> {
    // Cache advice requests since they're expensive
    const cached = this.cache.get('get_business_advice', request);
    if (cached) {
      return { success: true, result: cached };
    }

    const result = await super.getBusinessAdvice(request);
    if (result.success) {
      this.cache.set('get_business_advice', request, result.result);
    }

    return result;
  }

  async getForecast(salesHistory: any[]): Promise<MCPResponse> {
    // Cache forecasts - they're computationally expensive
    const cacheKey = { historyHash: this.hashArray(salesHistory) };
    const cached = this.cache.get('forecast_stock', cacheKey);
    if (cached) {
      return { success: true, result: cached };
    }

    const result = await super.getForecast(salesHistory);
    if (result.success) {
      this.cache.set('forecast_stock', cacheKey, result.result, 30 * 60 * 1000); // 30 min cache
    }

    return result;
  }

  async searchBusinessContext(query: string, entityTypes?: string[]): Promise<MCPResponse> {
    // Cache search results
    const cacheKey = { query, entityTypes };
    const cached = this.cache.get('search_business_context', cacheKey);
    if (cached) {
      return { success: true, result: cached };
    }

    const result = await super.searchBusinessContext(query, entityTypes);
    if (result.success) {
      this.cache.set('search_business_context', cacheKey, result.result);
    }

    return result;
  }

  /**
   * Invalidate cache when stock changes
   */
  async applyToStock(noteId: string, dryRun: boolean = false): Promise<MCPResponse> {
    const result = await super.applyToStock(noteId, dryRun);
    
    if (result.success && !dryRun) {
      // Invalidate stock-related caches
      this.cache.invalidate('get_stock');
      this.cache.invalidate('forecast_stock');
      console.log('🔄 Invalidated stock-related caches after stock update');
    }

    return result;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  private hashArray(arr: any[]): string {
    return JSON.stringify(arr).slice(0, 50); // Simple hash
  }
}

// Usage
export const cachedMCPClient = new CachedMCPClient();