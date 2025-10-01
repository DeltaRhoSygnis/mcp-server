/**
 * Business Intelligence Automation Service
 * Scheduled report generation with Excel templates and automated insights delivery
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { googleDriveService } from './googleDriveService';
import { dailySummariesService } from './dailySummariesService';
// Use require() for Google Generative AI to fix compilation issues
const { GoogleGenerativeAI } = require('@google/generative-ai');
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export interface BusinessReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  title: string;
  description: string;
  branchId?: string;
  dateRange: {
    start: string;
    end: string;
  };
  sections: ReportSection[];
  insights: string[];
  recommendations: string[];
  kpis: Record<string, any>;
  charts: ChartData[];
  createdAt: string;
  generatedBy: 'ai' | 'scheduled' | 'manual';
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'table' | 'chart' | 'insights' | 'comparison';
  content: any;
  order: number;
}

export interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: any[];
  config: any;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: string;
  sections: Omit<ReportSection, 'id' | 'content'>[];
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients?: string[];
  };
}

export class BusinessIntelligenceService {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Generate comprehensive business intelligence report
   */
  async generateReport(config: {
    reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
    dateRange: { start: string; end: string };
    branchId?: string;
    templateId?: string;
    customSections?: string[];
  }): Promise<BusinessReport> {
    try {
      console.log(`📊 Generating ${config.reportType} business intelligence report...`);
      
      const reportId = uuidv4();
      const startTime = Date.now();
      
      // Collect data for the report
      const reportData = await this.collectReportData(config);
      
      // Generate AI insights
      const aiInsights = await this.generateAIInsights(reportData, config);
      
      // Create report sections
      const sections = await this.createReportSections(reportData, config);
      
      // Generate KPIs
      const kpis = this.calculateKPIs(reportData);
      
      // Create charts data
      const charts = this.generateChartData(reportData);
      
      const report: BusinessReport = {
        id: reportId,
        reportType: config.reportType,
        title: `${config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1)} Business Intelligence Report`,
        description: `Comprehensive business analysis for ${config.dateRange.start} to ${config.dateRange.end}`,
        branchId: config.branchId,
        dateRange: config.dateRange,
        sections,
        insights: aiInsights.insights,
        recommendations: aiInsights.recommendations,
        kpis,
        charts,
        createdAt: new Date().toISOString(),
        generatedBy: 'ai'
      };
      
      // Store report in database
      await this.storeReport(report);
      
      const generationTime = Date.now() - startTime;
      console.log(`✅ Business intelligence report generated in ${generationTime}ms`);
      
      return report;
    } catch (error) {
      console.error('❌ Failed to generate business intelligence report:', error);
      throw error;
    }
  }

  /**
   * Collect all necessary data for report generation
   */
  private async collectReportData(config: {
    reportType: string;
    dateRange: { start: string; end: string };
    branchId?: string;
  }): Promise<any> {
    console.log('🔍 Collecting report data...');
    
    const startDate = `${config.dateRange.start}T00:00:00Z`;
    const endDate = `${config.dateRange.end}T23:59:59Z`;
    
    // Collect data from multiple sources
    const [
      salesData,
      expensesData,
      operationsData,
      notesData,
      summariesData,
      inventoryData
    ] = await Promise.all([
      this.collectSalesData(startDate, endDate, config.branchId),
      this.collectExpensesData(startDate, endDate, config.branchId),
      this.collectOperationsData(startDate, endDate, config.branchId),
      this.collectNotesData(startDate, endDate, config.branchId),
      this.collectSummariesData(startDate, endDate, config.branchId),
      this.collectInventoryData(config.branchId)
    ]);
    
    return {
      sales: salesData,
      expenses: expensesData,
      operations: operationsData,
      notes: notesData,
      summaries: summariesData,
      inventory: inventoryData,
      dateRange: config.dateRange,
      branchId: config.branchId
    };
  }

  /**
   * Collect sales data with trends
   */
  private async collectSalesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('notes')
        .select('*')
        .eq('category', 'sale')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('parsed', 'is', null);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: salesNotes, error } = await query;
      if (error) throw error;
      
      // Aggregate sales data
      let totalRevenue = 0;
      let totalTransactions = salesNotes?.length || 0;
      const productSales: Record<string, { quantity: number; revenue: number; transactions: number }> = {};
      const dailySales: Record<string, number> = {};
      
      salesNotes?.forEach(note => {
        const parsed = note.parsed;
        if (parsed && parsed.amount) {
          const amount = parseFloat(parsed.amount) || 0;
          totalRevenue += amount;
          
          const date = new Date(note.created_at).toISOString().split('T')[0];
          dailySales[date] = (dailySales[date] || 0) + amount;
          
          if (parsed.product_name) {
            const product = parsed.product_name;
            const quantity = parseFloat(parsed.quantity) || 1;
            
            if (!productSales[product]) {
              productSales[product] = { quantity: 0, revenue: 0, transactions: 0 };
            }
            productSales[product].quantity += quantity;
            productSales[product].revenue += amount;
            productSales[product].transactions += 1;
          }
        }
      });
      
      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      return {
        totalRevenue,
        totalTransactions,
        averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        topProducts,
        dailySales,
        salesTrend: this.calculateTrend(Object.values(dailySales))
      };
    } catch (error) {
      console.error('❌ Failed to collect sales data:', error);
      return { totalRevenue: 0, totalTransactions: 0, averageTransaction: 0, topProducts: [], dailySales: {}, salesTrend: 'stable' };
    }
  }

  /**
   * Collect expenses data with categorization
   */
  private async collectExpensesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: expenses, error } = await query;
      if (error) throw error;
      
      let totalExpenses = 0;
      const categoryExpenses: Record<string, number> = {};
      const dailyExpenses: Record<string, number> = {};
      
      expenses?.forEach(expense => {
        const amount = parseFloat(expense.amount) || 0;
        totalExpenses += amount;
        
        const date = new Date(expense.created_at).toISOString().split('T')[0];
        dailyExpenses[date] = (dailyExpenses[date] || 0) + amount;
        
        const category = expense.category || 'uncategorized';
        categoryExpenses[category] = (categoryExpenses[category] || 0) + amount;
      });
      
      const topCategories = Object.entries(categoryExpenses)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
      
      return {
        totalExpenses,
        totalItems: expenses?.length || 0,
        averageExpense: expenses?.length ? totalExpenses / expenses.length : 0,
        topCategories,
        dailyExpenses,
        expensesTrend: this.calculateTrend(Object.values(dailyExpenses))
      };
    } catch (error) {
      console.error('❌ Failed to collect expenses data:', error);
      return { totalExpenses: 0, totalItems: 0, averageExpense: 0, topCategories: [], dailyExpenses: {}, expensesTrend: 'stable' };
    }
  }

  /**
   * Collect operations data
   */
  private async collectOperationsData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('operations')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: operations, error } = await query;
      if (error) throw error;
      
      const operationTypes: Record<string, number> = {};
      const dailyOperations: Record<string, number> = {};
      
      operations?.forEach(operation => {
        const date = new Date(operation.created_at).toISOString().split('T')[0];
        dailyOperations[date] = (dailyOperations[date] || 0) + 1;
        
        const type = operation.operation_type || 'unknown';
        operationTypes[type] = (operationTypes[type] || 0) + 1;
      });
      
      return {
        totalOperations: operations?.length || 0,
        operationTypes,
        dailyOperations,
        averageDaily: Object.keys(dailyOperations).length > 0 ? 
          Object.values(dailyOperations).reduce((sum, count) => sum + count, 0) / Object.keys(dailyOperations).length : 0
      };
    } catch (error) {
      console.error('❌ Failed to collect operations data:', error);
      return { totalOperations: 0, operationTypes: {}, dailyOperations: {}, averageDaily: 0 };
    }
  }

  /**
   * Collect notes data for sentiment and categorization
   */
  private async collectNotesData(startDate: string, endDate: string, branchId?: string) {
    try {
      let query = supabase
        .from('notes')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data: notes, error } = await query;
      if (error) throw error;
      
      const categories: Record<string, number> = {};
      const statuses: Record<string, number> = {};
      
      notes?.forEach(note => {
        const category = note.category || 'uncategorized';
        const status = note.status || 'unknown';
        
        categories[category] = (categories[category] || 0) + 1;
        statuses[status] = (statuses[status] || 0) + 1;
      });
      
      return {
        totalNotes: notes?.length || 0,
        categories,
        statuses,
        averageDaily: notes?.length || 0 // Simplified
      };
    } catch (error) {
      console.error('❌ Failed to collect notes data:', error);
      return { totalNotes: 0, categories: {}, statuses: {}, averageDaily: 0 };
    }
  }

  /**
   * Collect summaries data for trends
   */
  private async collectSummariesData(startDate: string, endDate: string, branchId?: string) {
    try {
      const summaries = await dailySummariesService.getSummaryHistory(branchId, 30);
      
      const filteredSummaries = summaries.filter(summary => {
        const summaryDate = new Date(summary.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return summaryDate >= start && summaryDate <= end;
      });
      
      const totalProfit = filteredSummaries.reduce((sum, s) => sum + s.netProfit, 0);
      const averageProfit = filteredSummaries.length > 0 ? totalProfit / filteredSummaries.length : 0;
      
      return {
        summariesCount: filteredSummaries.length,
        totalProfit,
        averageProfit,
        profitTrend: this.calculateTrend(filteredSummaries.map(s => s.netProfit)),
        summaries: filteredSummaries.slice(0, 10) // Latest 10 for details
      };
    } catch (error) {
      console.error('❌ Failed to collect summaries data:', error);
      return { summariesCount: 0, totalProfit: 0, averageProfit: 0, profitTrend: 'stable', summaries: [] };
    }
  }

  /**
   * Collect inventory data
   */
  private async collectInventoryData(branchId?: string) {
    try {
      // This would be more complex in a real system
      // For now, return placeholder data
      return {
        totalItems: 0,
        lowStockItems: [],
        topMovingItems: [],
        inventoryValue: 0
      };
    } catch (error) {
      console.error('❌ Failed to collect inventory data:', error);
      return { totalItems: 0, lowStockItems: [], topMovingItems: [], inventoryValue: 0 };
    }
  }

  /**
   * Generate AI insights from collected data
   */
  private async generateAIInsights(data: any, config: any): Promise<{
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `
Analyze this chicken business data and provide insights and recommendations:

Sales Data:
- Total Revenue: ${data.sales.totalRevenue} PHP
- Total Transactions: ${data.sales.totalTransactions}
- Average Transaction: ${data.sales.averageTransaction} PHP
- Sales Trend: ${data.sales.salesTrend}
- Top Products: ${JSON.stringify(data.sales.topProducts.slice(0, 3))}

Expenses Data:
- Total Expenses: ${data.expenses.totalExpenses} PHP
- Expense Trend: ${data.expenses.expensesTrend}
- Top Categories: ${JSON.stringify(data.expenses.topCategories.slice(0, 3))}

Profit Analysis:
- Net Profit: ${data.sales.totalRevenue - data.expenses.totalExpenses} PHP
- Profit Margin: ${data.sales.totalRevenue > 0 ? ((data.sales.totalRevenue - data.expenses.totalExpenses) / data.sales.totalRevenue * 100).toFixed(2) : 0}%

Operations:
- Total Operations: ${data.operations.totalOperations}
- Average Daily Operations: ${data.operations.averageDaily}

Provide:
1. 5 key business insights
2. 5 actionable recommendations
3. Any concerns or opportunities

Format as JSON:
{
  "insights": ["insight1", "insight2", "insight3", "insight4", "insight5"],
  "recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5"],
  "concerns": ["concern1", "concern2"],
  "opportunities": ["opp1", "opp2"]
}
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      try {
        const parsed = JSON.parse(response);
        return {
          insights: parsed.insights || [],
          recommendations: [...(parsed.recommendations || []), ...(parsed.concerns || []), ...(parsed.opportunities || [])]
        };
      } catch (parseError) {
        console.warn('⚠️ Failed to parse AI insights, using fallback');
        return {
          insights: [
            `Total revenue: ${data.sales.totalRevenue} PHP with ${data.sales.totalTransactions} transactions`,
            `Net profit: ${data.sales.totalRevenue - data.expenses.totalExpenses} PHP`,
            `Most profitable product: ${data.sales.topProducts[0]?.name || 'N/A'}`,
            `Highest expense category: ${data.expenses.topCategories[0]?.category || 'N/A'}`,
            `Daily operations average: ${data.operations.averageDaily} activities`
          ],
          recommendations: [
            'Monitor profit margins regularly',
            'Focus on top-performing products',
            'Review high-expense categories',
            'Maintain operational efficiency',
            'Consider seasonal adjustments'
          ]
        };
      }
    } catch (error) {
      console.error('❌ Failed to generate AI insights:', error);
      return {
        insights: ['AI analysis temporarily unavailable'],
        recommendations: ['Review data manually for insights']
      };
    }
  }

  /**
   * Create structured report sections
   */
  private async createReportSections(data: any, config: any): Promise<ReportSection[]> {
    const sections: ReportSection[] = [
      {
        id: uuidv4(),
        title: 'Executive Summary',
        type: 'summary',
        content: {
          totalRevenue: data.sales.totalRevenue,
          totalExpenses: data.expenses.totalExpenses,
          netProfit: data.sales.totalRevenue - data.expenses.totalExpenses,
          profitMargin: data.sales.totalRevenue > 0 ? ((data.sales.totalRevenue - data.expenses.totalExpenses) / data.sales.totalRevenue * 100).toFixed(2) + '%' : '0%',
          totalTransactions: data.sales.totalTransactions,
          totalOperations: data.operations.totalOperations
        },
        order: 1
      },
      {
        id: uuidv4(),
        title: 'Sales Performance',
        type: 'table',
        content: {
          totalRevenue: data.sales.totalRevenue,
          totalTransactions: data.sales.totalTransactions,
          averageTransaction: data.sales.averageTransaction,
          topProducts: data.sales.topProducts.slice(0, 5),
          salesTrend: data.sales.salesTrend
        },
        order: 2
      },
      {
        id: uuidv4(),
        title: 'Expense Analysis',
        type: 'table',
        content: {
          totalExpenses: data.expenses.totalExpenses,
          totalItems: data.expenses.totalItems,
          averageExpense: data.expenses.averageExpense,
          topCategories: data.expenses.topCategories.slice(0, 5),
          expensesTrend: data.expenses.expensesTrend
        },
        order: 3
      },
      {
        id: uuidv4(),
        title: 'Operational Metrics',
        type: 'table',
        content: {
          totalOperations: data.operations.totalOperations,
          operationTypes: data.operations.operationTypes,
          averageDaily: data.operations.averageDaily
        },
        order: 4
      }
    ];
    
    return sections;
  }

  /**
   * Calculate key performance indicators
   */
  private calculateKPIs(data: any): Record<string, any> {
    const revenue = data.sales.totalRevenue;
    const expenses = data.expenses.totalExpenses;
    const profit = revenue - expenses;
    
    return {
      revenue,
      expenses,
      profit,
      profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) + '%' : '0%',
      averageTransactionValue: data.sales.totalTransactions > 0 ? revenue / data.sales.totalTransactions : 0,
      expenseRatio: revenue > 0 ? ((expenses / revenue) * 100).toFixed(2) + '%' : '0%',
      dailyAverageRevenue: Object.keys(data.sales.dailySales).length > 0 ? 
        revenue / Object.keys(data.sales.dailySales).length : 0,
      operationalEfficiency: data.operations.totalOperations > 0 ? 
        data.sales.totalTransactions / data.operations.totalOperations : 0
    };
  }

  /**
   * Generate chart data for visualization
   */
  private generateChartData(data: any): ChartData[] {
    const charts: ChartData[] = [];
    
    // Daily sales chart
    if (Object.keys(data.sales.dailySales).length > 0) {
      charts.push({
        id: uuidv4(),
        title: 'Daily Sales Trend',
        type: 'line',
        data: Object.entries(data.sales.dailySales).map(([date, amount]) => ({
          date,
          amount: amount as number
        })),
        config: {
          xAxis: 'date',
          yAxis: 'amount',
          color: '#10b981'
        }
      });
    }
    
    // Top products chart
    if (data.sales.topProducts.length > 0) {
      charts.push({
        id: uuidv4(),
        title: 'Top Products by Revenue',
        type: 'bar',
        data: data.sales.topProducts.slice(0, 5).map((product: any) => ({
          name: product.name,
          revenue: product.revenue
        })),
        config: {
          xAxis: 'name',
          yAxis: 'revenue',
          color: '#3b82f6'
        }
      });
    }
    
    // Expense categories chart
    if (data.expenses.topCategories.length > 0) {
      charts.push({
        id: uuidv4(),
        title: 'Expenses by Category',
        type: 'pie',
        data: data.expenses.topCategories.slice(0, 5).map((category: any) => ({
          category: category.category,
          amount: category.amount
        })),
        config: {
          valueField: 'amount',
          categoryField: 'category'
        }
      });
    }
    
    return charts;
  }

  /**
   * Calculate trend from data points
   */
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const threshold = firstAvg * 0.1; // 10% threshold
    
    if (secondAvg > firstAvg + threshold) return 'increasing';
    if (secondAvg < firstAvg - threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Store report in database
   */
  private async storeReport(report: BusinessReport): Promise<void> {
    try {
      const { error } = await supabase
        .from('business_reports')
        .insert({
          id: report.id,
          report_type: report.reportType,
          title: report.title,
          description: report.description,
          branch_id: report.branchId,
          date_from: report.dateRange.start,
          date_to: report.dateRange.end,
          report_data: {
            sections: report.sections,
            insights: report.insights,
            recommendations: report.recommendations,
            kpis: report.kpis,
            charts: report.charts
          },
          generated_by: report.generatedBy,
          status: 'generated',
          created_at: report.createdAt
        });
      
      if (error) throw error;
      console.log('✅ Business intelligence report stored in database');
    } catch (error) {
      console.error('❌ Failed to store report:', error);
      throw error;
    }
  }

  /**
   * Export report to Excel with professional formatting
   */
  async exportReportToExcel(reportId: string): Promise<{
    buffer: Buffer;
    filename: string;
    metadata: any;
  }> {
    try {
      console.log(`📊 Exporting report ${reportId} to Excel...`);
      
      // Get report from database
      const { data: reportData, error } = await supabase
        .from('business_reports')
        .select('*')
        .eq('id', reportId)
        .single();
      
      if (error || !reportData) {
        throw new Error('Report not found');
      }
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Executive Summary sheet
      const summaryData = [
        ['Business Intelligence Report'],
        [''],
        ['Report Type:', reportData.report_type],
        ['Date Range:', `${reportData.date_from} to ${reportData.date_to}`],
        ['Generated:', new Date(reportData.created_at).toLocaleString()],
        [''],
        ['Key Performance Indicators'],
        ...Object.entries(reportData.report_data.kpis || {}).map(([key, value]) => [key, value])
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');
      
      // Sections sheets
      reportData.report_data.sections?.forEach((section: any, index: number) => {
        const sectionData = [
          [section.title],
          [''],
          ...this.sectionToExcelData(section)
        ];
        
        const sectionSheet = XLSX.utils.aoa_to_sheet(sectionData);
        XLSX.utils.book_append_sheet(workbook, sectionSheet, `Section ${index + 1}`);
      });
      
      // Insights and Recommendations sheet
      const insightsData = [
        ['Insights & Recommendations'],
        [''],
        ['Key Insights:'],
        ...(reportData.report_data.insights || []).map((insight: string) => [`• ${insight}`]),
        [''],
        ['Recommendations:'],
        ...(reportData.report_data.recommendations || []).map((rec: string) => [`• ${rec}`])
      ];
      
      const insightsSheet = XLSX.utils.aoa_to_sheet(insightsData);
      XLSX.utils.book_append_sheet(workbook, insightsSheet, 'Insights');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      const filename = `business-report-${reportData.report_type}-${reportData.date_from}-${reportData.date_to}.xlsx`;
      
      return {
        buffer: Buffer.from(buffer),
        filename,
        metadata: {
          reportId: reportData.id,
          reportType: reportData.report_type,
          dateRange: `${reportData.date_from} to ${reportData.date_to}`,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Failed to export report to Excel:', error);
      throw error;
    }
  }

  /**
   * Convert report section to Excel data format
   */
  private sectionToExcelData(section: any): any[][] {
    switch (section.type) {
      case 'summary':
        return Object.entries(section.content).map(([key, value]) => [key, value]);
      
      case 'table':
        if (section.content.topProducts) {
          return [
            ['Product', 'Quantity', 'Revenue', 'Transactions'],
            ...section.content.topProducts.map((p: any) => [p.name, p.quantity, p.revenue, p.transactions])
          ];
        }
        if (section.content.topCategories) {
          return [
            ['Category', 'Amount'],
            ...section.content.topCategories.map((c: any) => [c.category, c.amount])
          ];
        }
        return Object.entries(section.content).map(([key, value]) => [key, value]);
      
      default:
        return [['Data not available for this section type']];
    }
  }

  /**
   * Schedule automated report generation
   */
  async scheduleAutomatedReports(config: {
    reportType: 'daily' | 'weekly' | 'monthly';
    time: string;
    branchId?: string;
    recipients?: string[];
    template?: string;
  }): Promise<void> {
    console.log('📅 Scheduling automated business intelligence reports:', config);
    // This would integrate with a job scheduler
    // Implementation depends on deployment environment
  }

  /**
   * Get report history
   */
  async getReportHistory(branchId?: string, limit: number = 20): Promise<BusinessReport[]> {
    try {
      let query = supabase
        .from('business_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data?.map(record => ({
        id: record.id,
        reportType: record.report_type,
        title: record.title,
        description: record.description,
        branchId: record.branch_id,
        dateRange: {
          start: record.date_from,
          end: record.date_to
        },
        sections: record.report_data?.sections || [],
        insights: record.report_data?.insights || [],
        recommendations: record.report_data?.recommendations || [],
        kpis: record.report_data?.kpis || {},
        charts: record.report_data?.charts || [],
        createdAt: record.created_at,
        generatedBy: record.generated_by
      })) || [];
    } catch (error) {
      console.error('❌ Failed to get report history:', error);
      return [];
    }
  }
}

// Singleton instance
export const businessIntelligenceService = new BusinessIntelligenceService();