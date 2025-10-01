/**
 * 🔌 **ENHANCED MCP WEBSOCKET CLIENT**
 * Real-time communication with Charnoks MCP Server
 * 
 * Features:
 * - Real-time chat with AI
 * - Voice streaming and transcription
 * - Live notifications and updates  
 * - Connection pooling and reconnection
 * - Type-safe message handling
 * - Error recovery and retry logic
 */

import { EventEmitter } from 'eventemitter3';

export interface WSMessage {
  id: string;
  type: 'chat' | 'voice_chunk' | 'voice_result' | 'notification' | 'system' | 'error' | 'auth';
  data: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
    model?: string;
    confidence?: number;
  };
}

export interface VoiceChunk {
  streamId: string;
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  products?: string[];
  actionItems?: string[];
}

export interface VoiceResult {
  streamId: string;
  finalTranscript: string;
  parsedData?: {
    products: string[];
    quantities: number[];
    actions: string[];
    businessInsights: string[];
  };
  confidence: number;
  processingTime: number;
}

export interface MCPNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  actionRequired?: boolean;
  data?: any;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  reconnectAttempts: number;
  lastError?: string;
  connectionId?: string;
  serverInfo?: {
    version: string;
    supportedFeatures: string[];
  };
}

export class EnhancedMCPWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private authToken: string;
  private jwtToken: string | null = null;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WSMessage[] = [];
  private sessionId: string;
  private userId: string;

  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 1000; // Start with 1 second
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds

  constructor(options: {
    baseUrl?: string;
    authToken?: string;
    userId?: string;
    sessionId?: string;
  } = {}) {
    super();

    this.baseUrl = options.baseUrl || this.getServerUrl();
    this.authToken = options.authToken || this.getAuthToken();
    this.userId = options.userId || `user_${Date.now()}`;
    this.sessionId = options.sessionId || this.generateSessionId();

    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      reconnectAttempts: 0
    };

    // Get JWT token from storage or authentication
    this.jwtToken = this.getStoredJWTToken();
  }

  private getServerUrl(): string {
    if (typeof window !== 'undefined') {
      const url = import.meta.env?.VITE_MCP_WS_URL || 
                  process.env.VITE_MCP_WS_URL || 
                  'ws://localhost:3002';
      return url.replace('https://', 'wss://').replace('http://', 'ws://');
    } else {
      const url = process.env.MCP_WS_URL || 'ws://localhost:3002';
      return url.replace('https://', 'wss://').replace('http://', 'ws://');
    }
  }

  private getAuthToken(): string {
    if (typeof window !== 'undefined') {
      return import.meta.env?.VITE_MCP_AUTH_TOKEN || 
             process.env.VITE_MCP_AUTH_TOKEN || 
             localStorage.getItem('mcp_auth_token') || 
             'default_auth_token';
    } else {
      return process.env.MCP_AUTH_TOKEN || 'default_auth_token';
    }
  }

  private getStoredJWTToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcp_jwt_token');
    }
    return null;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect to MCP WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connectionState.isConnected || this.connectionState.isConnecting) {
      console.log('🔄 Already connected or connecting to MCP WebSocket');
      return;
    }

    this.connectionState.isConnecting = true;
    this.emit('connecting');

    try {
      const wsUrl = `${this.baseUrl}/ws/chat?userId=${this.userId}&sessionId=${this.sessionId}`;
      
      console.log('🔌 Connecting to MCP WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ MCP WebSocket connected');
        
        this.connectionState = {
          isConnected: true,
          isConnecting: false,
          isAuthenticated: false,
          reconnectAttempts: 0,
          connectionId: this.generateMessageId()
        };

        this.emit('connected');
        this.authenticate();
        this.startHeartbeat();
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        console.log('🔌 MCP WebSocket disconnected:', event.code, event.reason);
        
        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = false;
        this.connectionState.isAuthenticated = false;

        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && this.connectionState.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ MCP WebSocket error:', error);
        this.connectionState.lastError = 'WebSocket connection error';
        this.emit('error', error);
      };

    } catch (error) {
      console.error('❌ Failed to create MCP WebSocket connection:', error);
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = error instanceof Error ? error.message : 'Connection failed';
      this.emit('error', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client initiated disconnect');
      this.ws = null;
    }

    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      reconnectAttempts: 0
    };

    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Authenticate with the server
   */
  private authenticate(): void {
    if (!this.jwtToken && !this.authToken) {
      console.warn('⚠️ No authentication token available');
      return;
    }

    const authMessage: WSMessage = {
      id: this.generateMessageId(),
      type: 'auth',
      data: {
        token: this.jwtToken || this.authToken,
        userId: this.userId,
        sessionId: this.sessionId,
        clientType: 'frontend_websocket'
      },
      timestamp: Date.now()
    };

    this.sendMessage(authMessage);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      console.log('📥 Received MCP message:', message.type, message.id);

      switch (message.type) {
        case 'auth':
          this.handleAuthMessage(message);
          break;

        case 'chat':
          this.handleChatMessage(message);
          break;

        case 'voice_result':
          this.handleVoiceResult(message);
          break;

        case 'notification':
          this.handleNotification(message);
          break;

        case 'system':
          this.handleSystemMessage(message);
          break;

        case 'error':
          this.handleErrorMessage(message);
          break;

        default:
          console.log('🔍 Unknown message type:', message.type);
          this.emit('message', message);
      }

    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error);
      this.emit('error', new Error('Invalid message format'));
    }
  }

  private handleAuthMessage(message: WSMessage): void {
    if (message.data.success) {
      this.connectionState.isAuthenticated = true;
      this.jwtToken = message.data.token;
      
      if (typeof window !== 'undefined' && message.data.token) {
        localStorage.setItem('mcp_jwt_token', message.data.token);
      }

      console.log('✅ MCP WebSocket authenticated');
      this.emit('authenticated', message.data);
    } else {
      console.error('❌ MCP WebSocket authentication failed:', message.data.error);
      this.emit('authenticationFailed', message.data);
    }
  }

  private handleChatMessage(message: WSMessage): void {
    const chatMessage: ChatMessage = {
      id: message.id,
      content: message.data.content || message.data.message,
      role: message.data.role || 'assistant',
      timestamp: new Date(message.timestamp),
      metadata: message.data.metadata
    };

    this.emit('chatMessage', chatMessage);
  }

  private handleVoiceResult(message: WSMessage): void {
    const voiceResult: VoiceResult = {
      streamId: message.data.streamId,
      finalTranscript: message.data.finalTranscript,
      parsedData: message.data.parsedData,
      confidence: message.data.confidence || 0,
      processingTime: message.data.processingTime || 0
    };

    this.emit('voiceResult', voiceResult);
  }

  private handleNotification(message: WSMessage): void {
    const notification: MCPNotification = {
      id: message.id,
      type: message.data.type || 'info',
      title: message.data.title,
      message: message.data.message,
      timestamp: new Date(message.timestamp),
      actionRequired: message.data.actionRequired,
      data: message.data.data
    };

    this.emit('notification', notification);
  }

  private handleSystemMessage(message: WSMessage): void {
    if (message.data.type === 'server_info') {
      this.connectionState.serverInfo = message.data.info;
    }
    
    this.emit('systemMessage', message);
  }

  private handleErrorMessage(message: WSMessage): void {
    console.error('❌ Server error:', message.data);
    this.emit('serverError', message.data);
  }

  /**
   * Send message to server
   */
  private sendMessage(message: WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('📤 Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      this.ws.send(messageString);
      console.log('📤 Sent MCP message:', message.type, message.id);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      this.messageQueue.push(message); // Queue for retry
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  // === PUBLIC API METHODS ===

  /**
   * Send chat message to AI
   */
  sendChatMessage(content: string, role: 'owner' | 'worker' | 'customer' = 'owner'): void {
    const message: WSMessage = {
      id: this.generateMessageId(),
      type: 'chat',
      data: {
        content,
        role,
        userId: this.userId,
        sessionId: this.sessionId
      },
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.sendMessage(message);
  }

  /**
   * Start voice streaming session
   */
  startVoiceStream(streamId: string): void {
    const message: WSMessage = {
      id: this.generateMessageId(),
      type: 'voice_start',
      data: {
        streamId,
        userId: this.userId,
        sessionId: this.sessionId
      },
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.sendMessage(message);
  }

  /**
   * Send voice transcript chunk
   */
  sendVoiceChunk(chunk: VoiceChunk): void {
    const message: WSMessage = {
      id: this.generateMessageId(),
      type: 'voice_chunk',
      data: chunk,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.sendMessage(message);
  }

  /**
   * End voice streaming session
   */
  endVoiceStream(streamId: string): void {
    const message: WSMessage = {
      id: this.generateMessageId(),
      type: 'voice_end',
      data: {
        streamId,
        userId: this.userId,
        sessionId: this.sessionId
      },
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.sendMessage(message);
  }

  /**
   * Send custom message
   */
  sendCustomMessage(type: string, data: any): void {
    const message: WSMessage = {
      id: this.generateMessageId(),
      type: type as any,
      data,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };

    this.sendMessage(message);
  }

  // === CONNECTION MANAGEMENT ===

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      this.RECONNECT_DELAY * Math.pow(2, this.connectionState.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.connectionState.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.connectionState.reconnectAttempts++;
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat: WSMessage = {
          id: this.generateMessageId(),
          type: 'system',
          data: { type: 'heartbeat' },
          timestamp: Date.now()
        };
        this.sendMessage(heartbeat);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // === GETTERS ===

  get isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  get isAuthenticated(): boolean {
    return this.connectionState.isAuthenticated;
  }

  get state(): ConnectionState {
    return { ...this.connectionState };
  }

  get queuedMessages(): number {
    return this.messageQueue.length;
  }
}

// === REACT HOOK FOR WEBSOCKET ===

export function useMCPWebSocket(options?: {
  autoConnect?: boolean;
  userId?: string;
  sessionId?: string;
}) {
  const [wsClient] = useState(() => new EnhancedMCPWebSocket({
    userId: options?.userId,
    sessionId: options?.sessionId
  }));

  const [connectionState, setConnectionState] = useState<ConnectionState>(wsClient.state);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<MCPNotification[]>([]);

  useEffect(() => {
    // Connection state updates
    const updateConnectionState = () => setConnectionState(wsClient.state);
    wsClient.on('connecting', updateConnectionState);
    wsClient.on('connected', updateConnectionState);
    wsClient.on('disconnected', updateConnectionState);
    wsClient.on('authenticated', updateConnectionState);

    // Message handling
    wsClient.on('chatMessage', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    wsClient.on('notification', (notification: MCPNotification) => {
      setNotifications(prev => [...prev, notification]);
    });

    // Auto-connect if enabled
    if (options?.autoConnect !== false) {
      wsClient.connect();
    }

    // Cleanup
    return () => {
      wsClient.removeAllListeners();
      wsClient.disconnect();
    };
  }, [wsClient, options?.autoConnect]);

  const sendMessage = useCallback((content: string, role?: 'owner' | 'worker' | 'customer') => {
    // Add user message to local state immediately
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      content,
      role: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to server
    wsClient.sendChatMessage(content, role);
  }, [wsClient]);

  const startVoiceStream = useCallback((streamId: string) => {
    wsClient.startVoiceStream(streamId);
  }, [wsClient]);

  const sendVoiceChunk = useCallback((chunk: VoiceChunk) => {
    wsClient.sendVoiceChunk(chunk);
  }, [wsClient]);

  const endVoiceStream = useCallback((streamId: string) => {
    wsClient.endVoiceStream(streamId);
  }, [wsClient]);

  const connect = useCallback(() => {
    wsClient.connect();
  }, [wsClient]);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, [wsClient]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    // State
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    isAuthenticated: connectionState.isAuthenticated,
    connectionState,
    messages,
    notifications,
    queuedMessages: wsClient.queuedMessages,

    // Actions
    connect,
    disconnect,
    sendMessage,
    startVoiceStream,
    sendVoiceChunk,
    endVoiceStream,
    clearMessages,
    clearNotifications,

    // Direct client access
    client: wsClient
  };
}

// Create default instance
export const mcpWebSocket = new EnhancedMCPWebSocket();

// Auto-connect on module load in browser
if (typeof window !== 'undefined') {
  mcpWebSocket.connect().catch(console.error);
}

export default EnhancedMCPWebSocket;