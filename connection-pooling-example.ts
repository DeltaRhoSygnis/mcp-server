/**
 * WebSocket Connection Pool for MCP Client
 * Efficiently manages multiple WebSocket connections with load balancing
 */

interface PooledConnection {
  id: string;
  ws: WebSocket;
  isActive: boolean;
  lastUsed: number;
  activeStreams: number;
  maxStreams: number;
  connectionTime: number;
  errorCount: number;
}

interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  maxStreamsPerConnection: number;
  idleTimeout: number; // Time before closing idle connections
  reconnectDelay: number;
  healthCheckInterval: number;
}

export class WebSocketConnectionPool {
  private connections = new Map<string, PooledConnection>();
  private config: ConnectionPoolConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string, config: Partial<ConnectionPoolConfig> = {}) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.config = {
      minConnections: config.minConnections || 2,
      maxConnections: config.maxConnections || 8,
      maxStreamsPerConnection: config.maxStreamsPerConnection || 5,
      idleTimeout: config.idleTimeout || 5 * 60 * 1000, // 5 minutes
      reconnectDelay: config.reconnectDelay || 2000,
      healthCheckInterval: config.healthCheckInterval || 30 * 1000 // 30 seconds
    };

    this.initialize();
  }

  /**
   * Initialize connection pool
   */
  private async initialize(): Promise<void> {
    console.log(`🏊 Initializing WebSocket pool (min: ${this.config.minConnections}, max: ${this.config.maxConnections})`);

    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    // Start health monitoring
    this.startHealthCheck();
  }

  /**
   * Get available connection from pool
   */
  async getConnection(): Promise<PooledConnection> {
    // Find connection with least load
    let bestConnection: PooledConnection | null = null;
    let lowestLoad = Infinity;

    for (const conn of this.connections.values()) {
      if (conn.isActive && conn.activeStreams < conn.maxStreams) {
        const load = conn.activeStreams / conn.maxStreams;
        if (load < lowestLoad) {
          lowestLoad = load;
          bestConnection = conn;
        }
      }
    }

    // If no available connection and we can create more
    if (!bestConnection && this.connections.size < this.config.maxConnections) {
      console.log('📈 Pool at capacity, creating new connection');
      bestConnection = await this.createConnection();
    }

    // If still no connection, wait for one to become available
    if (!bestConnection) {
      console.log('⏳ Pool full, waiting for available connection...');
      bestConnection = await this.waitForAvailableConnection();
    }

    // Mark connection as used
    bestConnection.lastUsed = Date.now();
    bestConnection.activeStreams++;

    console.log(`🔗 Using connection ${bestConnection.id} (load: ${bestConnection.activeStreams}/${bestConnection.maxStreams})`);
    
    return bestConnection;
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.activeStreams > 0) {
      conn.activeStreams--;
      console.log(`🔓 Released connection ${connectionId} (load: ${conn.activeStreams}/${conn.maxStreams})`);
    }
  }

  /**
   * Create new WebSocket connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const id = crypto.randomUUID?.() || Date.now().toString();
    const wsUrl = `${this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/pool`;

    console.log(`🔨 Creating new WebSocket connection: ${id}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}${this.authToken ? `?token=${this.authToken}` : ''}`);
      
      const connection: PooledConnection = {
        id,
        ws,
        isActive: false,
        lastUsed: Date.now(),
        activeStreams: 0,
        maxStreams: this.config.maxStreamsPerConnection,
        connectionTime: Date.now(),
        errorCount: 0
      };

      ws.onopen = () => {
        console.log(`✅ WebSocket connection ${id} established`);
        connection.isActive = true;
        this.connections.set(id, connection);
        
        // Send pool identification
        ws.send(JSON.stringify({
          type: 'pool_join',
          connectionId: id,
          timestamp: new Date().toISOString()
        }));
        
        resolve(connection);
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket connection ${id} error:`, error);
        connection.errorCount++;
        
        if (!connection.isActive) {
          reject(error);
        } else {
          // Mark for reconnection
          this.handleConnectionError(connection);
        }
      };

      ws.onclose = () => {
        console.log(`📞 WebSocket connection ${id} closed`);
        connection.isActive = false;
        
        // Schedule reconnection if needed
        if (this.connections.has(id)) {
          setTimeout(() => this.reconnectConnection(id), this.config.reconnectDelay);
        }
      };

      ws.onmessage = (event) => {
        this.handlePoolMessage(connection, event);
      };

      // Timeout for initial connection
      setTimeout(() => {
        if (!connection.isActive) {
          ws.close();
          reject(new Error(`Connection timeout for ${id}`));
        }
      }, 10000);
    });
  }

  /**
   * Handle messages for pooled connections
   */
  private handlePoolMessage(connection: PooledConnection, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'pool_heartbeat':
          // Respond to heartbeat
          connection.ws.send(JSON.stringify({
            type: 'pool_heartbeat_response',
            connectionId: connection.id,
            timestamp: new Date().toISOString()
          }));
          break;
          
        case 'pool_stats_request':
          // Send connection stats
          connection.ws.send(JSON.stringify({
            type: 'pool_stats_response',
            connectionId: connection.id,
            stats: {
              activeStreams: connection.activeStreams,
              maxStreams: connection.maxStreams,
              uptime: Date.now() - connection.connectionTime,
              errorCount: connection.errorCount
            }
          }));
          break;
          
        default:
          // Forward to appropriate stream handler
          this.forwardToStreamHandler(connection, data);
      }
    } catch (error) {
      console.error('Error handling pool message:', error);
    }
  }

  /**
   * Forward message to stream handler
   */
  private forwardToStreamHandler(connection: PooledConnection, data: any): void {
    // This would forward messages to the appropriate voice/chat stream handler
    console.log(`📨 Forwarding message from connection ${connection.id}:`, data.type);
  }

  /**
   * Wait for available connection
   */
  private async waitForAvailableConnection(): Promise<PooledConnection> {
    return new Promise((resolve) => {
      const checkForConnection = () => {
        for (const conn of this.connections.values()) {
          if (conn.isActive && conn.activeStreams < conn.maxStreams) {
            resolve(conn);
            return;
          }
        }
        
        // Check again in 100ms
        setTimeout(checkForConnection, 100);
      };
      
      checkForConnection();
    });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(connection: PooledConnection): void {
    console.warn(`⚠️ Connection ${connection.id} error count: ${connection.errorCount}`);
    
    if (connection.errorCount > 3) {
      console.log(`🔥 Connection ${connection.id} too many errors, removing from pool`);
      this.removeConnection(connection.id);
    }
  }

  /**
   * Reconnect a failed connection
   */
  private async reconnectConnection(connectionId: string): Promise<void> {
    const oldConnection = this.connections.get(connectionId);
    if (!oldConnection || oldConnection.isActive) return;

    console.log(`🔄 Reconnecting WebSocket ${connectionId}`);
    
    try {
      this.connections.delete(connectionId);
      await this.createConnection();
    } catch (error) {
      console.error(`Failed to reconnect ${connectionId}:`, error);
    }
  }

  /**
   * Remove connection from pool
   */
  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws.close();
      this.connections.delete(connectionId);
      
      // Ensure minimum connections
      if (this.connections.size < this.config.minConnections) {
        this.createConnection().catch(console.error);
      }
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = Date.now();
    
    for (const [id, connection] of this.connections.entries()) {
      // Check for idle connections
      if (connection.activeStreams === 0 && 
          now - connection.lastUsed > this.config.idleTimeout && 
          this.connections.size > this.config.minConnections) {
        
        console.log(`🧹 Closing idle connection ${id}`);
        this.removeConnection(id);
        continue;
      }

      // Send heartbeat to active connections
      if (connection.isActive) {
        try {
          connection.ws.send(JSON.stringify({
            type: 'pool_heartbeat',
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error(`Heartbeat failed for ${id}:`, error);
          this.handleConnectionError(connection);
        }
      }
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.isActive);
    
    return {
      total: connections.length,
      active: activeConnections.length,
      totalStreams: activeConnections.reduce((sum, c) => sum + c.activeStreams, 0),
      maxStreams: activeConnections.reduce((sum, c) => sum + c.maxStreams, 0),
      avgLoad: activeConnections.length > 0 
        ? activeConnections.reduce((sum, c) => sum + (c.activeStreams / c.maxStreams), 0) / activeConnections.length 
        : 0,
      oldestConnection: connections.length > 0 
        ? Math.min(...connections.map(c => c.connectionTime)) 
        : null
    };
  }

  /**
   * Destroy connection pool
   */
  destroy(): void {
    console.log('🔥 Destroying WebSocket connection pool');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    for (const connection of this.connections.values()) {
      connection.ws.close();
    }
    
    this.connections.clear();
  }
}

/**
 * Enhanced MCP WebSocket Stream with connection pooling
 */
export class PooledMCPVoiceStream extends MCPVoiceStream {
  private connectionPool: WebSocketConnectionPool;
  private currentConnection?: PooledConnection;

  constructor(
    baseUrl: string, 
    authToken: string,
    callbacks: {
      onPartialResult?: (result: VoiceStreamResponse) => void;
      onFinalResult?: (result: VoiceStreamResponse) => void;
      onError?: (error: string) => void;
    }
  ) {
    super(callbacks);
    this.connectionPool = new WebSocketConnectionPool(baseUrl, authToken);
  }

  async startStreaming(): Promise<void> {
    try {
      // Get connection from pool
      this.currentConnection = await this.connectionPool.getConnection();
      
      // Use the pooled connection for streaming
      this.ws = this.currentConnection.ws;
      
      // Set up message handling
      this.setupStreamHandling();
      
      // Start speech recognition
      if (this.recognition) {
        this.recognition.start();
      }
      
      console.log(`🎤 Started voice streaming on pooled connection ${this.currentConnection.id}`);
      
    } catch (error) {
      this.onError?.(error instanceof Error ? error.message : 'Failed to start streaming');
    }
  }

  stopStreaming(): void {
    super.stopStreaming();
    
    // Release connection back to pool
    if (this.currentConnection) {
      this.connectionPool.releaseConnection(this.currentConnection.id);
      this.currentConnection = undefined;
    }
  }

  getPoolStats() {
    return this.connectionPool.getPoolStats();
  }
}

// Usage
export const pooledVoiceStream = new PooledMCPVoiceStream(
  'wss://your-mcp-server.onrender.com',
  'your-auth-token',
  {
    onPartialResult: (result) => console.log('Partial:', result),
    onFinalResult: (result) => console.log('Final:', result),
    onError: (error) => console.error('Error:', error)
  }
);