/**
 * Sequential AI Service - Multi-Model Collaboration System
 * Implements intelligent AI agent collaboration with multilingual support
 * Optimized for Filipino chicken business operations with Tagalog/Cebuano support
 */

import AdvancedGeminiProxy, { GeminiResponse, TaskRequest, GeminiConfig } from '../advanced-gemini-proxy.js';
import { MultiLLMProxy } from './MultiLLMProxy.js';
import { MultilingualService } from './multilingualService.js';
import { v4 as uuidv4 } from 'uuid';
import { monitoring } from '../monitoring.js';

export type LanguageCode = 'en' | 'tl' | 'ceb' | 'auto';
export type WorkflowType = 'business-analysis' | 'voice-processing' | 'complex-parsing' | 'forecasting' | 'advisory' | 'reporting';
export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'critical';

export interface AIStep {
  model: 'gemini' | 'deepseek' | 'cerebras' | 'mistral' | 'openrouter' | 'whisper' | 'cohere';
  task: 'speech-to-text' | 'language-detection' | 'translation' | 'data-extraction' | 'reasoning' | 'validation' | 'formatting' | 'business-parsing' | 'insights-generation' | 'forecasting' | 'advisory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  fallbackModel?: string;
}

export interface SequentialAIConfig {
  workflow: WorkflowType;
  complexity: ComplexityLevel;
  language: LanguageCode;
  useSequential: boolean;
  userRole?: 'owner' | 'worker';
  branchId?: string;
  culturalContext?: 'filipino' | 'cebuano' | 'tagalog' | 'mixed';
}

export interface SequentialAIResult {
  success: boolean;
  result: any;
  metadata: {
    requestId: string;
    workflow: WorkflowType;
    stepsExecuted: AIStep[];
    totalProcessingTime: number;
    language: LanguageCode;
    detectedLanguage?: LanguageCode;
    translationRequired: boolean;
    costEstimate: number;
    qualityScore: number;
    modelUsage: Record<string, number>;
  };
  error?: string;
  fallbackUsed?: boolean;
}

export interface WorkflowDefinition {
  name: WorkflowType;
  description: string;
  steps: AIStep[];
  estimatedTime: number;
  estimatedCost: number;
  complexityHandling: Record<ComplexityLevel, AIStep[]>;
}

/**
 * Sequential AI Service - Core Implementation
 * Handles multi-model collaboration with intelligent routing and Filipino language support
 */
export class SequentialAIService {
  private geminiProxy: AdvancedGeminiProxy;
  private multiLLMProxy: MultiLLMProxy;
  private multilingualService: MultilingualService;
  private workflows: Map<WorkflowType, WorkflowDefinition> = new Map();
  private requestCache: Map<string, SequentialAIResult> = new Map();

  constructor(
    geminiProxy: AdvancedGeminiProxy,
    multiLLMProxy: MultiLLMProxy
  ) {
    this.geminiProxy = geminiProxy;
    this.multiLLMProxy = multiLLMProxy;
    this.multilingualService = new MultilingualService(geminiProxy, multiLLMProxy);
    this.initializeWorkflows();
  }

  /**
   * Main entry point for sequential AI processing
   */
  async processWithSequentialAI(
    input: string | any,
    config: SequentialAIConfig
  ): Promise<SequentialAIResult> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      console.log(`🤖 Starting sequential AI processing for ${config.workflow} (${config.complexity})`);

      // Check if we should use sequential AI or fallback to single model
      if (!config.useSequential || config.complexity === 'simple') {
        return await this.processSingleModel(input, config, requestId);
      }

      // Get workflow definition
      const workflow = this.workflows.get(config.workflow);
      if (!workflow) {
        throw new Error(`Unknown workflow: ${config.workflow}`);
      }

      // Select appropriate steps based on complexity
      const steps = workflow.complexityHandling[config.complexity] || workflow.steps;

      // Language detection and preprocessing
      let processedInput = input;
      let detectedLanguage = config.language;
      
      if (config.language === 'auto' && typeof input === 'string') {
        detectedLanguage = await this.multilingualService.detectLanguage(input);
        console.log(`🌐 Detected language: ${detectedLanguage}`);
      }

      // Execute sequential steps
      let result = processedInput;
      const executedSteps: AIStep[] = [];
      const modelUsage: Record<string, number> = {};

      for (const step of steps) {
        console.log(`🔄 Executing step: ${step.model} - ${step.task}`);
        
        const stepResult = await this.executeStep(step, result, {
          language: detectedLanguage,
          culturalContext: config.culturalContext,
          userRole: config.userRole,
          branchId: config.branchId
        });

        result = stepResult.result;
        executedSteps.push(step);
        modelUsage[step.model] = (modelUsage[step.model] || 0) + 1;

        // Store intermediate results for debugging
        console.log(`✅ Step completed: ${step.task} (${stepResult.processingTime}ms)`);
      }

      // Post-processing for language output
      if (detectedLanguage !== 'en' && config.workflow !== 'voice-processing') {
        result = await this.multilingualService.localizeOutput(result, detectedLanguage, config.culturalContext);
      }

      const totalProcessingTime = Date.now() - startTime;
      const costEstimate = this.calculateCostEstimate(modelUsage);
      const qualityScore = this.calculateQualityScore(executedSteps, config.complexity);

      const finalResult: SequentialAIResult = {
        success: true,
        result,
        metadata: {
          requestId,
          workflow: config.workflow,
          stepsExecuted: executedSteps,
          totalProcessingTime,
          language: detectedLanguage,
          detectedLanguage: config.language === 'auto' ? detectedLanguage : undefined,
          translationRequired: detectedLanguage !== 'en',
          costEstimate,
          qualityScore,
          modelUsage
        }
      };

      // Cache successful results
      this.requestCache.set(requestId, finalResult);

      console.log(`🎉 Sequential AI completed: ${totalProcessingTime}ms, Quality: ${qualityScore}%`);
      return finalResult;

    } catch (error) {
      console.error('❌ Sequential AI processing failed:', error);
      
      // Attempt fallback to single model
      try {
        const fallbackResult = await this.processSingleModel(input, config, requestId);
        fallbackResult.fallbackUsed = true;
        return fallbackResult;
      } catch (fallbackError) {
        return {
          success: false,
          result: null,
          metadata: {
            requestId,
            workflow: config.workflow,
            stepsExecuted: [],
            totalProcessingTime: Date.now() - startTime,
            language: config.language,
            translationRequired: false,
            costEstimate: 0,
            qualityScore: 0,
            modelUsage: {}
          },
          error: error instanceof Error ? error.message : 'Sequential AI processing failed'
        };
      }
    }
  }

  /**
   * Execute individual step in the sequential workflow
   */
  private async executeStep(
    step: AIStep,
    input: any,
    context: {
      language: LanguageCode;
      culturalContext?: string;
      userRole?: string;
      branchId?: string;
    }
  ): Promise<{ result: any; processingTime: number }> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (step.task) {
        case 'speech-to-text':
          result = await this.executeSpeechToText(input, step, context);
          break;

        case 'language-detection':
          result = await this.multilingualService.detectLanguage(input);
          break;

        case 'translation':
          result = await this.multilingualService.translateText(input, 'en', context.language);
          break;

        case 'data-extraction':
          result = await this.executeDataExtraction(input, step, context);
          break;

        case 'reasoning':
          result = await this.executeReasoning(input, step, context);
          break;

        case 'validation':
          result = await this.executeValidation(input, step, context);
          break;

        case 'formatting':
          result = await this.executeFormatting(input, step, context);
          break;

        case 'business-parsing':
          result = await this.executeBusinessParsing(input, step, context);
          break;

        case 'insights-generation':
          result = await this.executeInsightsGeneration(input, step, context);
          break;

        case 'forecasting':
          result = await this.executeForecasting(input, step, context);
          break;

        case 'advisory':
          result = await this.executeAdvisory(input, step, context);
          break;

        default:
          throw new Error(`Unknown task: ${step.task}`);
      }

      return {
        result,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ Step failed: ${step.task} on ${step.model}`, error);
      
      // Try fallback model if specified
      if (step.fallbackModel) {
        console.log(`🔄 Attempting fallback to ${step.fallbackModel}`);
        const fallbackStep = { ...step, model: step.fallbackModel as any };
        return await this.executeStep(fallbackStep, input, context);
      }
      
      throw error;
    }
  }

  /**
   * Execute speech-to-text processing
   */
  private async executeSpeechToText(input: any, step: AIStep, context: any): Promise<any> {
    // This would integrate with Whisper API through Groq
    // For now, return the input assuming it's already text
    if (typeof input === 'string') {
      return input;
    }
    
    // Future: Implement actual Whisper integration
    throw new Error('Speech-to-text not yet implemented');
  }

  /**
   * Execute data extraction step
   */
  private async executeDataExtraction(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildDataExtractionPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.3,
      maxOutputTokens: 1000,
      taskType: {
        complexity: 'medium',
        type: 'analysis',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute reasoning step with deep analysis
   */
  private async executeReasoning(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildReasoningPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.5,
      maxOutputTokens: 1500,
      taskType: {
        complexity: 'complex',
        type: 'reasoning',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute validation step
   */
  private async executeValidation(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildValidationPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.2,
      maxOutputTokens: 800,
      taskType: {
        complexity: 'medium',
        type: 'analysis',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute formatting step for final output
   */
  private async executeFormatting(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildFormattingPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.4,
      maxOutputTokens: 1200,
      taskType: {
        complexity: 'medium',
        type: 'text',
        priority: 'medium'
      }
    });

    return response.text;
  }

  /**
   * Execute business parsing for chicken business operations
   */
  private async executeBusinessParsing(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildBusinessParsingPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.3,
      maxOutputTokens: 1000,
      taskType: {
        complexity: 'medium',
        type: 'analysis',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute insights generation for business intelligence
   */
  private async executeInsightsGeneration(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildInsightsPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.6,
      maxOutputTokens: 1500,
      taskType: {
        complexity: 'complex',
        type: 'analysis',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute forecasting for business predictions
   */
  private async executeForecasting(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildForecastingPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.4,
      maxOutputTokens: 1200,
      taskType: {
        complexity: 'complex',
        type: 'analysis',
        priority: 'high'
      }
    });

    return this.parseStructuredResponse(response.text);
  }

  /**
   * Execute advisory for business recommendations
   */
  private async executeAdvisory(input: any, step: AIStep, context: any): Promise<any> {
    const prompt = this.buildAdvisoryPrompt(input, context);
    
    const response = await this.callModel(step.model, prompt, {
      temperature: 0.5,
      maxOutputTokens: 1200,
      taskType: {
        complexity: 'medium',
        type: 'text',
        priority: 'medium'
      }
    });

    return response.text;
  }

  /**
   * Call appropriate AI model based on step configuration
   */
  private async callModel(modelName: string, prompt: string, config: any): Promise<GeminiResponse> {
    switch (modelName) {
      case 'gemini':
        return await this.geminiProxy.generateText(prompt, config);
      
      case 'deepseek':
      case 'cerebras':
      case 'mistral':
      case 'openrouter':
      case 'cohere':
        return await this.multiLLMProxy.generateText(prompt, {
          provider: modelName === 'deepseek' ? 'openrouter' : modelName,
          ...config
        });
      
      default:
        // Fallback to Gemini
        return await this.geminiProxy.generateText(prompt, config);
    }
  }

  /**
   * Fallback to single model processing
   */
  private async processSingleModel(
    input: any,
    config: SequentialAIConfig,
    requestId: string
  ): Promise<SequentialAIResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildSingleModelPrompt(input, config);
      const response = await this.geminiProxy.generateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: 1000
      });

      let result = response.text;
      
      // Apply language localization if needed
      if (config.language !== 'en') {
        result = await this.multilingualService.localizeOutput(result, config.language, config.culturalContext);
      }

      return {
        success: true,
        result,
        metadata: {
          requestId,
          workflow: config.workflow,
          stepsExecuted: [{ model: 'gemini', task: 'formatting', priority: 'medium' }],
          totalProcessingTime: Date.now() - startTime,
          language: config.language,
          translationRequired: config.language !== 'en',
          costEstimate: 3,
          qualityScore: 75,
          modelUsage: { gemini: 1 }
        }
      };
    } catch (error) {
      throw new Error(`Single model fallback failed: ${error}`);
    }
  }

  /**
   * Initialize workflow definitions
   */
  private initializeWorkflows(): void {
    // Business Analysis Workflow
    this.workflows.set('business-analysis', {
      name: 'business-analysis',
      description: 'Complex business intelligence analysis with multi-model collaboration',
      steps: [
        { model: 'gemini', task: 'data-extraction', priority: 'high' },
        { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
        { model: 'cerebras', task: 'validation', priority: 'medium', fallbackModel: 'gemini' },
        { model: 'gemini', task: 'formatting', priority: 'medium' }
      ],
      estimatedTime: 10000,
      estimatedCost: 20,
      complexityHandling: {
        simple: [
          { model: 'gemini', task: 'data-extraction', priority: 'medium' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ],
        medium: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ],
        complex: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
          { model: 'cerebras', task: 'validation', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ],
        critical: [
          { model: 'gemini', task: 'data-extraction', priority: 'critical' },
          { model: 'deepseek', task: 'reasoning', priority: 'critical', fallbackModel: 'gemini' },
          { model: 'cerebras', task: 'validation', priority: 'critical', fallbackModel: 'gemini' },
          { model: 'mistral', task: 'insights-generation', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ]
      }
    });

    // Voice Processing Workflow
    this.workflows.set('voice-processing', {
      name: 'voice-processing',
      description: 'Voice-to-business-data with multilingual support',
      steps: [
        { model: 'whisper', task: 'speech-to-text', priority: 'high' },
        { model: 'gemini', task: 'language-detection', priority: 'high' },
        { model: 'mistral', task: 'translation', priority: 'medium', fallbackModel: 'gemini' },
        { model: 'gemini', task: 'business-parsing', priority: 'high' }
      ],
      estimatedTime: 8000,
      estimatedCost: 15,
      complexityHandling: {
        simple: [
          { model: 'whisper', task: 'speech-to-text', priority: 'medium' },
          { model: 'gemini', task: 'business-parsing', priority: 'medium' }
        ],
        medium: [
          { model: 'whisper', task: 'speech-to-text', priority: 'high' },
          { model: 'gemini', task: 'language-detection', priority: 'high' },
          { model: 'gemini', task: 'business-parsing', priority: 'high' }
        ],
        complex: [
          { model: 'whisper', task: 'speech-to-text', priority: 'high' },
          { model: 'gemini', task: 'language-detection', priority: 'high' },
          { model: 'mistral', task: 'translation', priority: 'medium', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'business-parsing', priority: 'high' }
        ],
        critical: [
          { model: 'whisper', task: 'speech-to-text', priority: 'critical' },
          { model: 'gemini', task: 'language-detection', priority: 'critical' },
          { model: 'mistral', task: 'translation', priority: 'high', fallbackModel: 'gemini' },
          { model: 'cerebras', task: 'validation', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'business-parsing', priority: 'high' }
        ]
      }
    });

    // Forecasting Workflow
    this.workflows.set('forecasting', {
      name: 'forecasting',
      description: 'Business forecasting with multiple model validation',
      steps: [
        { model: 'gemini', task: 'data-extraction', priority: 'high' },
        { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
        { model: 'cerebras', task: 'forecasting', priority: 'high', fallbackModel: 'gemini' },
        { model: 'gemini', task: 'formatting', priority: 'medium' }
      ],
      estimatedTime: 12000,
      estimatedCost: 25,
      complexityHandling: {
        simple: [
          { model: 'gemini', task: 'forecasting', priority: 'medium' }
        ],
        medium: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'deepseek', task: 'forecasting', priority: 'high', fallbackModel: 'gemini' }
        ],
        complex: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
          { model: 'cerebras', task: 'forecasting', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ],
        critical: [
          { model: 'gemini', task: 'data-extraction', priority: 'critical' },
          { model: 'deepseek', task: 'reasoning', priority: 'critical', fallbackModel: 'gemini' },
          { model: 'cerebras', task: 'forecasting', priority: 'critical', fallbackModel: 'gemini' },
          { model: 'mistral', task: 'validation', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ]
      }
    });

    // Advisory Workflow
    this.workflows.set('advisory', {
      name: 'advisory',
      description: 'Business advisory with cultural context and multilingual support',
      steps: [
        { model: 'gemini', task: 'data-extraction', priority: 'high' },
        { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
        { model: 'mistral', task: 'advisory', priority: 'medium', fallbackModel: 'gemini' },
        { model: 'gemini', task: 'formatting', priority: 'medium' }
      ],
      estimatedTime: 9000,
      estimatedCost: 18,
      complexityHandling: {
        simple: [
          { model: 'gemini', task: 'advisory', priority: 'medium' }
        ],
        medium: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'gemini', task: 'advisory', priority: 'high' }
        ],
        complex: [
          { model: 'gemini', task: 'data-extraction', priority: 'high' },
          { model: 'deepseek', task: 'reasoning', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'advisory', priority: 'high' }
        ],
        critical: [
          { model: 'gemini', task: 'data-extraction', priority: 'critical' },
          { model: 'deepseek', task: 'reasoning', priority: 'critical', fallbackModel: 'gemini' },
          { model: 'mistral', task: 'advisory', priority: 'high', fallbackModel: 'gemini' },
          { model: 'gemini', task: 'formatting', priority: 'medium' }
        ]
      }
    });
  }

  /**
   * Build prompts for different tasks
   */
  private buildDataExtractionPrompt(input: any, context: any): string {
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a data extraction specialist for Filipino chicken business operations.

${culturalContext}

INPUT DATA:
${typeof input === 'string' ? input : JSON.stringify(input)}

EXTRACTION TASK:
Extract structured business data from the input. Focus on:
- Financial amounts (in PHP/pesos)
- Quantities (chickens, eggs, products)
- Business operations (purchase, sale, processing, distribution)
- Locations (branches, suppliers, customers)
- Dates and times
- People involved (roles, names)

Return structured JSON with clear categorization.
Handle mixed languages (English/Tagalog/Cebuano) appropriately.`;
  }

  private buildReasoningPrompt(input: any, context: any): string {
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a business reasoning specialist with deep understanding of Filipino chicken business operations.

${culturalContext}

EXTRACTED DATA:
${typeof input === 'string' ? input : JSON.stringify(input)}

REASONING TASK:
Analyze the extracted data and provide deep business insights:
- Identify patterns and trends
- Assess business impact and implications
- Determine risk factors and opportunities
- Consider seasonal variations and market conditions
- Evaluate operational efficiency
- Recommend strategic actions

Use step-by-step reasoning and provide confidence levels for each insight.
Consider Filipino business culture and practices.`;
  }

  private buildValidationPrompt(input: any, context: any): string {
    return `You are a business data validation specialist.

REASONING RESULTS:
${typeof input === 'string' ? input : JSON.stringify(input)}

VALIDATION TASK:
Validate the reasoning results for accuracy and consistency:
- Check numerical calculations
- Verify business logic
- Assess reasonableness of conclusions
- Identify potential errors or inconsistencies
- Rate confidence levels
- Flag any suspicious or unrealistic findings

Return validation results with specific feedback and corrected data if needed.`;
  }

  private buildFormattingPrompt(input: any, context: any): string {
    const languageInstructions = this.getLanguageInstructions(context.language);
    
    return `You are a business communication specialist for Filipino chicken businesses.

${languageInstructions}

VALIDATED RESULTS:
${typeof input === 'string' ? input : JSON.stringify(input)}

FORMATTING TASK:
Format the results into clear, actionable business communication:
- Use appropriate business language for ${context.language === 'tl' ? 'Tagalog' : context.language === 'ceb' ? 'Cebuano' : 'English'}
- Structure information logically
- Highlight key insights and recommendations
- Use Filipino business terminology when appropriate
- Make it accessible for ${context.userRole || 'business users'}
- Include specific action items

Format for UI display with proper headings and bullet points.`;
  }

  private buildBusinessParsingPrompt(input: any, context: any): string {
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a Filipino chicken business operations parser.

${culturalContext}

INPUT TEXT:
${typeof input === 'string' ? input : JSON.stringify(input)}

PARSING TASK:
Parse the input for chicken business operations and extract:
- Business type: purchase, processing, distribution, cooking, sales, general
- Quantities and amounts
- Locations and branches
- People and roles
- Time information
- Financial data
- Operational notes

Handle mixed languages and Filipino business terminology.
Return structured business data with confidence scores.`;
  }

  private buildInsightsPrompt(input: any, context: any): string {
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a business intelligence specialist for Filipino chicken operations.

${culturalContext}

BUSINESS DATA:
${typeof input === 'string' ? input : JSON.stringify(input)}

INSIGHTS TASK:
Generate actionable business insights:
- Performance analysis
- Trend identification
- Opportunity discovery
- Risk assessment
- Operational recommendations
- Financial optimization suggestions
- Market positioning advice

Consider Filipino market conditions, seasonal variations, and cultural factors.
Provide specific, actionable recommendations with priority levels.`;
  }

  private buildForecastingPrompt(input: any, context: any): string {
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a business forecasting specialist for Filipino chicken operations.

${culturalContext}

HISTORICAL DATA:
${typeof input === 'string' ? input : JSON.stringify(input)}

FORECASTING TASK:
Generate business forecasts considering:
- Historical trends and patterns
- Seasonal variations in the Philippines
- Market conditions and competition
- Economic factors affecting chicken business
- Supply chain considerations
- Customer demand patterns

Provide forecasts with confidence intervals and key assumptions.
Include specific recommendations for business planning.`;
  }

  private buildAdvisoryPrompt(input: any, context: any): string {
    const languageInstructions = this.getLanguageInstructions(context.language);
    const culturalContext = this.getCulturalContext(context.language, context.culturalContext);
    
    return `You are a business advisor for Filipino chicken operations.

${culturalContext}
${languageInstructions}

BUSINESS SITUATION:
${typeof input === 'string' ? input : JSON.stringify(input)}

ADVISORY TASK:
Provide business advice tailored for Filipino chicken business:
- Strategic recommendations
- Operational improvements
- Financial optimization
- Risk mitigation strategies
- Growth opportunities
- Best practices

Consider the user's role (${context.userRole}) and local business culture.
Provide specific, actionable advice in ${context.language === 'tl' ? 'Tagalog' : context.language === 'ceb' ? 'Cebuano' : 'English'}.`;
  }

  private buildSingleModelPrompt(input: any, config: SequentialAIConfig): string {
    const culturalContext = this.getCulturalContext(config.language, config.culturalContext);
    const languageInstructions = this.getLanguageInstructions(config.language);
    
    return `You are an AI assistant for Filipino chicken business operations.

${culturalContext}
${languageInstructions}

TASK: ${config.workflow}
COMPLEXITY: ${config.complexity}

INPUT:
${typeof input === 'string' ? input : JSON.stringify(input)}

Provide comprehensive analysis and recommendations for this ${config.workflow} task.
Consider Filipino business practices and respond in ${config.language === 'tl' ? 'Tagalog' : config.language === 'ceb' ? 'Cebuano' : 'English'}.`;
  }

  /**
   * Helper methods
   */
  private getCulturalContext(language: LanguageCode, culturalContext?: string): string {
    if (language === 'tl' || culturalContext === 'tagalog' || culturalContext === 'filipino') {
      return `CULTURAL CONTEXT: Filipino chicken business operations
- Understand Filipino business practices and terminology
- Consider local market conditions in the Philippines
- Recognize traditional and modern chicken farming methods
- Account for peso currency and local pricing
- Consider regional variations and practices`;
    } else if (language === 'ceb' || culturalContext === 'cebuano') {
      return `CULTURAL CONTEXT: Cebuano chicken business operations
- Understand Cebuano business practices and terminology
- Consider Visayas region market conditions
- Recognize local farming traditions in Cebu/Visayas
- Account for regional business practices
- Consider local dialects and expressions`;
    }
    return '';
  }

  private getLanguageInstructions(language: LanguageCode): string {
    if (language === 'tl') {
      return `LANGUAGE INSTRUCTIONS:
- Respond in clear, business-appropriate Tagalog
- Use Filipino business terminology
- Include English technical terms when necessary
- Format for Filipino business context`;
    } else if (language === 'ceb') {
      return `LANGUAGE INSTRUCTIONS:
- Respond in clear, business-appropriate Cebuano
- Use Cebuano business terminology
- Include English technical terms when necessary
- Format for Visayas business context`;
    }
    return '';
  }

  private parseStructuredResponse(text: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return the text as-is
      return { content: text, type: 'text' };
    } catch (error) {
      // If JSON parsing fails, return structured text
      return { content: text, type: 'text', parsed: false };
    }
  }

  private calculateCostEstimate(modelUsage: Record<string, number>): number {
    const costs = {
      gemini: 3,
      deepseek: 5,
      cerebras: 4,
      mistral: 4,
      openrouter: 5,
      whisper: 2,
      cohere: 3
    };

    return Object.entries(modelUsage).reduce((total, [model, count]) => {
      return total + (costs[model as keyof typeof costs] || 3) * count;
    }, 0);
  }

  private calculateQualityScore(steps: AIStep[], complexity: ComplexityLevel): number {
    const baseScore = 75;
    const stepBonus = steps.length * 5;
    const complexityBonus = {
      simple: 0,
      medium: 10,
      complex: 20,
      critical: 30
    }[complexity];

    return Math.min(100, baseScore + stepBonus + complexityBonus);
  }

  /**
   * Public utility methods
   */
  public getWorkflowDefinition(workflow: WorkflowType): WorkflowDefinition | undefined {
    return this.workflows.get(workflow);
  }

  public getSupportedWorkflows(): WorkflowType[] {
    return Array.from(this.workflows.keys());
  }

  public estimateCost(workflow: WorkflowType, complexity: ComplexityLevel): number {
    const workflowDef = this.workflows.get(workflow);
    if (!workflowDef) return 5;

    const steps = workflowDef.complexityHandling[complexity] || workflowDef.steps;
    const modelUsage: Record<string, number> = {};
    
    steps.forEach(step => {
      modelUsage[step.model] = (modelUsage[step.model] || 0) + 1;
    });

    return this.calculateCostEstimate(modelUsage);
  }

  public estimateTime(workflow: WorkflowType, complexity: ComplexityLevel): number {
    const workflowDef = this.workflows.get(workflow);
    if (!workflowDef) return 3000;

    const steps = workflowDef.complexityHandling[complexity] || workflowDef.steps;
    return steps.length * 2500; // Estimate 2.5 seconds per step
  }
}

export default SequentialAIService;