/**
 * Chicken Business Memory Service
 * Clean browser-compatible implementation with graceful fallback when localStorage is unavailable.
 * Provides lightweight knowledge graph style storage for entities, relations, observations.
 */

// Local type definitions (decoupled from other possibly missing files)
interface ChickenBusinessPattern {
  business_type: 'purchase' | 'processing' | 'distribution' | 'cooking' | 'sales' | 'general';
  confidence_score: number;
  learned_patterns: Record<string, any>;
}

interface BusinessEntity {
  name: string;
  entityType: 'supplier' | 'customer' | 'worker' | 'branch' | 'product' | 'business_period';
  attributes?: Record<string, any>;
  created?: string;
  lastUpdated?: string;
}

interface BusinessRelation {
  from: string;
  to: string;
  relationType: string;
  metadata?: Record<string, any>;
  created?: string;
  lastUpdated?: string;
}

interface BusinessObservation {
  entityName: string;
  observation: string;
  timestamp: string;
  confidence?: number;
  source: 'ai_learning' | 'user_input' | 'system_analysis';
  id?: string;
  created?: string;
}

interface MemoryDataShape {
  entities: BusinessEntity[];
  relations: BusinessRelation[];
  observations: BusinessObservation[];
  patterns: any[]; // reserved for future richer pattern storage
  contexts: Record<string, any>;
}

export class ChickenBusinessMemoryService {
  private storageKey = 'chicken_business_memory';
  private isInitialized = false;
  private fallback: MemoryDataShape = { entities: [], relations: [], observations: [], patterns: [], contexts: {} };

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Initialize browser-compatible memory service using localStorage
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.hasLocalStorage()) {
        if (!localStorage.getItem(this.storageKey)) {
          localStorage.setItem(this.storageKey, JSON.stringify(this.fallback));
        }
      }
      this.isInitialized = true;
      return true;
    } catch (error) {
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get memory data from localStorage
   */
  private getMemoryData(): MemoryDataShape {
    if (!this.hasLocalStorage()) return this.fallback;
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) as MemoryDataShape : this.fallback;
    } catch {
      return this.fallback;
    }
  }

  /**
   * Save memory data to localStorage
   */
  private saveMemoryData(data: MemoryDataShape): void {
    if (!this.hasLocalStorage()) { this.fallback = data; return; }
    try { localStorage.setItem(this.storageKey, JSON.stringify(data)); } catch { /* ignore */ }
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
          lastUpdated: new Date().toISOString()
        });
      }
      
      this.saveMemoryData(memoryData);
      console.log(`✅ Created relation: ${relation.from} -> ${relation.to} (${relation.relationType})`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to create relation:`, error);
      return false;
    }
  }
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
      // Add observation
      memoryData.observations.push({
        ...observation,
        id: Date.now().toString(),
        created: new Date().toISOString()
      });
      
      this.saveMemoryData(memoryData);
      console.log(`✅ Added observation for ${observation.entityName}`);
      return true;

    } catch (error) {
      console.warn('Failed to add observation:', error);
      return false;
    }
  }

  /**
   * Search memory for relevant business context
   */
  async searchBusinessContext(query: string): Promise<Array<{ type: 'entity' | 'observation'; data: any }>> {
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
      return [];
    }
  }

  /**
   * Learn from a chicken business pattern by storing relevant knowledge
   */
  async learnFromPattern(pattern: ChickenBusinessPattern): Promise<void> {
    if (!pattern.learned_patterns) return;

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
    await this.addBusinessObservation({
      entityName: 'Business_Operations',
      observation: `${pattern.business_type} operation completed (confidence ${pattern.confidence_score})`,
      timestamp,
      source: 'ai_learning',
      confidence: pattern.confidence_score
    });
  }

  private extractPotentialEntities(noteText: string): string[] {
    const entities: string[] = [];
    const t = noteText.toLowerCase();
    if (t.includes('magnolia')) entities.push('Magnolia_Supplier');
    if (t.includes('san miguel')) entities.push('San_Miguel_Supplier');
    if (t.includes('whole')) entities.push('Whole_Chicken');
    if (t.includes('parts')) entities.push('Chicken_Parts');
    if (t.includes('neck')) entities.push('Chicken_Necks');
    if (t.includes('worker')) entities.push('Worker_Generic');
    if (t.includes('branch')) entities.push('Branch_Generic');
    return Array.from(new Set(entities));
  }

  async disconnect(): Promise<void> {
    if (this.isInitialized) {
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const chickenMemoryService = new ChickenBusinessMemoryService();