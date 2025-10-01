/**
 * Enhanced Business Intelligence Integration
 * Integrates SequentialAIService with existing business functions
 * Provides multi-model collaboration and Filipino language support
 */

import { SequentialAIService, WorkflowDefinition, WorkflowContext } from './sequentialAIService.js';
import { MultilingualService, LanguageCode } from './multilingualService.js';
import { AIObserverService } from './aiObserver.js';
import { AIStoreAdvisorService } from './aiStoreAdvisor.js';
import { ChickenBusinessTools } from '../tools/chicken-business-tools.js';
import { EnhancedChickenBusinessAI } from './chickenBusinessAI-enhanced.js';
import AdvancedGeminiProxy from '../advanced-gemini-proxy.js';
import { MultiLLMProxy } from './MultiLLMProxy.js';
import { v4 as uuidv4 } from 'uuid';

export interface EnhancedBusinessAnalysisResult {
  originalAnalysis: any;
  enhancedInsights: string[];
  multiModelRecommendations: string[];
  confidence: number;
  languageOutput: {
    language: LanguageCode;
    localizedContent: any;
    culturalContext: string;
  };
  modelCollaboration: {
    modelsUsed: string[];
    consensusScore: number;
    conflictingViews?: string[];
  };
  actionableItems: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    timeframe: string;
    businessImpact: string;
  }[];
}

export interface BusinessIntelligenceConfig {
  userLanguage?: LanguageCode;
  userRole?: 'owner' | 'worker' | 'customer';
  complexityLevel?: 'simple' | 'medium' | 'complex' | 'critical';
  includeForecasting?: boolean;
  includeMultiModelAnalysis?: boolean;
  culturalContext?: 'filipino' | 'cebuano' | 'formal' | 'casual';
}

/**
 * Enhanced Business Intelligence Service
 * Combines sequential AI with existing business intelligence functions
 */
export class EnhancedBusinessIntelligenceService {
  private sequentialAI: SequentialAIService;
  private multilingualService: MultilingualService;
  private aiObserver: AIObserverService;
  private aiStoreAdvisor: AIStoreAdvisorService;
  private chickenBusinessTools: ChickenBusinessTools;
  private enhancedChickenAI: EnhancedChickenBusinessAI;
  private geminiProxy: AdvancedGeminiProxy;
  private multiLLMProxy: MultiLLMProxy;

  constructor(
    geminiProxy: AdvancedGeminiProxy,
    multiLLMProxy: MultiLLMProxy
  ) {
    this.geminiProxy = geminiProxy;
    this.multiLLMProxy = multiLLMProxy;
    
    // Initialize services
    this.sequentialAI = new SequentialAIService(geminiProxy, multiLLMProxy);
    this.multilingualService = new MultilingualService(geminiProxy, multiLLMProxy);
    this.aiObserver = new AIObserverService(geminiProxy);
    this.aiStoreAdvisor = new AIStoreAdvisorService(geminiProxy);
    this.chickenBusinessTools = new ChickenBusinessTools(geminiProxy);
    this.enhancedChickenAI = new EnhancedChickenBusinessAI(multiLLMProxy);
  }

  /**
   * Enhanced business performance analysis with multi-model collaboration
   */
  async analyzeBusinessPerformanceEnhanced(
    timeframe: 'daily' | 'weekly' | 'monthly',
    config: BusinessIntelligenceConfig = {}
  ): Promise<EnhancedBusinessAnalysisResult> {
    const requestId = uuidv4();
    console.log(`🔍 Enhanced Business Analysis [${requestId}]`);

    try {
      // Step 1: Get original analysis from existing function
      const originalAnalysis = await this.chickenBusinessTools.analyzeBusinessPerformance(
        timeframe,
        true, // includeInsights
        true  // includeRecommendations
      );

      // Step 2: Use Sequential AI for enhanced analysis
      const workflowContext: WorkflowContext = {
        originalData: originalAnalysis,
        userRole: config.userRole || 'owner',
        businessContext: {
          timeframe,
          performanceMetrics: originalAnalysis.summary,
          existingInsights: originalAnalysis.insights,
          existingRecommendations: originalAnalysis.recommendations
        },
        requestId,
        priority: config.complexityLevel === 'critical' ? 'high' : 'medium'
      };

      const sequentialResult = await this.sequentialAI.executeWorkflow(
        'business-analysis',
        workflowContext
      );

      // Step 3: Generate multilingual output if needed
      const userLanguage = config.userLanguage || 'en';
      let localizedContent = originalAnalysis;
      
      if (userLanguage !== 'en') {
        localizedContent = await this.multilingualService.localizeOutput(
          originalAnalysis,
          userLanguage,
          config.culturalContext,
          config.userRole
        );
      }

      // Step 4: Extract actionable items from enhanced analysis
      const actionableItems = await this.extractActionableItems(
        sequentialResult,
        config.complexityLevel || 'medium'
      );

      // Step 5: Build comprehensive result
      const result: EnhancedBusinessAnalysisResult = {
        originalAnalysis,
        enhancedInsights: sequentialResult.insights || [],
        multiModelRecommendations: sequentialResult.recommendations || [],
        confidence: sequentialResult.confidence || 85,
        languageOutput: {
          language: userLanguage,
          localizedContent,
          culturalContext: config.culturalContext || 'filipino'
        },
        modelCollaboration: {
          modelsUsed: sequentialResult.modelsUsed || ['gemini', 'deepseek', 'cerebras'],
          consensusScore: sequentialResult.consensusScore || 90,
          conflictingViews: sequentialResult.conflictingViews
        },
        actionableItems
      };

      console.log(`✅ Enhanced Analysis Complete [${requestId}]`);
      return result;

    } catch (error) {
      console.error(`❌ Enhanced Analysis Failed [${requestId}]:`, error);
      
      // Fallback to original analysis
      const fallbackAnalysis = await this.chickenBusinessTools.analyzeBusinessPerformance(timeframe);
      
      return {
        originalAnalysis: fallbackAnalysis,
        enhancedInsights: ['Enhanced analysis unavailable - using standard analysis'],
        multiModelRecommendations: fallbackAnalysis.recommendations || [],
        confidence: 70,
        languageOutput: {
          language: 'en',
          localizedContent: fallbackAnalysis,
          culturalContext: 'filipino'
        },
        modelCollaboration: {
          modelsUsed: ['gemini'],
          consensusScore: 70
        },
        actionableItems: []
      };
    }
  }

  /**
   * Enhanced chicken business forecast with sequential AI
   */
  async generateEnhancedForecast(
    period: string,
    dataType: string = 'sales',
    config: BusinessIntelligenceConfig = {}
  ): Promise<EnhancedBusinessAnalysisResult> {
    const requestId = uuidv4();
    console.log(`📈 Enhanced Forecast Generation [${requestId}]`);

    try {
      // Step 1: Get original forecast
      const originalForecast = await this.chickenBusinessTools.chicken_business_forecast({
        period,
        data_type: dataType,
        historical_data: {}
      });

      // Step 2: Use Sequential AI for enhanced forecasting
      const workflowContext: WorkflowContext = {
        originalData: originalForecast,
        userRole: config.userRole || 'owner',
        businessContext: {
          forecastPeriod: period,
          dataType,
          marketConditions: 'stable', // Could be enhanced with real market data
          seasonality: this.getSeasonalityContext(period)
        },
        requestId,
        priority: 'medium'
      };

      const sequentialResult = await this.sequentialAI.executeWorkflow(
        'forecasting',
        workflowContext
      );

      // Step 3: Localize forecast if needed
      const userLanguage = config.userLanguage || 'en';
      let localizedContent = originalForecast;
      
      if (userLanguage !== 'en') {
        localizedContent = await this.multilingualService.localizeOutput(
          {
            forecast: originalForecast.forecast,
            insights: sequentialResult.insights,
            recommendations: sequentialResult.recommendations
          },
          userLanguage,
          config.culturalContext,
          config.userRole
        );
      }

      const result: EnhancedBusinessAnalysisResult = {
        originalAnalysis: originalForecast,
        enhancedInsights: sequentialResult.insights || [],
        multiModelRecommendations: sequentialResult.recommendations || [],
        confidence: sequentialResult.confidence || 80,
        languageOutput: {
          language: userLanguage,
          localizedContent,
          culturalContext: config.culturalContext || 'filipino'
        },
        modelCollaboration: {
          modelsUsed: sequentialResult.modelsUsed || ['gemini', 'cerebras', 'mistral'],
          consensusScore: sequentialResult.consensusScore || 85
        },
        actionableItems: await this.extractActionableItems(sequentialResult, 'medium')
      };

      console.log(`✅ Enhanced Forecast Complete [${requestId}]`);
      return result;

    } catch (error) {
      console.error(`❌ Enhanced Forecast Failed [${requestId}]:`, error);
      throw error;
    }
  }

  /**
   * Enhanced AI insights with multilingual support
   */
  async generateEnhancedInsights(
    businessData: any,
    config: BusinessIntelligenceConfig = {}
  ): Promise<EnhancedBusinessAnalysisResult> {
    const requestId = uuidv4();
    console.log(`💡 Enhanced Insights Generation [${requestId}]`);

    try {
      // Step 1: Get original AI insights
      const originalInsights = await this.aiObserver.generateAIInsights(businessData);

      // Step 2: Use Sequential AI for enhanced analysis
      const workflowContext: WorkflowContext = {
        originalData: { insights: originalInsights, businessData },
        userRole: config.userRole || 'owner',
        businessContext: {
          dataScope: 'comprehensive',
          businessMetrics: businessData,
          insightDepth: config.complexityLevel || 'medium'
        },
        requestId,
        priority: 'medium'
      };

      const sequentialResult = await this.sequentialAI.executeWorkflow(
        'advisory',
        workflowContext
      );

      // Step 3: Enhanced insights with chicken business context
      const enhancedBusinessInsights = await this.enhancedChickenAI.getBusinessInsights(
        config.complexityLevel === 'simple' ? 'today' : 'week'
      );

      // Step 4: Combine insights
      const combinedInsights = [
        ...originalInsights.map(insight => insight.key_finding || insight.message || ''),
        ...sequentialResult.insights || [],
        ...enhancedBusinessInsights.insights || []
      ];

      const combinedRecommendations = [
        ...originalInsights.map(insight => insight.recommendations || []).flat(),
        ...sequentialResult.recommendations || [],
        ...enhancedBusinessInsights.recommendations || []
      ];

      // Step 5: Localize output
      const userLanguage = config.userLanguage || 'en';
      let localizedContent = {
        insights: combinedInsights,
        recommendations: combinedRecommendations,
        businessHealth: this.assessBusinessHealth(originalInsights)
      };
      
      if (userLanguage !== 'en') {
        localizedContent = await this.multilingualService.localizeOutput(
          localizedContent,
          userLanguage,
          config.culturalContext,
          config.userRole
        );
      }

      const result: EnhancedBusinessAnalysisResult = {
        originalAnalysis: { insights: originalInsights },
        enhancedInsights: combinedInsights,
        multiModelRecommendations: combinedRecommendations,
        confidence: this.calculateCombinedConfidence([
          sequentialResult.confidence || 80,
          85, // Original insights confidence
          75  // Enhanced chicken AI confidence
        ]),
        languageOutput: {
          language: userLanguage,
          localizedContent,
          culturalContext: config.culturalContext || 'filipino'
        },
        modelCollaboration: {
          modelsUsed: ['gemini', 'deepseek', 'cerebras', 'enhanced-chicken-ai'],
          consensusScore: 88
        },
        actionableItems: await this.extractActionableItems(sequentialResult, config.complexityLevel || 'medium')
      };

      console.log(`✅ Enhanced Insights Complete [${requestId}]`);
      return result;

    } catch (error) {
      console.error(`❌ Enhanced Insights Failed [${requestId}]:`, error);
      throw error;
    }
  }

  /**
   * Comprehensive business advisor with multilingual support
   */
  async getEnhancedBusinessAdvice(
    query: string,
    userRole: 'owner' | 'worker' = 'owner',
    config: BusinessIntelligenceConfig = {}
  ): Promise<EnhancedBusinessAnalysisResult> {
    const requestId = uuidv4();
    console.log(`🎯 Enhanced Business Advice [${requestId}]`);

    try {
      // Step 1: Get original advice
      const originalAdvice = await this.aiStoreAdvisor.getBusinessAdvice(query, userRole);

      // Step 2: Detect user language from query
      const detectedLanguage = await this.multilingualService.detectLanguage(query);
      const targetLanguage = config.userLanguage || detectedLanguage;

      // Step 3: Use Sequential AI for comprehensive advisory
      const workflowContext: WorkflowContext = {
        originalData: { advice: originalAdvice, query },
        userRole,
        businessContext: {
          queryType: 'business_advice',
          originalQuery: query,
          userLanguage: targetLanguage,
          businessDomain: 'chicken_business'
        },
        requestId,
        priority: config.complexityLevel === 'critical' ? 'high' : 'medium'
      };

      const sequentialResult = await this.sequentialAI.executeWorkflow(
        'advisory',
        workflowContext
      );

      // Step 4: Localize advice if needed
      let localizedContent = {
        advice: originalAdvice.advice,
        recommendations: sequentialResult.recommendations || [],
        culturalConsiderations: this.getCulturalBusinessContext(targetLanguage)
      };
      
      if (targetLanguage !== 'en') {
        localizedContent = await this.multilingualService.localizeOutput(
          localizedContent,
          targetLanguage,
          config.culturalContext,
          userRole
        );
      }

      const result: EnhancedBusinessAnalysisResult = {
        originalAnalysis: originalAdvice,
        enhancedInsights: sequentialResult.insights || [],
        multiModelRecommendations: sequentialResult.recommendations || [],
        confidence: sequentialResult.confidence || 85,
        languageOutput: {
          language: targetLanguage,
          localizedContent,
          culturalContext: config.culturalContext || 'filipino'
        },
        modelCollaboration: {
          modelsUsed: sequentialResult.modelsUsed || ['gemini', 'mistral', 'deepseek'],
          consensusScore: sequentialResult.consensusScore || 87
        },
        actionableItems: await this.extractActionableItems(sequentialResult, config.complexityLevel || 'medium')
      };

      console.log(`✅ Enhanced Advice Complete [${requestId}]`);
      return result;

    } catch (error) {
      console.error(`❌ Enhanced Advice Failed [${requestId}]:`, error);
      throw error;
    }
  }

  /**
   * Voice processing with multilingual support
   */
  async processVoiceWithLanguageSupport(
    transcript: string,
    config: BusinessIntelligenceConfig = {}
  ): Promise<EnhancedBusinessAnalysisResult> {
    const requestId = uuidv4();
    console.log(`🎤 Enhanced Voice Processing [${requestId}]`);

    try {
      // Step 1: Detect language from transcript
      const languageDetection = await this.multilingualService.detectLanguageAdvanced(transcript);
      
      // Step 2: Translate if needed for processing
      let processableTranscript = transcript;
      if (languageDetection.detectedLanguage !== 'en') {
        const translation = await this.multilingualService.translateText(
          transcript,
          'en',
          languageDetection.detectedLanguage
        );
        processableTranscript = translation.translatedText;
      }

      // Step 3: Use Sequential AI for voice processing
      const workflowContext: WorkflowContext = {
        originalData: { 
          transcript: processableTranscript,
          originalTranscript: transcript,
          detectedLanguage: languageDetection.detectedLanguage
        },
        userRole: config.userRole || 'owner',
        businessContext: {
          inputType: 'voice',
          languageContext: languageDetection,
          businessTerminology: languageDetection.businessTerminology
        },
        requestId,
        priority: 'medium'
      };

      const sequentialResult = await this.sequentialAI.executeWorkflow(
        'voice-processing',
        workflowContext
      );

      // Step 4: Localize response back to original language
      const targetLanguage = languageDetection.detectedLanguage;
      let localizedContent = {
        processedTranscript: processableTranscript,
        extractedInfo: sequentialResult.extractedData || {},
        recommendations: sequentialResult.recommendations || []
      };
      
      if (targetLanguage !== 'en') {
        localizedContent = await this.multilingualService.localizeOutput(
          localizedContent,
          targetLanguage,
          this.getCulturalContextFromLanguage(targetLanguage),
          config.userRole
        );
      }

      const result: EnhancedBusinessAnalysisResult = {
        originalAnalysis: { transcript, languageDetection },
        enhancedInsights: sequentialResult.insights || [],
        multiModelRecommendations: sequentialResult.recommendations || [],
        confidence: sequentialResult.confidence || 80,
        languageOutput: {
          language: targetLanguage,
          localizedContent,
          culturalContext: this.getCulturalContextFromLanguage(targetLanguage)
        },
        modelCollaboration: {
          modelsUsed: ['whisper', 'gemini', 'mistral'],
          consensusScore: 85
        },
        actionableItems: await this.extractActionableItems(sequentialResult, 'medium')
      };

      console.log(`✅ Enhanced Voice Processing Complete [${requestId}]`);
      return result;

    } catch (error) {
      console.error(`❌ Enhanced Voice Processing Failed [${requestId}]:`, error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */
  private async extractActionableItems(
    sequentialResult: any,
    complexityLevel: string
  ): Promise<any[]> {
    const actions = [];
    
    if (sequentialResult.recommendations) {
      for (const recommendation of sequentialResult.recommendations) {
        actions.push({
          priority: this.determinePriority(recommendation, complexityLevel),
          action: recommendation,
          timeframe: this.estimateTimeframe(recommendation),
          businessImpact: this.assessBusinessImpact(recommendation)
        });
      }
    }

    return actions;
  }

  private determinePriority(recommendation: string, complexityLevel: string): 'high' | 'medium' | 'low' {
    const urgent = ['urgent', 'immediate', 'critical', 'asap'].some(word => 
      recommendation.toLowerCase().includes(word)
    );
    
    if (urgent || complexityLevel === 'critical') return 'high';
    if (complexityLevel === 'complex') return 'medium';
    return 'low';
  }

  private estimateTimeframe(recommendation: string): string {
    if (recommendation.toLowerCase().includes('immediate')) return 'immediately';
    if (recommendation.toLowerCase().includes('daily')) return 'daily';
    if (recommendation.toLowerCase().includes('week')) return 'this week';
    if (recommendation.toLowerCase().includes('month')) return 'this month';
    return 'within 2 weeks';
  }

  private assessBusinessImpact(recommendation: string): string {
    const highImpact = ['revenue', 'profit', 'cost', 'efficiency', 'customer'].some(word => 
      recommendation.toLowerCase().includes(word)
    );
    
    return highImpact ? 'high business impact' : 'operational improvement';
  }

  private getSeasonalityContext(period: string): string {
    const currentMonth = new Date().getMonth();
    const holidayMonths = [10, 11, 0]; // Nov, Dec, Jan (Christmas season in Philippines)
    
    if (holidayMonths.includes(currentMonth)) {
      return 'holiday_season_high_demand';
    } else if (currentMonth >= 3 && currentMonth <= 5) {
      return 'summer_season_stable_demand';
    } else {
      return 'regular_season_normal_demand';
    }
  }

  private getCulturalBusinessContext(language: LanguageCode): string[] {
    const contexts = {
      'tl': [
        'Consider "utang" (credit) relationships common in Filipino business',
        'Factor in "pakikipagkunware" (maintaining harmony) in customer relations',
        'Include "bayanihan" (community cooperation) in business operations'
      ],
      'ceb': [
        'Consider "dungan" (togetherness) in business partnerships',
        'Factor in "gugma" (care) for customer relationships',
        'Include "pakig-angayon" (cooperation) in operations'
      ],
      'en': [
        'Standard business practices and professional relationships',
        'Focus on efficiency and profitability',
        'Maintain clear business boundaries'
      ]
    };
    
    return contexts[language] || contexts['en'];
  }

  private getCulturalContextFromLanguage(language: LanguageCode): string {
    const mapping = {
      'tl': 'filipino',
      'ceb': 'cebuano',
      'en': 'formal'
    };
    
    return mapping[language] || 'filipino';
  }

  private assessBusinessHealth(insights: any[]): string {
    const positiveKeywords = ['increase', 'growth', 'profit', 'success', 'improve'];
    const negativeKeywords = ['decrease', 'loss', 'problem', 'decline', 'concern'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    insights.forEach(insight => {
      const text = (insight.key_finding || insight.message || '').toLowerCase();
      if (positiveKeywords.some(word => text.includes(word))) positiveCount++;
      if (negativeKeywords.some(word => text.includes(word))) negativeCount++;
    });
    
    if (positiveCount > negativeCount * 1.5) return 'excellent';
    if (positiveCount > negativeCount) return 'good';
    if (negativeCount > positiveCount) return 'concerning';
    return 'stable';
  }

  private calculateCombinedConfidence(confidences: number[]): number {
    const average = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    return Math.round(average);
  }
}

export default EnhancedBusinessIntelligenceService;