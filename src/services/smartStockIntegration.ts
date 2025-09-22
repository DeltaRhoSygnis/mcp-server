/**
 * Smart Stock Integration Service
 * Connects ChickenBusinessAI patterns to existing sales/expenses/products tables
 * Phase 2 of AI implementation - automatic stock updates from parsed patterns
 */

import { supabase } from '../src/supabaseConfig';
import { offlineDB } from './offlineService';
import { connectionService } from './connectionService';
import { unifiedDataService } from './unifiedDataService';
import type { ChickenBusinessPattern } from './chickenBusinessAI';

interface StockIntegrationResult {
  success: boolean;
  updates: {
    products_updated?: number;
    sales_created?: number;
    expenses_created?: number;
    stock_adjustments?: Array<{
      product: string;
      old_stock: number;
      new_stock: number;
      change: number;
    }>;
  };
  errors?: string[];
}

export class SmartStockIntegration {
  
  /**
   * Apply AI pattern to actual stock/sales/expenses
   * Main entry point for Phase 2 integration
   */
  async applyPatternToStock(
    pattern: ChickenBusinessPattern,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<StockIntegrationResult> {
    try {
      const result: StockIntegrationResult = {
        success: true,
        updates: {}
      };

      // Apply different stock operations based on pattern type
      switch (pattern.business_type) {
        case 'purchase':
          await this.applyPurchasePattern(pattern, result, userRole, branchId);
          break;
          
        case 'processing':
          await this.applyProcessingPattern(pattern, result, userRole, branchId);
          break;
          
        case 'distribution':
          await this.applyDistributionPattern(pattern, result, userRole, branchId);
          break;
          
        case 'cooking':
          await this.applyCookingPattern(pattern, result, userRole, branchId);
          break;
          
        case 'sales':
          await this.applySalesPattern(pattern, result, userRole, branchId);
          break;
          
        default:
          console.log('📝 Pattern type does not require stock updates:', pattern.business_type);
      }

      return result;

    } catch (error) {
      console.error('❌ Smart stock integration failed:', error);
      return {
        success: false,
        updates: {},
        errors: [error.message]
      };
    }
  }

  /**
   * Apply purchase pattern: Add products to inventory, create expense
   * Example: "Buy magnolia whole chicken 20 bags, 10 chickens per bag"
   */
  private async applyPurchasePattern(
    pattern: ChickenBusinessPattern,
    result: StockIntegrationResult,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    const { learned_patterns } = pattern;
    
    if (!learned_patterns.bags || !learned_patterns.units_per_bag) {
      console.warn('⚠️ Purchase pattern missing quantity data');
      return;
    }

    // 1. Find or create product
    const productName = learned_patterns.product || 'Whole Chicken';
    const supplier = learned_patterns.supplier || 'Unknown Supplier';
    const totalUnits = learned_patterns.bags * learned_patterns.units_per_bag;
    
    const product = await this.findOrCreateProduct(
      `${supplier} ${productName}`,
      learned_patterns.cost_per_bag || 0,
      'Raw Chicken'
    );

    // 2. Update stock
    const stockUpdate = await this.updateProductStock(product.id, totalUnits, 'add');
    result.updates.stock_adjustments = result.updates.stock_adjustments || [];
    result.updates.stock_adjustments.push(stockUpdate);
    result.updates.products_updated = (result.updates.products_updated || 0) + 1;

    // 3. Create expense record if cost is provided
    if (learned_patterns.cost_per_bag && learned_patterns.bags) {
      const totalCost = learned_patterns.cost_per_bag * learned_patterns.bags;
      await this.createExpenseRecord(
        `Purchase: ${learned_patterns.bags} bags ${productName} from ${supplier}`,
        totalCost,
        'Inventory Purchase',
        userRole,
        branchId
      );
      result.updates.expenses_created = (result.updates.expenses_created || 0) + 1;
    }

    console.log(`✅ Purchase applied: +${totalUnits} units of ${productName}`);
  }

  /**
   * Apply processing pattern: Convert whole chickens to parts + necks
   * Example: "Chopped 200 chickens into 35 bags parts + 10 neck bags"
   */
  private async applyProcessingPattern(
    pattern: ChickenBusinessPattern,
    result: StockIntegrationResult,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    const { learned_patterns } = pattern;
    
    if (!learned_patterns.input_bags || (!learned_patterns.output_parts_bags && !learned_patterns.output_necks_bags)) {
      console.warn('⚠️ Processing pattern missing input/output data');
      return;
    }

    const stockUpdates: any[] = [];

    // 1. Reduce whole chicken stock (if we can identify the source product)
    if (learned_patterns.input_bags && learned_patterns.units_per_bag) {
      const inputUnits = learned_patterns.input_bags * learned_patterns.units_per_bag;
      const wholeChickenProduct = await this.findProductByCategory('Raw Chicken');
      
      if (wholeChickenProduct) {
        const wholeUpdate = await this.updateProductStock(wholeChickenProduct.id, inputUnits, 'subtract');
        stockUpdates.push(wholeUpdate);
      }
    }

    // 2. Add chicken parts stock
    if (learned_patterns.output_parts_bags && learned_patterns.parts_per_bag) {
      const partsUnits = learned_patterns.output_parts_bags * learned_patterns.parts_per_bag;
      const partsProduct = await this.findOrCreateProduct(
        'Chicken Parts',
        0, // No base price needed for processing
        'Processed Chicken'
      );
      
      const partsUpdate = await this.updateProductStock(partsProduct.id, partsUnits, 'add');
      stockUpdates.push(partsUpdate);
    }

    // 3. Add chicken necks stock
    if (learned_patterns.output_necks_bags && learned_patterns.necks_per_bag) {
      const necksUnits = learned_patterns.output_necks_bags * learned_patterns.necks_per_bag;
      const necksProduct = await this.findOrCreateProduct(
        'Chicken Necks',
        0,
        'Processed Chicken'
      );
      
      const necksUpdate = await this.updateProductStock(necksProduct.id, necksUnits, 'add');
      stockUpdates.push(necksUpdate);
    }

    result.updates.stock_adjustments = (result.updates.stock_adjustments || []).concat(stockUpdates);
    result.updates.products_updated = (result.updates.products_updated || 0) + stockUpdates.length;

    console.log(`✅ Processing applied: ${stockUpdates.length} stock adjustments`);
  }

  /**
   * Apply distribution pattern: Move stock between branches (future feature)
   * Example: "Send Branch1: 3 bags + 1 neck bag"
   */
  private async applyDistributionPattern(
    pattern: ChickenBusinessPattern,
    result: StockIntegrationResult,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    // Phase 3 feature - for now just log
    console.log('📦 Distribution pattern logged for future branch-specific tracking');
    
    // Could create transfer records or branch-specific stock adjustments
    // This would integrate with the branches table in the database
  }

  /**
   * Apply cooking pattern: Convert raw parts to cooked items
   * Example: "Branch1 cooked 1 bag" 
   */
  private async applyCookingPattern(
    pattern: ChickenBusinessPattern,
    result: StockIntegrationResult,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    const { learned_patterns } = pattern;
    const stockUpdates: any[] = [];

    // 1. Reduce raw chicken parts stock
    if (learned_patterns.cooked_bags && learned_patterns.parts_per_bag) {
      const rawUnits = learned_patterns.cooked_bags * learned_patterns.parts_per_bag;
      const rawPartsProduct = await this.findProductByName('Chicken Parts');
      
      if (rawPartsProduct) {
        const rawUpdate = await this.updateProductStock(rawPartsProduct.id, rawUnits, 'subtract');
        stockUpdates.push(rawUpdate);
      }
    }

    // 2. Add cooked chicken inventory
    if (learned_patterns.cooked_bags && learned_patterns.parts_per_bag) {
      const cookedUnits = learned_patterns.cooked_bags * learned_patterns.parts_per_bag;
      const cookedProduct = await this.findOrCreateProduct(
        'Fried Chicken',
        35, // Default selling price per piece
        'Cooked Food'
      );
      
      const cookedUpdate = await this.updateProductStock(cookedProduct.id, cookedUnits, 'add');
      stockUpdates.push(cookedUpdate);
    }

    result.updates.stock_adjustments = (result.updates.stock_adjustments || []).concat(stockUpdates);
    result.updates.products_updated = (result.updates.products_updated || 0) + stockUpdates.length;

    console.log(`✅ Cooking applied: ${stockUpdates.length} stock adjustments`);
  }

  /**
   * Apply sales pattern: Create sales records and reduce cooked stock
   * Example: "Leftovers: 20 pieces @35 pesos, 10 necks @15 pesos"
   */
  private async applySalesPattern(
    pattern: ChickenBusinessPattern,
    result: StockIntegrationResult,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    const { learned_patterns } = pattern;
    let salesCreated = 0;
    const stockUpdates: any[] = [];

    // 1. Handle chicken parts sales
    if (learned_patterns.leftover_parts && learned_patterns.price_per_part) {
      const partsQuantity = learned_patterns.leftover_parts;
      const partsPrice = learned_patterns.price_per_part;
      const partsTotal = partsQuantity * partsPrice;

      // Create sales record
      await this.createSalesRecord(
        [{
          name: 'Fried Chicken',
          quantity: partsQuantity,
          price: partsPrice
        }],
        partsTotal,
        userRole,
        branchId
      );

      // Reduce cooked stock
      const friedChickenProduct = await this.findProductByName('Fried Chicken');
      if (friedChickenProduct) {
        const stockUpdate = await this.updateProductStock(friedChickenProduct.id, partsQuantity, 'subtract');
        stockUpdates.push(stockUpdate);
      }

      salesCreated++;
    }

    // 2. Handle chicken necks sales  
    if (learned_patterns.leftover_necks && learned_patterns.price_per_neck) {
      const necksQuantity = learned_patterns.leftover_necks;
      const necksPrice = learned_patterns.price_per_neck;
      const necksTotal = necksQuantity * necksPrice;

      // Create sales record
      await this.createSalesRecord(
        [{
          name: 'Chicken Necks',
          quantity: necksQuantity,
          price: necksPrice
        }],
        necksTotal,
        userRole,
        branchId
      );

      // Reduce necks stock
      const necksProduct = await this.findProductByName('Chicken Necks');
      if (necksProduct) {
        const stockUpdate = await this.updateProductStock(necksProduct.id, necksQuantity, 'subtract');
        stockUpdates.push(stockUpdate);
      }

      salesCreated++;
    }

    result.updates.sales_created = salesCreated;
    result.updates.stock_adjustments = (result.updates.stock_adjustments || []).concat(stockUpdates);
    result.updates.products_updated = (result.updates.products_updated || 0) + stockUpdates.length;

    console.log(`✅ Sales applied: ${salesCreated} sales records, ${stockUpdates.length} stock adjustments`);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find existing product or create new one
   */
  private async findOrCreateProduct(name: string, price: number, category: string): Promise<any> {
    try {
      // First try to find existing product
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${name}%`)
        .single();

      if (existingProduct) {
        return existingProduct;
      }

      // Create new product
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert({
          name,
          price,
          category,
          stock: 0,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log(`🆕 Created new product: ${name}`);
      return newProduct;

    } catch (error) {
      console.error('❌ Failed to find/create product:', error);
      throw error;
    }
  }

  /**
   * Find product by category (for stock operations)
   */
  private async findProductByCategory(category: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;

    } catch (error) {
      console.warn(`⚠️ No product found for category: ${category}`);
      return null;
    }
  }

  /**
   * Find product by name (exact or similar)
   */
  private async findProductByName(name: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${name}%`)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;

    } catch (error) {
      console.warn(`⚠️ No product found for name: ${name}`);
      return null;
    }
  }

  /**
   * Update product stock (add or subtract)
   */
  private async updateProductStock(
    productId: string, 
    quantity: number, 
    operation: 'add' | 'subtract'
  ): Promise<{ product: string; old_stock: number; new_stock: number; change: number }> {
    try {
      // Get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('name, stock')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const oldStock = product.stock || 0;
      const change = operation === 'add' ? quantity : -quantity;
      const newStock = Math.max(0, oldStock + change); // Prevent negative stock

      // Update stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (updateError) throw updateError;

      return {
        product: product.name,
        old_stock: oldStock,
        new_stock: newStock,
        change
      };

    } catch (error) {
      console.error('❌ Failed to update product stock:', error);
      throw error;
    }
  }

  /**
   * Create expense record via unified service
   */
  private async createExpenseRecord(
    description: string,
    amount: number,
    category: string,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    try {
      const expenseData = {
        description,
        amount,
        category,
        // Additional context from AI
        ai_generated: true,
        branch_id: branchId
      };

      await unifiedDataService.saveExpense(expenseData);
      console.log(`💰 Expense created: ${description} - ₱${amount}`);

    } catch (error) {
      console.error('❌ Failed to create expense record:', error);
      throw error;
    }
  }

  /**
   * Create sales record via unified service
   */
  private async createSalesRecord(
    items: Array<{ name: string; quantity: number; price: number }>,
    total: number,
    userRole: 'owner' | 'worker',
    branchId?: string
  ): Promise<void> {
    try {
      const saleData = {
        items: items.map(item => ({
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        })),
        total,
        payment: total, // Assume exact payment for AI-generated sales
        change: 0,
        // Additional context from AI
        ai_generated: true,
        branch_id: branchId
      };

      await unifiedDataService.saveSale(saleData);
      console.log(`💸 Sale created: ${items.length} items - ₱${total}`);

    } catch (error) {
      console.error('❌ Failed to create sales record:', error);
      throw error;
    }
  }

  /**
   * Get stock integration status for a pattern
   */
  async getIntegrationStatus(noteId: string): Promise<{ applied: boolean; results?: StockIntegrationResult }> {
    try {
      // Check if note has been applied to stock
      const { data, error } = await supabase
        .from('notes')
        .select('status, stock_integration_results')
        .eq('id', noteId)
        .single();

      if (error) throw error;

      return {
        applied: data.status === 'stock_applied',
        results: data.stock_integration_results
      };

    } catch (error) {
      console.error('❌ Failed to get integration status:', error);
      return { applied: false };
    }
  }

  /**
   * Mark note as applied to stock
   */
  async markAsApplied(noteId: string, results: StockIntegrationResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          status: 'stock_applied',
          stock_integration_results: results
        })
        .eq('id', noteId);

      if (error) throw error;

    } catch (error) {
      console.error('❌ Failed to mark note as applied:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const smartStockIntegration = new SmartStockIntegration();

// Export types for other services
export type { StockIntegrationResult };