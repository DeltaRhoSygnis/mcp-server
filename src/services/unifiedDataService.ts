/**
 * Unified Data Service - Stub implementation
 * TODO: Implement full unified data service functionality when needed
 */

export interface UnifiedDataService {
  syncData: () => Promise<void>;
  getData: (key: string) => Promise<any>;
  setData: (key: string, value: any) => Promise<void>;
  saveExpense: (expenseData: any) => Promise<void>;
  saveSale: (saleData: any) => Promise<void>;
}

export const unifiedDataService: UnifiedDataService = {
  async syncData(): Promise<void> {
    console.log('🔄 Unified data service not implemented, skipping sync');
  },
  
  async getData(key: string): Promise<any> {
    console.log('🔄 Unified data service not implemented, returning null for key:', key);
    return null;
  },
  
  async setData(key: string, value: any): Promise<void> {
    console.log('🔄 Unified data service not implemented, data not saved:', { key, value });
  },

  async saveExpense(expenseData: any): Promise<void> {
    console.log('🔄 Unified data service not implemented, expense not saved:', expenseData);
  },

  async saveSale(saleData: any): Promise<void> {
    console.log('🔄 Unified data service not implemented, sale not saved:', saleData);
  }
};