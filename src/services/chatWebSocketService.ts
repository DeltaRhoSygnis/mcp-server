import WebSocket from 'ws';
import { unifiedAIService, ChatContext } from './unifiedAIService.js';

export interface ChatWebSocketMessage {
  type: 'chat' | 'voice' | 'action' | 'context_update';
  sessionId: string;
  userId: string;
  role: 'customer' | 'worker' | 'owner' | 'admin';
  content?: string;
  voiceData?: Buffer;
  action?: any;
  context?: Partial<ChatContext>;
}

export interface ChatWebSocketResponse {
  type: 'response' | 'action_result' | 'voice_response' | 'error';
  sessionId: string;
  content?: string;
  actions?: any[];
  suggestions?: string[];
  voiceData?: Buffer;
  error?: string;
}

export class ChatWebSocketService {
  private clients: Map<string, WebSocket> = new Map();
  private sessionClients: Map<string, string[]> = new Map();

  constructor(private wss: WebSocket.Server) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = crypto.randomUUID();
      this.clients.set(clientId, ws);

      console.log(`Chat client connected: ${clientId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ChatWebSocketMessage;
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });

      // Send welcome message
      this.sendResponse(clientId, {
        type: 'response',
        sessionId: '',
        content: 'Connected to Charnoks AI Assistant. How can I help you today?'
      });
    });
  }

  private async handleMessage(clientId: string, message: ChatWebSocketMessage): Promise<void> {
    try {
      // Register client for session
      this.registerClientForSession(clientId, message.sessionId);

      switch (message.type) {
        case 'chat':
          await this.handleChatMessage(clientId, message);
          break;
        case 'voice':
          await this.handleVoiceMessage(clientId, message);
          break;
        case 'action':
          await this.handleActionMessage(clientId, message);
          break;
        case 'context_update':
          await this.handleContextUpdate(clientId, message);
          break;
        default:
          this.sendError(clientId, 'Unknown message type');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      this.sendError(clientId, 'Error processing your request');
    }
  }

  private async handleChatMessage(clientId: string, message: ChatWebSocketMessage): Promise<void> {
    if (!message.content) {
      this.sendError(clientId, 'Message content is required');
      return;
    }

    // Process through unified AI service
    const response = await unifiedAIService.processChat(
      message.userId,
      message.content,
      {
        sessionId: message.sessionId,
        role: message.role,
        ...message.context
      }
    );

    // Send response back to client
    this.sendResponse(clientId, {
      type: 'response',
      sessionId: message.sessionId,
      content: response.content,
      actions: response.actions,
      suggestions: response.suggestions
    });

    // Execute any actions that need real-time updates
    if (response.actions && response.actions.length > 0) {
      for (const action of response.actions) {
        await this.executeRealtimeAction(clientId, message.sessionId, action);
      }
    }
  }

  private async handleVoiceMessage(clientId: string, message: ChatWebSocketMessage): Promise<void> {
    if (!message.voiceData) {
      this.sendError(clientId, 'Voice data is required');
      return;
    }

    try {
      // Convert voice to text (integrate with existing voice processing)
      const transcription = await this.transcribeVoice(message.voiceData);
      
      // Process as chat message
      const chatMessage: ChatWebSocketMessage = {
        ...message,
        type: 'chat',
        content: transcription
      };
      
      await this.handleChatMessage(clientId, chatMessage);
      
      // Also send voice response if appropriate for the role
      if (message.role === 'worker') {
        const voiceResponse = await this.generateVoiceResponse(transcription, message.role);
        this.sendResponse(clientId, {
          type: 'voice_response',
          sessionId: message.sessionId,
          voiceData: voiceResponse
        });
      }
    } catch (error) {
      console.error('Error processing voice message:', error);
      this.sendError(clientId, 'Error processing voice input');
    }
  }

  private async handleActionMessage(clientId: string, message: ChatWebSocketMessage): Promise<void> {
    // Handle direct action requests (like "update stock", "generate report")
    const response = await unifiedAIService.processChat(
      message.userId,
      `Execute action: ${JSON.stringify(message.action)}`,
      {
        sessionId: message.sessionId,
        role: message.role,
        currentWorkflow: 'action_execution'
      }
    );

    this.sendResponse(clientId, {
      type: 'action_result',
      sessionId: message.sessionId,
      content: response.content,
      actions: response.actions
    });
  }

  private async handleContextUpdate(clientId: string, message: ChatWebSocketMessage): Promise<void> {
    // Update session context (role change, workflow change, etc.)
    console.log(`Context updated for session ${message.sessionId}:`, message.context);
    
    this.sendResponse(clientId, {
      type: 'response',
      sessionId: message.sessionId,
      content: 'Context updated successfully'
    });
  }

  private async executeRealtimeAction(clientId: string, sessionId: string, action: any): Promise<void> {
    // Execute actions that need real-time feedback
    switch (action.type) {
      case 'stock_update':
        // Send real-time stock update notification
        this.sendResponse(clientId, {
          type: 'action_result',
          sessionId,
          content: `Stock updated: ${action.description}`
        });
        break;
      case 'voice_response':
        // Generate and send voice response
        const voiceData = await this.generateVoiceResponse(action.parameters.text, 'worker');
        this.sendResponse(clientId, {
          type: 'voice_response',
          sessionId,
          voiceData
        });
        break;
    }
  }

  private sendResponse(clientId: string, response: ChatWebSocketResponse): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  }

  private sendError(clientId: string, error: string): void {
    this.sendResponse(clientId, {
      type: 'error',
      sessionId: '',
      error
    });
  }

  private registerClientForSession(clientId: string, sessionId: string): void {
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, []);
    }
    const clients = this.sessionClients.get(sessionId)!;
    if (!clients.includes(clientId)) {
      clients.push(clientId);
    }
  }

  private handleClientDisconnect(clientId: string): void {
    console.log(`Chat client disconnected: ${clientId}`);
    this.clients.delete(clientId);
    
    // Remove from session clients
    for (const [sessionId, clients] of this.sessionClients.entries()) {
      const index = clients.indexOf(clientId);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.sessionClients.delete(sessionId);
        }
      }
    }
  }

  private async transcribeVoice(voiceData: Buffer): Promise<string> {
    // Integration point with existing voice processing
    // This would use your existing voice transcription logic
    return "Voice transcription placeholder";
  }

  private async generateVoiceResponse(text: string, role: string): Promise<Buffer> {
    // Integration point for text-to-speech
    // This would generate voice response based on role
    return Buffer.from("Voice response placeholder");
  }

  // Broadcast to all clients in a session
  public broadcastToSession(sessionId: string, response: ChatWebSocketResponse): void {
    const clients = this.sessionClients.get(sessionId) || [];
    clients.forEach(clientId => {
      this.sendResponse(clientId, response);
    });
  }

  // Get session statistics
  public getSessionStats(): any {
    return {
      totalClients: this.clients.size,
      activeSessions: this.sessionClients.size,
      clientsPerSession: Array.from(this.sessionClients.values()).map(clients => clients.length)
    };
  }
}