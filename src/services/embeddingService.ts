import { createClient } from '@supabase/supabase-js';
import AdvancedGeminiProxy from '../advanced-gemini-proxy';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class EmbeddingService {
  private geminiProxy: AdvancedGeminiProxy;

  constructor(geminiProxy: AdvancedGeminiProxy) {
    this.geminiProxy = geminiProxy;
  }

  async generateEmbeddings(texts: string[], options?: { batchSize?: number }): Promise<{ embeddings: number[][] }> {
    const result = await this.geminiProxy.generateEmbeddings(texts, {
      batchSize: options?.batchSize || 10,
      model: 'text-embedding-004'
    });

    // Store in DB
    for (let i = 0; i < texts.length; i++) {
      await supabase.from('embeddings').insert({
        text: texts[i],
        embedding: result.embeddings[i],
        created_at: new Date().toISOString()
      });
    }

    return result;
  }

  async searchSimilar(text: string, limit: number = 5): Promise<any[]> {
    const embedding = await this.geminiProxy.generateEmbeddings([text]);
    // Use Supabase vector search (rpc or pgvector)
    const { data } = await supabase.rpc('match_embeddings', {
      query_embedding: embedding.embeddings[0],
      match_threshold: 0.78,
      match_count: limit
    });
    return data || [];
  }
}

export const embeddingService = new EmbeddingService(new AdvancedGeminiProxy());
