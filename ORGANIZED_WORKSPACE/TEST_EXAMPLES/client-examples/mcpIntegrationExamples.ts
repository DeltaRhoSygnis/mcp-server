/**
 * MCP Integration Examples
 * Complete examples for integrating MCP server with your frontend/backend
 * Copy these examples to your Charnoksv3 repository
 */

// =============================================================================
// 1. BASIC MCP CLIENT USAGE
// =============================================================================

import { mcpClient, MCPClient } from './mcpClient';

/**
 * Example: Processing chicken business notes
 */
export async function processBusinessNoteExample() {
  // Authenticate first (do this once when app starts)
  const authResult = await mcpClient.authenticate('your_mcp_auth_token_here');
  if (!authResult.success) {
    console.error('Authentication failed:', authResult.error);
    return;
  }

  // Process a business note
  const noteResult = await mcpClient.processChickenNote({
    content: "Bought 20 bags whole chicken from Magnolia supplier. Each bag has 8 chickens. Total cost 7500 pesos.",
    userRole: 'owner',
    branchId: 'main_branch'
  });

  if (noteResult.success) {
    console.log('Note processed:', noteResult.result);
    
    // Apply to stock if needed
    if (noteResult.result?.note_id) {
      const stockResult = await mcpClient.applyToStock(noteResult.result.note_id, false);
      console.log('Stock updated:', stockResult.result);
    }
  } else {
    console.error('Note processing failed:', noteResult.error);
  }
}

/**
 * Example: Getting AI business advice
 */
export async function getBusinessAdviceExample() {
  const adviceResult = await mcpClient.getBusinessAdvice({
    question: "How can I increase profit margins on whole chicken sales?",
    userRole: 'owner',
    context: {
      currentMargin: 25,
      monthlySales: 50000,
      mainProducts: ['whole_chicken', 'chicken_parts']
    }
  });

  if (adviceResult.success) {
    console.log('AI Advice:', adviceResult.result);
  }
}

// =============================================================================
// 2. REACT COMPONENT EXAMPLES
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useMCPClient } from './mcpClient';
import { useMCPVoiceStream, useMCPChat } from './mcpWebSocket';

/**
 * Example: Note Processing Component
 */
export function ChickenNoteProcessor() {
  const [noteContent, setNoteContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const { processNote } = useMCPClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    
    const response = await processNote({
      content: noteContent,
      userRole: 'owner',
      branchId: 'main'
    });
    
    setResult(response);
    setProcessing(false);
  };

  return (
    <div className="chicken-note-processor">
      <h2>Process Business Note</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Enter your business note here..."
          className="w-full p-3 border rounded"
          rows={4}
        />
        <button 
          type="submit" 
          disabled={processing || !noteContent.trim()}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Process Note'}
        </button>
      </form>
      
      {result && (
        <div className="mt-4 p-3 border rounded">
          <h3>Result:</h3>
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Voice Recording Component
 */
export function VoiceRecorder() {
  const {
    isRecording,
    partialResult,
    finalResult,
    error,
    startRecording,
    stopRecording
  } = useMCPVoiceStream();

  return (
    <div className="voice-recorder">
      <h2>Voice Recording</h2>
      
      <div className="controls">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded ${
            isRecording 
              ? 'bg-red-500 text-white' 
              : 'bg-green-500 text-white'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {partialResult && (
        <div className="mt-4 p-3 border rounded bg-yellow-50">
          <h3>Partial Recognition:</h3>
          <p>Confidence: {(partialResult.partialParse?.confidence || 0) * 100}%</p>
          <pre className="text-sm">
            {JSON.stringify(partialResult.partialParse?.items, null, 2)}
          </pre>
        </div>
      )}

      {finalResult && (
        <div className="mt-4 p-3 border rounded bg-green-50">
          <h3>Final Result:</h3>
          <pre className="text-sm">
            {JSON.stringify(finalResult.final, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Real-time Chat Component
 */
export function MCPChatInterface() {
  const {
    messages,
    isConnected,
    error,
    connect,
    sendMessage,
    disconnect
  } = useMCPChat();
  
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      sendMessage(inputMessage, 'owner');
      setInputMessage('');
    }
  };

  return (
    <div className="mcp-chat">
      <h2>AI Assistant Chat</h2>
      
      <div className="connection-status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {error && (
        <div className="error bg-red-100 text-red-700 p-2 rounded">
          Error: {error}
        </div>
      )}

      <div className="messages max-h-96 overflow-y-auto border p-3 mb-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-2 p-2 rounded ${
              message.type === 'user' 
                ? 'bg-blue-100 ml-8' 
                : 'bg-gray-100 mr-8'
            }`}
          >
            <div className="font-bold">
              {message.type === 'user' ? 'You' : 'AI Assistant'}
            </div>
            <div>{message.content}</div>
            <div className="text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString()}
              {message.confidence && ` (${Math.round(message.confidence * 100)}%)`}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask your AI assistant..."
          className="flex-1 p-2 border rounded"
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={!isConnected || !inputMessage.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// =============================================================================
// 3. BACKEND/API INTEGRATION EXAMPLES
// =============================================================================

/**
 * Example: Express.js middleware for authentication
 */
export function createMCPAuthMiddleware(mcpClient: MCPClient) {
  return async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify with MCP server
    const healthCheck = await mcpClient.getHealthStatus();
    
    if (!healthCheck.success) {
      return res.status(503).json({ error: 'MCP server unavailable' });
    }

    req.mcpClient = mcpClient;
    next();
  };
}

/**
 * Example: API endpoint for processing notes
 */
export function createNotesAPI(app: any, mcpClient: MCPClient) {
  app.post('/api/notes/process', async (req: any, res: any) => {
    try {
      const { content, userRole, branchId } = req.body;
      
      const result = await mcpClient.processChickenNote({
        content,
        userRole,
        branchId
      });

      if (result.success) {
        res.json(result.result);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/advice', async (req: any, res: any) => {
    try {
      const { question, context, userRole } = req.body;
      
      const result = await mcpClient.getBusinessAdvice({
        question,
        context,
        userRole
      });

      if (result.success) {
        res.json(result.result);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// =============================================================================
// 4. OFFLINE INTEGRATION EXAMPLE
// =============================================================================

/**
 * Example: Offline-first note processing with IndexedDB
 */
export class OfflineMCPIntegration {
  private db: IDBDatabase | null = null;

  async initialize() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('MCPOfflineDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Create notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          notesStore.createIndex('status', 'status', { unique: false });
          notesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveNoteOffline(content: string, userRole: string) {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['notes'], 'readwrite');
    const store = transaction.objectStore('notes');
    
    const note = {
      content,
      userRole,
      status: 'pending',
      timestamp: new Date().toISOString(),
      localId: Date.now().toString()
    };

    return store.add(note);
  }

  async syncPendingNotes() {
    if (!this.db) return;

    const transaction = this.db.transaction(['notes'], 'readwrite');
    const store = transaction.objectStore('notes');
    const index = store.index('status');
    
    const pendingNotes = await new Promise<any[]>((resolve) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
    });

    for (const note of pendingNotes) {
      try {
        const result = await mcpClient.processChickenNote({
          content: note.content,
          userRole: note.userRole
        });

        if (result.success) {
          // Update note status
          note.status = 'synced';
          note.mcpResult = result.result;
          store.put(note);
        }
      } catch (error) {
        console.error('Failed to sync note:', error);
      }
    }
  }
}

// =============================================================================
// 5. ENVIRONMENT SETUP EXAMPLE
// =============================================================================

/**
 * Example: Environment configuration
 */
export const mcpConfig = {
  // For development
  development: {
    MCP_SERVER_URL: 'http://localhost:3002',
    MCP_AUTH_TOKEN: 'your_development_token',
    WEBSOCKET_ENABLED: true
  },
  
  // For production (Render deployment)
  production: {
    MCP_SERVER_URL: 'https://your-mcp-server.onrender.com',
    MCP_AUTH_TOKEN: 'your_production_token',
    WEBSOCKET_ENABLED: true
  }
};

/**
 * Example: Initialize MCP client with environment
 */
export function initializeMCPClient() {
  const config = process.env.NODE_ENV === 'production' 
    ? mcpConfig.production 
    : mcpConfig.development;

  // Set environment variables for mcpClient
  if (typeof window !== 'undefined') {
    // Browser environment
    localStorage.setItem('mcp_server_url', config.MCP_SERVER_URL);
    localStorage.setItem('mcp_auth_token', config.MCP_AUTH_TOKEN);
  } else {
    // Node.js environment
    process.env.MCP_SERVER_URL = config.MCP_SERVER_URL;
    process.env.MCP_AUTH_TOKEN = config.MCP_AUTH_TOKEN;
  }

  return mcpClient;
}

export default {
  processBusinessNoteExample,
  getBusinessAdviceExample,
  ChickenNoteProcessor,
  VoiceRecorder,
  MCPChatInterface,
  createMCPAuthMiddleware,
  createNotesAPI,
  OfflineMCPIntegration,
  initializeMCPClient
};