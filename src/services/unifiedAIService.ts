import { chickenBusinessAI } from './chickenBusinessAI.js';
import { aiStoreAdvisor } from './aiStoreAdvisor.js';
import { chickenMemoryService } from './chickenMemoryService.js';
import { AdvancedGeminiProxy } from '../advanced-gemini-proxy.js';

export interface ChatContext {
  userId: string;
  role: 'customer' | 'worker' | 'owner' | 'admin';
  sessionId: string;
  conversationHistory: ChatMessage[];
  businessContext: any;
  currentWorkflow?: string;
}

export interface ChatMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'voice' | 'action';
  metadata?: any;
}

export interface AIResponse {
  content: string;
  actions?: AIAction[];
  suggestions?: string[];
  toolCalls?: any[];
  confidence: number;
  reasoning?: string;
}

export interface AIAction {
  type: 'stock_update' | 'create_note' | 'generate_report' | 'voice_response';
  parameters: any;
  description: string;
}

export class UnifiedAIService {
  private geminiProxy: AdvancedGeminiProxy;
  private activeSessions: Map<string, ChatContext> = new Map();
  private patternLearning: Map<string, any[]> = new Map();

  constructor() {
    this.geminiProxy = new AdvancedGeminiProxy();
  }

  /**
   * Main chat interface - processes user input and generates contextual responses
   */
  async processChat(
    userId: string,
    message: string,
    context: Partial<ChatContext>
  ): Promise<AIResponse> {
    try {
      // Get or create session context
      const sessionContext = await this.getOrCreateSession(userId, context);
      
      // Add user message to history
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        role: 'user',
        content: message,
        type: 'text'
      };
      sessionContext.conversationHistory.push(userMessage);

      // Analyze user intent and context
      const intent = await this.analyzeUserIntent(message, sessionContext);
      
      // Generate role-based response
      const response = await this.generateRoleBasedResponse(intent, sessionContext);
      
      // Execute any required actions
      const actions = await this.executeAIActions(response.actions || [], sessionContext);
      
      // Learn from interaction
      await this.learnFromInteraction(sessionContext, intent, response);
      
      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        role: 'assistant',
        content: response.content,
        type: 'text',
        metadata: { intent, actions }
      };
      sessionContext.conversationHistory.push(assistantMessage);

      // Update session
      this.activeSessions.set(sessionContext.sessionId, sessionContext);
      
      return response;
    } catch (error) {
      console.error('Error in processChat:', error);
      return {
        content: "I apologize, but I encountered an error. Please try again.",
        confidence: 0,
        actions: []
      };
    }
  }

  /**
   * Analyze user intent based on message and context
   */
  private async analyzeUserIntent(message: string, context: ChatContext): Promise<any> {
    const systemPrompt = this.buildIntentAnalysisPrompt(context.role);
    
    const response = await this.geminiProxy.generateContent([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze intent for: "${message}"` }
    ]);

    try {
      return JSON.parse(response.content);
    } catch {
      // Fallback to simple classification
      return {
        category: this.classifySimpleIntent(message),
        confidence: 0.7,
        entities: [],
        actions: []
      };
    }
  }

  /**
   * Generate responses based on user role and context
   */
  private async generateRoleBasedResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    switch (context.role) {
      case 'customer':
        return this.generateCustomerResponse(intent, context);
      case 'worker':
        return this.generateWorkerResponse(intent, context);
      case 'owner':
        return this.generateOwnerResponse(intent, context);
      case 'admin':
        return this.generateAdminResponse(intent, context);
      default:
        return this.generateGenericResponse(intent, context);
    }
  }

  /**
   * Customer service enhanced responses
   */
  private async generateCustomerResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    // Get relevant business context
    const businessInfo = await chickenMemoryService.searchSimilar(intent.query || '', 5);
    
    const systemPrompt = `You are Charnoks' helpful customer service AI. You have access to our business information and can help customers with:
    - Product information and availability
    - Store hours and location
    - Order status and inquiries
    - General business questions
    
    Business Context: ${JSON.stringify(businessInfo)}
    
    Always be friendly, helpful, and professional. If you can't answer something, offer to connect them with a human representative.`;

    const response = await this.geminiProxy.generateContent([
      { role: 'system', content: systemPrompt },
      ...context.conversationHistory.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ]);

    return {
      content: response.content,
      confidence: response.confidence || 0.8,
      suggestions: [
        "Would you like to know our current specials?",
        "Can I help you with anything else?",
        "Would you like to speak with a team member?"
      ]
    };
  }

  /**
   * Worker assistant responses with voice and workflow support
   */
  private async generateWorkerResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    const actions: AIAction[] = [];
    let content = '';

    // Check if this is a stock-related request
    if (intent.category === 'stock_management') {
      const stockAction = await this.handleStockRequest(intent, context);
      actions.push(stockAction);
      content = `I'll help you with that stock update. ${stockAction.description}`;
    }
    // Check if this is a note/voice input
    else if (intent.category === 'voice_input' || intent.category === 'note_taking') {
      const noteAction = await this.handleNoteInput(intent, context);
      actions.push(noteAction);
      content = `I've processed your input and updated the system. ${noteAction.description}`;
    }
    // General worker assistance
    else {
      const workerAdvice = await aiStoreAdvisor.getWorkerAdvice(intent.query || '');
      content = workerAdvice.advice;
    }

    return {
      content,
      actions,
      confidence: 0.9,
      suggestions: [
        "Need help with stock updates?",
        "Want to record a voice note?",
        "Any issues to report?"
      ]
    };
  }

  /**
   * Owner dashboard and business insights
   */
  private async generateOwnerResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    // Get business insights and analytics
    const businessAnalysis = await aiStoreAdvisor.getBusinessAdvice(intent.query || '');
    const recentPatterns = await chickenBusinessAI.getRecentPatterns();
    
    const systemPrompt = `You are the business intelligence AI for Charnoks' owner. Provide strategic insights, analytics, and recommendations based on:
    
    Current Business Analysis: ${JSON.stringify(businessAnalysis)}
    Recent Patterns: ${JSON.stringify(recentPatterns)}
    
    Focus on actionable insights, trends, forecasts, and strategic recommendations.`;

    const response = await this.geminiProxy.generateContent([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: intent.query || context.conversationHistory.slice(-1)[0]?.content }
    ]);

    return {
      content: response.content,
      confidence: 0.9,
      suggestions: [
        "Show me today's sales analysis",
        "What are the trending patterns?",
        "Generate a forecast report"
      ],
      toolCalls: businessAnalysis.recommendedActions
    };
  }

  /**
   * Admin pattern learning and system optimization
   */
  private async generateAdminResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    const actions: AIAction[] = [];
    let content = '';

    if (intent.category === 'pattern_learning') {
      // Analyze system patterns and suggest optimizations
      const patterns = await this.analyzeSystemPatterns();
      actions.push({
        type: 'generate_report',
        parameters: { type: 'pattern_analysis', data: patterns },
        description: 'Generated pattern analysis report'
      });
      content = `I've analyzed system patterns and found ${patterns.optimizations.length} potential optimizations.`;
    } else if (intent.category === 'ai_training') {
      // Help with AI training and fine-tuning
      const trainingData = await this.prepareTrainingData();
      content = `Prepared training dataset with ${trainingData.samples} samples. Ready for model fine-tuning.`;
    } else {
      // General admin assistance
      const systemStatus = await this.getSystemStatus();
      content = `System Status: ${systemStatus.health}. ${systemStatus.recommendations.join(' ')}`;
    }

    return {
      content,
      actions,
      confidence: 0.95,
      suggestions: [
        "Analyze workflow patterns",
        "Optimize AI responses",
        "Review system performance"
      ]
    };
  }

  /**
   * Handle stock-related requests with tool integration
   */
  private async handleStockRequest(intent: any, context: ChatContext): Promise<AIAction> {
    // Extract stock information from intent
    const stockInfo = intent.entities.find((e: any) => e.type === 'product');
    const quantity = intent.entities.find((e: any) => e.type === 'quantity');
    
    if (stockInfo && quantity) {
      // Use existing stock service
      const result = await chickenBusinessAI.parseAndApplyNote(
        `Update ${stockInfo.value} quantity to ${quantity.value}`,
        context.userId
      );
      
      return {
        type: 'stock_update',
        parameters: { product: stockInfo.value, quantity: quantity.value },
        description: `Updated ${stockInfo.value} stock to ${quantity.value} units`
      };
    }
    
    return {
      type: 'stock_update',
      parameters: {},
      description: 'Please specify the product and quantity to update'
    };
  }

  /**
   * Learn from user interactions to improve responses
   */
  private async learnFromInteraction(
    context: ChatContext,
    intent: any,
    response: AIResponse
  ): Promise<void> {
    const interaction = {
      userId: context.userId,
      role: context.role,
      intent,
      response: response.content,
      timestamp: new Date(),
      confidence: response.confidence
    };

    // Store in memory service for pattern learning
    await chickenMemoryService.addObservation(
      `user_interaction_${context.userId}`,
      interaction
    );

    // Update role-specific patterns
    const rolePatterns = this.patternLearning.get(context.role) || [];
    rolePatterns.push(interaction);
    this.patternLearning.set(context.role, rolePatterns.slice(-100)); // Keep last 100
  }

  /**
   * Get or create session context
   */
  private async getOrCreateSession(
    userId: string,
    context: Partial<ChatContext>
  ): Promise<ChatContext> {
    const sessionId = context.sessionId || crypto.randomUUID();
    
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId)!;
    }

    // Load user's business context
    const businessContext = await chickenMemoryService.searchSimilar(
      `user_${userId}`,
      5
    );

    const newSession: ChatContext = {
      userId,
      role: context.role || 'customer',
      sessionId,
      conversationHistory: [],
      businessContext,
      currentWorkflow: context.currentWorkflow
    };

    this.activeSessions.set(sessionId, newSession);
    return newSession;
  }

  /**
   * Build role-specific system prompts
   */
  private buildIntentAnalysisPrompt(role: string): string {
    const basePrompt = `Analyze the user's intent and return a JSON object with:
    {
      "category": "stock_management|customer_inquiry|voice_input|business_analysis|pattern_learning|ai_training|general",
      "confidence": 0.0-1.0,
      "entities": [{"type": "product|quantity|date|action", "value": "extracted_value"}],
      "query": "cleaned_user_query",
      "actions": ["suggested_action_1", "suggested_action_2"]
    }`;

    const roleSpecific = {
      customer: "Focus on product inquiries, orders, and general store information.",
      worker: "Focus on stock updates, voice notes, workflow assistance, and operational tasks.",
      owner: "Focus on business analytics, strategic insights, forecasting, and decision support.",
      admin: "Focus on system optimization, pattern analysis, AI training, and technical administration."
    };

    return `${basePrompt}\n\nRole Context: ${roleSpecific[role as keyof typeof roleSpecific] || roleSpecific.customer}`;
  }

  /**
   * Simple intent classification fallback
   */
  private classifySimpleIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('stock') || lowerMessage.includes('inventory')) {
      return 'stock_management';
    }
    if (lowerMessage.includes('hours') || lowerMessage.includes('location')) {
      return 'customer_inquiry';
    }
    if (lowerMessage.includes('sales') || lowerMessage.includes('analytics')) {
      return 'business_analysis';
    }
    
    return 'general';
  }

  // Additional helper methods...
  private async executeAIActions(actions: AIAction[], context: ChatContext): Promise<any[]> {
    // Implementation for executing AI actions
    return [];
  }

  private async analyzeSystemPatterns(): Promise<any> {
    // Implementation for pattern analysis
    return { optimizations: [] };
  }

  private async prepareTrainingData(): Promise<any> {
    // Implementation for training data preparation
    return { samples: 0 };
  }

  private async getSystemStatus(): Promise<any> {
    // Implementation for system status
    return { health: 'good', recommendations: [] };
  }

  private async generateGenericResponse(intent: any, context: ChatContext): Promise<AIResponse> {
    // Generic fallback response
    return {
      content: "I'm here to help! How can I assist you today?",
      confidence: 0.5
    };
  }

  private async handleNoteInput(intent: any, context: ChatContext): Promise<AIAction> {
    // Handle note/voice input
    return {
      type: 'create_note',
      parameters: { content: intent.query },
      description: 'Created note from input'
    };
  }
}

export const unifiedAIService = new UnifiedAIService();