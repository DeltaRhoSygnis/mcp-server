/**
 * MCP WebSocket Integration
 * Handles real-time communication with MCP server
 * Voice streaming, live chat, and real-time notifications
 */

import { mcpClient } from './mcpClient';

export interface VoiceStreamResponse {
  partialParse?: {
    items: Array<{productId: string, qty: number, confidence: number}>;
    confidence: number;
  };
  final?: {
    structuredSales: any;
    note_id: string;
  };
  streamChunk?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  role?: 'owner' | 'worker' | 'customer';
  confidence?: number;
}

/**
 * Voice Recording with MCP Live Stream Integration
 */
export class MCPVoiceStream {
  private ws: WebSocket | null = null;
  private recognition: any = null;
  private streamId: string = '';
  private isRecording: boolean = false;
  private onPartialResult?: (result: VoiceStreamResponse) => void;
  private onFinalResult?: (result: VoiceStreamResponse) => void;
  private onError?: (error: string) => void;

  constructor(callbacks: {
    onPartialResult?: (result: VoiceStreamResponse) => void;
    onFinalResult?: (result: VoiceStreamResponse) => void;
    onError?: (error: string) => void;
  }) {
    this.onPartialResult = callbacks.onPartialResult;
    this.onFinalResult = callbacks.onFinalResult;
    this.onError = callbacks.onError;
    
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    // Check for browser speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.onError?.('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US'; // You can make this configurable

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send transcript chunk to MCP server
          mcpClient.sendVoiceChunk(this.ws, {
            streamId: this.streamId,
            transcriptChunk: transcript,
            products: this.getLocalProducts() // You can implement this
          });
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      this.onError?.(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        // Automatically restart if still recording
        this.recognition.start();
      }
    };
  }

  /**
   * Start voice recording and streaming
   */
  async startStreaming(): Promise<void> {
    try {
      this.streamId = Date.now().toString();
      this.isRecording = true;

      // Create WebSocket connection
      this.ws = await mcpClient.startVoiceStream(this.streamId);

      // Handle WebSocket messages
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.partialParse) {
          this.onPartialResult?.(data);
        }
        
        if (data.final) {
          this.onFinalResult?.(data);
        }
        
        if (data.error) {
          this.onError?.(data.error);
        }
      };

      // Start speech recognition
      if (this.recognition) {
        this.recognition.start();
      }

    } catch (error) {
      this.onError?.(error instanceof Error ? error.message : 'Failed to start streaming');
    }
  }

  /**
   * Stop voice recording and streaming
   */
  stopStreaming(): void {
    this.isRecording = false;

    if (this.recognition) {
      this.recognition.stop();
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get local products for context (implement based on your data)
   */
  private getLocalProducts(): Array<{id: string, name: string}> {
    // This should return your available products
    // You can get this from your local storage, state, or API
    return [
      { id: 'whole', name: 'Whole Chicken' },
      { id: 'parts', name: 'Chicken Parts' },
      { id: 'necks', name: 'Chicken Necks' }
    ];
  }
}

/**
 * Real-time Chat with MCP Server
 */
export class MCPChatStream {
  private ws: WebSocket | null = null;
  private onMessage?: (message: ChatMessage) => void;
  private onError?: (error: string) => void;
  private onConnectionChange?: (connected: boolean) => void;

  constructor(callbacks: {
    onMessage?: (message: ChatMessage) => void;
    onError?: (error: string) => void;
    onConnectionChange?: (connected: boolean) => void;
  }) {
    this.onMessage = callbacks.onMessage;
    this.onError = callbacks.onError;
    this.onConnectionChange = callbacks.onConnectionChange;
  }

  /**
   * Connect to chat WebSocket
   */
  async connect(): Promise<void> {
    try {
      this.ws = await mcpClient.createWebSocketConnection();

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chat_message') {
          const message: ChatMessage = {
            id: data.id || Date.now().toString(),
            type: 'ai',
            content: data.content,
            timestamp: new Date(data.timestamp || Date.now()),
            confidence: data.confidence
          };
          
          this.onMessage?.(message);
        }
      };

      this.ws.onopen = () => {
        this.onConnectionChange?.(true);
      };

      this.ws.onclose = () => {
        this.onConnectionChange?.(false);
      };

      this.ws.onerror = (error) => {
        this.onError?.('WebSocket connection error');
      };

    } catch (error) {
      this.onError?.(error instanceof Error ? error.message : 'Failed to connect');
    }
  }

  /**
   * Send chat message
   */
  sendMessage(content: string, role: 'owner' | 'worker' | 'customer' = 'owner'): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'chat_message',
        content,
        role,
        timestamp: new Date().toISOString()
      };

      this.ws.send(JSON.stringify(message));

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content,
        timestamp: new Date(),
        role
      };

      this.onMessage?.(userMessage);
    }
  }

  /**
   * Disconnect chat
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * React hooks for voice and chat features
 */
export function useMCPVoiceStream() {
  const [isRecording, setIsRecording] = React.useState(false);
  const [partialResult, setPartialResult] = React.useState<VoiceStreamResponse | null>(null);
  const [finalResult, setFinalResult] = React.useState<VoiceStreamResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const voiceStream = React.useMemo(() => new MCPVoiceStream({
    onPartialResult: setPartialResult,
    onFinalResult: setFinalResult,
    onError: setError
  }), []);

  const startRecording = React.useCallback(async () => {
    setError(null);
    setPartialResult(null);
    setFinalResult(null);
    setIsRecording(true);
    
    try {
      await voiceStream.startStreaming();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, [voiceStream]);

  const stopRecording = React.useCallback(() => {
    voiceStream.stopStreaming();
    setIsRecording(false);
  }, [voiceStream]);

  return {
    isRecording,
    partialResult,
    finalResult,
    error,
    startRecording,
    stopRecording
  };
}

export function useMCPChat() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const chatStream = React.useMemo(() => new MCPChatStream({
    onMessage: (message) => setMessages(prev => [...prev, message]),
    onError: setError,
    onConnectionChange: setIsConnected
  }), []);

  const connect = React.useCallback(async () => {
    await chatStream.connect();
  }, [chatStream]);

  const sendMessage = React.useCallback((content: string, role?: 'owner' | 'worker' | 'customer') => {
    chatStream.sendMessage(content, role);
  }, [chatStream]);

  const disconnect = React.useCallback(() => {
    chatStream.disconnect();
  }, [chatStream]);

  React.useEffect(() => {
    return () => {
      chatStream.disconnect();
    };
  }, [chatStream]);

  return {
    messages,
    isConnected,
    error,
    connect,
    sendMessage,
    disconnect,
    clearMessages: () => setMessages([])
  };
}

// For non-React environments, export the classes directly
export { MCPVoiceStream, MCPChatStream };