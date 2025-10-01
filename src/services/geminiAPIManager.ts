/**
 * Gemini API Manager - Stub Implementation
 * Provides compatibility for legacy imports
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

export class GeminiAPIManager {
  private genAI: any;

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '');
  }

  async generateText(prompt: string, options: any = {}) {
    const model = this.genAI.getGenerativeModel({ model: options.model || 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      model: options.model || 'gemini-2.0-flash',
      success: true
    };
  }

  async generateEmbeddings(texts: string[]) {
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddings = [];
    
    for (const text of texts) {
      const result = await model.embedContent(text);
      embeddings.push(result.embedding.values);
    }
    
    return { embeddings, model: 'text-embedding-004' };
  }

  isHealthy() {
    return !!process.env.GEMINI_API_KEY;
  }

  async makeRequest(prompt: string, options: any = {}) {
    return this.generateText(prompt, options);
  }

  async parseChickenNote(content: string) {
    const prompt = `Parse this chicken business note and return structured data: "${content}"`;
    return this.generateText(prompt, { model: 'gemini-2.0-flash' });
  }

  async callGemini(prompt: string, options: any = {}) {
    return this.generateText(prompt, options);
  }

  async generateInsights(salesData: any, expenseData: any) {
    const prompt = `Generate business insights from this data:
Sales: ${JSON.stringify(salesData)}
Expenses: ${JSON.stringify(expenseData)}`;
    return this.generateText(prompt, { model: 'gemini-2.0-flash' });
  }
}

// Export singleton
export const geminiAPIManager = new GeminiAPIManager();