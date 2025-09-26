/**
 * Offline Service - Stub Implementation
 * Provides offline data persistence capabilities
 */

export interface OfflineData {
  id: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

class OfflineService {
  private storage: Map<string, OfflineData> = new Map();

  async store(key: string, data: any): Promise<void> {
    this.storage.set(key, {
      id: key,
      data,
      timestamp: Date.now(),
      synced: false
    });
  }

  async retrieve(key: string): Promise<any | null> {
    const item = this.storage.get(key);
    return item ? item.data : null;
  }

  async getUnsynced(): Promise<OfflineData[]> {
    return Array.from(this.storage.values()).filter(item => !item.synced);
  }

  async markSynced(key: string): Promise<void> {
    const item = this.storage.get(key);
    if (item) {
      item.synced = true;
      this.storage.set(key, item);
    }
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async getAllData(): Promise<OfflineData[]> {
    return Array.from(this.storage.values());
  }

  isAvailable(): boolean {
    return true; // Always available in memory
  }
}

// Export singleton
export const offlineDB = new OfflineService();