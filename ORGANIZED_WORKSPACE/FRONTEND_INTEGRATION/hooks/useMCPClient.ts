/**
 * 🪝 **COMPREHENSIVE MCP REACT HOOKS**
 * Complete collection of React hooks for MCP integration
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { mcpClient, MCPResponse, ChickenNote, BusinessAdviceRequest } from './mcpClient';
import { useMCPWebSocket, ChatMessage, MCPNotification, VoiceChunk } from './enhanced-mcp-websocket';

// === CORE MCP CLIENT HOOK ===

export interface MCPClientState {
  isConnected: boolean;
  isLoading: boolean;
  lastError: string | null;
  requestCount: number;
  successRate: number;
}

export function useMCPClient() {
  const [state, setState] = useState<MCPClientState>({
    isConnected: false,
    isLoading: false,
    lastError: null,
    requestCount: 0,
    successRate: 100
  });

  const successCount = useRef(0);

  // Check connection on mount
  useEffect(() => {
    mcpClient.getHealthStatus().then(response => {
      setState(prev => ({
        ...prev,
        isConnected: response.success,
        lastError: response.success ? null : response.error || 'Connection failed'
      }));
    });
  }, []);

  const updateStats = useCallback((success: boolean, error?: string) => {
    setState(prev => {
      const newRequestCount = prev.requestCount + 1;
      if (success) successCount.current++;
      
      return {
        ...prev,
        requestCount: newRequestCount,
        successRate: (successCount.current / newRequestCount) * 100,
        lastError: success ? null : error || 'Request failed'
      };
    });
  }, []);

  const processNote = useCallback(async (note: ChickenNote): Promise<MCPResponse> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await mcpClient.processChickenNote(note);
      updateStats(result.success, result.error);
      return result;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateStats]);

  const getAdvice = useCallback(async (request: BusinessAdviceRequest): Promise<MCPResponse> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await mcpClient.getBusinessAdvice(request);
      updateStats(result.success, result.error);
      return result;
    } finally {
      setState(prev => ({ ...prev, isLoading: false })); 
    }
  }, [updateStats]);

  const searchContext = useCallback(async (query: string, entityTypes?: string[]): Promise<MCPResponse> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await mcpClient.searchBusinessContext(query, entityTypes);
      updateStats(result.success, result.error);
      return result;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateStats]);

  const chat = useCallback(async (message: string, role?: 'owner' | 'worker' | 'customer'): Promise<MCPResponse> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await mcpClient.chat(message, role);
      updateStats(result.success, result.error);
      return result;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateStats]);

  const callTool = useCallback(async (toolName: string, args: any): Promise<MCPResponse> => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const result = await mcpClient.callTool(toolName, args);
      updateStats(result.success, result.error);
      return result;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateStats]);

  return {
    client: mcpClient,
    ...state,
    processNote,
    getAdvice,
    searchContext,
    chat,
    callTool
  };
}

// === CHICKEN NOTES MANAGEMENT HOOK ===

export interface ChickenNotesState {
  notes: ChickenNote[];
  isProcessing: boolean;
  processingResults: Record<string, MCPResponse>;
  filters: {
    status?: ChickenNote['status'];
    userRole?: ChickenNote['user_role'];
    branchId?: string;
    dateRange?: { start: Date; end: Date };
  };
}

export function useChickenNotes(branchId: string = 'default', userId: string = 'current_user') {
  const { processNote, isLoading } = useMCPClient();
  
  const [state, setState] = useState<ChickenNotesState>({
    notes: [],
    isProcessing: false,
    processingResults: {},
    filters: {}
  });

  const addNote = useCallback(async (content: string, userRole?: ChickenNote['user_role']) => {
    const note: ChickenNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      local_uuid: `local_${Date.now()}`,
      branch_id: branchId,
      author_id: userId,
      content,
      user_role: userRole || 'owner',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Add note to local state immediately
    setState(prev => ({
      ...prev,
      notes: [note, ...prev.notes],
      isProcessing: true
    }));

    try {
      // Process with MCP
      const result = await processNote(note);
      
      // Update note status and store result
      setState(prev => ({
        ...prev,
        notes: prev.notes.map(n => 
          n.id === note.id 
            ? { ...n, status: result.success ? 'parsed' : 'pending' }
            : n
        ),
        processingResults: {
          ...prev.processingResults,
          [note.id!]: result
        },
        isProcessing: false
      }));

      return { note, result };

    } catch (error) {
      setState(prev => ({
        ...prev,
        notes: prev.notes.map(n => 
          n.id === note.id 
            ? { ...n, status: 'pending' }
            : n
        ),
        isProcessing: false
      }));
      throw error;
    }
  }, [branchId, userId, processNote]);

  const updateNote = useCallback((noteId: string, updates: Partial<ChickenNote>) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(note => 
        note.id === noteId ? { ...note, ...updates } : note
      )
    }));
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.filter(note => note.id !== noteId),
      processingResults: { ...prev.processingResults, [noteId]: undefined }
    }));
  }, []);

  const setFilters = useCallback((filters: Partial<ChickenNotesState['filters']>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  const filteredNotes = useMemo(() => {
    return state.notes.filter(note => {
      if (state.filters.status && note.status !== state.filters.status) return false;
      if (state.filters.userRole && note.user_role !== state.filters.userRole) return false;
      if (state.filters.branchId && note.branch_id !== state.filters.branchId) return false;
      
      if (state.filters.dateRange) {
        const noteDate = new Date(note.created_at || 0);
        if (noteDate < state.filters.dateRange.start || noteDate > state.filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
  }, [state.notes, state.filters]);

  const reprocessNote = useCallback(async (noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const result = await processNote(note);
      
      setState(prev => ({
        ...prev,
        notes: prev.notes.map(n => 
          n.id === noteId 
            ? { ...n, status: result.success ? 'parsed' : 'pending' }
            : n
        ),
        processingResults: {
          ...prev.processingResults,
          [noteId]: result
        },
        isProcessing: false
      }));

      return result;
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  }, [state.notes, processNote]);

  const clearNotes = useCallback(() => {
    setState(prev => ({
      ...prev,
      notes: [],
      processingResults: {}
    }));
  }, []);

  return {
    notes: filteredNotes,
    allNotes: state.notes,
    isProcessing: state.isProcessing || isLoading,
    processingResults: state.processingResults,
    filters: state.filters,
    addNote,
    updateNote,
    deleteNote,
    reprocessNote,
    setFilters,
    clearNotes,
    totalNotes: state.notes.length,
    filteredCount: filteredNotes.length
  };
}

// === BUSINESS INTELLIGENCE HOOK ===

export interface BusinessIntelligence {
  forecasts: any[];
  recommendations: any[];
  alerts: any[];
  insights: any[];
  isLoading: boolean;
  lastUpdate: Date | null;
}

export function useBusinessIntelligence(branchId: string = 'default') {
  const { getAdvice, callTool } = useMCPClient();
  
  const [intelligence, setIntelligence] = useState<BusinessIntelligence>({
    forecasts: [],
    recommendations: [],
    alerts: [],
    insights: [],
    isLoading: false,
    lastUpdate: null
  });

  const generateForecast = useCallback(async (salesHistory: any[], timeframe: string = '7_days') => {
    setIntelligence(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await callTool('get_sales_forecast', {
        salesHistory,
        timeframe,
        branch_id: branchId
      });

      if (result.success) {
        setIntelligence(prev => ({
          ...prev,
          forecasts: [result.result, ...prev.forecasts.slice(0, 4)], // Keep last 5
          lastUpdate: new Date(),
          isLoading: false
        }));
      }

      return result;
    } catch (error) {
      setIntelligence(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [callTool, branchId]);

  const getOperationalAdvice = useCallback(async (context: string, urgency: 'low' | 'medium' | 'high' = 'medium') => {
    const request: BusinessAdviceRequest = {
      type: 'operational',
      context,
      urgency,
      role: 'owner',
      branch_id: branchId
    };

    setIntelligence(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await getAdvice(request);
      
      if (result.success) {
        setIntelligence(prev => ({
          ...prev,
          recommendations: [result.result, ...prev.recommendations.slice(0, 9)], // Keep last 10
          lastUpdate: new Date(),
          isLoading: false
        }));
      }

      return result;
    } catch (error) {
      setIntelligence(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [getAdvice, branchId]);

  const generateInsights = useCallback(async (notes: ChickenNote[]) => {
    setIntelligence(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await callTool('generate_business_insights', {
        notes,
        branch_id: branchId,
        analysis_type: 'comprehensive'
      });

      if (result.success) {
        setIntelligence(prev => ({
          ...prev,
          insights: [result.result, ...prev.insights.slice(0, 4)], // Keep last 5
          lastUpdate: new Date(),
          isLoading: false
        }));
      }

      return result;
    } catch (error) {
      setIntelligence(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [callTool, branchId]);

  const clearIntelligence = useCallback(() => {
    setIntelligence({
      forecasts: [],
      recommendations: [],
      alerts: [],
      insights: [],
      isLoading: false,
      lastUpdate: null
    });
  }, []);

  return {
    ...intelligence,
    generateForecast,
    getOperationalAdvice,
    generateInsights,
    clearIntelligence
  };
}

// === VOICE STREAMING HOOK ===

export interface VoiceStreamState {
  isStreaming: boolean;
  isProcessing: boolean;
  currentStreamId: string | null;
  transcriptChunks: VoiceChunk[];
  finalResults: any[];
  error: string | null;
}

export function useVoiceStream() {
  const { 
    startVoiceStream, 
    sendVoiceChunk, 
    endVoiceStream, 
    isConnected,
    client 
  } = useMCPWebSocket();

  const [state, setState] = useState<VoiceStreamState>({
    isStreaming: false,
    isProcessing: false,
    currentStreamId: null,
    transcriptChunks: [],
    finalResults: [],
    error: null
  });

  // Listen for voice results
  useEffect(() => {
    const handleVoiceResult = (result: any) => {
      setState(prev => ({
        ...prev,
        finalResults: [result, ...prev.finalResults.slice(0, 9)], // Keep last 10
        isProcessing: false
      }));
    };

    client.on('voiceResult', handleVoiceResult);

    return () => {
      client.off('voiceResult', handleVoiceResult);
    };
  }, [client]);

  const startStream = useCallback(() => {
    if (!isConnected) {
      setState(prev => ({ ...prev, error: 'Not connected to WebSocket' }));
      return;
    }

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setState(prev => ({
      ...prev,
      isStreaming: true,
      currentStreamId: streamId,
      transcriptChunks: [],
      error: null
    }));

    startVoiceStream(streamId);
    return streamId;
  }, [isConnected, startVoiceStream]);

  const sendChunk = useCallback((transcript: string, confidence: number = 0.8, isFinal: boolean = false) => {
    if (!state.currentStreamId) {
      setState(prev => ({ ...prev, error: 'No active stream' }));
      return;
    }

    const chunk: VoiceChunk = {
      streamId: state.currentStreamId,
      transcript,
      confidence,
      isFinal,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      transcriptChunks: [...prev.transcriptChunks, chunk],
      isProcessing: isFinal
    }));

    sendVoiceChunk(chunk);
  }, [state.currentStreamId, sendVoiceChunk]);

  const stopStream = useCallback(() => {
    if (state.currentStreamId) {
      endVoiceStream(state.currentStreamId);
    }

    setState(prev => ({
      ...prev,
      isStreaming: false,
      currentStreamId: null,
      isProcessing: false
    }));
  }, [state.currentStreamId, endVoiceStream]);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcriptChunks: [],
      finalResults: [],
      error: null
    }));
  }, []);

  return {
    ...state,
    isConnected,
    startStream,
    sendChunk,
    stopStream,
    clearResults,
    currentTranscript: state.transcriptChunks.map(c => c.transcript).join(' ')
  };
}

// === NOTIFICATION MANAGEMENT HOOK ===

export function useNotifications() {
  const { notifications, clearNotifications } = useMCPWebSocket();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleNotifications = useMemo(() => {
    return notifications.filter(n => !dismissed.has(n.id));
  }, [notifications, dismissed]);

  const dismissNotification = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  const dismissAll = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setDismissed(new Set(allIds));
  }, [notifications]);

  const clearAll = useCallback(() => {
    clearNotifications();
    setDismissed(new Set());
  }, [clearNotifications]);

  const getUnreadCount = useCallback((type?: MCPNotification['type']) => {
    return visibleNotifications.filter(n => 
      !type || n.type === type
    ).length;
  }, [visibleNotifications]);

  const getActionRequiredCount = useCallback(() => {
    return visibleNotifications.filter(n => n.actionRequired).length;
  }, [visibleNotifications]);

  return {
    notifications: visibleNotifications,
    allNotifications: notifications,
    dismissNotification,
    dismissAll,
    clearAll,
    getUnreadCount,
    getActionRequiredCount,
    hasUnread: visibleNotifications.length > 0,
    hasActionRequired: visibleNotifications.some(n => n.actionRequired)
  };
}

// === REAL-TIME CHAT HOOK ===

export function useMCPChat(options?: {
  autoConnect?: boolean;
  userId?: string;
  sessionId?: string;
  maxMessages?: number;
}) {
  const wsHook = useMCPWebSocket({
    autoConnect: options?.autoConnect,
    userId: options?.userId, 
    sessionId: options?.sessionId
  });

  const [isTyping, setIsTyping] = useState(false);
  const maxMessages = options?.maxMessages || 100;

  // Limit messages to prevent memory issues
  const limitedMessages = useMemo(() => {
    if (wsHook.messages.length <= maxMessages) {
      return wsHook.messages;
    }
    return wsHook.messages.slice(-maxMessages);
  }, [wsHook.messages, maxMessages]);

  const sendMessage = useCallback(async (content: string, role?: 'owner' | 'worker' | 'customer') => {
    setIsTyping(true);
    
    try {
      wsHook.sendMessage(content, role);
      
      // Simulate AI typing indicator
      setTimeout(() => {
        setIsTyping(false);
      }, 2000);

    } catch (error) {
      setIsTyping(false);
      throw error;
    }
  }, [wsHook.sendMessage]);

  return {
    ...wsHook,
    messages: limitedMessages,
    sendMessage,
    isTyping,
    messageCount: limitedMessages.length,
    hasReachedLimit: wsHook.messages.length > maxMessages
  };
}

// === COMPOSITE DASHBOARD HOOK ===

export function useChickenBusinessDashboard(branchId: string = 'default', userId: string = 'current_user') {
  const mcpClient = useMCPClient();
  const chickenNotes = useChickenNotes(branchId, userId);
  const businessIntelligence = useBusinessIntelligence(branchId);
  const voiceStream = useVoiceStream();
  const notifications = useNotifications();
  const chat = useMCPChat({ userId });

  // Auto-generate insights when notes are added
  useEffect(() => {
    if (chickenNotes.notes.length > 0 && chickenNotes.notes.length % 5 === 0) {
      businessIntelligence.generateInsights(chickenNotes.notes);
    }
  }, [chickenNotes.notes.length, businessIntelligence.generateInsights, chickenNotes.notes]);

  const dashboardStats = useMemo(() => ({
    totalNotes: chickenNotes.totalNotes,
    processedNotes: chickenNotes.notes.filter(n => n.status === 'parsed').length,
    pendingNotes: chickenNotes.notes.filter(n => n.status === 'pending').length,
    recentRecommendations: businessIntelligence.recommendations.length,
    unreadNotifications: notifications.getUnreadCount(),
    actionRequiredNotifications: notifications.getActionRequiredCount(),
    chatMessages: chat.messageCount,
    isFullyConnected: mcpClient.isConnected && chat.isConnected,
    successRate: mcpClient.successRate
  }), [
    chickenNotes,
    businessIntelligence.recommendations.length,
    notifications,
    chat.messageCount,
    mcpClient.isConnected,
    mcpClient.successRate,
    chat.isConnected
  ]);

  return {
    // Individual hooks
    mcpClient,
    chickenNotes, 
    businessIntelligence,
    voiceStream,
    notifications,
    chat,
    
    // Dashboard-specific data
    dashboardStats,
    
    // Overall loading state
    isLoading: mcpClient.isLoading || chickenNotes.isProcessing || businessIntelligence.isLoading,
    
    // Overall connection state
    isConnected: mcpClient.isConnected && chat.isConnected
  };
}

export default {
  useMCPClient,
  useChickenNotes,
  useBusinessIntelligence,
  useVoiceStream,
  useNotifications,
  useMCPChat,
  useChickenBusinessDashboard
};