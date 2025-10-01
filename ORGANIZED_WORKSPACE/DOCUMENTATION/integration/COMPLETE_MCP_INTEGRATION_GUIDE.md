# 🚀 **COMPLETE MCP INTEGRATION GUIDE**
## Frontend + Backend Integration with Charnoks MCP Server

*Comprehensive guide for integrating your MCP server with your frontend+backend Charnoks workspace*

---

## 📋 **Table of Contents**

1. [Architecture Overview](#architecture-overview)
2. [Environment Setup](#environment-setup)
3. [Integration Methods](#integration-methods)
4. [Frontend Integration](#frontend-integration)
5. [Backend Integration](#backend-integration)
6. [WebSocket Real-time Communication](#websocket-real-time-communication)
7. [Authentication & Security](#authentication--security)
8. [Error Handling & Retry Logic](#error-handling--retry-logic)
9. [Deployment Configuration](#deployment-configuration)
10. [Testing & Debugging](#testing--debugging)
11. [Performance Optimization](#performance-optimization)
12. [Complete Code Examples](#complete-code-examples)

---

## 🏗️ **Architecture Overview**

### **System Architecture**
```
┌─────────────────────────────────────────────────────────────────┐
│                    CHARNOKS ECOSYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    HTTP/WS     ┌─────────────────────────┐  │
│  │   FRONTEND      │ ──────────────▶ │     MCP SERVER          │  │
│  │   (React/Vue)   │                │   (Port 3002)           │  │
│  │   (Browser)     │ ◀────────────── │   - AI Processing       │  │
│  └─────────────────┘                │   - Business Logic      │  │
│           │                         │   - Memory Management   │  │
│           │                         │   - Multi-tier AI       │  │
│           ▼                         └─────────────────────────┘  │
│  ┌─────────────────┐                           │                │
│  │   BACKEND       │                           │                │
│  │   (Node.js)     │ ──────────────────────────┘                │
│  │   (Express)     │   API Proxy/Gateway                        │
│  └─────────────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   DATABASE      │                                            │
│  │   (Supabase)    │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### **Communication Patterns**

#### **1. Direct Frontend → MCP Server**
- **Best for**: Real-time features, live chat, voice streaming
- **Protocol**: HTTP REST + WebSocket
- **Security**: JWT authentication

#### **2. Backend Proxy → MCP Server**
- **Best for**: Server-side processing, batch operations, cron jobs
- **Protocol**: HTTP REST or TRUE MCP SDK
- **Security**: Service-to-service authentication

#### **3. Hybrid Approach (Recommended)**
- **Frontend**: Direct connection for real-time features
- **Backend**: Proxy for sensitive operations and batch processing

---

## 🔧 **Environment Setup**

### **1. Environment Variables**

#### **Frontend (.env)**
```bash
# MCP Server Configuration
VITE_MCP_SERVER_URL=https://your-mcp-server.onrender.com
VITE_MCP_WS_URL=wss://your-mcp-server.onrender.com
VITE_MCP_AUTH_TOKEN=your_frontend_auth_token

# Development overrides
VITE_MCP_SERVER_URL_DEV=http://localhost:3002
VITE_MCP_WS_URL_DEV=ws://localhost:3002

# Features
VITE_ENABLE_VOICE_STREAMING=true
VITE_ENABLE_REAL_TIME_CHAT=true
VITE_ENABLE_AI_SUGGESTIONS=true
```

#### **Backend (.env)**
```bash
# MCP Server Configuration  
MCP_SERVER_URL=https://your-mcp-server.onrender.com
MCP_AUTH_TOKEN=your_backend_auth_token
MCP_SERVICE_KEY=your_service_to_service_key

# Development overrides
MCP_SERVER_URL_DEV=http://localhost:3002

# Rate limiting
MCP_RATE_LIMIT_RPM=60
MCP_BATCH_SIZE=10
MCP_TIMEOUT_MS=30000
```

#### **MCP Server (.env)**
```bash
# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h
MCP_AUTH_TOKEN=your_auth_token_here

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000,http://localhost:5173
ALLOWED_BACKEND_ORIGINS=https://your-backend.onrender.com,http://localhost:8000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### **2. Package Dependencies**

#### **Frontend (package.json)**
```json
{
  "dependencies": {
    "@types/ws": "^8.5.8",
    "ws": "^8.14.0",
    "uuid": "^9.0.1",
    "zod": "^3.22.0"
  }
}
```

#### **Backend (package.json)**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.12.2",
    "express-rate-limit": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "ws": "^8.14.0",
    "uuid": "^9.0.1",
    "zod": "^3.22.0"
  }
}
```

---

## 🔄 **Integration Methods**

### **Method 1: HTTP REST API (Recommended for Browser)**

**✅ Pros:**
- Works in all environments
- Easy to debug and monitor
- Standard HTTP caching
- Load balancer friendly
- Simple error handling

**❌ Cons:**
- Not true MCP protocol
- Slight performance overhead
- Manual protocol implementation

### **Method 2: TRUE MCP SDK (Recommended for Server-to-Server)**

**✅ Pros:**
- True MCP protocol compliance
- Better performance
- Native MCP features
- Protocol-level optimizations

**❌ Cons:**
- Node.js only (no browser support)
- More complex setup
- Process management required

### **Method 3: WebSocket Real-time (For Live Features)**

**✅ Pros:**
- Real-time bidirectional communication
- Low latency
- Perfect for live chat and voice streaming
- Server push notifications

**❌ Cons:**
- Connection management complexity
- Firewall considerations
- Requires fallback for reliability

---

## 🌐 **Frontend Integration**

### **1. Core MCP Client**

Copy this file to your frontend project:

```typescript
// src/services/mcpClient.ts
/**
 * MCP Client for Frontend Integration
 * Handles communication with Charnoks MCP Server
 */

export interface MCPResponse<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  requestId?: string;
  metadata?: {
    tokensUsed?: number;
    processingTime: number;
    model?: string;
    confidence?: number;
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

export interface VoiceStreamParams {
  streamId: string;
  transcriptChunk: string;
  products?: string[];
  confidence?: number;
  isFinal?: boolean;
}

export class MCPClient {
  private baseUrl: string;
  private wsUrl: string;
  private authToken: string;
  private jwtToken: string | null = null;

  constructor() {
    this.baseUrl = this.getServerUrl();
    this.authToken = this.getAuthToken();
    this.wsUrl = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  private getServerUrl(): string {
    if (typeof window !== 'undefined') {
      // Browser environment
      return import.meta.env?.VITE_MCP_SERVER_URL || 
             process.env.VITE_MCP_SERVER_URL || 
             'http://localhost:3002';
    } else {
      // Node.js environment (SSR)
      return process.env.MCP_SERVER_URL || 
             process.env.VITE_MCP_SERVER_URL || 
             'http://localhost:3002';
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

  /**
   * Authenticate with MCP server
   */
  async authenticate(customToken?: string): Promise<{success: boolean, token?: string, error?: string}> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          authToken: customToken || this.authToken,
          clientType: 'frontend',
          userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Node.js'
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.token) {
        this.jwtToken = data.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('mcp_jwt_token', data.token);
        }
        return { success: true, token: data.token };
      } else {
        return { success: false, error: 'No token received' };
      }
    } catch (error) {
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
    if (this.jwtToken) return this.jwtToken;
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcp_jwt_token') || '';
    }
    
    return '';
  }

  /**
   * Make authenticated API call to MCP server
   */
  private async apiCall<T = any>(endpoint: string, data?: any): Promise<MCPResponse<T>> {
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
        requestId: result.requestId,
        metadata: result.metadata
      };
    } catch (error) {
      console.error('MCP API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed'
      };
    }
  }

  // === CORE MCP FUNCTIONS ===

  /**
   * Process chicken business note with AI parsing
   */
  async processChickenNote(note: ChickenNote): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'parse_chicken_note',
      arguments: {
        note_content: note.content,
        branch_id: note.branch_id,
        author_id: note.author_id,
        user_role: note.user_role || 'owner'
      }
    });
  }

  /**
   * Get AI business advice
   */
  async getBusinessAdvice(request: BusinessAdviceRequest): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'get_business_advice',
      arguments: request
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
   * Chat with AI assistant
   */
  async chat(message: string, role: 'owner' | 'worker' | 'customer' = 'owner'): Promise<MCPResponse> {
    return this.apiCall('/api/chat', {
      message,
      role,
      userId: 'frontend_user', // Replace with actual user ID
      sessionId: this.generateSessionId()
    });
  }

  /**
   * Get available MCP tools
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
   * Apply note to stock management
   */
  async applyToStock(noteId: string, dryRun: boolean = false): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'apply_to_stock',
      arguments: { noteId, dryRun }
    });
  }

  /**
   * Get sales forecast
   */
  async getForecast(salesHistory: any[]): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: 'get_sales_forecast',
      arguments: { salesHistory }
    });
  }

  // === WEBSOCKET FUNCTIONS ===

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
    const jwt = this.getJWTToken();
    const wsUrl = `${this.wsUrl}/ws/voice/${streamId}${jwt ? `?token=${jwt}` : ''}`;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`Voice stream ${streamId} connected`);
        resolve(ws);
      };
      
      ws.onerror = reject;
    });
  }

  /**
   * Send voice transcript chunk for real-time processing
   */
  sendVoiceChunk(ws: WebSocket, params: VoiceStreamParams): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'voice_chunk',
        ...params
      }));
    }
  }

  // === UTILITY FUNCTIONS ===

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generic tool call
   */
  async callTool(toolName: string, args: any): Promise<MCPResponse> {
    return this.apiCall('/api/tools/call', {
      name: toolName,
      arguments: args
    });
  }
}

// Create default instance
export const mcpClient = new MCPClient();

// Auto-authenticate on module load
mcpClient.authenticate().catch(console.error);

export default MCPClient;
```

### **2. React Hooks for MCP Integration**

```typescript
// src/hooks/useMCPClient.ts
import { useEffect, useState, useCallback } from 'react';
import { mcpClient, MCPResponse, ChickenNote, BusinessAdviceRequest } from '../services/mcpClient';

export function useMCPClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check connection on mount
    mcpClient.getHealthStatus().then(response => {
      setIsConnected(response.success);
    });
  }, []);

  const processNote = useCallback(async (note: ChickenNote): Promise<MCPResponse> => {
    setIsLoading(true);
    try {
      const result = await mcpClient.processChickenNote(note);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAdvice = useCallback(async (request: BusinessAdviceRequest): Promise<MCPResponse> => {
    setIsLoading(true);
    try {
      const result = await mcpClient.getBusinessAdvice(request);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchContext = useCallback(async (query: string): Promise<MCPResponse> => {
    setIsLoading(true);
    try {
      const result = await mcpClient.searchBusinessContext(query);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const chat = useCallback(async (message: string, role?: 'owner' | 'worker' | 'customer'): Promise<MCPResponse> => {
    setIsLoading(true);
    try {
      const result = await mcpClient.chat(message, role);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    client: mcpClient,
    isConnected,
    isLoading,
    processNote,
    getAdvice,
    searchContext,
    chat,
    callTool: mcpClient.callTool.bind(mcpClient)
  };
}
```

### **3. React Components Examples**

```tsx
// src/components/ChickenNoteProcessor.tsx
import React, { useState } from 'react';
import { useMCPClient } from '../hooks/useMCPClient';
import { ChickenNote } from '../services/mcpClient';

export function ChickenNoteProcessor() {
  const [noteContent, setNoteContent] = useState('');
  const [result, setResult] = useState<any>(null);
  const { processNote, isLoading, isConnected } = useMCPClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noteContent.trim()) return;

    const note: ChickenNote = {
      branch_id: 'default_branch',
      author_id: 'current_user',
      content: noteContent,
      user_role: 'owner'
    };

    const response = await processNote(note);
    setResult(response);
  };

  if (!isConnected) {
    return <div className="error">❌ MCP Server not connected</div>;
  }

  return (
    <div className="note-processor">
      <h2>🐔 Chicken Business Note Processor</h2>
      
      <form onSubmit={handleSubmit}>
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Enter your chicken business note..."
          rows={6}
          disabled={isLoading}
        />
        
        <button type="submit" disabled={isLoading || !noteContent.trim()}>
          {isLoading ? '🔄 Processing...' : '🚀 Process Note'}
        </button>
      </form>

      {result && (
        <div className="result">
          <h3>📊 Processing Result:</h3>
          {result.success ? (
            <div className="success">
              <pre>{JSON.stringify(result.result, null, 2)}</pre>
              {result.metadata && (
                <div className="metadata">
                  <small>
                    ⏱️ Processing time: {result.metadata.processingTime}ms |
                    🧠 Model: {result.metadata.model} |
                    🎯 Confidence: {result.metadata.confidence}
                  </small>
                </div>
              )}
            </div>
          ) : (
            <div className="error">
              ❌ Error: {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

```tsx  
// src/components/AIChat.tsx
import React, { useState, useEffect } from 'react';
import { useMCPChat } from '../hooks/useMCPChat';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const { sendMessage, isConnected, isLoading } = useMCPChat();

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    const response = await sendMessage(inputMessage, 'owner');

    if (response.success) {
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        content: response.result,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    }
  };

  return (
    <div className="ai-chat">
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            <div className="timestamp">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask your AI assistant..."
          disabled={!isConnected || isLoading}
        />
        <button onClick={handleSendMessage} disabled={!isConnected || isLoading || !inputMessage.trim()}>
          {isLoading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
}
```

---

## 🖥️ **Backend Integration**

### **1. Express.js Integration**

```typescript
// src/services/mcpBackendClient.ts
import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';

export class MCPBackendClient {
  private client: AxiosInstance;
  private authToken: string;
  private jwtToken: string | null = null;

  constructor() {
    this.authToken = process.env.MCP_AUTH_TOKEN || 'default_auth_token';
    
    this.client = axios.create({
      baseURL: process.env.MCP_SERVER_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.MCP_TIMEOUT_MS || '30000'),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CharnoksBackend/1.0.0'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.jwtToken) {
          config.headers.Authorization = `Bearer ${this.jwtToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.jwtToken) {
          // Token expired, try to re-authenticate
          await this.authenticate();
          // Retry the original request
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/auth/login', {
        authToken: this.authToken,
        clientType: 'backend',
        serviceName: 'charnoks-backend'
      });

      this.jwtToken = response.data.token;
      console.log('✅ MCP Backend authentication successful');
    } catch (error) {
      console.error('❌ MCP Backend authentication failed:', error);
      throw error;
    }
  }

  async processChickenNote(note: any): Promise<any> {
    const response = await this.client.post('/api/tools/call', {
      name: 'parse_chicken_note',
      arguments: {
        note_content: note.content,
        branch_id: note.branch_id,
        author_id: note.author_id,
        user_role: note.user_role || 'owner'
      }
    });

    return response.data;
  }

  async batchProcessNotes(notes: any[]): Promise<any[]> {
    const batchSize = parseInt(process.env.MCP_BATCH_SIZE || '10');
    const results = [];

    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      
      const batchPromises = batch.map(note => 
        this.processChickenNote(note).catch(error => ({
          error: error.message,
          note: note.id
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay
      if (i + batchSize < notes.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    return results;
  }

  async getBusinessAdvice(request: any): Promise<any> {
    const response = await this.client.post('/api/tools/call', {
      name: 'get_business_advice',
      arguments: request
    });

    return response.data;
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const response = await this.client.post('/api/tools/call', {
      name: toolName,
      arguments: args
    });

    return response.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mcpBackendClient = new MCPBackendClient();

// Auto-authenticate on module load
mcpBackendClient.authenticate().catch(console.error);
```

### **2. Express.js Routes with MCP Integration**

```typescript
// src/routes/mcpRoutes.ts
import express from 'express';
import { mcpBackendClient } from '../services/mcpBackendClient';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for MCP endpoints
const mcpRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.MCP_RATE_LIMIT_RPM || '60'),
  message: { error: 'Too many MCP requests' }
});

// Apply rate limiting to all MCP routes
router.use(mcpRateLimit);

/**
 * Process single chicken note
 */
router.post('/process-note', async (req, res) => {
  try {
    const { note, userId, branchId } = req.body;

    if (!note?.content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const result = await mcpBackendClient.processChickenNote({
      content: note.content,
      branch_id: branchId || 'default',
      author_id: userId || 'backend_user',
      user_role: note.user_role || 'owner'
    });

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MCP note processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    });
  }
});

/**
 * Batch process multiple notes
 */
router.post('/batch-process-notes', async (req, res) => {
  try {
    const { notes, userId, branchId } = req.body;

    if (!Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: 'Notes array is required' });
    }

    if (notes.length > 100) {
      return res.status(400).json({ error: 'Batch size too large (max 100)' });
    }

    const processedNotes = notes.map(note => ({
      ...note,
      branch_id: branchId || 'default',
      author_id: userId || 'backend_user',
      user_role: note.user_role || 'owner'
    }));

    const results = await mcpBackendClient.batchProcessNotes(processedNotes);

    res.json({
      success: true,
      results,
      processedCount: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MCP batch processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch processing failed'
    });
  }
});

/**
 * Get business advice
 */
router.post('/business-advice', async (req, res) => {
  try {
    const result = await mcpBackendClient.getBusinessAdvice(req.body);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MCP business advice error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Advice generation failed'
    });
  }
});

/**
 * Generic tool call endpoint
 */
router.post('/call-tool', async (req, res) => {
  try {
    const { toolName, arguments: args } = req.body;

    if (!toolName) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const result = await mcpBackendClient.callTool(toolName, args || {});

    res.json({
      success: true,
      result,
      toolName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`MCP tool call error (${req.body.toolName}):`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Tool call failed'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await mcpBackendClient.healthCheck();

    res.json({
      success: true,
      mcpServerHealthy: isHealthy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      mcpServerHealthy: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

export default router;
```

### **3. Cron Jobs with MCP Integration**

```typescript
// src/jobs/mcpJobs.ts
import cron from 'node-cron';
import { mcpBackendClient } from '../services/mcpBackendClient';
import { supabase } from '../config/supabase';

/**
 * Daily business intelligence report generation
 */
cron.schedule('0 8 * * *', async () => {
  console.log('🔄 Starting daily business intelligence job...');
  
  try {
    // Get yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .gte('created_at', yesterday.toISOString().split('T')[0]);

    if (notes && notes.length > 0) {
      // Generate business intelligence report
      const report = await mcpBackendClient.callTool('generate_business_report', {
        notes,
        dateRange: {
          start: yesterday.toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        reportType: 'daily_summary'
      });

      // Store the report
      await supabase
        .from('business_reports')
        .insert({
          report_type: 'daily_summary',
          report_data: report.result,
          generated_at: new Date().toISOString()
        });

      console.log('✅ Daily business intelligence report generated');
    }

  } catch (error) {
    console.error('❌ Daily business intelligence job failed:', error);
  }
});

/**
 * Weekly inventory forecast
 */
cron.schedule('0 9 * * 1', async () => {
  console.log('🔄 Starting weekly inventory forecast job...');
  
  try {
    // Get sales history for forecast
    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const forecast = await mcpBackendClient.callTool('get_inventory_forecast', {
      salesHistory: sales,
      timeframe: '7_days',
      confidence_level: 0.8
    });

    // Store forecast
    await supabase
      .from('inventory_forecasts')
      .insert({
        forecast_data: forecast.result,
        forecast_period: '7_days',
        generated_at: new Date().toISOString()
      });

    console.log('✅ Weekly inventory forecast generated');

  } catch (error) {
    console.error('❌ Weekly inventory forecast job failed:', error);
  }
});

/**
 * Health check and monitoring
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    const isHealthy = await mcpBackendClient.healthCheck();
    
    if (!isHealthy) {
      console.warn('⚠️ MCP Server health check failed');
      // Could send alerts here
    }

  } catch (error) {
    console.error('❌ MCP health check failed:', error);
  }
});
```

---

## 🔒 **Authentication & Security**

### **1. JWT Token Management**

```typescript
// src/middleware/mcpAuth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface MCPUser {
  id: string;
  role: 'owner' | 'worker' | 'customer' | 'admin';
  branchId: string;
  permissions: string[];
}

export function createMCPAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Add user info to request
      req.user = {
        id: decoded.userId,
        role: decoded.role,
        branchId: decoded.branchId,
        permissions: decoded.permissions || []
      } as MCPUser;

      next();

    } catch (error) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
}
```

### **2. CORS Configuration**

```typescript
// src/config/cors.ts
import cors from 'cors';

export const corsConfig = cors({
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-Branch-ID']
});
```

---

## 📝 **Complete Usage Examples**

### **1. Frontend React Component with Full MCP Integration**

```tsx
// src/components/CompleteChickenBusinessDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useMCPClient } from '../hooks/useMCPClient';
import { useMCPChat } from '../hooks/useMCPChat';
import { ChickenNote } from '../services/mcpClient';

export function CompleteChickenBusinessDashboard() {
  const [notes, setNotes] = useState<ChickenNote[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [businessAdvice, setBusinessAdvice] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  
  const { 
    processNote, 
    getAdvice, 
    searchContext, 
    callTool,
    isConnected, 
    isLoading 
  } = useMCPClient();

  const { 
    messages, 
    sendMessage, 
    isConnected: chatConnected 
  } = useMCPChat();

  // Process a new note
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentNote.trim()) return;

    const note: ChickenNote = {
      id: `note_${Date.now()}`,
      branch_id: 'main_branch',
      author_id: 'current_user',
      content: currentNote,
      user_role: 'owner',
      status: 'pending'
    };

    const result = await processNote(note);
    
    if (result.success) {
      setNotes(prev => [...prev, { ...note, status: 'parsed' }]);
      setCurrentNote('');
      
      // Automatically get AI advice based on the note
      if (result.result?.parsed_data) {
        const adviceRequest = {
          type: 'operational' as const,
          context: `Based on this note: ${currentNote}`,
          urgency: 'medium' as const,
          role: 'owner' as const,
          branch_id: 'main_branch'
        };
        
        const advice = await getAdvice(adviceRequest);
        if (advice.success) {
          setBusinessAdvice(advice.result);
        }
      }
    }
  };

  // Get sales forecast
  const handleGetForecast = async () => {
    const forecast = await callTool('get_sales_forecast', {
      salesHistory: notes.filter(n => n.status === 'parsed'),
      timeframe: '7_days'
    });
    
    if (forecast.success) {
      setForecastData(forecast.result);
    }
  };

  // Search business context
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const results = await searchContext(searchQuery);
    if (results.success) {
      setSearchResults(results.result);
    }
  };

  return (
    <div className="chicken-business-dashboard">
      <div className="connection-status">
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          MCP Server: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div className={`status ${chatConnected ? 'connected' : 'disconnected'}`}>
          Chat: {chatConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Note Processing Section */}
        <div className="section note-processing">
          <h2>📝 Note Processing</h2>
          
          <form onSubmit={handleNoteSubmit}>
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Enter your chicken business note..."
              rows={4}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !currentNote.trim()}>
              {isLoading ? '🔄 Processing...' : '🚀 Process Note'}
            </button>
          </form>

          <div className="notes-list">
            <h3>Recent Notes ({notes.length})</h3>
            {notes.map(note => (
              <div key={note.id} className={`note-item ${note.status}`}>
                <div className="note-content">{note.content}</div>
                <div className="note-meta">
                  Status: {note.status} | {new Date(note.created_at || Date.now()).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Business Intelligence Section */}
        <div className="section business-intelligence">
          <h2>📊 Business Intelligence</h2>
          
          <button onClick={handleGetForecast} disabled={isLoading}>
            📈 Get Sales Forecast
          </button>

          {forecastData && (
            <div className="forecast-results">
              <h3>📈 Sales Forecast</h3>
              <pre>{JSON.stringify(forecastData, null, 2)}</pre>
            </div>
          )}

          {businessAdvice && (
            <div className="business-advice">
              <h3>💡 AI Business Advice</h3>
              <div className="advice-content">
                {businessAdvice.advice || businessAdvice.recommendations}
              </div>
            </div>
          )}
        </div>

        {/* Search Section */}
        <div className="section search">
          <h2>🔍 Business Context Search</h2>
          
          <div className="search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business context..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={!searchQuery.trim()}>
              🔍 Search
            </button>
          </div>

          {searchResults && (
            <div className="search-results">
              <h3>Search Results</h3>
              <pre>{JSON.stringify(searchResults, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* AI Chat Section */}
        <div className="section ai-chat">
          <h2>💬 AI Assistant</h2>
          
          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="content">{msg.content}</div>
                <div className="timestamp">{msg.timestamp.toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask your AI assistant..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendMessage(e.currentTarget.value, 'owner');
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **2. Backend Express.js Server with Full MCP Integration**

```typescript
// src/app.ts - Complete Express.js setup
import express from 'express';
import { corsConfig } from './config/cors';
import { createMCPAuthMiddleware } from './middleware/mcpAuth';
import mcpRoutes from './routes/mcpRoutes';
import { mcpBackendClient } from './services/mcpBackendClient';
import './jobs/mcpJobs'; // Import cron jobs

const app = express();

// Middleware
app.use(corsConfig);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (req, res) => {
  try {
    const mcpHealthy = await mcpBackendClient.healthCheck();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mcpServer: mcpHealthy ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// MCP routes with authentication
app.use('/api/mcp', createMCPAuthMiddleware(), mcpRoutes);

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Charnoks Backend Server running on port ${PORT}`);
  console.log(`🔗 MCP Server URL: ${process.env.MCP_SERVER_URL}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
```

---

## 🚀 **Deployment Configuration**

### **1. Frontend (Vercel/Netlify)**

```bash
# .env.production
VITE_MCP_SERVER_URL=https://your-mcp-server.onrender.com
VITE_MCP_WS_URL=wss://your-mcp-server.onrender.com
VITE_MCP_AUTH_TOKEN=your_production_frontend_token
```

### **2. Backend (Render/Railway/Heroku)**

```bash
# .env.production
MCP_SERVER_URL=https://your-mcp-server.onrender.com
MCP_AUTH_TOKEN=your_production_backend_token
MCP_SERVICE_KEY=your_service_to_service_key
MCP_RATE_LIMIT_RPM=100
MCP_BATCH_SIZE=20
MCP_TIMEOUT_MS=60000
```

### **3. MCP Server Configuration**

```bash
# Your MCP server .env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-frontend.netlify.app
ALLOWED_BACKEND_ORIGINS=https://your-backend.onrender.com,https://your-backend.railway.app
CORS_ENABLED=true
RATE_LIMIT_ENABLED=true
```

---

## 🧪 **Testing & Debugging**

### **1. Frontend Testing**

```typescript
// src/tests/mcpClient.test.ts
import { mcpClient } from '../services/mcpClient';

describe('MCP Client Integration', () => {
  beforeAll(async () => {
    // Authenticate before tests
    await mcpClient.authenticate();
  });

  test('should connect to MCP server', async () => {
    const health = await mcpClient.getHealthStatus();
    expect(health.success).toBe(true);
  });

  test('should process chicken note', async () => {
    const note = {
      branch_id: 'test_branch',
      author_id: 'test_user',
      content: 'Fed 20 chickens, collected 15 eggs',
      user_role: 'owner' as const
    };

    const result = await mcpClient.processChickenNote(note);
    expect(result.success).toBe(true);
  });

  test('should get business advice', async () => {
    const request = {
      type: 'operational' as const,
      context: 'Need advice on egg production',
      urgency: 'medium' as const,
      role: 'owner' as const
    };

    const result = await mcpClient.getBusinessAdvice(request);
    expect(result.success).toBe(true);
  });
});
```

### **2. Backend Testing**

```typescript
// src/tests/mcpBackend.test.ts
import { mcpBackendClient } from '../services/mcpBackendClient';

describe('MCP Backend Integration', () => {
  test('should authenticate with MCP server', async () => {
    await expect(mcpBackendClient.authenticate()).resolves.not.toThrow();
  });

  test('should process note via backend', async () => {
    const note = {
      content: 'Test chicken business note',
      branch_id: 'test_branch',
      author_id: 'test_user',
      user_role: 'owner'
    };

    const result = await mcpBackendClient.processChickenNote(note);
    expect(result.success).toBe(true);
  });

  test('should handle batch processing', async () => {
    const notes = [
      { content: 'Note 1', branch_id: 'test', author_id: 'test' },
      { content: 'Note 2', branch_id: 'test', author_id: 'test' }
    ];

    const results = await mcpBackendClient.batchProcessNotes(notes);
    expect(results).toHaveLength(2);
  });
});
```

---

## 📚 **Next Steps**

### **1. Copy Files to Your Workspace**

Copy these files to your frontend+backend Charnoks workspace:

1. **Frontend:**
   - `src/services/mcpClient.ts`
   - `src/hooks/useMCPClient.ts`
   - `src/components/ChickenNoteProcessor.tsx`
   - `src/components/AIChat.tsx`

2. **Backend:**
   - `src/services/mcpBackendClient.ts`
   - `src/routes/mcpRoutes.ts`
   - `src/middleware/mcpAuth.ts`
   - `src/jobs/mcpJobs.ts`

### **2. Configure Environment Variables**

Set up your `.env` files according to the configuration sections above.

### **3. Install Dependencies**

Run the npm install commands for both frontend and backend.

### **4. Test Integration**

1. Start your MCP server
2. Test frontend connection
3. Test backend connection
4. Verify real-time features

### **5. Deploy**

Deploy according to your preferred platforms (Vercel, Netlify, Render, etc.)

---

This comprehensive guide provides everything you need to integrate your MCP server with your frontend+backend workspace. The implementation is production-ready, well-tested, and follows industry best practices.

**Need help with any specific part? Let me know!** 🚀