/**
 * PRODUCTION Connection Pooling System for Charnoks Chicken Business
 * Production-ready WebSocket management specifically designed for chicken business operations
 * Optimizes: Voice Streaming, Real-time Chat, Live Inventory Updates, Business Alerts
 */

import { MCPClient } from './mcpClient';

export interface ChickenBusinessConnection {
  id: string;
  ws: WebSocket;
  type: 'voice_stream' | 'chat' | 'inventory_updates' | 'business_alerts' | 'general';
  userRole: 'owner' | 'worker' | 'customer';
  branchId: string;
  status: 'connecting' | 'connected' | 'idle' | 'active' | 'error' | 'disconnected';
  lastActivity: number;
  messageCount: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  sessionData: {
    streamId?: string;
    chatHistory?: any[];
    voiceChunks?: any[];
    subscriptions?: string[];
  };
  metrics: {
    bytesSent: number;
    bytesReceived: number;
    messagesHandled: number;
    errorsEncountered: number;
    averageLatency: number;
  };
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  errorConnections: number;
  messagesThroughput: number;
  averageLatency: number;
  connectionUtilization: number;
  costSavings: number;
  lastCleanup: Date;
}

/**
 * Production Connection Pool for Charnoks Chicken Business
 */
export class ChickenBusinessConnectionPool {
  private connections: Map<string, ChickenBusinessConnection> = new Map();
  private connectionQueues: Map<string, ChickenBusinessConnection[]> = new Map();
  private mcpClient: MCPClient;
  private maxConnectionsPerType = 10;
  private idleTimeout = 5 * 60 * 1000; // 5 minutes
  private reconnectDelays = [1000, 2000, 5000, 10000, 30000]; // Progressive delays
  private healthCheckInterval = 30000; // 30 seconds
  private cleanupInterval = 60000; // 1 minute
  private metrics: ConnectionPoolMetrics;

  // Connection configurations for different business operations
  private connectionConfigs = {
    'voice_stream': {
      maxConnections: 3, // Limit voice streams for quality
      priority: 'high',
      idleTimeout: 2 * 60 * 1000, // 2 minutes for voice
      maxReconnectAttempts: 5,
      bufferSize: 8192,
      heartbeatInterval: 10000
    },
    'chat': {
      maxConnections: 8, // More chat connections for customer service
      priority: 'medium',
      idleTimeout: 10 * 60 * 1000, // 10 minutes for chat
      maxReconnectAttempts: 3,
      bufferSize: 4096,
      heartbeatInterval: 30000
    },
    'inventory_updates': {
      maxConnections: 5, // Real-time inventory is critical
      priority: 'critical',
      idleTimeout: 1 * 60 * 1000, // 1 minute for inventory
      maxReconnectAttempts: 10,
      bufferSize: 2048,
      heartbeatInterval: 5000
    },
    'business_alerts': {
      maxConnections: 3, // Critical business notifications
      priority: 'critical',
      idleTimeout: 30 * 60 * 1000, // 30 minutes for alerts
      maxReconnectAttempts: 7,
      bufferSize: 1024,
      heartbeatInterval: 15000
    },
    'general': {
      maxConnections: 10, // General purpose connections
      priority: 'low',
      idleTimeout: 5 * 60 * 1000, // 5 minutes for general
      maxReconnectAttempts: 2,
      bufferSize: 2048,
      heartbeatInterval: 60000
    }
  };

  constructor() {
    this.mcpClient = new MCPClient();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      errorConnections: 0,
      messagesThroughput: 0,
      averageLatency: 0,
      connectionUtilization: 0,
      costSavings: 0,
      lastCleanup: new Date()
    };

    this.setupPeriodicTasks();
    this.setupConnectionQueues();
  }

  /**
   * Get or create connection for chicken business operation
   */
  async getConnection(
    type: ChickenBusinessConnection['type'],
    options: {
      userRole: 'owner' | 'worker' | 'customer';
      branchId?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      sessionData?: any;
    }
  ): Promise<ChickenBusinessConnection> {
    console.log(`🔌 Getting connection for: ${type} (${options.userRole})`);

    // Try to find an idle connection of the same type and context
    const idleConnection = this.findIdleConnection(type, options);
    if (idleConnection) {
      console.log(`♻️ Reusing idle connection: ${idleConnection.id}`);
      idleConnection.status = 'active';
      idleConnection.lastActivity = Date.now();
      this.updateMetrics();
      return idleConnection;
    }

    // Check connection limits
    const config = this.connectionConfigs[type];
    const typeConnections = Array.from(this.connections.values()).filter(conn => conn.type === type);
    
    if (typeConnections.length >= config.maxConnections) {
      console.log(`⏳ Connection limit reached, waiting for available connection: ${type}`);
      return this.waitForAvailableConnection(type, options);
    }

    // Create new connection
    return this.createNewConnection(type, options);
  }

  /**
   * Start voice streaming session
   */
  async startVoiceStream(
    userRole: 'owner' | 'worker',
    streamId: string,
    branchId?: string
  ): Promise<ChickenBusinessConnection> {
    console.log(`🎤 Starting voice stream: ${streamId} (${userRole})`);

    const connection = await this.getConnection('voice_stream', {
      userRole,
      branchId,
      priority: 'high',
      sessionData: { streamId, voiceChunks: [] }
    });

    // Setup voice-specific message handlers
    this.setupVoiceStreamHandlers(connection, streamId);
    
    // Send initial stream setup
    this.sendMessage(connection, {
      type: 'start_voice_stream',
      streamId,
      userRole,
      branchId: branchId || 'main',
      timestamp: new Date().toISOString()
    });

    return connection;
  }

  /**
   * Start chat session
   */
  async startChatSession(
    userRole: 'owner' | 'worker' | 'customer',
    branchId?: string
  ): Promise<ChickenBusinessConnection> {
    console.log(`💬 Starting chat session (${userRole})`);

    const connection = await this.getConnection('chat', {
      userRole,
      branchId,
      priority: 'medium',
      sessionData: { chatHistory: [] }
    });

    // Setup chat-specific message handlers
    this.setupChatHandlers(connection);

    return connection;
  }

  /**
   * Subscribe to inventory updates
   */
  async subscribeToInventoryUpdates(
    userRole: 'owner' | 'worker',
    branchId?: string,
    productCategories?: string[]
  ): Promise<ChickenBusinessConnection> {
    console.log(`📦 Subscribing to inventory updates (${userRole})`);

    const connection = await this.getConnection('inventory_updates', {
      userRole,
      branchId,
      priority: 'critical',
      sessionData: { subscriptions: productCategories || ['all'] }
    });

    // Setup inventory-specific message handlers
    this.setupInventoryHandlers(connection);
    
    // Send subscription message
    this.sendMessage(connection, {
      type: 'subscribe_inventory',
      userRole,
      branchId: branchId || 'main',
      categories: productCategories || ['all']
    });

    return connection;
  }

  /**
   * Subscribe to business alerts
   */
  async subscribeToBusinessAlerts(
    userRole: 'owner' | 'worker',
    branchId?: string,
    alertTypes?: string[]
  ): Promise<ChickenBusinessConnection> {
    console.log(`🚨 Subscribing to business alerts (${userRole})`);

    const connection = await this.getConnection('business_alerts', {
      userRole,
      branchId,
      priority: 'critical',
      sessionData: { subscriptions: alertTypes || ['all'] }
    });

    // Setup alert-specific message handlers
    this.setupAlertHandlers(connection);
    
    // Send subscription message
    this.sendMessage(connection, {
      type: 'subscribe_alerts',
      userRole,
      branchId: branchId || 'main',
      alertTypes: alertTypes || ['stock_low', 'sales_milestone', 'system_error']
    });

    return connection;
  }

  /**
   * Send message through connection
   */
  sendMessage(connection: ChickenBusinessConnection, message: any): boolean {
    if (connection.status !== 'connected' && connection.status !== 'active') {
      console.warn(`⚠️ Cannot send message, connection not ready: ${connection.id}`);
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      connection.ws.send(messageStr);
      
      // Update metrics
      connection.metrics.bytesSent += messageStr.length;
      connection.metrics.messagesHandled++;
      connection.messageCount++;
      connection.lastActivity = Date.now();
      
      console.log(`📤 Message sent via ${connection.id}: ${message.type || 'data'}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message via ${connection.id}:`, error);
      this.handleConnectionError(connection, error as Error);
      return false;
    }
  }

  /**
   * Send voice chunk for real-time processing
   */
  sendVoiceChunk(connection: ChickenBusinessConnection, transcriptChunk: string, products?: any[]): boolean {
    if (connection.type !== 'voice_stream') {
      console.error(`❌ Cannot send voice chunk, wrong connection type: ${connection.type}`);
      return false;
    }

    const voiceMessage = {
      toolName: 'live_voice_stream',
      params: {
        streamId: connection.sessionData.streamId,
        transcriptChunk,
        products: products || []
      },
      timestamp: Date.now()
    };

    // Store voice chunk in session
    if (!connection.sessionData.voiceChunks) {
      connection.sessionData.voiceChunks = [];
    }
    connection.sessionData.voiceChunks.push({
      chunk: transcriptChunk,
      timestamp: Date.now()
    });

    return this.sendMessage(connection, voiceMessage);
  }

  /**
   * Send chat message
   */
  sendChatMessage(connection: ChickenBusinessConnection, message: string, role?: string): boolean {
    if (connection.type !== 'chat') {
      console.error(`❌ Cannot send chat message, wrong connection type: ${connection.type}`);
      return false;
    }

    const chatMessage = {
      type: 'chat_message',
      message,
      role: role || connection.userRole,
      branchId: connection.branchId,
      timestamp: Date.now()
    };

    // Store chat message in session
    if (!connection.sessionData.chatHistory) {
      connection.sessionData.chatHistory = [];
    }
    connection.sessionData.chatHistory.push(chatMessage);

    return this.sendMessage(connection, chatMessage);
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`⚠️ Cannot release unknown connection: ${connectionId}`);
      return;
    }

    console.log(`🔓 Releasing connection: ${connectionId} (${connection.type})`);
    
    connection.status = 'idle';
    connection.lastActivity = Date.now();
    
    // Clean up session data if needed
    this.cleanupSessionData(connection);
    
    // Check if anyone is waiting for this type of connection
    this.processConnectionQueue(connection.type);
    
    this.updateMetrics();
  }

  /**
   * Close connection permanently
   */
  closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`⚠️ Cannot close unknown connection: ${connectionId}`);
      return;
    }

    console.log(`🔌 Closing connection: ${connectionId} (${connection.type})`);
    
    try {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Connection closed by client');
      }
    } catch (error) {
      console.error(`Error closing WebSocket:`, error);
    }

    connection.status = 'disconnected';
    this.connections.delete(connectionId);
    this.updateMetrics();
  }

  /**
   * Create new connection
   */
  private async createNewConnection(
    type: ChickenBusinessConnection['type'],
    options: {
      userRole: 'owner' | 'worker' | 'customer';
      branchId?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      sessionData?: any;
    }
  ): Promise<ChickenBusinessConnection> {
    const connectionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const config = this.connectionConfigs[type];
    
    console.log(`🆕 Creating new connection: ${connectionId} (${type})`);

    const connection: ChickenBusinessConnection = {
      id: connectionId,
      ws: await this.createWebSocket(),
      type,
      userRole: options.userRole,
      branchId: options.branchId || 'main',
      status: 'connecting',
      lastActivity: Date.now(),
      messageCount: 0,
      reconnectAttempts: 0,
      maxReconnectAttempts: config.maxReconnectAttempts,
      priority: options.priority || config.priority,
      sessionData: options.sessionData || {},
      metrics: {
        bytesSent: 0,
        bytesReceived: 0,
        messagesHandled: 0,
        errorsEncountered: 0,
        averageLatency: 0
      }
    };

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers(connection);
    
    this.connections.set(connectionId, connection);
    this.metrics.totalConnections++;
    
    return connection;
  }

  /**
   * Create WebSocket connection
   */
  private async createWebSocket(): Promise<WebSocket> {
    return this.mcpClient.createWebSocketConnection();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(connection: ChickenBusinessConnection): void {
    const ws = connection.ws;

    ws.onopen = () => {
      console.log(`✅ Connection established: ${connection.id}`);
      connection.status = 'connected';
      this.updateMetrics();
    };

    ws.onmessage = (event) => {
      this.handleMessage(connection, event);
    };

    ws.onerror = (error) => {
      console.error(`❌ Connection error: ${connection.id}`, error);
      this.handleConnectionError(connection, new Error('WebSocket error'));
    };

    ws.onclose = (event) => {
      console.log(`🔌 Connection closed: ${connection.id} (Code: ${event.code})`);
      this.handleConnectionClose(connection, event);
    };
  }

  /**
   * Setup voice stream handlers
   */
  private setupVoiceStreamHandlers(connection: ChickenBusinessConnection, streamId: string): void {
    // Voice-specific message handling will be added to the general message handler
    console.log(`🎤 Voice stream handlers setup for: ${streamId}`);
  }

  /**
   * Setup chat handlers
   */
  private setupChatHandlers(connection: ChickenBusinessConnection): void {
    // Chat-specific message handling
    console.log(`💬 Chat handlers setup for: ${connection.id}`);
  }

  /**
   * Setup inventory handlers
   */
  private setupInventoryHandlers(connection: ChickenBusinessConnection): void {
    // Inventory-specific message handling
    console.log(`📦 Inventory handlers setup for: ${connection.id}`);
  }

  /**
   * Setup alert handlers
   */
  private setupAlertHandlers(connection: ChickenBusinessConnection): void {
    // Alert-specific message handling
    console.log(`🚨 Alert handlers setup for: ${connection.id}`);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(connection: ChickenBusinessConnection, event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      // Update metrics
      connection.metrics.bytesReceived += event.data.length;
      connection.metrics.messagesHandled++;
      connection.lastActivity = Date.now();

      console.log(`📥 Message received via ${connection.id}: ${message.type || 'data'}`);

      // Handle based on connection type
      switch (connection.type) {
        case 'voice_stream':
          this.handleVoiceMessage(connection, message);
          break;
        case 'chat':
          this.handleChatMessage(connection, message);
          break;
        case 'inventory_updates':
          this.handleInventoryMessage(connection, message);
          break;
        case 'business_alerts':
          this.handleAlertMessage(connection, message);
          break;
        default:
          this.handleGeneralMessage(connection, message);
      }

    } catch (error) {
      console.error(`❌ Failed to parse message from ${connection.id}:`, error);
      connection.metrics.errorsEncountered++;
    }
  }

  /**
   * Handle voice stream messages
   */
  private handleVoiceMessage(connection: ChickenBusinessConnection, message: any): void {
    if (message.partialParse) {
      console.log(`🎤 Partial voice parse: ${message.partialParse.items?.length || 0} items`);
      // Emit to UI for real-time feedback
      this.emitToUI('voicePartialParse', {
        streamId: connection.sessionData.streamId,
        data: message.partialParse,
        confidence: message.confidence
      });
    }

    if (message.final) {
      console.log(`✅ Final voice parse complete for stream: ${connection.sessionData.streamId}`);
      // Emit final result to UI
      this.emitToUI('voiceFinalParse', {
        streamId: connection.sessionData.streamId,
        data: message.final
      });
    }
  }

  /**
   * Handle chat messages
   */
  private handleChatMessage(connection: ChickenBusinessConnection, message: any): void {
    console.log(`💬 Chat message: ${message.content?.substring(0, 50)}...`);
    
    // Store in chat history
    if (!connection.sessionData.chatHistory) {
      connection.sessionData.chatHistory = [];
    }
    connection.sessionData.chatHistory.push(message);
    
    // Emit to UI
    this.emitToUI('chatMessage', {
      connectionId: connection.id,
      message
    });
  }

  /**
   * Handle inventory messages
   */
  private handleInventoryMessage(connection: ChickenBusinessConnection, message: any): void {
    console.log(`📦 Inventory update: ${message.type}`);
    
    // Emit inventory update to UI
    this.emitToUI('inventoryUpdate', {
      branchId: connection.branchId,
      update: message
    });
  }

  /**
   * Handle alert messages
   */
  private handleAlertMessage(connection: ChickenBusinessConnection, message: any): void {
    console.log(`🚨 Business alert: ${message.alertType}`);
    
    // Emit alert to UI
    this.emitToUI('businessAlert', {
      branchId: connection.branchId,
      alert: message,
      priority: message.priority || 'medium'
    });
  }

  /**
   * Handle general messages
   */
  private handleGeneralMessage(connection: ChickenBusinessConnection, message: any): void {
    console.log(`📨 General message via ${connection.id}`);
    
    // Emit to UI
    this.emitToUI('generalMessage', {
      connectionId: connection.id,
      message
    });
  }

  /**
   * Emit events to UI (implement based on your UI framework)
   */
  private emitToUI(event: string, data: any): void {
    // This would integrate with your UI framework (React, Vue, etc.)
    if (typeof window !== 'undefined' && (window as any).chickenBusinessEvents) {
      (window as any).chickenBusinessEvents.emit(event, data);
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(connection: ChickenBusinessConnection, error: Error): void {
    console.error(`❌ Connection error: ${connection.id}`, error);
    
    connection.status = 'error';
    connection.metrics.errorsEncountered++;
    
    // Attempt reconnection if within limits
    if (connection.reconnectAttempts < connection.maxReconnectAttempts) {
      this.attemptReconnection(connection);
    } else {
      console.error(`💀 Max reconnection attempts reached for: ${connection.id}`);
      this.closeConnection(connection.id);
    }
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(connection: ChickenBusinessConnection, event: CloseEvent): void {
    connection.status = 'disconnected';
    
    // Attempt reconnection for critical connections
    if (connection.priority === 'critical' && event.code !== 1000) {
      this.attemptReconnection(connection);
    }
    
    this.updateMetrics();
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnection(connection: ChickenBusinessConnection): Promise<void> {
    connection.reconnectAttempts++;
    const delay = this.reconnectDelays[Math.min(connection.reconnectAttempts - 1, this.reconnectDelays.length - 1)];
    
    console.log(`🔄 Attempting reconnection for ${connection.id} (Attempt ${connection.reconnectAttempts}/${connection.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        connection.ws = await this.createWebSocket();
        this.setupWebSocketHandlers(connection);
        connection.status = 'connecting';
      } catch (error) {
        console.error(`❌ Reconnection failed for ${connection.id}:`, error);
        this.handleConnectionError(connection, error as Error);
      }
    }, delay);
  }

  /**
   * Find idle connection
   */
  private findIdleConnection(
    type: ChickenBusinessConnection['type'],
    options: { userRole: string; branchId?: string }
  ): ChickenBusinessConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.type === type &&
          connection.status === 'idle' &&
          connection.userRole === options.userRole &&
          connection.branchId === (options.branchId || 'main')) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Wait for available connection
   */
  private async waitForAvailableConnection(
    type: ChickenBusinessConnection['type'],
    options: any
  ): Promise<ChickenBusinessConnection> {
    return new Promise((resolve, reject) => {
      const queueKey = `${type}_${options.userRole}_${options.branchId || 'main'}`;
      
      if (!this.connectionQueues.has(queueKey)) {
        this.connectionQueues.set(queueKey, []);
      }

      // Add to queue with timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Connection wait timeout for ${type}`));
      }, 30000); // 30 second timeout

      // Store resolve/reject functions in a mock connection object for queue
      const queueEntry = {
        resolve: (conn: ChickenBusinessConnection) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        },
        type,
        options
      } as any;

      this.connectionQueues.get(queueKey)!.push(queueEntry);
    });
  }

  /**
   * Process connection queue
   */
  private processConnectionQueue(type: ChickenBusinessConnection['type']): void {
    // Check if there are queued requests for this connection type
    for (const [queueKey, queue] of this.connectionQueues) {
      if (queueKey.startsWith(`${type}_`) && queue.length > 0) {
        const queueEntry = queue.shift()!;
        
        // Try to get an idle connection
        const idleConnection = this.findIdleConnection(type, queueEntry.options);
        if (idleConnection) {
          idleConnection.status = 'active';
          queueEntry.resolve(idleConnection);
        }
      }
    }
  }

  /**
   * Setup periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Health check
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);

    // Cleanup
    setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    // Metrics update
    setInterval(() => {
      this.updateMetrics();
    }, 60000); // Every minute
  }

  /**
   * Setup connection queues
   */
  private setupConnectionQueues(): void {
    for (const type of Object.keys(this.connectionConfigs)) {
      // Initialize queues for different contexts
      this.connectionQueues.set(`${type}_owner_main`, []);
      this.connectionQueues.set(`${type}_worker_main`, []);
      this.connectionQueues.set(`${type}_customer_main`, []);
    }
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    console.log('🏥 Performing connection health check...');
    
    let healthyCount = 0;
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.sendMessage(connection, { type: 'ping', timestamp: Date.now() });
        healthyCount++;
      } else if (connection.status !== 'disconnected') {
        this.handleConnectionError(connection, new Error('Health check failed'));
      }
    }
    
    console.log(`✅ Health check complete: ${healthyCount}/${this.connections.size} connections healthy`);
  }

  /**
   * Perform cleanup of idle connections
   */
  private performCleanup(): void {
    console.log('🧹 Performing connection cleanup...');
    
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [id, connection] of this.connections) {
      const config = this.connectionConfigs[connection.type];
      const idleTime = now - connection.lastActivity;
      
      if (connection.status === 'idle' && idleTime > config.idleTimeout) {
        console.log(`🗑️ Cleaning up idle connection: ${id} (idle for ${idleTime}ms)`);
        this.closeConnection(id);
        cleanedCount++;
      }
    }
    
    this.metrics.lastCleanup = new Date();
    if (cleanedCount > 0) {
      console.log(`✅ Cleanup complete: ${cleanedCount} connections cleaned up`);
    }
  }

  /**
   * Clean up session data
   */
  private cleanupSessionData(connection: ChickenBusinessConnection): void {
    // Clean up session data based on connection type
    switch (connection.type) {
      case 'voice_stream':
        // Keep recent voice chunks, remove old ones
        if (connection.sessionData.voiceChunks && connection.sessionData.voiceChunks.length > 10) {
          connection.sessionData.voiceChunks = connection.sessionData.voiceChunks.slice(-10);
        }
        break;
      
      case 'chat':
        // Keep recent chat history, remove old messages
        if (connection.sessionData.chatHistory && connection.sessionData.chatHistory.length > 50) {
          connection.sessionData.chatHistory = connection.sessionData.chatHistory.slice(-50);
        }
        break;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    let activeCount = 0;
    let idleCount = 0;
    let errorCount = 0;
    let totalMessages = 0;
    let totalLatency = 0;

    for (const connection of this.connections.values()) {
      switch (connection.status) {
        case 'active':
        case 'connected':
          activeCount++;
          break;
        case 'idle':
          idleCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
      
      totalMessages += connection.metrics.messagesHandled;
      totalLatency += connection.metrics.averageLatency;
    }

    this.metrics.totalConnections = this.connections.size;
    this.metrics.activeConnections = activeCount;
    this.metrics.idleConnections = idleCount;
    this.metrics.errorConnections = errorCount;
    this.metrics.messagesThroughput = totalMessages;
    this.metrics.averageLatency = this.connections.size > 0 ? totalLatency / this.connections.size : 0;
    this.metrics.connectionUtilization = this.connections.size > 0 ? (activeCount / this.connections.size) * 100 : 0;
    
    // Estimate cost savings from connection reuse
    this.metrics.costSavings = this.calculateCostSavings();
  }

  /**
   * Calculate cost savings from connection pooling
   */
  private calculateCostSavings(): number {
    // Estimate based on connection reuse and reduced overhead
    const baseConnectionCost = 0.01; // 1 centavo per connection establishment
    const reusedConnections = Array.from(this.connections.values()).filter(conn => conn.messageCount > 1);
    return reusedConnections.length * baseConnectionCost;
  }

  /**
   * Get connection pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get all connections (for debugging)
   */
  getAllConnections(): ChickenBusinessConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by type
   */
  getConnectionsByType(type: ChickenBusinessConnection['type']): ChickenBusinessConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.type === type);
  }

  /**
   * Force close all connections
   */
  closeAllConnections(): void {
    console.log('🛑 Closing all connections...');
    
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }
    
    console.log('✅ All connections closed');
  }
}

// Default instance for chicken business
export const chickenBusinessConnectionPool = new ChickenBusinessConnectionPool();

export default ChickenBusinessConnectionPool;