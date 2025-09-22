/**
 * Unified AI Service
 * Primary AI interface that routes through MCP server with fallback to direct APIs
 * Replaces existing geminiAPIManager for better reliability and consistency
 */

import { mcpClient, MCPToolResponse } from './mcpClient';
import { GeminiAPIManager } from './geminiAPIManager';

export interface AIServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  source: 'mcp' | 'direct' | 'offline';
}

class UnifiedAIService {
  private geminiManager: GeminiAPIManager;
  private mcpAvailable: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // 1 minute

  constructor() {
    this.geminiManager = new GeminiAPIManager();
    this.checkMCPHealth();
  }

  /**
   * Check MCP server health periodically
   */
  private async checkMCPHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }

    try {
      this.mcpAvailable = await mcpClient.testConnection();
      this.lastHealthCheck = now;
      
      if (this.mcpAvailable) {
        console.log('✅ MCP server is available');
      } else {
        console.warn('⚠️ MCP server unavailable, falling back to direct API');
      }
    } catch (error) {
      console.warn('⚠️ MCP health check failed:', error);
      this.mcpAvailable = false;
    }
  }

  /**
   * Parse chicken business note with intelligent routing
   */
  async parseChickenNote(
    content: string,
    userRole: 'owner' | 'worker' = 'worker',
    branchId?: string
  ): Promise<AIServiceResponse> {
    await this.checkMCPHealth();

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResponse = await mcpClient.parseChickenNote(content, userRole, branchId);
        if (mcpResponse.success) {
          return {
            success: true,
            data: mcpResponse.result,
            source: 'mcp'
          };
        }
      } catch (error) {
        console.warn('MCP parse failed, falling back to direct API:', error);
        this.mcpAvailable = false;
      }
    }

    // Fallback to direct Gemini API
    try {
      const directResult = await this.geminiManager.parseChickenNote(content);
      return {
        success: true,
        data: directResult,
        source: 'direct'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'direct'
      };
    }
  }

  /**
   * Get business advice with intelligent routing
   */
  async getBusinessAdvice(
    question: string,
    userRole: 'owner' | 'worker' = 'owner',
    businessContext?: string
  ): Promise<AIServiceResponse> {
    await this.checkMCPHealth();

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResponse = await mcpClient.getBusinessAdvice(question, userRole, businessContext);
        if (mcpResponse.success) {
          return {
            success: true,
            data: mcpResponse.result,
            source: 'mcp'
          };
        }
      } catch (error) {
        console.warn('MCP business advice failed, falling back:', error);
        this.mcpAvailable = false;
      }
    }

    // Fallback to direct API (implement basic business advice)
    try {
      const prompt = `As a chicken business expert, provide advice for this question: ${question}
      
User Role: ${userRole}
Business Context: ${businessContext || 'General chicken business operations'}

Provide practical, actionable advice in a structured format.`;

      const directResult = await this.geminiManager.callGemini(
        { 
          type: 'text',
          complexity: 'medium',
          priority: 'normal'
        },
        prompt
      );

      return {
        success: true,
        data: directResult,
        source: 'direct'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'direct'
      };
    }
  }

  /**
   * Generate embeddings with intelligent routing
   */
  async generateEmbeddings(texts: string[]): Promise<AIServiceResponse> {
    await this.checkMCPHealth();

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResponse = await mcpClient.generateEmbeddings(texts);
        if (mcpResponse.success) {
          return {
            success: true,
            data: mcpResponse.result,
            source: 'mcp'
          };
        }
      } catch (error) {
        console.warn('MCP embeddings failed, falling back:', error);
        this.mcpAvailable = false;
      }
    }

    // Fallback to direct API
    try {
      const embeddings = await this.geminiManager.generateEmbeddings(texts);
      return {
        success: true,
        data: embeddings,
        source: 'direct'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'direct'
      };
    }
  }

  /**
   * Get AI insights with intelligent routing
   */
  async getAIInsights(
    salesData: any[],
    expenseData: any[]
  ): Promise<AIServiceResponse> {
    await this.checkMCPHealth();

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResponse = await mcpClient.getAIInsights(salesData, expenseData);
        if (mcpResponse.success) {
          return {
            success: true,
            data: mcpResponse.result,
            source: 'mcp'
          };
        }
      } catch (error) {
        console.warn('MCP insights failed, falling back:', error);
        this.mcpAvailable = false;
      }
    }

    // Fallback to direct API
    try {
      const insights = await this.geminiManager.generateInsights(salesData, expenseData);
      return {
        success: true,
        data: insights,
        source: 'direct'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'direct'
      };
    }
  }

  /**
   * Get sales forecast with intelligent routing
   */
  async getSalesForecast(
    historicalData: any[],
    period: string = '7_days'
  ): Promise<AIServiceResponse> {
    await this.checkMCPHealth();

    // Try MCP first
    if (this.mcpAvailable) {
      try {
        const mcpResponse = await mcpClient.getSalesForecast(historicalData, period);
        if (mcpResponse.success) {
          return {
            success: true,
            data: mcpResponse.result,
            source: 'mcp'
          };
        }
      } catch (error) {
        console.warn('MCP forecast failed, falling back:', error);
        this.mcpAvailable = false;
      }
    }

    // Fallback to basic forecasting logic
    try {
      // Simple forecasting logic as fallback
      const forecast = this.generateBasicForecast(historicalData, period);
      return {
        success: true,
        data: forecast,
        source: 'direct'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: 'direct'
      };
    }
  }

  /**
   * Basic forecast generation as fallback
   */
  private generateBasicForecast(data: any[], period: string): any {
    if (!data || data.length === 0) {
      return {
        forecast: [],
        trends: 'Insufficient data for forecasting',
        confidence: 0
      };
    }

    // Simple moving average forecast
    const recent = data.slice(-7); // Last 7 entries
    const average = recent.reduce((sum, item) => sum + (item.total || 0), 0) / recent.length;
    
    const periodDays = period === '7_days' ? 7 : period === '30_days' ? 30 : 7;
    const forecast = Array(periodDays).fill(null).map((_, i) => ({
      date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted_sales: Math.round(average * (0.9 + Math.random() * 0.2)),
      confidence: 0.6
    }));

    return {
      forecast,
      trends: recent.length > 1 ? 
        (recent[recent.length - 1].total > recent[0].total ? 'Increasing' : 'Decreasing') : 
        'Stable',
      confidence: 0.6,
      source: 'basic_algorithm'
    };
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    mcp: { available: boolean; url: string };
    direct: { available: boolean };
  }> {
    await this.checkMCPHealth();
    
    return {
      mcp: {
        available: this.mcpAvailable,
        url: mcpClient['baseUrl']
      },
      direct: {
        available: true // Direct API is always available if configured
      }
    };
  }

  /**
   * Force refresh MCP connection
   */
  async refreshMCPConnection(): Promise<boolean> {
    this.lastHealthCheck = 0;
    await this.checkMCPHealth();
    return this.mcpAvailable;
  }
}

// Create singleton instance
export const unifiedAI = new UnifiedAIService();

// Export for direct use
export default unifiedAI;