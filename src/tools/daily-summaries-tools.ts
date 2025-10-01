/**
 * MCP Tools for Daily Summaries Automation & Archive
 * Provides tools for generating daily summaries, archiving old data, and viewing reports
 */

import { z } from 'zod';
import { dailySummariesService, DailySummaryConfig } from '../services/dailySummariesService';

export const dailySummariesTools = [
  {
    name: 'generate_daily_summary',
    description: 'Generate a comprehensive daily business summary with AI insights and optional archival',
    inputSchema: z.object({
      date: z.string().describe('Date in YYYY-MM-DD format'),
      branchId: z.string().optional().describe('Optional branch ID to filter data'),
      includeArchival: z.boolean().default(false).describe('Whether to archive old records during summary generation'),
      retentionDays: z.number().default(90).describe('Number of days to retain detailed records (older records will be archived)')
    }),
    handler: async (params: {
      date: string;
      branchId?: string;
      includeArchival?: boolean;
      retentionDays?: number;
    }) => {
      try {
        console.log('📊 Generating daily summary with params:', params);
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(params.date)) {
          throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
        }
        
        const config: DailySummaryConfig = {
          date: params.date,
          branchId: params.branchId,
          includeArchival: params.includeArchival || false,
          retentionDays: params.retentionDays || 90
        };
        
        const summary = await dailySummariesService.generateDailySummary(config);
        
        return {
          success: true,
          summary: {
            id: summary.id,
            date: summary.date,
            branchId: summary.branchId,
            performance: {
              totalSales: summary.totalSales,
              totalExpenses: summary.totalExpenses,
              netProfit: summary.netProfit,
              profitMargin: summary.totalSales > 0 ? ((summary.netProfit / summary.totalSales) * 100).toFixed(2) + '%' : '0%'
            },
            activity: {
              noteCount: summary.noteCount,
              operationCount: summary.operationCount
            },
            topProducts: summary.topProducts,
            insights: summary.keyInsights,
            aiSummary: summary.aiGeneratedSummary,
            alertsGenerated: summary.alertsGenerated,
            archivedRecords: summary.archivedRecords,
            createdAt: summary.createdAt
          }
        };
      } catch (error) {
        console.error('❌ Failed to generate daily summary:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'get_summary_history',
    description: 'Retrieve historical daily summaries with business performance trends',
    inputSchema: z.object({
      branchId: z.string().optional().describe('Optional branch ID to filter summaries'),
      limit: z.number().default(30).describe('Maximum number of summaries to retrieve (default: 30)')
    }),
    handler: async (params: {
      branchId?: string;
      limit?: number;
    }) => {
      try {
        console.log('📈 Retrieving summary history with params:', params);
        
        const summaries = await dailySummariesService.getSummaryHistory(
          params.branchId,
          params.limit || 30
        );
        
        // Calculate trends
        const trends = {
          totalSummaries: summaries.length,
          avgDailySales: 0,
          avgDailyExpenses: 0,
          avgDailyProfit: 0,
          bestPerformingDay: null as any,
          worstPerformingDay: null as any
        };
        
        if (summaries.length > 0) {
          trends.avgDailySales = summaries.reduce((sum, s) => sum + s.totalSales, 0) / summaries.length;
          trends.avgDailyExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0) / summaries.length;
          trends.avgDailyProfit = summaries.reduce((sum, s) => sum + s.netProfit, 0) / summaries.length;
          
          trends.bestPerformingDay = summaries.reduce((best, current) => 
            current.netProfit > best.netProfit ? current : best
          );
          
          trends.worstPerformingDay = summaries.reduce((worst, current) => 
            current.netProfit < worst.netProfit ? current : worst
          );
        }
        
        return {
          success: true,
          summaries: summaries.slice(0, 10), // Limit response size
          trends,
          totalCount: summaries.length
        };
      } catch (error) {
        console.error('❌ Failed to get summary history:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'archive_old_records',
    description: 'Archive old business records to Google Drive and clean up database',
    inputSchema: z.object({
      retentionDays: z.number().default(90).describe('Number of days to retain records (older records will be archived)'),
      branchId: z.string().optional().describe('Optional branch ID to filter archived records'),
      tables: z.array(z.string()).default(['notes', 'operations', 'expenses']).describe('Tables to archive')
    }),
    handler: async (params: {
      retentionDays?: number;
      branchId?: string;
      tables?: string[];
    }) => {
      try {
        console.log('🗄️ Archiving old records with params:', params);
        
        const today = new Date().toISOString().split('T')[0];
        const config: DailySummaryConfig = {
          date: today,
          branchId: params.branchId,
          includeArchival: true,
          retentionDays: params.retentionDays || 90
        };
        
        // Generate today's summary with archival
        const summary = await dailySummariesService.generateDailySummary(config);
        
        return {
          success: true,
          archival: {
            cutoffDate: new Date(Date.now() - (config.retentionDays! * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
            archivedRecords: summary.archivedRecords,
            retentionDays: config.retentionDays
          },
          message: 'Old records successfully archived to Google Drive and removed from database'
        };
      } catch (error) {
        console.error('❌ Failed to archive old records:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'schedule_automated_summaries',
    description: 'Schedule automated daily summary generation with configurable frequency and archival',
    inputSchema: z.object({
      frequency: z.enum(['daily', 'weekly']).default('daily').describe('How often to generate summaries'),
      time: z.string().default('00:00').describe('Time to run automation (HH:MM format)'),
      branchId: z.string().optional().describe('Optional branch ID for automated summaries'),
      includeArchival: z.boolean().default(true).describe('Whether to include archival in automated runs'),
      retentionDays: z.number().default(90).describe('Days to retain detailed records')
    }),
    handler: async (params: {
      frequency?: 'daily' | 'weekly';
      time?: string;
      branchId?: string;
      includeArchival?: boolean;
      retentionDays?: number;
    }) => {
      try {
        console.log('📅 Scheduling automated summaries with params:', params);
        
        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (params.time && !timeRegex.test(params.time)) {
          throw new Error('Invalid time format. Please use HH:MM format (24-hour).');
        }
        
        await dailySummariesService.scheduleAutomatedSummaries({
          frequency: params.frequency || 'daily',
          time: params.time || '00:00',
          branchId: params.branchId,
          includeArchival: params.includeArchival ?? true,
          retentionDays: params.retentionDays || 90
        });
        
        return {
          success: true,
          schedule: {
            frequency: params.frequency || 'daily',
            time: params.time || '00:00',
            branchId: params.branchId || 'all branches',
            includeArchival: params.includeArchival ?? true,
            retentionDays: params.retentionDays || 90
          },
          message: 'Automated daily summaries scheduled successfully'
        };
      } catch (error) {
        console.error('❌ Failed to schedule automated summaries:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'get_business_insights',
    description: 'Get AI-generated business insights and recommendations based on recent performance',
    inputSchema: z.object({
      days: z.number().default(7).describe('Number of recent days to analyze'),
      branchId: z.string().optional().describe('Optional branch ID to filter analysis'),
      focusArea: z.enum(['sales', 'expenses', 'operations', 'all']).default('all').describe('Specific area to focus insights on')
    }),
    handler: async (params: {
      days?: number;
      branchId?: string;
      focusArea?: 'sales' | 'expenses' | 'operations' | 'all';
    }) => {
      try {
        console.log('🧠 Generating business insights with params:', params);
        
        const summaries = await dailySummariesService.getSummaryHistory(
          params.branchId,
          params.days || 7
        );
        
        if (summaries.length === 0) {
          return {
            success: false,
            error: 'No summary data available for analysis'
          };
        }
        
        // Aggregate insights from recent summaries
        const allInsights = summaries.flatMap(s => s.keyInsights);
        const totalSales = summaries.reduce((sum, s) => sum + s.totalSales, 0);
        const totalExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0);
        const totalProfit = summaries.reduce((sum, s) => sum + s.netProfit, 0);
        const avgDailyProfit = totalProfit / summaries.length;
        
        // Get top products across all days
        const productMap = new Map<string, { quantity: number; revenue: number }>();
        summaries.forEach(summary => {
          summary.topProducts.forEach(product => {
            const existing = productMap.get(product.name) || { quantity: 0, revenue: 0 };
            productMap.set(product.name, {
              quantity: existing.quantity + product.quantity,
              revenue: existing.revenue + product.revenue
            });
          });
        });
        
        const topProducts = Array.from(productMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);
        
        return {
          success: true,
          insights: {
            period: `${params.days || 7} days`,
            branchId: params.branchId || 'all branches',
            performance: {
              totalSales,
              totalExpenses,
              totalProfit,
              avgDailyProfit,
              profitMargin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) + '%' : '0%'
            },
            topProducts,
            keyInsights: [...new Set(allInsights)].slice(0, 10), // Unique insights, max 10
            recommendations: [
              avgDailyProfit < 0 ? 'Focus on reducing expenses or increasing sales' : 'Maintain current profitable operations',
              topProducts.length > 0 ? `Prioritize ${topProducts[0].name} - your best performer` : 'No clear product leaders identified',
              summaries.length < 7 ? 'Generate more daily summaries for better insights' : 'Good data coverage for analysis'
            ]
          }
        };
      } catch (error) {
        console.error('❌ Failed to generate business insights:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  }
];

export function registerDailySummariesTools(server: any) {
  console.log('📊 Registering Daily Summaries MCP tools...');
  
  dailySummariesTools.forEach(tool => {
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
  
  console.log(`✅ Registered ${dailySummariesTools.length} Daily Summaries MCP tools`);
}