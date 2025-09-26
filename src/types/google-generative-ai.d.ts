// Type declarations for @google/generative-ai to resolve import issues
declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(options: { model: string }): GenerativeModel;
  }
  
  export class GenerativeModel {
    generateContent(parts: any[]): Promise<any>;
    generateText(prompt: string | any[]): Promise<any>;
  }
  
  export enum HarmCategory {
    HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
  }
  
  export enum HarmBlockThreshold {
    BLOCK_NONE = 'BLOCK_NONE',
    BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
    BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
    BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  }
  
  export interface GenerateRequest {
    contents: any[];
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  }
  
  export interface GenerateResponse {
    text: string;
    candidates?: any[];
  }
}