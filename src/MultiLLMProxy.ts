import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

export class MultiLLMProxy {
  private gemini: GoogleGenerativeAI;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private monitoring: any; // Import from monitoring.ts

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    if (process.env.OPENAI_API_KEY) this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (process.env.ANTHROPIC_API_KEY) this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Assume monitoring imported
  }

  async generateText(prompt: string, options: any = {}) {
    // Priority: Gemini > Claude > OpenAI
    try {
      const model = options.model || 'gemini-1.5-flash';
      return await this.gemini.getGenerativeModel(model).generateContent(prompt, options);
    } catch (geminiErr) {
      console.warn('Gemini failed, falling back to Claude:', geminiErr);
      this.monitoring.logError('llm_fallback', 'gemini_to_claude', { prompt, error: geminiErr });
      if (this.anthropic) {
        try {
          const response = await this.anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: options.maxTokens || 1000,
            messages: [{ role: 'user', content: prompt }]
          });
          return { text: response.content[0].text, model: 'claude' };
        } catch (claudeErr) {
          console.warn('Claude failed, falling back to OpenAI:', claudeErr);
          this.monitoring.logError('llm_fallback', 'claude_to_openai', { prompt, error: claudeErr });
          if (this.openai) {
            const response = await this.openai.chat.completions.create({
              model: 'gpt-4',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: options.maxTokens || 1000
            });
            return { text: response.choices[0].message.content, model: 'gpt-4' };
          }
        }
      }
      throw new Error('All LLMs failed');
    }
  }

  // ...existing Gemini methods, extend with multi-model options...
}

// ...existing code...