import { parseStockNote } from './geminiService';
import { supabase } from '../src/supabaseConfig';
import { offlineDB } from './offlineService';
import { recordSale, recordExpense } from './supabaseService';

export class AIAgentService {
  // Step 1: Note → IndexedDB → Supabase → Gemini → Structured Data
  async processNote(content: string, userRole: 'owner' | 'worker') {
    try {
      // Try to sync immediately if online
      if (navigator.onLine) {
        return await this.syncAndProcess(content, userRole);
      }
      
      return { success: true, offline: true };
    } catch (error) {
      console.error('Note processing failed:', error);
      return { success: false, error };
    }
  }

  private async syncAndProcess(content: string, userRole: string) {
    // Save to Supabase
    const { data: note, error } = await supabase
      .from('notes')
      .insert({ content, user_role: userRole, status: 'pending' })
      .select()
      .single();

    if (error) throw error;

    // Parse with Gemini
    const parsed = await parseStockNote(content);
    
    // Update note with parsed data
    await supabase
      .from('notes')
      .update({ parsed_data: parsed, status: 'parsed' })
      .eq('id', note.id);

    // Convert to operations
    await this.createOperations(parsed, note.id);

    return { success: true, noteId: note.id, parsed };
  }

  private async createOperations(parsed: any, noteId: string) {
    const operations = [];

    // Convert purchases
    if (parsed.purchases) {
      for (const purchase of parsed.purchases) {
        operations.push({
          local_uuid: crypto.randomUUID(),
          type: 'purchase',
          data: purchase,
          timestamp: new Date().toISOString(),
          note_id: noteId
        });
      }
    }

    // Convert cooking
    if (parsed.cooking) {
      for (const cook of parsed.cooking) {
        operations.push({
          local_uuid: crypto.randomUUID(),
          type: 'cook',
          data: cook,
          timestamp: new Date().toISOString(),
          note_id: noteId
        });
      }
    }

    // Insert operations
    if (operations.length > 0) {
      await supabase.from('operations').insert(operations);
    }
  }

  // Background sync for all offline data
  async syncPendingData() {
    if (!navigator.onLine) return;

    const tables = ['notes', 'sales', 'expenses', 'products'];
    
    for (const table of tables) {
      try {
        const pending = await offlineDB.getPending(table);
        
        for (const record of pending) {
          await this.syncRecord(table, record);
          await offlineDB.markSynced(table, record.id);
        }
      } catch (error) {
        console.warn(`Sync failed for ${table}:`, error);
      }
    }
  }

  private async syncRecord(table: string, record: any) {
    const { sync_status, created_at, ...data } = record;
    
    switch (table) {
      case 'notes':
        return this.syncAndProcess(data.content, data.user_role);
      case 'sales':
        return recordSale(data);
      case 'expenses':
        return recordExpense(data);
      case 'products':
        return supabase.from(table).insert(data);
      default:
        return supabase.from(table).insert(data);
    }
  }

  // Daily summary generation
  async generateDailySummary(branchId: string, date: string) {
    const { data: operations } = await supabase
      .from('operations')
      .select('*')
      .eq('data->>branch', branchId)
      .gte('timestamp', `${date}T00:00:00`)
      .lt('timestamp', `${date}T23:59:59`);

    const summary = {
      total_operations: operations?.length || 0,
      purchases: operations?.filter(op => op.type === 'purchase').length || 0,
      cooking: operations?.filter(op => op.type === 'cook').length || 0,
      sales: operations?.filter(op => op.type === 'sale').length || 0
    };

    await supabase.from('summaries').upsert({
      branch_id: branchId,
      date,
      summary
    });

    return summary;
  }
}

export const aiAgent = new AIAgentService();