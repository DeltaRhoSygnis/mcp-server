// Use require() for Google Generative AI to fix compilation issues
const { GoogleGenerativeAI } = require('@google/generative-ai');
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';
import { HfInference } from '@huggingface/inference';

export class MultiLLMProxy {
  private gemini: any;
  private openrouter: OpenAI | null = null; // OpenRouter uses OpenAI-compatible API
  private cohere: CohereClient | null = null;
  private hf: HfInference | null = null;
  private monitoring: any; // Import from monitoring.ts

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    // Initialize OpenRouter (OpenAI-compatible API)
    if (process.env.OPENROUTER_API_KEY) {
      this.openrouter = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1'
      });
    }
    
    // Initialize Cohere
    if (process.env.COHERE_API_KEY) {
      this.cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
    }
    
    // Initialize Hugging Face
    if (process.env.HF_TOKEN) {
      this.hf = new HfInference(process.env.HF_TOKEN);
    }
    
    // Assume monitoring imported
  }

  async generateText(prompt: string, options: any = {}) {
    // Priority: Gemini > Cohere > HuggingFace > OpenRouter
    try {
      const model = options.model || 'gemini-2.0-flash';
      const result = await this.gemini.getGenerativeModel(model).generateContent([{ text: prompt }]);
      return result.response;
    } catch (geminiErr) {
      console.warn('Gemini failed, falling back to Cohere:', geminiErr);
      this.monitoring?.logError('llm_fallback', 'gemini_to_cohere', { prompt, error: geminiErr });
      
      if (this.cohere) {
        try {
          const response = await this.cohere.generate({
            model: 'command-r-plus',
            prompt: prompt,
            maxTokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.3
          });
          return { text: response.generations[0].text, model: 'cohere' };
        } catch (cohereErr) {
          console.warn('Cohere failed, falling back to HuggingFace:', cohereErr);
          this.monitoring?.logError('llm_fallback', 'cohere_to_hf', { prompt, error: cohereErr });
          
          if (this.hf) {
            try {
              const response = await this.hf.textGeneration({
                model: 'microsoft/DialoGPT-medium',
                inputs: prompt,
                parameters: { max_new_tokens: options.maxTokens || 1000 }
              });
              return { text: response.generated_text, model: 'huggingface' };
            } catch (hfErr) {
              console.warn('HuggingFace failed, falling back to OpenRouter:', hfErr);
              this.monitoring?.logError('llm_fallback', 'hf_to_openrouter', { prompt, error: hfErr });
              
              if (this.openrouter) {
                const response = await this.openrouter.chat.completions.create({
                  model: 'anthropic/claude-3.5-sonnet',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: options.maxTokens || 1000
                });
                return { text: response.choices[0].message?.content || '', model: 'openrouter' };
              }
            }
          }
        }
      }
      throw new Error('All LLM providers failed');
    }
  }

  // ...existing Gemini methods, extend with multi-model options...
}

// ...existing code...