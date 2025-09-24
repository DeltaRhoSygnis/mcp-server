/**
 * TRUE MCP SDK Client Implementation
 * Uses the actual MCP protocol instead of HTTP REST APIs
 * This is what "using MCP SDK" really means
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, StdioClientTransportOptions } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/types.js';

export interface MCPSDKResponse {
  success: boolean;
  result?: any;
  error?: string;
  requestId?: string;
}

export interface ChickenNote {
  content: string;
  userRole: 'owner' | 'worker';
  branchId?: string;
  localUuid?: string;
}

export interface BusinessAdviceRequest {
  question: string;
  context?: any;
  userRole: 'owner' | 'worker';
}

/**
 * TRUE MCP SDK Client - Uses MCP Protocol, Not HTTP APIs
 */
export class MCPSDKClient {
  private client: Client;
  private transport: Transport;
  private isConnected = false;

  constructor(serverPath?: string) {
    // Configure transport to your MCP server
    const transportOptions: StdioClientTransportOptions = {
      command: 'node',
      args: [serverPath || './dist/index.js'], // Path to your compiled MCP server
      env: {
        ...process.env,
        // Pass required environment variables to server
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    };

    this.transport = new StdioClientTransport(transportOptions);

    // Create MCP client
    this.client = new Client(
      {
        name: 'charnoks-chicken-business-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          // Declare what capabilities we support
          experimental: {},
          sampling: {}
        }
      }
    );
  }

  /**
   * Connect to MCP server using SDK protocol
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      console.log('🔌 Connecting to MCP server via SDK...');
      
      await this.client.connect(this.transport);
      this.isConnected = true;
      
      console.log('✅ MCP SDK connection established');

      // Get server info
      const serverInfo = await this.client.getServerCapabilities();
      console.log('📋 Server capabilities:', serverInfo);

    } catch (error) {
      console.error('❌ MCP SDK connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.close();
      this.isConnected = false;
      console.log('📞 MCP SDK connection closed');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  /**
   * List available tools using MCP SDK
   */
  async getAvailableTools(): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.request(
        { method: 'tools/list' },
        {}
      );

      return {
        success: true,
        result: result.tools
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tools'
      };
    }
  }

  /**
   * Process chicken business note using TRUE MCP SDK
   */
  async processChickenNote(note: ChickenNote): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      console.log('🐔 Processing note via MCP SDK:', note.content.substring(0, 50) + '...');

      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'parse_chicken_note',
          arguments: {
            content: note.content,
            branch_id: note.branchId || 'main',
            author_id: 'user',
            local_uuid: note.localUuid || crypto.randomUUID?.() || Date.now().toString(),
            priority: 'medium'
          }
        }
      );

      console.log('✅ Note processed via MCP SDK');

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result,
        requestId: crypto.randomUUID?.() || Date.now().toString()
      };

    } catch (error) {
      console.error('❌ MCP SDK note processing failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Note processing failed'
      };
    }
  }

  /**
   * Get business advice using TRUE MCP SDK
   */
  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      console.log('💡 Getting business advice via MCP SDK');

      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'get_business_advice',
          arguments: {
            question: request.question,
            context: request.context,
            user_role: request.userRole
          }
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Business advice failed'
      };
    }
  }

  /**
   * Apply to stock using TRUE MCP SDK
   */
  async applyToStock(noteId: string, dryRun: boolean = false): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'apply_to_stock',
          arguments: {
            note_id: noteId,
            dry_run: dryRun
          }
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stock application failed'
      };
    }
  }

  /**
   * Search business context using TRUE MCP SDK
   */
  async searchBusinessContext(query: string, entityTypes?: string[]): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'search_business_context',
          arguments: {
            query,
            entityTypes: entityTypes || ['product', 'supplier', 'customer']
          }
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Context search failed'
      };
    }
  }

  /**
   * Get sales forecast using TRUE MCP SDK
   */
  async getForecast(salesHistory: any[]): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'forecast_stock',
          arguments: {
            salesHistory
          }
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Forecast failed'
      };
    }
  }

  /**
   * Chat with AI using TRUE MCP SDK
   */
  async chat(message: string, role: 'owner' | 'worker' | 'customer' = 'owner'): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: 'ai_chat',
          arguments: {
            message,
            role,
            history: [] // You can implement history management
          }
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chat failed'
      };
    }
  }

  /**
   * Generic tool call using TRUE MCP SDK
   */
  async callTool(toolName: string, args: any): Promise<MCPSDKResponse> {
    if (!this.isConnected) await this.connect();

    try {
      console.log(`🔧 Calling tool "${toolName}" via MCP SDK`);

      const result = await this.client.request(
        { method: 'tools/call' },
        {
          name: toolName,
          arguments: args
        }
      );

      return {
        success: true,
        result: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Tool ${toolName} failed`
      };
    }
  }

  /**
   * Check if connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get client info
   */
  getClientInfo() {
    return {
      name: 'charnoks-chicken-business-client',
      version: '1.0.0',
      connected: this.isConnected,
      transport: 'stdio'
    };
  }
}

/**
 * React hook for MCP SDK client
 */
export function useMCPSDKClient() {
  const client = new MCPSDKClient();
  
  React.useEffect(() => {
    client.connect().catch(console.error);
    
    return () => {
      client.disconnect();
    };
  }, []);

  return {
    client,
    processNote: (note: ChickenNote) => client.processChickenNote(note),
    getAdvice: (request: BusinessAdviceRequest) => client.getBusinessAdvice(request),
    searchContext: (query: string, types?: string[]) => client.searchBusinessContext(query, types),
    chat: (message: string, role?: 'owner' | 'worker') => client.chat(message, role),
    callTool: (toolName: string, args: any) => client.callTool(toolName, args),
    isConnected: client.isClientConnected()
  };
}

// Default SDK client instance
export const mcpSDKClient = new MCPSDKClient();

// Auto-connect when module loads
mcpSDKClient.connect().catch(console.error);

export default MCPSDKClient;