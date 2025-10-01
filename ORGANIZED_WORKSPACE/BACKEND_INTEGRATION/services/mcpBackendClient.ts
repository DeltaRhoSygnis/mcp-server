/**
 * 🖥️ **MCP BACKEND CLIENT**
 * Server-to-server communication with MCP server for backend applications
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import jwt from 'jsonwebtoken';

export interface MCPBackendResponse<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  metadata?: {
    processingTime?: number;
    model?: string;
    confidence?: number;
    tokensUsed?: number;
  };
}

export interface ChickenNote {
  id?: string;
  local_uuid?: string;
  branch_id: string;
  author_id: string;
  content: string;
  user_role?: 'owner' | 'worker' | 'customer';
  status?: 'pending' | 'parsed' | 'confirmed' | 'synced';
  created_at?: string;
}

export interface BusinessAdviceRequest {
  type: 'inventory' | 'sales' | 'financial' | 'operational' | 'forecast';
  context: string;
  urgency: 'low' | 'medium' | 'high';
  role: 'owner' | 'worker' | 'customer';
  branch_id?: string;
  timeframe?: string;
  specific_questions?: string[];
}

export class MCPBackendClient {
  private client: AxiosInstance;
  private authToken: string;
  private jwtToken: string | null = null;
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.baseURL = process.env.MCP_SERVER_URL || 'http://localhost:3002';
    this.authToken = process.env.MCP_AUTH_TOKEN || 'default_auth_token';
    this.timeout = parseInt(process.env.MCP_TIMEOUT_MS || '30000');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CharnoksBackend/1.0.0',
        'X-Client-Type': 'backend'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.jwtToken) {
          config.headers.Authorization = `Bearer ${this.jwtToken}`;
        } else if (this.authToken) {
          config.headers['X-Auth-Token'] = this.authToken;
        }

        // Add request timestamp for latency tracking
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and retry
    this.client.interceptors.response.use(
      (response) => {
        // Calculate response time
        const responseTime = Date.now() - response.config.metadata?.startTime;
        if (response.data && typeof response.data === 'object') {
          response.data.metadata = {
            ...response.data.metadata,
            processingTime: responseTime
          };
        }
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as any;

        // Handle authentication errors
        if (error.response?.status === 401 && this.jwtToken) {
          console.log('🔄 JWT token expired, attempting re-authentication...');
          try {
            await this.authenticate();
            // Retry the original request
            return this.client.request(config);
          } catch (authError) {
            console.error('❌ Re-authentication failed:', authError);
          }
        }

        // Handle retry logic for network errors
        if (this.shouldRetry(error) && (!config._retryCount || config._retryCount < this.retryAttempts)) {
          config._retryCount = (config._retryCount || 0) + 1;
          
          console.log(`🔄 Retrying MCP request (attempt ${config._retryCount}/${this.retryAttempts})`);
          
          await this.delay(this.retryDelay * config._retryCount);
          return this.client.request(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      (error.response.status >= 500 && error.response.status < 600)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Authenticate with MCP server
   */
  async authenticate(): Promise<void> {
    try {
      console.log('🔐 Authenticating with MCP server...');
      
      const response = await this.client.post('/auth/login', {
        authToken: this.authToken,
        clientType: 'backend',
        serviceName: 'charnoks-backend',
        version: process.env.npm_package_version || '1.0.0'
      });

      this.jwtToken = response.data.token;
      console.log('✅ MCP Backend authentication successful');
      
    } catch (error) {
      console.error('❌ MCP Backend authentication failed:', error);
      throw new Error(`MCP authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a single chicken note
   */
  async processChickenNote(note: ChickenNote): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.post('/api/tools/call', {
        name: 'parse_chicken_note',
        arguments: {
          note_content: note.content,
          branch_id: note.branch_id,
          author_id: note.author_id,
          user_role: note.user_role || 'owner',
          note_id: note.id,
          local_uuid: note.local_uuid
        }
      });

      return {
        success: true,
        result: response.data.result || response.data.content?.[0]?.text,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('❌ Failed to process chicken note:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Batch process multiple chicken notes
   */
  async batchProcessNotes(notes: ChickenNote[]): Promise<MCPBackendResponse[]> {
    const batchSize = parseInt(process.env.MCP_BATCH_SIZE || '10');
    const results: MCPBackendResponse[] = [];

    console.log(`📦 Batch processing ${notes.length} notes (batch size: ${batchSize})`);

    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notes.length / batchSize)}`);

      const batchPromises = batch.map(async (note, index) => {
        try {
          const result = await this.processChickenNote(note);
          return { ...result, noteIndex: i + index };
        } catch (error) {
          return {
            success: false,
            error: this.extractErrorMessage(error),
            noteIndex: i + index,
            noteId: note.id
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (i + batchSize < notes.length) {
        await this.delay(1000);
      }
    }

    console.log(`✅ Batch processing complete: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  }

  /**
   * Get business advice from AI
   */
  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.post('/api/tools/call', {
        name: 'get_business_advice',
        arguments: {
          ...request,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        result: response.data.result || response.data.content?.[0]?.text,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('❌ Failed to get business advice:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Search business context and memory
   */
  async searchBusinessContext(query: string, entityTypes?: string[], limit?: number): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.post('/api/tools/call', {
        name: 'search_business_context',
        arguments: {
          query,
          entityTypes: entityTypes || ['product', 'supplier', 'customer'],
          limit: limit || 10
        }
      });

      return {
        success: true,
        result: response.data.result || response.data.content?.[0]?.text,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('❌ Failed to search business context:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Generic tool calling
   */
  async callTool(toolName: string, args: any): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.post('/api/tools/call', {
        name: toolName,
        arguments: {
          ...args,
          timestamp: new Date().toISOString(),
          clientType: 'backend'
        }
      });

      return {
        success: true,
        result: response.data.result || response.data.content?.[0]?.text,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error(`❌ Failed to call tool ${toolName}:`, error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Get available tools from MCP server
   */
  async getAvailableTools(): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.get('/api/tools');

      return {
        success: true,
        result: response.data.tools || response.data.result,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('❌ Failed to get available tools:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000 // Shorter timeout for health checks
      });

      return response.status === 200 && (
        response.data.status === 'healthy' ||
        response.data.status === 'ok'
      );

    } catch (error) {
      console.warn('⚠️ MCP server health check failed:', this.extractErrorMessage(error));
      return false;
    }
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.get('/info');

      return {
        success: true,
        result: response.data,
        metadata: { processingTime: 0 }
      };

    } catch (error) {
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Chat with AI (for backend-initiated conversations)
   */
  async chat(message: string, context?: any): Promise<MCPBackendResponse> {
    try {
      const response = await this.client.post('/api/chat', {
        message,
        context,
        userId: 'backend_system',
        sessionId: `backend_${Date.now()}`
      });

      return {
        success: true,
        result: response.data.result || response.data.message,
        metadata: response.data.metadata
      };

    } catch (error) {
      console.error('❌ Backend chat failed:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: any): string {
    if (error instanceof AxiosError) {
      if (error.response?.data?.error) {
        return error.response.data.error;
      }
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      if (error.message) {
        return error.message;
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      baseURL: this.baseURL,
      isAuthenticated: !!this.jwtToken,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
  }) {
    if (config.timeout) {
      this.timeout = config.timeout;
      this.client.defaults.timeout = config.timeout;
    }
    if (config.retryAttempts) {
      this.retryAttempts = config.retryAttempts;
    }
    if (config.retryDelay) {
      this.retryDelay = config.retryDelay;
    }
  }
}

// Create and export default instance
export const mcpBackendClient = new MCPBackendClient();

// Auto-authenticate on module load
if (process.env.NODE_ENV !== 'test') {
  mcpBackendClient.authenticate().catch((error) => {
    console.error('❌ Initial MCP authentication failed:', error.message);
    console.log('⚠️ MCP client will retry authentication on first request');
  });
}

export default MCPBackendClient;