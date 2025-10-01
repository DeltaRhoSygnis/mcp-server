/**
 * Daily Summaries Automation & Archive Service
 * Handles automated daily aggregation, cleanup, and archival of business data
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { googleDriveService } from './googleDriveService';
// Use require() for Google Generative AI to fix compilation issues
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export interface DailySummaryConfig {
  date: string; // YYYY-MM-DD format
  branchId?: string;
  includeArchival?: boolean;
  retentionDays?: number; // Days to keep detailed records
}

export interface BusinessSummary {
  id: string;
  date: string;
  branchId?: string;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  noteCount: number;
  operationCount: number;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  keyInsights: string[];
  alertsGenerated: number;
  aiGeneratedSummary: string;
  createdAt: string;
  archivedRecords?: {
    notes: number;
    operations: number;
    expenses: number;
  };
}

export class DailySummariesService {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Generate comprehensive daily summary
   */
  async generateDailySummary(config: DailySummaryConfig): Promise<BusinessSummary> {
    try {
      console.log(`📊 Generating daily summary for ${config.date}...`);
      
      const startDate = `${config.date}T00:00:00Z`;
      const endDate = `${config.date}T23:59:59Z`;
      
      // Aggregate sales data
      const salesData = await this.aggregateSalesData(startDate, endDate, config.branchId);
      
      // Aggregate expenses data
      const expensesData = await this.aggregateExpensesData(startDate, endDate, config.branchId);
      
      // Aggregate operations data
      const operationsData = await this.aggregateOperationsData(startDate, endDate, config.branchId);
      
      // Aggregate notes data
      const notesData = await this.aggregateNotesData(startDate, endDate, config.branchId);
      
      // Generate AI insights
      const aiSummary = await this.generateAISummary({
        date: config.date,
        sales: salesData,
        expenses: expensesData,
        operations: operationsData,
        notes: notesData
      });
      
      // Create summary object
      const summary: BusinessSummary = {
        id: uuidv4(),
        date: config.date,
        branchId: config.branchId,
        totalSales: salesData.total,
        totalExpenses: expensesData.total,
        netProfit: salesData.total - expensesData.total,
        noteCount: notesData.count,
        operationCount: operationsData.count,
        topProducts: salesData.topProducts,
        keyInsights: aiSummary.insights,
        alertsGenerated: aiSummary.alertsCount,
        aiGeneratedSummary: aiSummary.summary,
        createdAt: new Date().toISOString()
      };
      
      // Store summary in database
      await this.storeDailySummary(summary);
      
      // Archive old records if requested
      if (config.includeArchival) {
        const archivedRecords = await this.archiveOldRecords(config);
        summary.archivedRecords = archivedRecords;
      }
      
      console.log(`✅ Daily summary generated successfully for ${config.date}`);
      return summary;
    } catch (error) {
      console.error('❌ Failed to generate daily summary:', error);
      throw error;
    }
  }

  /**
   * Aggregate sales data for the day
   */
  private async aggregateSalesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('notes')
        .select('parsed, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('category', 'sale')
        .not('parsed', 'is', null);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: salesNotes, error } = await query;
      
      if (error) throw error;
      
      let total = 0;
      const productSales: Record<string, { quantity: number; revenue: number }> = {};
      
      salesNotes?.forEach(note => {
        const parsed = note.parsed;
        if (parsed && parsed.amount) {
          total += parseFloat(parsed.amount) || 0;
          
          if (parsed.product_name) {
            const product = parsed.product_name;
            const quantity = parseFloat(parsed.quantity) || 1;
            const revenue = parseFloat(parsed.amount) || 0;
            
            if (!productSales[product]) {
              productSales[product] = { quantity: 0, revenue: 0 };
            }
            productSales[product].quantity += quantity;
            productSales[product].revenue += revenue;
          }
        }
      });
      
      // Get top 5 products by revenue
      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      return {
        total,
        count: salesNotes?.length || 0,
        topProducts
      };
    } catch (error) {
      console.error('❌ Failed to aggregate sales data:', error);
      return { total: 0, count: 0, topProducts: [] };
    }
  }

  /**
   * Aggregate expenses data for the day
   */
  private async aggregateExpensesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('expenses')
        .select('amount, category, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: expenses, error } = await query;
      
      if (error) throw error;
      
      const total = expenses?.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0) || 0;
      const byCategory: Record<string, number> = {};
      
      expenses?.forEach(expense => {
        const category = expense.category || 'uncategorized';
        byCategory[category] = (byCategory[category] || 0) + (parseFloat(expense.amount) || 0);
      });
      
      return {
        total,
        count: expenses?.length || 0,
        byCategory
      };
    } catch (error) {
      console.error('❌ Failed to aggregate expenses data:', error);
      return { total: 0, count: 0, byCategory: {} };
    }
  }

  /**
   * Aggregate operations data for the day
   */
  private async aggregateOperationsData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('operations')
        .select('operation_type, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: operations, error } = await query;
      
      if (error) throw error;
      
      const byType: Record<string, number> = {};
      operations?.forEach(op => {
        const type = op.operation_type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      });
      
      return {
        count: operations?.length || 0,
        byType
      };
    } catch (error) {
      console.error('❌ Failed to aggregate operations data:', error);
      return { count: 0, byType: {} };
    }
  }

  /**
   * Aggregate notes data for the day
   */
  private async aggregateNotesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('notes')
        .select('category, status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: notes, error } = await query;
      
      if (error) throw error;
      
      const byCategory: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      
      notes?.forEach(note => {
        const category = note.category || 'uncategorized';
        const status = note.status || 'unknown';
        
        byCategory[category] = (byCategory[category] || 0) + 1;
        byStatus[status] = (byStatus[status] || 0) + 1;
      });
      
      return {
        count: notes?.length || 0,
        byCategory,
        byStatus
      };
    } catch (error) {
      console.error('❌ Failed to aggregate notes data:', error);
      return { count: 0, byCategory: {}, byStatus: {} };
    }
  }

  /**
   * Generate AI-powered summary and insights
   */
  private async generateAISummary(data: {
    date: string;
    sales: any;
    expenses: any;
    operations: any;
    notes: any;
  }): Promise<{
    summary: string;
    insights: string[];
    alertsCount: number;
  }> {
    try {
      const prompt = `
Analyze this chicken business daily performance data and provide insights:

Date: ${data.date}
Sales: ${data.sales.total} PHP (${data.sales.count} transactions)
Top Products: ${JSON.stringify(data.sales.topProducts)}
Expenses: ${data.expenses.total} PHP (${data.expenses.count} items)
Expense Categories: ${JSON.stringify(data.expenses.byCategory)}
Operations: ${data.operations.count} (${JSON.stringify(data.operations.byType)})
Notes: ${data.notes.count} (${JSON.stringify(data.notes.byCategory)})

Provide:
1. A comprehensive business summary (2-3 sentences)
2. Key insights and recommendations (3-5 bullet points)
3. Any alerts or concerns that need attention

Format as JSON:
{
  "summary": "Overall business performance summary",
  "insights": ["insight1", "insight2", "insight3"],
  "alerts": ["alert1", "alert2"] (if any)
}
`;
      
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      try {
        const parsed = JSON.parse(response);
        return {
          summary: parsed.summary || 'AI summary generation failed',
          insights: parsed.insights || [],
          alertsCount: parsed.alerts?.length || 0
        };
      } catch (parseError) {
        console.warn('⚠️ Failed to parse AI summary, using fallback');
        return {
          summary: `Business performance for ${data.date}: Sales ${data.sales.total} PHP, Expenses ${data.expenses.total} PHP, Net: ${data.sales.total - data.expenses.total} PHP`,
          insights: ['AI analysis temporarily unavailable'],
          alertsCount: 0
        };
      }
    } catch (error) {
      console.error('❌ Failed to generate AI summary:', error);
      return {
        summary: `Basic summary for ${data.date}: Sales ${data.sales.total} PHP, Expenses ${data.expenses.total} PHP`,
        insights: ['AI analysis failed'],
        alertsCount: 0
      };
    }
  }

  /**
   * Store daily summary in database
   */
  private async storeDailySummary(summary: BusinessSummary): Promise<void> {
    try {
      const { error } = await supabase
        .from('summaries')
        .insert({
          id: summary.id,
          branch_id: summary.branchId,
          summary_type: 'daily',
          date_from: summary.date,
          date_to: summary.date,
          summary_data: {
            totalSales: summary.totalSales,
            totalExpenses: summary.totalExpenses,
            netProfit: summary.netProfit,
            noteCount: summary.noteCount,
            operationCount: summary.operationCount,
            topProducts: summary.topProducts,
            keyInsights: summary.keyInsights,
            alertsGenerated: summary.alertsGenerated,
            archivedRecords: summary.archivedRecords
          },
          ai_summary: summary.aiGeneratedSummary,
          status: 'generated',
          created_at: summary.createdAt
        });
      
      if (error) throw error;
      console.log('✅ Daily summary stored in database');
    } catch (error) {
      console.error('❌ Failed to store daily summary:', error);
      throw error;
    }
  }

  /**
   * Archive old records to reduce database size
   */
  private async archiveOldRecords(config: DailySummaryConfig): Promise<{
    notes: number;
    operations: number;
    expenses: number;
  }> {
    const retentionDays = config.retentionDays || 90; // Default 90 days retention
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();
    
    console.log(`🗄️ Archiving records older than ${cutoffISO}...`);
    
    try {
      // Export old records to Google Drive before deletion
      const exportResult = await googleDriveService.exportAndUpload({
        tables: ['notes', 'operations', 'expenses'],
        format: 'xlsx',
        dateRange: {
          start: '2020-01-01', // Start from beginning
          end: cutoffDate.toISOString().split('T')[0] // End at cutoff date
        },
        branchId: config.branchId
      });
      
      console.log(`📤 Archived data exported to Google Drive: ${exportResult.webViewLink}`);
      
      // Count records to be archived
      const [notesCount, operationsCount, expensesCount] = await Promise.all([
        this.countOldRecords('notes', cutoffISO, config.branchId),
        this.countOldRecords('operations', cutoffISO, config.branchId),
        this.countOldRecords('expenses', cutoffISO, config.branchId)
      ]);
      
      // Delete old records (only after successful export)
      await Promise.all([
        this.deleteOldRecords('notes', cutoffISO, config.branchId),
        this.deleteOldRecords('operations', cutoffISO, config.branchId),
        this.deleteOldRecords('expenses', cutoffISO, config.branchId)
      ]);
      
      console.log(`🗑️ Archived ${notesCount + operationsCount + expensesCount} old records`);
      
      return {
        notes: notesCount,
        operations: operationsCount,
        expenses: expensesCount
      };
    } catch (error) {
      console.error('❌ Failed to archive old records:', error);
      return { notes: 0, operations: 0, expenses: 0 };
    }
  }

  /**
   * Count old records for a table
   */
  private async countOldRecords(tableName: string, cutoffDate: string, branchId?: string): Promise<number> {
    try {
      let query = supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoffDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { count, error } = await query;
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`❌ Failed to count old records in ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Delete old records from a table
   */
  private async deleteOldRecords(tableName: string, cutoffDate: string, branchId?: string): Promise<void> {
    try {
      let query = supabase
        .from(tableName)
        .delete()
        .lt('created_at', cutoffDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      console.log(`✅ Deleted old records from ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to delete old records from ${tableName}:`, error);
    }
  }

  /**
   * Get summary history
   */
  async getSummaryHistory(branchId?: string, limit: number = 30): Promise<BusinessSummary[]> {
    try {
      let query = supabase
        .from('summaries')
        .select('*')
        .eq('summary_type', 'daily')
        .order('date_from', { ascending: false })
        .limit(limit);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data?.map(record => ({
        id: record.id,
        date: record.date_from,
        branchId: record.branch_id,
        totalSales: record.summary_data?.totalSales || 0,
        totalExpenses: record.summary_data?.totalExpenses || 0,
        netProfit: record.summary_data?.netProfit || 0,
        noteCount: record.summary_data?.noteCount || 0,
        operationCount: record.summary_data?.operationCount || 0,
        topProducts: record.summary_data?.topProducts || [],
        keyInsights: record.summary_data?.keyInsights || [],
        alertsGenerated: record.summary_data?.alertsGenerated || 0,
        aiGeneratedSummary: record.ai_summary || '',
        createdAt: record.created_at,
        archivedRecords: record.summary_data?.archivedRecords
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get summary history:', error);
      return [];
    }
  }

  /**
   * Schedule automated daily summary generation
   */
  async scheduleAutomatedSummaries(config: {
    frequency: 'daily' | 'weekly';
    time: string; // HH:MM format
    branchId?: string;
    includeArchival: boolean;
    retentionDays: number;
  }): Promise<void> {
    console.log('📅 Scheduling automated daily summaries:', config);
    // This would integrate with a job scheduler like node-cron
    // Implementation depends on deployment environment
  }
}

// Singleton instance
export const dailySummariesService = new DailySummariesService();