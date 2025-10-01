/**
 * Enhanced Vector Search MCP Tools
 * Advanced vector similarity search with cross-collection capabilities and tunable thresholds
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { embeddingService } from '../services/embeddingService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface VectorSearchConfig {
  query: string;
  collections?: string[]; // Which tables/collections to search
  similarityThreshold?: number; // Minimum similarity score (0.0 to 1.0)
  maxResults?: number;
  branchId?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  includeMetadata?: boolean;
  searchType?: 'semantic' | 'hybrid' | 'fuzzy';
  boostFactors?: {
    recency?: number; // Boost recent results
    category?: Record<string, number>; // Boost specific categories
    importance?: number; // Boost high-importance items
  };
}

export interface VectorSearchResult {
  id: string;
  content: string;
  similarity: number;
  collection: string;
  metadata: {
    category?: string;
    branch_id?: string;
    created_at: string;
    importance_score?: number;
    tags?: string[];
  };
  context?: {
    table: string;
    surrounding_content?: string;
    related_items?: string[];
  };
}

export class EnhancedVectorSearchService {
  /**
   * Perform advanced vector similarity search across multiple collections
   */
  async vectorSearch(config: VectorSearchConfig): Promise<{
    results: VectorSearchResult[];
    totalFound: number;
    searchMetadata: {
      queryEmbedding?: number[];
      searchTime: number;
      collectionsSearched: string[];
      similarityThreshold: number;
    };
  }> {
    const startTime = Date.now();
    console.log('🔍 Performing enhanced vector search:', config);

    try {
      // Generate embedding for the search query
      const result = await embeddingService.generateEmbeddings([config.query]);
      const queryEmbedding = result.embeddings[0];
      
      // Default collections to search
      const collections = config.collections || ['notes', 'memories', 'operations', 'expenses'];
      const similarityThreshold = config.similarityThreshold || 0.3;
      const maxResults = config.maxResults || 20;
      
      // Perform parallel searches across all collections
      const searchPromises = collections.map(collection => 
        this.searchCollection(collection, queryEmbedding, {
          ...config,
          similarityThreshold,
          maxResults: Math.ceil(maxResults / collections.length) + 5 // Get more per collection then filter
        })
      );
      
      const collectionResults = await Promise.allSettled(searchPromises);
      
      // Combine and rank results
      const allResults: VectorSearchResult[] = [];
      const collectionsSearched: string[] = [];
      
      collectionResults.forEach((result, index) => {
        const collection = collections[index];
        collectionsSearched.push(collection);
        
        if (result.status === 'fulfilled' && result.value.length > 0) {
          allResults.push(...result.value);
        } else if (result.status === 'rejected') {
          console.warn(`⚠️ Search failed for collection ${collection}:`, result.reason);
        }
      });
      
      // Apply advanced ranking and filtering
      const rankedResults = this.rankAndFilterResults(allResults, config);
      
      // Limit to requested number of results
      const finalResults = rankedResults.slice(0, maxResults);
      
      const searchTime = Date.now() - startTime;
      console.log(`✅ Vector search completed in ${searchTime}ms, found ${finalResults.length} results`);
      
      return {
        results: finalResults,
        totalFound: allResults.length,
        searchMetadata: {
          queryEmbedding: config.includeMetadata ? queryEmbedding : undefined,
          searchTime,
          collectionsSearched,
          similarityThreshold
        }
      };
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Search a specific collection/table
   */
  private async searchCollection(
    collection: string, 
    queryEmbedding: number[], 
    config: VectorSearchConfig
  ): Promise<VectorSearchResult[]> {
    try {
      let query;
      
      switch (collection) {
        case 'notes':
          query = supabase.rpc('vector_search_notes', {
            query_embedding: queryEmbedding,
            similarity_threshold: config.similarityThreshold,
            match_count: config.maxResults
          });
          break;
          
        case 'memories':
          query = supabase.rpc('vector_search_memories', {
            query_embedding: queryEmbedding,
            similarity_threshold: config.similarityThreshold,
            match_count: config.maxResults
          });
          break;
          
        case 'operations':
          // For operations, search description field
          query = supabase.rpc('vector_search_operations', {
            query_embedding: queryEmbedding,
            similarity_threshold: config.similarityThreshold,
            match_count: config.maxResults
          });
          break;
          
        case 'expenses':
          // For expenses, search category and description
          query = supabase.rpc('vector_search_expenses', {
            query_embedding: queryEmbedding,
            similarity_threshold: config.similarityThreshold,
            match_count: config.maxResults
          });
          break;
          
        default:
          console.warn(`⚠️ Unknown collection: ${collection}`);
          return [];
      }
      
      // Apply filters
      if (config.branchId) {
        query = query.eq('branch_id', config.branchId);
      }
      
      if (config.dateRange?.start) {
        query = query.gte('created_at', config.dateRange.start);
      }
      
      if (config.dateRange?.end) {
        query = query.lte('created_at', config.dateRange.end);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`❌ Search failed for ${collection}:`, error);
        return [];
      }
      
      // Transform results to common format
      return (data || []).map((item: any) => ({
        id: item.id,
        content: this.extractContent(item, collection),
        similarity: item.similarity || 0,
        collection,
        metadata: {
          category: item.category,
          branch_id: item.branch_id,
          created_at: item.created_at,
          importance_score: item.importance_score,
          tags: item.tags || []
        },
        context: {
          table: collection,
          surrounding_content: item.surrounding_content,
          related_items: item.related_items || []
        }
      }));
    } catch (error) {
      console.error(`❌ Failed to search collection ${collection}:`, error);
      return [];
    }
  }

  /**
   * Extract content from different data types
   */
  private extractContent(item: any, collection: string): string {
    switch (collection) {
      case 'notes':
        return item.content || item.text || '';
      case 'memories':
        return item.observation || item.content || '';
      case 'operations':
        return `${item.operation_type || ''}: ${item.description || ''}`.trim();
      case 'expenses':
        return `${item.category || ''}: ${item.description || ''} - ${item.amount || 0} PHP`.trim();
      default:
        return item.content || item.text || item.description || '';
    }
  }

  /**
   * Advanced ranking and filtering of results
   */
  private rankAndFilterResults(results: VectorSearchResult[], config: VectorSearchConfig): VectorSearchResult[] {
    let scored = results.map(result => {
      let score = result.similarity;
      
      // Apply boost factors
      if (config.boostFactors) {
        // Recency boost
        if (config.boostFactors.recency) {
          const daysSinceCreated = (Date.now() - new Date(result.metadata.created_at).getTime()) / (1000 * 60 * 60 * 24);
          const recencyBoost = Math.max(0, 1 - (daysSinceCreated / 365)) * config.boostFactors.recency;
          score += recencyBoost;
        }
        
        // Category boost
        if (config.boostFactors.category && result.metadata.category) {
          const categoryBoost = config.boostFactors.category[result.metadata.category] || 0;
          score += categoryBoost;
        }
        
        // Importance boost
        if (config.boostFactors.importance && result.metadata.importance_score) {
          score += result.metadata.importance_score * config.boostFactors.importance;
        }
      }
      
      return { ...result, adjustedScore: score };
    });
    
    // Sort by adjusted score
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
    
    // Remove adjusted score before returning
    return scored.map(({ adjustedScore, ...result }) => result);
  }

  /**
   * Perform cross-collection similarity search
   */
  async crossCollectionSearch(config: {
    sourceId: string;
    sourceCollection: string;
    targetCollections?: string[];
    similarityThreshold?: number;
    maxResults?: number;
    branchId?: string;
  }): Promise<{
    sourceItem: any;
    similarItems: VectorSearchResult[];
  }> {
    try {
      console.log('🔄 Performing cross-collection search:', config);
      
      // Get the source item and its embedding
      const sourceItem = await this.getItemById(config.sourceCollection, config.sourceId);
      if (!sourceItem) {
        throw new Error(`Source item not found: ${config.sourceId} in ${config.sourceCollection}`);
      }
      
      // Extract content for embedding
      const sourceContent = this.extractContent(sourceItem, config.sourceCollection);
      
      // Perform vector search using source content
      const searchResults = await this.vectorSearch({
        query: sourceContent,
        collections: config.targetCollections || ['notes', 'memories', 'operations', 'expenses'],
        similarityThreshold: config.similarityThreshold || 0.4,
        maxResults: config.maxResults || 10,
        branchId: config.branchId,
        includeMetadata: true
      });
      
      // Filter out the source item itself
      const similarItems = searchResults.results.filter(
        result => !(result.collection === config.sourceCollection && result.id === config.sourceId)
      );
      
      return {
        sourceItem,
        similarItems
      };
    } catch (error) {
      console.error('❌ Cross-collection search failed:', error);
      throw error;
    }
  }

  /**
   * Get item by ID from a collection
   */
  private async getItemById(collection: string, id: string): Promise<any> {
    const { data, error } = await supabase
      .from(collection)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Semantic clustering of search results
   */
  async clusterResults(results: VectorSearchResult[], numClusters: number = 3): Promise<{
    clusters: Array<{
      id: number;
      centroid: string;
      items: VectorSearchResult[];
      theme: string;
    }>;
  }> {
    console.log(`🎯 Clustering ${results.length} results into ${numClusters} clusters`);
    
    // Simple clustering based on content similarity
    const clusters: Array<{
      id: number;
      centroid: string;
      items: VectorSearchResult[];
      theme: string;
    }> = [];
    
    // Initialize clusters with most diverse results
    const usedIndices = new Set<number>();
    
    for (let i = 0; i < numClusters && i < results.length; i++) {
      const centroidIndex = this.findMostDiverseResult(results, usedIndices);
      usedIndices.add(centroidIndex);
      
      clusters.push({
        id: i,
        centroid: results[centroidIndex].content,
        items: [results[centroidIndex]],
        theme: this.extractTheme(results[centroidIndex])
      });
    }
    
    // Assign remaining results to nearest cluster
    for (let i = 0; i < results.length; i++) {
      if (usedIndices.has(i)) continue;
      
      const result = results[i];
      let bestCluster = 0;
      let bestSimilarity = 0;
      
      for (let j = 0; j < clusters.length; j++) {
        // Simple similarity based on content length and common words
        const similarity = this.calculateContentSimilarity(result.content, clusters[j].centroid);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = j;
        }
      }
      
      clusters[bestCluster].items.push(result);
    }
    
    return { clusters };
  }

  /**
   * Find the most diverse result for cluster initialization
   */
  private findMostDiverseResult(results: VectorSearchResult[], usedIndices: Set<number>): number {
    if (usedIndices.size === 0) return 0;
    
    let mostDiverseIndex = 0;
    let maxDiversityScore = -1;
    
    for (let i = 0; i < results.length; i++) {
      if (usedIndices.has(i)) continue;
      
      let diversityScore = 0;
      for (const usedIndex of usedIndices) {
        diversityScore += 1 - this.calculateContentSimilarity(
          results[i].content,
          results[usedIndex].content
        );
      }
      
      if (diversityScore > maxDiversityScore) {
        maxDiversityScore = diversityScore;
        mostDiverseIndex = i;
      }
    }
    
    return mostDiverseIndex;
  }

  /**
   * Calculate simple content similarity
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract theme from result
   */
  private extractTheme(result: VectorSearchResult): string {
    if (result.metadata.category) {
      return result.metadata.category;
    }
    
    // Extract theme from content
    const words = result.content.toLowerCase().split(/\s+/);
    const commonBusinessWords = ['sale', 'chicken', 'expense', 'inventory', 'customer', 'order', 'delivery'];
    
    for (const word of commonBusinessWords) {
      if (words.includes(word)) {
        return word;
      }
    }
    
    return result.collection;
  }
}

// Singleton instance
export const enhancedVectorSearchService = new EnhancedVectorSearchService();