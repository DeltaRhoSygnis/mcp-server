/**
 * MCP Client - Frontend/Backend Integration
 * Communicates with your MCP server deployed on Render
 * Handles all AI processing, business intelligence, and real-time communication
 */

export interface MCPResponse {
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

export interface VoiceStreamParams {
  streamId: string;
  transcriptChunk: string;
  products?: Array<{id: string, name: string}>;
}

/**
 * Main MCP Client for communicating with your MCP server
 */
export class MCPClient {
  private baseUrl: string;
  private authToken: string;
  private wsUrl: string;

  constructor() {
    // Automatically detect environment
    this.baseUrl = this.getServerUrl();
    this.authToken = this.getAuthToken();
    this.wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  private getServerUrl(): string {
    // Check various environment variable patterns
    if (typeof window !== 'undefined') {
      // Browser environment
      return import.meta.env?.VITE_MCP_SERVER_URL || 
             process.env.VITE_MCP_SERVER_URL || 
             'http://localhost:3002';
    } else {
      // Node.js environment
      return process.env.MCP_SERVER_URL || 
             process.env.VITE_MCP_SERVER_URL || 
             'http://localhost:3002';
    }
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      // Browser - try localStorage first, then env vars
      const stored = localStorage.getItem('mcp_auth_token');
      if (stored) return stored;
      
      return import.meta.env?.VITE_MCP_AUTH_TOKEN || 
             process.env.VITE_MCP_AUTH_TOKEN || '';
    } else {
      // Node.js environment
      return process.env.MCP_AUTH_TOKEN || '';
    }
  }

  /**
   * Authenticate with MCP server and get JWT token
   */
  async authenticate(mcpAuthToken?: string): Promise<{success: boolean, token?: string, error?: string}> {
    try {
      const token = mcpAuthToken || this.authToken;
      if (!token) {
        throw new Error('No MCP auth token provided');
      }

      const response = await fetch(`${this.baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store JWT token for future requests
      if (typeof window !== 'undefined') {
        localStorage.setItem('mcp_jwt_token', data.token);
      }

      return { success: true, token: data.token };
    } catch (error) {
      console.error('MCP Authentication failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  }

  /**
   * Get JWT token for API calls
   */
  private getJWTToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcp_jwt_token') || '';
    }
    return ''; // In Node.js, handle JWT storage differently
  }

  /**
   * Make authenticated API call to MCP server
   */
  private async apiCall(endpoint: string, data?: any): Promise<MCPResponse> {
    try {
      const jwt = this.getJWTToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: data ? 'POST' : 'GET',
        headers,
        body: data ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to re-authenticate
          const authResult = await this.authenticate();
          if (authResult.success) {
            // Retry the original request
            return this.apiCall(endpoint, data);
          }
        }
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        result: result.content ? result.content[0]?.text : result,
        requestId: result.requestId
      };
    } catch (error) {
      console.error('MCP API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed'
      };
    }
  }

  /**
   * Process chicken business note with AI parsing
   */
  async processChickenNote(note: ChickenNote): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'parse_chicken_note',
      arguments: {
        content: note.content,
        branch_id: note.branchId || 'main',
        author_id: 'user', // You can make this dynamic
        local_uuid: note.localUuid || crypto.randomUUID?.() || Date.now().toString(),
        priority: 'medium'
      }
    });
  }

  /**
   * Get AI-powered business advice
   */
  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'get_business_advice',
      arguments: {
        question: request.question,
        context: request.context,
        user_role: request.userRole
      }
    });
  }

  /**
   * Apply parsed note to stock/inventory
   */
  async applyToStock(noteId: string, dryRun: boolean = false): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'apply_to_stock',
      arguments: {
        note_id: noteId,
        dry_run: dryRun
      }
    });
  }

  /**
   * Get sales forecast based on historical data
   */
  async getForecast(salesHistory: any[]): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'forecast_stock',
      arguments: {
        salesHistory
      }
    });
  }

  /**
   * Search business context and memory
   */
  async searchBusinessContext(query: string, entityTypes?: string[]): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'search_business_context',
      arguments: {
        query,
        entityTypes: entityTypes || ['product', 'supplier', 'customer']
      }
    });
  }

  /**
   * List available MCP tools
   */
  async getAvailableTools(): Promise<MCPResponse> {
    return this.apiCall('/api/tools');
  }

  /**
   * Get server health status
   */
  async getHealthStatus(): Promise<MCPResponse> {
    return this.apiCall('/health');
  }

  /**
   * Create WebSocket connection for real-time communication
   */
  createWebSocketConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const jwt = this.getJWTToken();
        const wsUrl = `${this.wsUrl}/ws/chat${jwt ? `?token=${jwt}` : ''}`;
        
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('MCP WebSocket connected');
          resolve(ws);
        };

        ws.onerror = (error) => {
          console.error('MCP WebSocket error:', error);
          reject(error);
        };

        ws.onclose = () => {
          console.log('MCP WebSocket disconnected');
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start live voice streaming session
   */
  async startVoiceStream(streamId: string): Promise<WebSocket> {
    const ws = await this.createWebSocketConnection();
    
    // Send initial stream setup
    ws.send(JSON.stringify({
      type: 'start_stream',
      streamId,
      timestamp: new Date().toISOString()
    }));

    return ws;
  }

  /**
   * Send voice transcript chunk for real-time processing
   */
  sendVoiceChunk(ws: WebSocket, params: VoiceStreamParams): void {
    ws.send(JSON.stringify({
      toolName: 'live_voice_stream',
      params: {
        streamId: params.streamId,
        transcriptChunk: params.transcriptChunk,
        products: params.products || []
      }
    }));
  }

  /**
   * Simple chat with AI assistant
   */
  async chat(message: string, role: 'owner' | 'worker' | 'customer' = 'owner'): Promise<MCPResponse> {
    return this.apiCall('/api/chat', {
      message,
      role,
      history: [] // You can implement history management
    });
  }
}

/**
 * Default MCP client instance
 * Use this throughout your app for MCP server communication
 */
export const mcpClient = new MCPClient();

/**
 * React hook for MCP client (if you're using React)
 */
export function useMCPClient() {
  return {
    client: mcpClient,
    processNote: (note: ChickenNote) => mcpClient.processChickenNote(note),
    getAdvice: (request: BusinessAdviceRequest) => mcpClient.getBusinessAdvice(request),
    searchContext: (query: string) => mcpClient.searchBusinessContext(query),
    chat: (message: string, role?: 'owner' | 'worker') => mcpClient.chat(message, role)
  };
}

export default MCPClient;