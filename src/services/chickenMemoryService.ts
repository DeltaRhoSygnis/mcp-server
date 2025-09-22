/**
 * Memory Integration Service for Chicken Business AI
 * Browser-compatible version with local storage backing
 * Enables persistent learning and intelligent context for your AI system
 */

// Remove Node.js dependencies for browser compatibility
// import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// import { spawn } from 'child_process';
import type { ChickenBusinessPattern } from './chickenBusinessAI';

interface BusinessEntity {
  name: string;
  entityType: 'supplier' | 'customer' | 'worker' | 'branch' | 'product' | 'business_period';
  attributes?: Record<string, any>;
}

interface BusinessRelation {
  from: string;
  to: string;
  relationType: string;
  metadata?: Record<string, any>;
}

interface BusinessObservation {
  entityName: string;
  observation: string;
  timestamp: string;
  confidence?: number;
  source: 'ai_learning' | 'user_input' | 'system_analysis';
}

export class ChickenBusinessMemoryService {
  private storageKey = 'chicken_business_memory';
  private isInitialized = false;

  /**
   * Initialize browser-compatible memory service using localStorage
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🧠 Initializing Chicken Business Memory Service (Browser Mode)...');
      
      // Initialize localStorage structure if it doesn't exist
      if (!localStorage.getItem(this.storageKey)) {
        localStorage.setItem(this.storageKey, JSON.stringify({
          entities: [],
          relations: [],
          patterns: [],
          contexts: {}
        }));
      }
      
      this.isInitialized = true;
      console.log('✅ Memory service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize memory service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get memory data from localStorage
   */
  private getMemoryData(): any {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { entities: [], relations: [], patterns: [], contexts: {} };
    } catch (error) {
      console.warn('Failed to parse memory data:', error);
      return { entities: [], relations: [], patterns: [], contexts: {} };
    }
  }

  /**
   * Save memory data to localStorage
   */
  private saveMemoryData(data: any): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save memory data:', error);
    }
  }

  /**
   * Store business entities in memory (suppliers, customers, workers, etc.)
   */
  async storeBusinessEntity(entity: BusinessEntity): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('Memory service not initialized');
      return false;
    }

    try {
      const memoryData = this.getMemoryData();
      
      // Check if entity already exists
      const existingIndex = memoryData.entities.findIndex((e: any) => 
        e.name === entity.name && e.entityType === entity.entityType
      );
      
      if (existingIndex >= 0) {
        // Update existing entity
        memoryData.entities[existingIndex] = {
          ...memoryData.entities[existingIndex],
          ...entity,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new entity
        memoryData.entities.push({
          ...entity,
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
      
      this.saveMemoryData(memoryData);
      console.log(`✅ Stored entity: ${entity.name} (${entity.entityType})`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to store entity ${entity.name}:`, error);
      return false;
    }
  }

  /**
   * Create relationships between business entities
   */
  async createBusinessRelation(relation: BusinessRelation): Promise<boolean> {
    if (!this.isConnected || !this.memoryClient) {
      console.warn('Memory service not connected');
      return false;
    }

    try {
      await this.memoryClient.request({
  /**
   * Create relationships between business entities
   */
  async createBusinessRelation(relation: BusinessRelation): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('Memory service not initialized');
      return false;
    }

    try {
      const memoryData = this.getMemoryData();
      
      // Check if relation already exists
      const existingIndex = memoryData.relations.findIndex((r: any) => 
        r.from === relation.from && r.to === relation.to && r.relationType === relation.relationType
      );
      
      if (existingIndex >= 0) {
        // Update existing relation
        memoryData.relations[existingIndex] = {
          ...memoryData.relations[existingIndex],
          ...relation,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new relation
        memoryData.relations.push({
          ...relation,
          created: new Date().toISOString(),
  /**
   * Add observations about business entities (learning from patterns)
   */
  async addBusinessObservation(observation: BusinessObservation): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('Memory service not initialized');
      return false;
    }

    try {
      const memoryData = this.getMemoryData();
      
      // Initialize observations array if it doesn't exist
      if (!memoryData.observations) {
        memoryData.observations = [];
      }
      
      // Add new observation
      memoryData.observations.push({
        ...observation,
        id: Date.now().toString(),
        created: new Date().toISOString()
      });
      
      this.saveMemoryData(memoryData);
      console.log(`✅ Added observation for ${observation.entityName}`);
      return true;

    } catch (error) {
  /**
   * Search memory for relevant business context
   */
  async searchBusinessContext(query: string): Promise<any[]> {
    if (!this.isInitialized) {
      console.warn('Memory service not initialized');
      return [];
    }

    try {
      const memoryData = this.getMemoryData();
      const results: any[] = [];
      const lowerQuery = query.toLowerCase();
      
      // Search entities
      for (const entity of memoryData.entities || []) {
        if (entity.name.toLowerCase().includes(lowerQuery) ||
            entity.entityType.toLowerCase().includes(lowerQuery)) {
          results.push({ type: 'entity', data: entity });
        }
      }
      
      // Search observations
      for (const observation of memoryData.observations || []) {
        if (observation.entityName.toLowerCase().includes(lowerQuery) ||
            observation.observation.toLowerCase().includes(lowerQuery)) {
          results.push({ type: 'observation', data: observation });
        }
      }
      
      return results;

    } catch (error) {
      console.error('❌ Failed to search memory:', error);
      return [];
    }
  }

      return result.content || [];

    } catch (error) {
      console.error('❌ Failed to search memory:', error);
      return [];
    }
  }

  /**
   * Learn from a chicken business pattern by storing relevant knowledge
   */
  async learnFromPattern(pattern: ChickenBusinessPattern): Promise<void> {
    if (!pattern.learned_patterns) return;

    console.log('🧠 Learning from pattern:', pattern.business_type);

    try {
      // Store supplier information
      if (pattern.learned_patterns.supplier) {
        await this.storeSupplierKnowledge(pattern);
      }

      // Store worker information
      if (pattern.learned_patterns.worker_mentioned) {
        await this.storeWorkerKnowledge(pattern);
      }

      // Store branch information
      if (pattern.learned_patterns.branch_mentioned) {
        await this.storeBranchKnowledge(pattern);
      }

      // Store business pattern observations
      await this.storePatternObservations(pattern);

    } catch (error) {
      console.error('❌ Failed to learn from pattern:', error);
    }
  }

  /**
   * Get intelligent context for note parsing
   */
  async getContextForNote(noteText: string): Promise<string> {
    // Extract potential entity names from note
    const entities = this.extractPotentialEntities(noteText);
    let context = '';

    for (const entity of entities) {
      const memory = await this.searchBusinessContext(entity);
      if (memory.length > 0) {
        context += `\n📝 Known about ${entity}: ${JSON.stringify(memory)}`;
      }
    }

    return context;
  }

  /**
   * Initialize basic business knowledge graph
   */
  async initializeBusinessKnowledge(): Promise<void> {
    console.log('🏗️ Initializing business knowledge graph...');

    // Core suppliers
    await this.storeBusinessEntity({
      name: 'Magnolia_Supplier',
      entityType: 'supplier',
      attributes: {
        delivery_schedule: 'Tuesday and Friday',
        product_type: 'whole_chickens',
        units_per_bag: 10,
        typical_price: 1200,
        reliability: 'high'
      }
    });

    await this.storeBusinessEntity({
      name: 'San_Miguel_Supplier',
      entityType: 'supplier',
      attributes: {
        product_type: 'whole_chickens',
        reliability: 'medium'
      }
    });

    // Core products
    await this.storeBusinessEntity({
      name: 'Whole_Chicken',
      entityType: 'product',
      attributes: {
        unit: 'piece',
        typical_bag_size: 10
      }
    });

    await this.storeBusinessEntity({
      name: 'Chicken_Parts',
      entityType: 'product',
      attributes: {
        unit: 'piece',
        derived_from: 'whole_chicken'
      }
    });

    await this.storeBusinessEntity({
      name: 'Chicken_Necks',
      entityType: 'product',
      attributes: {
        unit: 'piece',
        derived_from: 'whole_chicken'
      }
    });

    // Create relationships
    await this.createBusinessRelation({
      from: 'Magnolia_Supplier',
      to: 'Whole_Chicken',
      relationType: 'supplies'
    });

    await this.createBusinessRelation({
      from: 'Whole_Chicken',
      to: 'Chicken_Parts',
      relationType: 'processes_into'
    });

    await this.createBusinessRelation({
      from: 'Whole_Chicken',
      to: 'Chicken_Necks',
      relationType: 'processes_into'
    });

    console.log('✅ Basic business knowledge initialized');
  }

  /**
   * Private helper methods
   */
  private async storeSupplierKnowledge(pattern: ChickenBusinessPattern): Promise<void> {
    const supplierName = `${pattern.learned_patterns.supplier}_Supplier`;
    
    await this.storeBusinessEntity({
      name: supplierName,
      entityType: 'supplier'
    });

    if (pattern.learned_patterns.cost_per_bag) {
      await this.addBusinessObservation({
        entityName: supplierName,
        observation: `Cost per bag: ${pattern.learned_patterns.cost_per_bag} pesos`,
        timestamp: new Date().toISOString(),
        source: 'ai_learning',
        confidence: pattern.confidence_score
      });
    }
  }

  private async storeWorkerKnowledge(pattern: ChickenBusinessPattern): Promise<void> {
    const workerName = `Worker_${pattern.learned_patterns.worker_mentioned}`;
    
    await this.storeBusinessEntity({
      name: workerName,
      entityType: 'worker'
    });

    await this.addBusinessObservation({
      entityName: workerName,
      observation: `Involved in ${pattern.business_type} operation`,
      timestamp: new Date().toISOString(),
      source: 'ai_learning'
    });
  }

  private async storeBranchKnowledge(pattern: ChickenBusinessPattern): Promise<void> {
    const branchName = `Branch_${pattern.learned_patterns.branch_mentioned}`;
    
    await this.storeBusinessEntity({
      name: branchName,
      entityType: 'branch'
    });
  }

  private async storePatternObservations(pattern: ChickenBusinessPattern): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Store business operation patterns
    await this.addBusinessObservation({
      entityName: `Business_Operations`,
      observation: `${pattern.business_type} operation completed with confidence ${pattern.confidence_score}`,
      timestamp,
  /**
   * Cleanup connection
   */
  async disconnect(): Promise<void> {
    if (this.isInitialized) {
      this.isInitialized = false;
      console.log('🔌 Memory service disconnected');
    }
  }
    if (text.includes('san miguel')) entities.push('San_Miguel_Supplier');

    // Look for products
    if (text.includes('chicken')) entities.push('Whole_Chicken');
    if (text.includes('parts')) entities.push('Chicken_Parts');
    if (text.includes('necks')) entities.push('Chicken_Necks');

    return entities;
  }

  /**
   * Cleanup connection
   */
  async disconnect(): Promise<void> {
    if (this.memoryClient && this.isConnected) {
      await this.memoryClient.close();
      this.isConnected = false;
      console.log('🔌 Memory service disconnected');
    }
  }
}

// Export singleton instance
export const chickenMemoryService = new ChickenBusinessMemoryService();