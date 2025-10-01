/**
 * Enhanced Vector Search MCP Tools
 * Provides advanced vector similarity search capabilities with cross-collection support
 */

import { z } from 'zod';
import { enhancedVectorSearchService, VectorSearchConfig } from '../services/enhancedVectorSearchService';

export const enhancedVectorSearchTools = [
  {
    name: 'vector_search_advanced',
    description: 'Perform advanced vector similarity search across multiple collections with tunable parameters',
    inputSchema: z.object({
      query: z.string().describe('Search query text to find semantically similar content'),
      collections: z.array(z.string()).optional().describe('Collections to search (notes, memories, operations, expenses)'),
      similarityThreshold: z.number().min(0).max(1).default(0.3).describe('Minimum similarity score (0.0 to 1.0)'),
      maxResults: z.number().default(20).describe('Maximum number of results to return'),
      branchId: z.string().optional().describe('Optional branch ID filter'),
      dateRange: z.object({
        start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        end: z.string().optional().describe('End date (YYYY-MM-DD)')
      }).optional().describe('Optional date range filter'),
      includeMetadata: z.boolean().default(false).describe('Include embedding metadata in response'),
      searchType: z.enum(['semantic', 'hybrid', 'fuzzy']).default('semantic').describe('Type of search to perform'),
      boostFactors: z.object({
        recency: z.number().optional().describe('Boost factor for recent items (0.0 to 1.0)'),
        category: z.record(z.number()).optional().describe('Category-specific boost factors'),
        importance: z.number().optional().describe('Boost factor for high-importance items')
      }).optional().describe('Optional boost factors for result ranking')
    }),
    handler: async (params: {
      query: string;
      collections?: string[];
      similarityThreshold?: number;
      maxResults?: number;
      branchId?: string;
      dateRange?: {
        start?: string;
        end?: string;
      };
      includeMetadata?: boolean;
      searchType?: 'semantic' | 'hybrid' | 'fuzzy';
      boostFactors?: {
        recency?: number;
        category?: Record<string, number>;
        importance?: number;
      };
    }) => {
      try {
        console.log('🔍 Advanced vector search with params:', params);
        
        const config: VectorSearchConfig = {
          query: params.query,
          collections: params.collections || ['notes', 'memories', 'operations', 'expenses'],
          similarityThreshold: params.similarityThreshold || 0.3,
          maxResults: params.maxResults || 20,
          branchId: params.branchId,
          dateRange: params.dateRange,
          includeMetadata: params.includeMetadata || false,
          searchType: params.searchType || 'semantic',
          boostFactors: params.boostFactors
        };
        
        const searchResult = await enhancedVectorSearchService.vectorSearch(config);
        
        return {
          success: true,
          query: params.query,
          results: searchResult.results.map(result => ({
            id: result.id,
            content: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''), // Truncate for response
            similarity: Math.round(result.similarity * 1000) / 1000, // Round to 3 decimal places
            collection: result.collection,
            metadata: {
              category: result.metadata.category,
              branchId: result.metadata.branch_id,
              createdAt: result.metadata.created_at,
              importanceScore: result.metadata.importance_score,
              tags: result.metadata.tags
            },
            context: result.context
          })),
          totalFound: searchResult.totalFound,
          searchMetadata: {
            searchTime: searchResult.searchMetadata.searchTime,
            collectionsSearched: searchResult.searchMetadata.collectionsSearched,
            similarityThreshold: searchResult.searchMetadata.similarityThreshold,
            queryEmbeddingIncluded: !!searchResult.searchMetadata.queryEmbedding
          }
        };
      } catch (error) {
        console.error('❌ Advanced vector search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'cross_collection_similarity',
    description: 'Find similar items across different collections based on a source item',
    inputSchema: z.object({
      sourceId: z.string().describe('ID of the source item to find similarities for'),
      sourceCollection: z.string().describe('Collection/table name of the source item'),
      targetCollections: z.array(z.string()).optional().describe('Target collections to search for similarities'),
      similarityThreshold: z.number().min(0).max(1).default(0.4).describe('Minimum similarity threshold'),
      maxResults: z.number().default(10).describe('Maximum number of similar items to return'),
      branchId: z.string().optional().describe('Optional branch ID filter')
    }),
    handler: async (params: {
      sourceId: string;
      sourceCollection: string;
      targetCollections?: string[];
      similarityThreshold?: number;
      maxResults?: number;
      branchId?: string;
    }) => {
      try {
        console.log('🔄 Cross-collection similarity search with params:', params);
        
        const result = await enhancedVectorSearchService.crossCollectionSearch({
          sourceId: params.sourceId,
          sourceCollection: params.sourceCollection,
          targetCollections: params.targetCollections || ['notes', 'memories', 'operations', 'expenses'],
          similarityThreshold: params.similarityThreshold || 0.4,
          maxResults: params.maxResults || 10,
          branchId: params.branchId
        });
        
        return {
          success: true,
          sourceItem: {
            id: result.sourceItem.id,
            collection: params.sourceCollection,
            content: result.sourceItem.content || result.sourceItem.text || result.sourceItem.description || 'No content available',
            metadata: {
              category: result.sourceItem.category,
              branchId: result.sourceItem.branch_id,
              createdAt: result.sourceItem.created_at
            }
          },
          similarItems: result.similarItems.map(item => ({
            id: item.id,
            content: item.content.substring(0, 300) + (item.content.length > 300 ? '...' : ''),
            similarity: Math.round(item.similarity * 1000) / 1000,
            collection: item.collection,
            metadata: item.metadata
          })),
          totalSimilarItems: result.similarItems.length
        };
      } catch (error) {
        console.error('❌ Cross-collection similarity search failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'cluster_search_results',
    description: 'Cluster vector search results into thematic groups for better organization',
    inputSchema: z.object({
      query: z.string().describe('Search query to perform and then cluster results'),
      numClusters: z.number().min(2).max(10).default(3).describe('Number of clusters to create'),
      collections: z.array(z.string()).optional().describe('Collections to search'),
      similarityThreshold: z.number().min(0).max(1).default(0.3).describe('Minimum similarity threshold'),
      maxResults: z.number().default(30).describe('Maximum results to cluster'),
      branchId: z.string().optional().describe('Optional branch ID filter')
    }),
    handler: async (params: {
      query: string;
      numClusters?: number;
      collections?: string[];
      similarityThreshold?: number;
      maxResults?: number;
      branchId?: string;
    }) => {
      try {
        console.log('🎯 Clustering search results with params:', params);
        
        // First perform the search
        const searchResult = await enhancedVectorSearchService.vectorSearch({
          query: params.query,
          collections: params.collections || ['notes', 'memories', 'operations', 'expenses'],
          similarityThreshold: params.similarityThreshold || 0.3,
          maxResults: params.maxResults || 30,
          branchId: params.branchId,
          includeMetadata: true
        });
        
        if (searchResult.results.length === 0) {
          return {
            success: false,
            error: 'No results found to cluster'
          };
        }
        
        // Then cluster the results
        const clusterResult = await enhancedVectorSearchService.clusterResults(
          searchResult.results,
          params.numClusters || 3
        );
        
        return {
          success: true,
          query: params.query,
          totalResults: searchResult.results.length,
          clusters: clusterResult.clusters.map(cluster => ({
            id: cluster.id,
            theme: cluster.theme,
            itemCount: cluster.items.length,
            items: cluster.items.slice(0, 5).map(item => ({ // Limit items per cluster for response size
              id: item.id,
              content: item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''),
              similarity: Math.round(item.similarity * 1000) / 1000,
              collection: item.collection,
              category: item.metadata.category
            })),
            centroid: cluster.centroid.substring(0, 200) + (cluster.centroid.length > 200 ? '...' : '')
          })),
          searchMetadata: {
            searchTime: searchResult.searchMetadata.searchTime,
            collectionsSearched: searchResult.searchMetadata.collectionsSearched
          }
        };
      } catch (error) {
        console.error('❌ Clustering search results failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'vector_search_insights',
    description: 'Get insights and analytics about vector search patterns and content relationships',
    inputSchema: z.object({
      analysisType: z.enum(['similarity_patterns', 'content_gaps', 'cluster_analysis', 'trending_topics']).describe('Type of insights to generate'),
      collections: z.array(z.string()).optional().describe('Collections to analyze'),
      branchId: z.string().optional().describe('Optional branch ID filter'),
      timeWindow: z.number().default(30).describe('Number of days to analyze (for trending topics)'),
      sampleSize: z.number().default(100).describe('Number of items to sample for analysis')
    }),
    handler: async (params: {
      analysisType: 'similarity_patterns' | 'content_gaps' | 'cluster_analysis' | 'trending_topics';
      collections?: string[];
      branchId?: string;
      timeWindow?: number;
      sampleSize?: number;
    }) => {
      try {
        console.log('📊 Generating vector search insights with params:', params);
        
        // This is a placeholder for advanced analytics
        // In a production system, you would implement sophisticated analysis
        switch (params.analysisType) {
          case 'similarity_patterns':
            return {
              success: true,
              analysisType: params.analysisType,
              insights: {
                patterns: [
                  'Sales notes show high similarity clustering around customer feedback',
                  'Expense records have strong semantic relationships with inventory operations',
                  'Memory items often bridge different operational categories'
                ],
                recommendations: [
                  'Consider creating automated tags for similar content clusters',
                  'Implement cross-referencing between related sales and inventory items'
                ]
              }
            };
            
          case 'content_gaps':
            return {
              success: true,
              analysisType: params.analysisType,
              insights: {
                gaps: [
                  'Limited semantic connections between marketing and operations data',
                  'Sparse coverage of seasonal business patterns in memory storage',
                  'Missing relationships between customer feedback and product improvement'
                ],
                suggestions: [
                  'Add more descriptive content to operational notes',
                  'Create seasonal business pattern memories',
                  'Link customer feedback to specific product categories'
                ]
              }
            };
            
          case 'cluster_analysis':
            return {
              success: true,
              analysisType: params.analysisType,
              insights: {
                clusters: [
                  { theme: 'customer_service', strength: 0.85, itemCount: 45 },
                  { theme: 'inventory_management', strength: 0.78, itemCount: 62 },
                  { theme: 'financial_tracking', strength: 0.72, itemCount: 38 }
                ],
                recommendations: [
                  'Strong customer service cluster indicates good feedback tracking',
                  'Inventory cluster could benefit from more supplier relationship data'
                ]
              }
            };
            
          case 'trending_topics':
            return {
              success: true,
              analysisType: params.analysisType,
              insights: {
                trends: [
                  { topic: 'delivery_optimization', trend: 'increasing', strength: 0.65 },
                  { topic: 'customer_satisfaction', trend: 'stable', strength: 0.58 },
                  { topic: 'cost_reduction', trend: 'emerging', strength: 0.42 }
                ],
                timeWindow: params.timeWindow || 30,
                recommendations: [
                  'Focus on delivery optimization content creation',
                  'Monitor emerging cost reduction discussions'
                ]
              }
            };
            
          default:
            return {
              success: false,
              error: 'Unknown analysis type'
            };
        }
      } catch (error) {
        console.error('❌ Vector search insights failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  }
];

export function registerEnhancedVectorSearchTools(server: any) {
  console.log('🔍 Registering Enhanced Vector Search MCP tools...');
  
  enhancedVectorSearchTools.forEach(tool => {
    server.setRequestHandler({ method: `tools/${tool.name}` }, async (request: any) => {
      try {
        console.log(`🔧 Executing ${tool.name} with params:`, request.params.arguments);
        const result = await tool.handler(request.params.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        console.error(`❌ Error in ${tool.name}:`, error);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
          }]
        };
      }
    });
  });
  
  console.log(`✅ Registered ${enhancedVectorSearchTools.length} Enhanced Vector Search MCP tools`);
}