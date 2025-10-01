/**
 * Business Intelligence Automation MCP Tools
 * Provides tools for generating comprehensive business reports and intelligence
 */

import { z } from 'zod';
import { businessIntelligenceService } from '../services/businessIntelligenceService';
import { googleDriveService } from '../services/googleDriveService';

export const businessIntelligenceTools = [
  {
    name: 'generate_business_report',
    description: 'Generate comprehensive business intelligence report with AI insights and recommendations',
    inputSchema: z.object({
      reportType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'custom']).describe('Type of report to generate'),
      dateRange: z.object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date (YYYY-MM-DD)'),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date (YYYY-MM-DD)')
      }).describe('Date range for the report'),
      branchId: z.string().optional().describe('Optional branch ID to filter data'),
      templateId: z.string().optional().describe('Optional report template ID'),
      customSections: z.array(z.string()).optional().describe('Custom sections to include in the report'),
      exportToExcel: z.boolean().default(false).describe('Whether to export report to Excel format'),
      uploadToDrive: z.boolean().default(false).describe('Whether to upload the report to Google Drive')
    }),
    handler: async (params: {
      reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
      dateRange: { start: string; end: string };
      branchId?: string;
      templateId?: string;
      customSections?: string[];
      exportToExcel?: boolean;
      uploadToDrive?: boolean;
    }) => {
      try {
        console.log('📊 Generating business intelligence report with params:', params);
        
        // Validate date range
        const startDate = new Date(params.dateRange.start);
        const endDate = new Date(params.dateRange.end);
        
        if (startDate > endDate) {
          return {
            success: false,
            error: 'Start date must be before end date'
          };
        }
        
        // Generate the report
        const report = await businessIntelligenceService.generateReport({
          reportType: params.reportType,
          dateRange: params.dateRange,
          branchId: params.branchId,
          templateId: params.templateId,
          customSections: params.customSections
        });
        
        let excelFile = null;
        let driveLink = null;
        
        // Export to Excel if requested
        if (params.exportToExcel) {
          const excelData = await businessIntelligenceService.exportReportToExcel(report.id);
          excelFile = {
            filename: excelData.filename,
            size: excelData.buffer.length,
            metadata: excelData.metadata
          };
          
          // Upload to Google Drive if requested
          if (params.uploadToDrive) {
            // Create file upload using proper Google Drive API
            const uploadResult = await googleDriveService.uploadFile(
              excelData.filename,
              {
                description: `Business Intelligence Report - ${params.reportType} - ${params.dateRange.start} to ${params.dateRange.end}`
              }
            );
            
            driveLink = uploadResult.webViewLink;
          }
        }
        
        return {
          success: true,
          report: {
            id: report.id,
            title: report.title,
            description: report.description,
            reportType: report.reportType,
            dateRange: report.dateRange,
            branchId: report.branchId,
            kpis: report.kpis,
            insights: report.insights.slice(0, 5), // Limit for response size
            recommendations: report.recommendations.slice(0, 5),
            sectionsCount: report.sections.length,
            chartsCount: report.charts.length,
            createdAt: report.createdAt,
            generatedBy: report.generatedBy
          },
          files: {
            excel: excelFile,
            driveLink: driveLink
          }
        };
      } catch (error) {
        console.error('❌ Failed to generate business report:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'get_report_history',
    description: 'Retrieve historical business intelligence reports',
    inputSchema: z.object({
      branchId: z.string().optional().describe('Optional branch ID to filter reports'),
      limit: z.number().default(20).describe('Maximum number of reports to retrieve'),
      reportType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'custom']).optional().describe('Filter by report type')
    }),
    handler: async (params: {
      branchId?: string;
      limit?: number;
      reportType?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
    }) => {
      try {
        console.log('📈 Retrieving report history with params:', params);
        
        const reports = await businessIntelligenceService.getReportHistory(
          params.branchId,
          params.limit || 20
        );
        
        // Filter by report type if specified
        const filteredReports = params.reportType
          ? reports.filter(report => report.reportType === params.reportType)
          : reports;
        
        return {
          success: true,
          reports: filteredReports.map(report => ({
            id: report.id,
            title: report.title,
            reportType: report.reportType,
            dateRange: report.dateRange,
            branchId: report.branchId,
            keyMetrics: {
              revenue: report.kpis.revenue,
              expenses: report.kpis.expenses,
              profit: report.kpis.profit,
              profitMargin: report.kpis.profitMargin
            },
            insightsCount: report.insights.length,
            recommendationsCount: report.recommendations.length,
            createdAt: report.createdAt,
            generatedBy: report.generatedBy
          })),
          totalCount: filteredReports.length
        };
      } catch (error) {
        console.error('❌ Failed to get report history:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'export_report_to_excel',
    description: 'Export an existing business intelligence report to Excel format',
    inputSchema: z.object({
      reportId: z.string().describe('ID of the report to export'),
      uploadToDrive: z.boolean().default(false).describe('Whether to upload the Excel file to Google Drive')
    }),
    handler: async (params: {
      reportId: string;
      uploadToDrive?: boolean;
    }) => {
      try {
        console.log('📊 Exporting report to Excel with params:', params);
        
        const excelData = await businessIntelligenceService.exportReportToExcel(params.reportId);
        
        let driveLink = null;
        
        // Upload to Google Drive if requested
        if (params.uploadToDrive) {
          // Create file upload using proper Google Drive API
          const uploadResult = await googleDriveService.uploadFile(
            excelData.filename,
            {
              description: `Exported Business Intelligence Report - ${excelData.metadata.reportType}`
            }
          );
          
          driveLink = uploadResult.webViewLink;
        }
        
        return {
          success: true,
          export: {
            filename: excelData.filename,
            size: excelData.buffer.length,
            metadata: excelData.metadata,
            driveLink: driveLink
          }
        };
      } catch (error) {
        console.error('❌ Failed to export report to Excel:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'schedule_automated_reports',
    description: 'Schedule automated business intelligence report generation',
    inputSchema: z.object({
      reportType: z.enum(['daily', 'weekly', 'monthly']).describe('Frequency of report generation'),
      time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).describe('Time to generate reports (HH:MM format)'),
      branchId: z.string().optional().describe('Optional branch ID for automated reports'),
      recipients: z.array(z.string().email()).optional().describe('Email addresses to send reports to'),
      template: z.string().optional().describe('Report template to use'),
      exportToExcel: z.boolean().default(true).describe('Whether to export reports to Excel'),
      uploadToDrive: z.boolean().default(true).describe('Whether to upload reports to Google Drive')
    }),
    handler: async (params: {
      reportType: 'daily' | 'weekly' | 'monthly';
      time: string;
      branchId?: string;
      recipients?: string[];
      template?: string;
      exportToExcel?: boolean;
      uploadToDrive?: boolean;
    }) => {
      try {
        console.log('📅 Scheduling automated reports with params:', params);
        
        await businessIntelligenceService.scheduleAutomatedReports({
          reportType: params.reportType,
          time: params.time,
          branchId: params.branchId,
          recipients: params.recipients,
          template: params.template
        });
        
        return {
          success: true,
          schedule: {
            reportType: params.reportType,
            time: params.time,
            branchId: params.branchId || 'all branches',
            recipients: params.recipients || [],
            exportToExcel: params.exportToExcel ?? true,
            uploadToDrive: params.uploadToDrive ?? true
          },
          message: 'Automated business intelligence reports scheduled successfully'
        };
      } catch (error) {
        console.error('❌ Failed to schedule automated reports:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  },

  {
    name: 'get_business_kpis',
    description: 'Get current business key performance indicators and metrics',
    inputSchema: z.object({
      dateRange: z.object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date (YYYY-MM-DD)'),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date (YYYY-MM-DD)')
      }).describe('Date range for KPI calculation'),
      branchId: z.string().optional().describe('Optional branch ID to filter data'),
      compareWithPrevious: z.boolean().default(false).describe('Whether to compare with previous period')
    }),
    handler: async (params: {
      dateRange: { start: string; end: string };
      branchId?: string;
      compareWithPrevious?: boolean;
    }) => {
      try {
        console.log('📊 Getting business KPIs with params:', params);
        
        // Generate a temporary report to get KPIs
        const report = await businessIntelligenceService.generateReport({
          reportType: 'custom',
          dateRange: params.dateRange,
          branchId: params.branchId
        });
        
        let previousKPIs = null;
        
        // Compare with previous period if requested
        if (params.compareWithPrevious) {
          const startDate = new Date(params.dateRange.start);
          const endDate = new Date(params.dateRange.end);
          const periodLength = endDate.getTime() - startDate.getTime();
          
          const previousEnd = new Date(startDate.getTime() - 1);
          const previousStart = new Date(previousEnd.getTime() - periodLength);
          
          const previousReport = await businessIntelligenceService.generateReport({
            reportType: 'custom',
            dateRange: {
              start: previousStart.toISOString().split('T')[0],
              end: previousEnd.toISOString().split('T')[0]
            },
            branchId: params.branchId
          });
          
          previousKPIs = previousReport.kpis;
        }
        
        // Calculate changes if comparing
        const changes = previousKPIs ? {
          revenueChange: previousKPIs.revenue > 0 ? 
            (((report.kpis.revenue - previousKPIs.revenue) / previousKPIs.revenue) * 100).toFixed(2) + '%' : 'N/A',
          expensesChange: previousKPIs.expenses > 0 ? 
            (((report.kpis.expenses - previousKPIs.expenses) / previousKPIs.expenses) * 100).toFixed(2) + '%' : 'N/A',
          profitChange: previousKPIs.profit !== 0 ? 
            (((report.kpis.profit - previousKPIs.profit) / Math.abs(previousKPIs.profit)) * 100).toFixed(2) + '%' : 'N/A'
        } : null;
        
        return {
          success: true,
          kpis: report.kpis,
          previousPeriod: previousKPIs,
          changes: changes,
          dateRange: params.dateRange,
          branchId: params.branchId || 'all branches',
          insights: report.insights.slice(0, 3),
          recommendations: report.recommendations.slice(0, 3)
        };
      } catch (error) {
        console.error('❌ Failed to get business KPIs:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  }
];

export function registerBusinessIntelligenceTools(server: any) {
  console.log('📊 Registering Business Intelligence MCP tools...');
  
  businessIntelligenceTools.forEach(tool => {
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
  
  console.log(`✅ Registered ${businessIntelligenceTools.length} Business Intelligence MCP tools`);
}