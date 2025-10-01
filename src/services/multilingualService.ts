/**
 * Multilingual Service for Filipino Chicken Business
 * Handles language detection, translation, and localization for Tagalog and Cebuano
 * Provides cultural context and business terminology for UI-facing outputs
 */

import AdvancedGeminiProxy, { GeminiResponse } from '../advanced-gemini-proxy.js';
import { MultiLLMProxy } from './MultiLLMProxy.js';
import { v4 as uuidv4 } from 'uuid';

export type LanguageCode = 'en' | 'tl' | 'ceb' | 'auto';
export type CulturalContext = 'filipino' | 'cebuano' | 'tagalog' | 'mixed' | 'formal' | 'casual';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  confidence: number;
  culturalContext?: CulturalContext;
  businessTerms: string[];
  metadata: {
    requestId: string;
    model: string;
    processingTime: number;
    wordCount: number;
  };
}

export interface LanguageDetectionResult {
  detectedLanguage: LanguageCode;
  confidence: number;
  mixedLanguages: LanguageCode[];
  dominantLanguage: LanguageCode;
  culturalContext: CulturalContext;
  businessTerminology: string[];
}

export interface LocalizationConfig {
  targetLanguage: LanguageCode;
  culturalContext: CulturalContext;
  userRole: 'owner' | 'worker' | 'customer';
  formality: 'formal' | 'casual' | 'business';
  includeEnglishTerms: boolean;
  preserveNumbers: boolean;
  regionSpecific: boolean;
}

/**
 * Multilingual Service Implementation
 * Comprehensive language support for Filipino chicken business operations
 */
export class MultilingualService {
  private geminiProxy: AdvancedGeminiProxy;
  private multiLLMProxy: MultiLLMProxy;
  private businessTerminology: Map<string, Map<LanguageCode, string>> = new Map();
  private commonPhrases: Map<LanguageCode, Map<string, string>> = new Map();
  private cachedTranslations: Map<string, TranslationResult> = new Map();

  constructor(geminiProxy: AdvancedGeminiProxy, multiLLMProxy: MultiLLMProxy) {
    this.geminiProxy = geminiProxy;
    this.multiLLMProxy = multiLLMProxy;
    this.initializeBusinessTerminology();
    this.initializeCommonPhrases();
  }

  /**
   * Detect language from input text with business context awareness
   */
  async detectLanguage(text: string): Promise<LanguageCode> {
    if (!text || text.trim().length === 0) {
      return 'en';
    }

    try {
      const prompt = `Analyze this text and detect the primary language used.

TEXT TO ANALYZE:
"${text}"

Consider these languages:
- English (en)
- Tagalog/Filipino (tl) 
- Cebuano (ceb)

Look for these indicators:
- Tagalog: words like "ang", "ng", "sa", "ay", "mga", "ako", "siya", "pesos", "manok", "bili", "benta"
- Cebuano: words like "ang", "sa", "ug", "nga", "ako", "siya", "ka", "matag", "namalit", "namaligya"
- English: standard English words and grammar

Return ONLY the language code: en, tl, or ceb
If mixed languages, return the dominant one.`;

      const response = await this.geminiProxy.generateText(prompt, {
        temperature: 0.1,
        maxOutputTokens: 10
      });

      const detected = response.text.trim().toLowerCase();
      
      if (detected.includes('tl') || detected.includes('tagalog')) {
        return 'tl';
      } else if (detected.includes('ceb') || detected.includes('cebuano')) {
        return 'ceb';
      } else {
        return 'en';
      }

    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en'; // Default fallback
    }
  }

  /**
   * Comprehensive language detection with business context
   */
  async detectLanguageAdvanced(text: string): Promise<LanguageDetectionResult> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const prompt = `You are a language detection specialist for Filipino chicken business operations.

ANALYZE THIS TEXT:
"${text}"

Detect and analyze:
1. Primary language (English, Tagalog, Cebuano)
2. Mixed languages present
3. Confidence level (0-100)
4. Cultural context (Filipino business, casual conversation, formal business)
5. Business terminology detected
6. Regional variations

EXPECTED BUSINESS TERMS:
- Chicken/Poultry: manok, chicken, isda, baboy
- Money: pesos, PHP, bayad, bayad, presyo, halaga
- Business: negosyo, tindahan, palengke, merkado, supplier
- Actions: bili, benta, order, deliver, pickup
- Quantities: pieces, kilo, tali, sako, box

Return JSON format:
{
  "detectedLanguage": "en|tl|ceb",
  "confidence": 95,
  "mixedLanguages": ["en", "tl"],
  "dominantLanguage": "tl",
  "culturalContext": "filipino|cebuano|formal|casual",
  "businessTerminology": ["manok", "pesos", "benta"]
}`;

      const response = await this.geminiProxy.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 300
      });

      const result = this.parseJSONResponse(response.text);
      
      return {
        detectedLanguage: result.detectedLanguage || 'en',
        confidence: result.confidence || 80,
        mixedLanguages: result.mixedLanguages || [],
        dominantLanguage: result.dominantLanguage || result.detectedLanguage || 'en',
        culturalContext: result.culturalContext || 'filipino',
        businessTerminology: result.businessTerminology || []
      };

    } catch (error) {
      console.error('Advanced language detection failed:', error);
      return {
        detectedLanguage: 'en',
        confidence: 50,
        mixedLanguages: [],
        dominantLanguage: 'en',
        culturalContext: 'filipino',
        businessTerminology: []
      };
    }
  }

  /**
   * Translate text between languages with business context preservation
   */
  async translateText(
    text: string,
    targetLanguage: LanguageCode,
    sourceLanguage?: LanguageCode
  ): Promise<TranslationResult> {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${text}-${sourceLanguage}-${targetLanguage}`;
    if (this.cachedTranslations.has(cacheKey)) {
      return this.cachedTranslations.get(cacheKey)!;
    }

    try {
      // Detect source language if not provided
      if (!sourceLanguage || sourceLanguage === 'auto') {
        sourceLanguage = await this.detectLanguage(text);
      }

      // No translation needed if source and target are the same
      if (sourceLanguage === targetLanguage) {
        const result: TranslationResult = {
          originalText: text,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          confidence: 100,
          businessTerms: [],
          metadata: {
            requestId,
            model: 'no-translation',
            processingTime: Date.now() - startTime,
            wordCount: text.split(' ').length
          }
        };
        return result;
      }

      const prompt = this.buildTranslationPrompt(text, sourceLanguage, targetLanguage);
      
      // Use Mistral for translation as it has good multilingual capabilities
      const response = await this.multiLLMProxy.generateText(prompt, {
        provider: 'mistral',
        temperature: 0.3,
        maxTokens: 1000,
        taskType: {
          complexity: 'medium',
          type: 'text',
          priority: 'medium'
        }
      });

      const translationData = this.parseTranslationResponse(response.text);
      
      const result: TranslationResult = {
        originalText: text,
        translatedText: translationData.translatedText || text,
        sourceLanguage,
        targetLanguage,
        confidence: translationData.confidence || 85,
        culturalContext: translationData.culturalContext,
        businessTerms: translationData.businessTerms || [],
        metadata: {
          requestId,
          model: 'mistral',
          processingTime: Date.now() - startTime,
          wordCount: text.split(' ').length
        }
      };

      // Cache the result
      this.cachedTranslations.set(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('Translation failed:', error);
      
      // Fallback: return original text
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: sourceLanguage || 'en',
        targetLanguage,
        confidence: 0,
        businessTerms: [],
        metadata: {
          requestId,
          model: 'fallback',
          processingTime: Date.now() - startTime,
          wordCount: text.split(' ').length
        }
      };
    }
  }

  /**
   * Localize output for UI display with cultural context
   */
  async localizeOutput(
    content: any,
    targetLanguage: LanguageCode,
    culturalContext?: CulturalContext,
    userRole?: 'owner' | 'worker'
  ): Promise<any> {
    if (targetLanguage === 'en') {
      return content; // No localization needed for English
    }

    try {
      const textContent = typeof content === 'string' ? content : JSON.stringify(content);
      
      const prompt = this.buildLocalizationPrompt(textContent, targetLanguage, culturalContext, userRole);
      
      const response = await this.geminiProxy.generateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: 1500
      });

      // If original content was JSON, try to parse the response back to JSON
      if (typeof content === 'object') {
        try {
          return JSON.parse(response.text);
        } catch {
          return { localizedContent: response.text };
        }
      }

      return response.text;

    } catch (error) {
      console.error('Localization failed:', error);
      return content; // Return original content if localization fails
    }
  }

  /**
   * Get business terminology in specific language
   */
  getBusinessTerm(englishTerm: string, targetLanguage: LanguageCode): string {
    const termMap = this.businessTerminology.get(englishTerm.toLowerCase());
    if (termMap && termMap.has(targetLanguage)) {
      return termMap.get(targetLanguage)!;
    }
    return englishTerm; // Fallback to English term
  }

  /**
   * Get common phrase in specific language
   */
  getCommonPhrase(phraseKey: string, targetLanguage: LanguageCode): string {
    const phraseMap = this.commonPhrases.get(targetLanguage);
    if (phraseMap && phraseMap.has(phraseKey)) {
      return phraseMap.get(phraseKey)!;
    }
    return phraseKey; // Fallback to key
  }

  /**
   * Format currency for Filipino context
   */
  formatCurrency(amount: number, language: LanguageCode): string {
    const formattedAmount = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);

    switch (language) {
      case 'tl':
        return formattedAmount.replace('PHP', '₱').replace('₱', '₱ ') + ' pesos';
      case 'ceb':
        return formattedAmount.replace('PHP', '₱').replace('₱', '₱ ') + ' pesos';
      default:
        return formattedAmount;
    }
  }

  /**
   * Format numbers with Filipino context
   */
  formatNumber(num: number, language: LanguageCode): string {
    const formatted = num.toLocaleString('en-PH');
    
    if (language === 'tl' || language === 'ceb') {
      return formatted; // Filipino numbering system is similar to English
    }
    
    return formatted;
  }

  /**
   * Build translation prompt with business context
   */
  private buildTranslationPrompt(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode
  ): string {
    const sourceLanguageName = this.getLanguageName(sourceLanguage);
    const targetLanguageName = this.getLanguageName(targetLanguage);
    
    return `You are a professional translator specializing in Filipino chicken business operations.

TRANSLATION TASK:
Translate from ${sourceLanguageName} to ${targetLanguageName}

SOURCE TEXT:
"${text}"

TRANSLATION GUIDELINES:
1. Preserve business terminology and context
2. Maintain professional tone appropriate for chicken business
3. Keep numerical values (prices, quantities) exactly as they are
4. Use appropriate business language for ${targetLanguageName}
5. Consider cultural context and local business practices
6. Preserve proper nouns (names, places, brands)

BUSINESS TERMINOLOGY REFERENCE:
- Chicken: manok (Tagalog/Cebuano)
- Money/Payment: bayad, pesos, halaga
- Buy: bili (Tagalog), palit (Cebuano)
- Sell: benta (Tagalog), baligya (Cebuano)
- Business: negosyo, tindahan
- Customer: customer, mamimili, kostumer
- Supplier: supplier, tagbigay
- Branch: sangay, branch

Return JSON format:
{
  "translatedText": "translated content here",
  "confidence": 95,
  "culturalContext": "filipino|cebuano|formal",
  "businessTerms": ["manok", "pesos"]
}`;
  }

  /**
   * Build localization prompt for UI content
   */
  private buildLocalizationPrompt(
    content: string,
    targetLanguage: LanguageCode,
    culturalContext?: CulturalContext,
    userRole?: string
  ): string {
    const languageName = this.getLanguageName(targetLanguage);
    const roleContext = userRole === 'owner' ? 'business owner' : userRole === 'worker' ? 'worker/employee' : 'user';
    
    return `You are a localization specialist for Filipino chicken business software.

LOCALIZATION TASK:
Adapt this content for ${languageName} speaking ${roleContext} in the Philippines.

CONTENT TO LOCALIZE:
${content}

LOCALIZATION REQUIREMENTS:
1. Use natural, conversational ${languageName} appropriate for business context
2. Maintain technical accuracy while making it culturally relevant
3. Use local business terminology and expressions
4. Consider the user is a ${roleContext} in a chicken business
5. Keep the same information structure and important details
6. Make it sound natural for Filipino ${roleContext}s
7. Use appropriate level of formality for ${culturalContext || 'business'} context

CULTURAL CONSIDERATIONS:
- Use Filipino business etiquette and communication style
- Include appropriate honorifics when addressing business owners
- Use familiar terms for chicken business operations
- Consider regional variations if targeting specific areas
- Maintain respect and professionalism

LANGUAGE STYLE:
- ${targetLanguage === 'tl' ? 'Clear Tagalog with occasional English technical terms' : 'Clear Cebuano with occasional English technical terms'}
- Business-appropriate but friendly tone
- Easy to understand for everyday users
- Practical and actionable language

Return the localized content directly (no JSON wrapper needed).`;
  }

  /**
   * Initialize business terminology mappings
   */
  private initializeBusinessTerminology(): void {
    const terms = [
      // Poultry terms
      ['chicken', new Map([['en', 'chicken'], ['tl', 'manok'], ['ceb', 'manok']])],
      ['egg', new Map([['en', 'egg'], ['tl', 'itlog'], ['ceb', 'itlog']])],
      ['rooster', new Map([['en', 'rooster'], ['tl', 'tandang'], ['ceb', 'sunoy']])],
      ['hen', new Map([['en', 'hen'], ['tl', 'inahin'], ['ceb', 'inahin']])],
      
      // Business terms
      ['business', new Map([['en', 'business'], ['tl', 'negosyo'], ['ceb', 'negosyo']])],
      ['store', new Map([['en', 'store'], ['tl', 'tindahan'], ['ceb', 'tindahan']])],
      ['market', new Map([['en', 'market'], ['tl', 'palengke'], ['ceb', 'merkado']])],
      ['customer', new Map([['en', 'customer'], ['tl', 'kostumer'], ['ceb', 'kostumer']])],
      ['supplier', new Map([['en', 'supplier'], ['tl', 'supplier'], ['ceb', 'supplier']])],
      ['branch', new Map([['en', 'branch'], ['tl', 'sangay'], ['ceb', 'sanga']])],
      
      // Financial terms
      ['money', new Map([['en', 'money'], ['tl', 'pera'], ['ceb', 'kwarta']])],
      ['price', new Map([['en', 'price'], ['tl', 'presyo'], ['ceb', 'presyo']])],
      ['payment', new Map([['en', 'payment'], ['tl', 'bayad'], ['ceb', 'bayad']])],
      ['profit', new Map([['en', 'profit'], ['tl', 'kita'], ['ceb', 'ganansya']])],
      ['expense', new Map([['en', 'expense'], ['tl', 'gastos'], ['ceb', 'gasto']])],
      ['income', new Map([['en', 'income'], ['tl', 'kita'], ['ceb', 'kita']])],
      
      // Actions
      ['buy', new Map([['en', 'buy'], ['tl', 'bili'], ['ceb', 'palit']])],
      ['sell', new Map([['en', 'sell'], ['tl', 'benta'], ['ceb', 'baligya']])],
      ['order', new Map([['en', 'order'], ['tl', 'order'], ['ceb', 'order']])],
      ['deliver', new Map([['en', 'deliver'], ['tl', 'deliver'], ['ceb', 'deliver']])],
      ['pickup', new Map([['en', 'pickup'], ['tl', 'kuha'], ['ceb', 'kuha']])],
      
      // Quantities
      ['piece', new Map([['en', 'piece'], ['tl', 'piraso'], ['ceb', 'ka buok']])],
      ['kilo', new Map([['en', 'kilo'], ['tl', 'kilo'], ['ceb', 'kilo']])],
      ['box', new Map([['en', 'box'], ['tl', 'kahon'], ['ceb', 'kahon']])],
      ['sack', new Map([['en', 'sack'], ['tl', 'sako'], ['ceb', 'sako']])],
      
      // Time
      ['today', new Map([['en', 'today'], ['tl', 'ngayon'], ['ceb', 'karon']])],
      ['yesterday', new Map([['en', 'yesterday'], ['tl', 'kahapon'], ['ceb', 'kagahapon']])],
      ['tomorrow', new Map([['en', 'tomorrow'], ['tl', 'bukas'], ['ceb', 'ugma']])],
      ['week', new Map([['en', 'week'], ['tl', 'linggo'], ['ceb', 'semana']])],
      ['month', new Map([['en', 'month'], ['tl', 'buwan'], ['ceb', 'buwan']])],
    ];

    terms.forEach(([term, translations]) => {
      this.businessTerminology.set(term as string, translations as Map<LanguageCode, string>);
    });
  }

  /**
   * Initialize common phrases for UI
   */
  private initializeCommonPhrases(): void {
    // Tagalog phrases
    this.commonPhrases.set('tl', new Map([
      ['welcome', 'Maligayang pagdating'],
      ['thank_you', 'Salamat'],
      ['please_wait', 'Sandali lang po'],
      ['loading', 'Naglo-load...'],
      ['error', 'May problema'],
      ['success', 'Matagumpay'],
      ['save', 'I-save'],
      ['cancel', 'Kanselahin'],
      ['confirm', 'Kumpirmahin'],
      ['delete', 'Burahin'],
      ['edit', 'I-edit'],
      ['view', 'Tingnan'],
      ['add', 'Magdagdag'],
      ['remove', 'Alisin'],
      ['search', 'Maghanap'],
      ['filter', 'I-filter'],
      ['sort', 'Ayusin'],
      ['total', 'Kabuuan'],
      ['subtotal', 'Subtotal'],
      ['quantity', 'Dami'],
      ['amount', 'Halaga'],
      ['date', 'Petsa'],
      ['time', 'Oras'],
      ['location', 'Lugar'],
      ['status', 'Status'],
      ['active', 'Aktibo'],
      ['inactive', 'Hindi aktibo'],
      ['pending', 'Naghihintay'],
      ['completed', 'Tapos na'],
      ['failed', 'Nabigo'],
    ]));

    // Cebuano phrases
    this.commonPhrases.set('ceb', new Map([
      ['welcome', 'Maayong pag-abot'],
      ['thank_you', 'Salamat'],
      ['please_wait', 'Palihug paghulat'],
      ['loading', 'Nagload...'],
      ['error', 'May sayop'],
      ['success', 'Malampuson'],
      ['save', 'I-save'],
      ['cancel', 'Kanselahon'],
      ['confirm', 'Kumpirmahon'],
      ['delete', 'Papahaon'],
      ['edit', 'I-edit'],
      ['view', 'Tan-awon'],
      ['add', 'Idugang'],
      ['remove', 'Kuhaa'],
      ['search', 'Pangitaa'],
      ['filter', 'I-filter'],
      ['sort', 'Sundon'],
      ['total', 'Tanan'],
      ['subtotal', 'Subtotal'],
      ['quantity', 'Gidaghanon'],
      ['amount', 'Kantidad'],
      ['date', 'Petsa'],
      ['time', 'Oras'],
      ['location', 'Lugar'],
      ['status', 'Status'],
      ['active', 'Aktibo'],
      ['inactive', 'Dili aktibo'],
      ['pending', 'Naghulat'],
      ['completed', 'Human na'],
      ['failed', 'Napakyas'],
    ]));

    // English phrases (for completeness)
    this.commonPhrases.set('en', new Map([
      ['welcome', 'Welcome'],
      ['thank_you', 'Thank you'],
      ['please_wait', 'Please wait'],
      ['loading', 'Loading...'],
      ['error', 'Error'],
      ['success', 'Success'],
      ['save', 'Save'],
      ['cancel', 'Cancel'],
      ['confirm', 'Confirm'],
      ['delete', 'Delete'],
      ['edit', 'Edit'],
      ['view', 'View'],
      ['add', 'Add'],
      ['remove', 'Remove'],
      ['search', 'Search'],
      ['filter', 'Filter'],
      ['sort', 'Sort'],
      ['total', 'Total'],
      ['subtotal', 'Subtotal'],
      ['quantity', 'Quantity'],
      ['amount', 'Amount'],
      ['date', 'Date'],
      ['time', 'Time'],
      ['location', 'Location'],
      ['status', 'Status'],
      ['active', 'Active'],
      ['inactive', 'Inactive'],
      ['pending', 'Pending'],
      ['completed', 'Completed'],
      ['failed', 'Failed'],
    ]));
  }

  /**
   * Helper methods
   */
  private getLanguageName(code: LanguageCode): string {
    switch (code) {
      case 'tl': return 'Tagalog';
      case 'ceb': return 'Cebuano';
      case 'en': return 'English';
      default: return 'English';
    }
  }

  private parseJSONResponse(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('JSON parsing failed:', error);
      return {};
    }
  }

  private parseTranslationResponse(text: string): any {
    try {
      const result = this.parseJSONResponse(text);
      if (result.translatedText) {
        return result;
      }
      
      // If no JSON structure, treat the entire text as translation
      return {
        translatedText: text,
        confidence: 75,
        businessTerms: []
      };
    } catch (error) {
      return {
        translatedText: text,
        confidence: 50,
        businessTerms: []
      };
    }
  }
}

export default MultilingualService;