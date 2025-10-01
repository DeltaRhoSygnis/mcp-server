/**
 * PRODUCTION Intelligent Cache System for Charnoks Chicken Business
 * Production-ready caching specifically designed for chicken business operations
 * Optimizes: Business Advice, Forecasts, Context Searches, Note Processing Results
 */

import { MCPResponse } from './mcpClient';

export interface ChickenBusinessCacheEntry {
  key: string;
  data: any;
  type: 'business_advice' | 'forecast' | 'context_search' | 'parsed_note' | 'stock_info' | 'supplier_data';
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
  businessValue: 'high' | 'medium' | 'low'; // Business importance
  userRole: 'owner' | 'worker';
  branchId: string;
  metadata?: {
    cost?: number; // Cost saved by caching
    processingTime?: number; // Time saved
    relatedOperations?: string[];
  };
}

export interface CacheMetrics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  costSavings: number;
  memoryUsage: number;
  lastCleanup: Date;
}

/**
 * Production Cache System for Charnoks Chicken Business
 */
export class ChickenBusinessCache {
  private db: IDBDatabase | null = null;
  private memoryCache: Map<string, ChickenBusinessCacheEntry> = new Map();
  private maxMemorySize = 50 * 1024 * 1024; // 50MB memory limit
  private currentMemorySize = 0;
  private hitCount = 0;
  private missCount = 0;
  private cleanupInterval = 15 * 60 * 1000; // 15 minutes
  
  // TTL configurations for different data types (in milliseconds)
  private ttlConfig = {
    'business_advice': 60 * 60 * 1000, // 1 hour - business advice stays relevant
    'forecast': 4 * 60 * 60 * 1000, // 4 hours - forecasts need regular updates  
    'context_search': 30 * 60 * 1000, // 30 minutes - search results change
    'parsed_note': 24 * 60 * 60 * 1000, // 24 hours - parsed notes are stable
    'stock_info': 10 * 60 * 1000, // 10 minutes - stock changes frequently
    'supplier_data': 2 * 60 * 60 * 1000 // 2 hours - supplier info relatively stable
  };

  // Cache priority for LRU eviction
  private businessValuePriority = {
    'high': 3,
    'medium': 2, 
    'low': 1
  };

  constructor() {
    this.setupPeriodicCleanup();
    this.setupMemoryMonitoring();
  }

  /**
   * Initialize IndexedDB for persistent caching
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CharnoksBusinessCache', 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Main cache store
        if (!db.objectStoreNames.contains('business_cache')) {
          const store = db.createObjectStore('business_cache', { keyPath: 'key' });
          store.createIndex('type', 'type');
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('lastAccessed', 'lastAccessed');
          store.createIndex('businessValue', 'businessValue');
          store.createIndex('userRole', 'userRole');
          store.createIndex('branchId', 'branchId');
        }
        
        // Cache metrics store
        if (!db.objectStoreNames.contains('cache_metrics')) {
          const metricsStore = db.createObjectStore('cache_metrics', { keyPath: 'date' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadMemoryCache();
        console.log('✅ Charnoks business cache initialized');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to initialize business cache');
        reject(request.error);
      };
    });
  }

  /**
   * Get cached data with chicken business logic
   */
  async get(
    key: string, 
    type: ChickenBusinessCacheEntry['type'],
    context?: { userRole?: 'owner' | 'worker'; branchId?: string }
  ): Promise<any | null> {
    console.log(`🔍 Cache lookup: ${key} (${type})`);

    // Try memory cache first (fastest)
    let entry = this.memoryCache.get(key);
    
    // Fallback to IndexedDB if not in memory
    if (!entry && this.db) {
      entry = await this.getFromIndexedDB(key);
      if (entry) {
        this.addToMemoryCache(entry);
      }
    }

    if (!entry) {
      this.missCount++;
      console.log(`❌ Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      console.log(`⏰ Cache expired: ${key}`);
      await this.remove(key);
      this.missCount++;
      return null;
    }

    // Check business context validity
    if (context && !this.isContextValid(entry, context)) {
      console.log(`🚫 Cache context invalid: ${key}`);
      this.missCount++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateEntryAsync(entry);

    this.hitCount++;
    console.log(`✅ Cache hit: ${key} (Accessed ${entry.accessCount} times)`);
    
    return entry.data;
  }

  /**
   * Store data in cache with chicken business optimization
   */
  async set(
    key: string,
    data: any,
    type: ChickenBusinessCacheEntry['type'],
    options: {
      userRole: 'owner' | 'worker';
      branchId?: string;
      businessValue?: 'high' | 'medium' | 'low';
      customTTL?: number;
      metadata?: ChickenBusinessCacheEntry['metadata'];
    }
  ): Promise<void> {
    console.log(`💾 Caching: ${key} (${type})`);

    const entry: ChickenBusinessCacheEntry = {
      key,
      data,
      type,
      timestamp: Date.now(),
      ttl: options.customTTL || this.ttlConfig[type] || 60 * 60 * 1000,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.estimateSize(data),
      businessValue: options.businessValue || this.getDefaultBusinessValue(type),
      userRole: options.userRole,
      branchId: options.branchId || 'main',
      metadata: {
        cost: this.estimateCostSavings(type),
        processingTime: this.estimateProcessingTime(type),
        ...options.metadata
      }
    };

    // Store in memory cache (with size management)
    await this.addToMemoryCache(entry);
    
    // Store in IndexedDB for persistence
    if (this.db) {
      await this.storeInIndexedDB(entry);
    }

    console.log(`✅ Cached: ${key} (Size: ${entry.size} bytes, Value: ${entry.businessValue})`);
  }

  /**
   * Smart cache invalidation for chicken business
   */
  async invalidateByPattern(
    pattern: RegExp | string,
    type?: ChickenBusinessCacheEntry['type'],
    context?: { userRole?: 'owner' | 'worker'; branchId?: string }
  ): Promise<number> {
    console.log(`🗑️ Invalidating cache pattern: ${pattern}`);

    let invalidatedCount = 0;
    const keysToRemove: string[] = [];

    // Check memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.matchesPattern(key, pattern) && 
          (!type || entry.type === type) &&
          (!context || this.isContextValid(entry, context))) {
        keysToRemove.push(key);
      }
    }

    // Remove from memory
    for (const key of keysToRemove) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= this.memoryCache.get(key)?.size || 0;
      invalidatedCount++;
    }

    // Remove from IndexedDB
    if (this.db && keysToRemove.length > 0) {
      const transaction = this.db.transaction(['business_cache'], 'readwrite');
      const store = transaction.objectStore('business_cache');
      
      for (const key of keysToRemove) {
        store.delete(key);
      }
    }

    console.log(`✅ Invalidated ${invalidatedCount} cache entries`);
    return invalidatedCount;
  }

  /**
   * Chicken business specific cache strategies
   */
  async cacheBusinessAdvice(question: string, answer: any, userRole: 'owner' | 'worker'): Promise<void> {
    const key = `advice_${this.hashString(question)}_${userRole}`;
    await this.set(key, answer, 'business_advice', {
      userRole,
      businessValue: 'high',
      metadata: {
        cost: 1.00, // 1 peso saved per cached advice
        processingTime: 3000 // 3 seconds saved
      }
    });
  }

  async cacheForecast(salesHistory: any[], forecast: any, userRole: 'owner' | 'worker'): Promise<void> {
    const historyHash = this.hashString(JSON.stringify(salesHistory));
    const key = `forecast_${historyHash}_${userRole}`;
    await this.set(key, forecast, 'forecast', {
      userRole,
      businessValue: 'high',
      customTTL: 4 * 60 * 60 * 1000, // 4 hours
      metadata: {
        cost: 2.00, // 2 pesos saved per cached forecast
        processingTime: 5000 // 5 seconds saved
      }
    });
  }

  async cacheContextSearch(query: string, results: any, userRole: 'owner' | 'worker'): Promise<void> {
    const key = `search_${this.hashString(query)}_${userRole}`;
    await this.set(key, results, 'context_search', {
      userRole,
      businessValue: 'medium',
      metadata: {
        cost: 0.10, // 10 centavos saved per cached search
        processingTime: 1500 // 1.5 seconds saved
      }
    });
  }

  async cacheParsedNote(noteContent: string, parsedData: any, userRole: 'owner' | 'worker'): Promise<void> {
    const key = `note_${this.hashString(noteContent)}_${userRole}`;
    await this.set(key, parsedData, 'parsed_note', {
      userRole,
      businessValue: 'medium',
      customTTL: 24 * 60 * 60 * 1000, // 24 hours
      metadata: {
        cost: 0.50, // 50 centavos saved per cached note
        processingTime: 2000 // 2 seconds saved
      }
    });
  }

  /**
   * Get chicken business advice from cache
   */
  async getCachedBusinessAdvice(question: string, userRole: 'owner' | 'worker'): Promise<any | null> {
    const key = `advice_${this.hashString(question)}_${userRole}`;
    return this.get(key, 'business_advice', { userRole });
  }

  async getCachedForecast(salesHistory: any[], userRole: 'owner' | 'worker'): Promise<any | null> {
    const historyHash = this.hashString(JSON.stringify(salesHistory));
    const key = `forecast_${historyHash}_${userRole}`;
    return this.get(key, 'forecast', { userRole });
  }

  async getCachedContextSearch(query: string, userRole: 'owner' | 'worker'): Promise<any | null> {
    const key = `search_${this.hashString(query)}_${userRole}`;
    return this.get(key, 'context_search', { userRole });
  }

  async getCachedParsedNote(noteContent: string, userRole: 'owner' | 'worker'): Promise<any | null> {
    const key = `note_${this.hashString(noteContent)}_${userRole}`;
    return this.get(key, 'parsed_note', { userRole });
  }

  /**
   * Memory management with LRU eviction
   */
  private async addToMemoryCache(entry: ChickenBusinessCacheEntry): Promise<void> {
    // Check if we need to free memory
    while (this.currentMemorySize + entry.size > this.maxMemorySize && this.memoryCache.size > 0) {
      await this.evictLeastValuable();
    }

    // Remove existing entry if updating
    if (this.memoryCache.has(entry.key)) {
      const existing = this.memoryCache.get(entry.key)!;
      this.currentMemorySize -= existing.size;
    }

    // Add new entry
    this.memoryCache.set(entry.key, entry);
    this.currentMemorySize += entry.size;
  }

  /**
   * Evict least valuable entry (considering business value and LRU)
   */
  private async evictLeastValuable(): Promise<void> {
    let leastValuableKey: string | null = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this.memoryCache) {
      // Score based on business value, access frequency, and recency
      const businessScore = this.businessValuePriority[entry.businessValue];
      const accessScore = Math.log(entry.accessCount + 1);
      const recencyScore = (Date.now() - entry.lastAccessed) / (1000 * 60); // Minutes since last access
      
      const totalScore = businessScore * 10 + accessScore - recencyScore * 0.1;

      if (totalScore < lowestScore) {
        lowestScore = totalScore;
        leastValuableKey = key;
      }
    }

    if (leastValuableKey) {
      const evicted = this.memoryCache.get(leastValuableKey)!;
      this.memoryCache.delete(leastValuableKey);
      this.currentMemorySize -= evicted.size;
      console.log(`🗑️ Evicted from memory: ${leastValuableKey} (Value: ${evicted.businessValue})`);
    }
  }

  /**
   * Load most valuable entries into memory cache
   */
  private async loadMemoryCache(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['business_cache'], 'readonly');
    const store = transaction.objectStore('business_cache');
    
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = request.result as ChickenBusinessCacheEntry[];
      
      // Sort by business value and access patterns
      entries.sort((a, b) => {
        const aScore = this.businessValuePriority[a.businessValue] * 10 + Math.log(a.accessCount + 1);
        const bScore = this.businessValuePriority[b.businessValue] * 10 + Math.log(b.accessCount + 1);
        return bScore - aScore;
      });

      // Load top entries until memory limit
      let loadedSize = 0;
      let loadedCount = 0;
      for (const entry of entries) {
        if (loadedSize + entry.size > this.maxMemorySize) break;
        if (this.isExpired(entry)) continue;

        this.memoryCache.set(entry.key, entry);
        loadedSize += entry.size;
        loadedCount++;
      }

      this.currentMemorySize = loadedSize;
      console.log(`🚀 Loaded ${loadedCount} cache entries into memory (${loadedSize} bytes)`);
    };
  }

  /**
   * Periodic cleanup of expired entries
   */
  private setupPeriodicCleanup(): void {
    setInterval(async () => {
      await this.cleanupExpired();
      await this.updateMetrics();
    }, this.cleanupInterval);
  }

  /**
   * Monitor memory usage
   */
  private setupMemoryMonitoring(): void {
    setInterval(() => {
      const memoryPercent = (this.currentMemorySize / this.maxMemorySize) * 100;
      if (memoryPercent > 80) {
        console.warn(`⚠️ Cache memory usage high: ${memoryPercent.toFixed(1)}%`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Utility methods
   */
  private isExpired(entry: ChickenBusinessCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private isContextValid(entry: ChickenBusinessCacheEntry, context: { userRole?: string; branchId?: string }): boolean {
    if (context.userRole && entry.userRole !== context.userRole) return false;
    if (context.branchId && entry.branchId !== context.branchId) return false;
    return true;
  }

  private matchesPattern(key: string, pattern: RegExp | string): boolean {
    if (typeof pattern === 'string') {
      return key.includes(pattern);
    }
    return pattern.test(key);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
  }

  private getDefaultBusinessValue(type: ChickenBusinessCacheEntry['type']): 'high' | 'medium' | 'low' {
    const valueMap = {
      'business_advice': 'high',
      'forecast': 'high', 
      'parsed_note': 'medium',
      'context_search': 'medium',
      'stock_info': 'low',
      'supplier_data': 'low'
    };
    return valueMap[type] || 'medium';
  }

  private estimateCostSavings(type: ChickenBusinessCacheEntry['type']): number {
    const costMap = {
      'business_advice': 1.00,
      'forecast': 2.00,
      'parsed_note': 0.50,
      'context_search': 0.10,
      'stock_info': 0.25,
      'supplier_data': 0.15
    };
    return costMap[type] || 0.50;
  }

  private estimateProcessingTime(type: ChickenBusinessCacheEntry['type']): number {
    const timeMap = {
      'business_advice': 3000,
      'forecast': 5000,
      'parsed_note': 2000,
      'context_search': 1500,
      'stock_info': 1000,
      'supplier_data': 1200
    };
    return timeMap[type] || 2000;
  }

  // IndexedDB operations
  private async getFromIndexedDB(key: string): Promise<ChickenBusinessCacheEntry | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['business_cache'], 'readonly');
    const store = transaction.objectStore('business_cache');
    
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async storeInIndexedDB(entry: ChickenBusinessCacheEntry): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['business_cache'], 'readwrite');
    const store = transaction.objectStore('business_cache');
    store.put(entry);
  }

  private async updateEntryAsync(entry: ChickenBusinessCacheEntry): Promise<void> {
    // Update in memory (already done)
    // Update in IndexedDB asynchronously
    setTimeout(() => {
      if (this.db) {
        const transaction = this.db.transaction(['business_cache'], 'readwrite');
        const store = transaction.objectStore('business_cache');
        store.put(entry);
      }
    }, 0);
  }

  private async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    if (this.db) {
      const transaction = this.db.transaction(['business_cache'], 'readwrite');
      const store = transaction.objectStore('business_cache');
      store.delete(key);
    }
  }

  private async cleanupExpired(): Promise<void> {
    console.log('🧹 Cleaning up expired cache entries...');
    
    let cleanedCount = 0;
    const keysToRemove: string[] = [];

    // Check memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        keysToRemove.push(key);
      }
    }

    // Remove expired from memory
    for (const key of keysToRemove) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.currentMemorySize -= entry.size;
      }
      this.memoryCache.delete(key);
      cleanedCount++;
    }

    // Clean IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['business_cache'], 'readwrite');
      const store = transaction.objectStore('business_cache');
      
      const request = store.getAll();
      request.onsuccess = () => {
        const entries = request.result as ChickenBusinessCacheEntry[];
        for (const entry of entries) {
          if (this.isExpired(entry)) {
            store.delete(entry.key);
            cleanedCount++;
          }
        }
      };
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  private async updateMetrics(): Promise<void> {
    if (!this.db) return;
    
    const total = this.hitCount + this.missCount;
    const metrics: CacheMetrics = {
      totalEntries: this.memoryCache.size,
      totalSize: this.currentMemorySize,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      missRate: total > 0 ? (this.missCount / total) * 100 : 0,
      averageResponseTime: 50, // Estimated cache response time
      costSavings: this.calculateTotalCostSavings(),
      memoryUsage: (this.currentMemorySize / this.maxMemorySize) * 100,
      lastCleanup: new Date()
    };

    const transaction = this.db.transaction(['cache_metrics'], 'readwrite');
    const store = transaction.objectStore('cache_metrics');
    store.put({ date: new Date().toDateString(), ...metrics });
  }

  private calculateTotalCostSavings(): number {
    let totalSavings = 0;
    for (const entry of this.memoryCache.values()) {
      totalSavings += (entry.metadata?.cost || 0) * entry.accessCount;
    }
    return totalSavings;
  }

  /**
   * Get cache metrics for business dashboard
   */
  async getMetrics(): Promise<CacheMetrics | null> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['cache_metrics'], 'readonly');
    const store = transaction.objectStore('cache_metrics');
    
    return new Promise((resolve) => {
      const request = store.get(new Date().toDateString());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Clear all cache (for testing or reset)
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.currentMemorySize = 0;
    this.hitCount = 0;
    this.missCount = 0;

    if (this.db) {
      const transaction = this.db.transaction(['business_cache'], 'readwrite');
      const store = transaction.objectStore('business_cache');
      store.clear();
    }

    console.log('🗑️ Cache cleared completely');
  }
}

// Default instance for chicken business
export const chickenBusinessCache = new ChickenBusinessCache();

// Auto-initialize
chickenBusinessCache.initialize().catch(console.error);

export default ChickenBusinessCache;