import { supabase } from '../src/supabaseConfig';
import { rateLimitService } from './rateLimitService';
import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Generate embeddings for notes (ChatGPT plan requirement)
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!ai) throw new Error('API key not configured');
  
  return rateLimitService.execute(async () => {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      content: { parts: [{ text }] }
    });
    
    return response.embedding.values;
  });
};

// Store embedding in database
export const storeNoteEmbedding = async (noteId: string, text: string) => {
  try {
    const embedding = await generateEmbedding(text);
    
    const { error } = await supabase
      .from('note_embeddings')
      .insert({
        note_id: noteId,
        embedding
      });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Failed to store embedding:', error);
    return { success: false, error };
  }
};

// Similarity search for RAG
export const findSimilarNotes = async (queryText: string, limit = 5) => {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    
    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Similarity search failed:', error);
    return [];
  }
};

// Batch embedding generation (nightly job)
export const batchGenerateEmbeddings = async () => {
  try {
    // Get notes without embeddings
    const { data: notes } = await supabase
      .from('notes')
      .select('id, content')
      .not('id', 'in', 
        supabase.from('note_embeddings').select('note_id')
      )
      .limit(10); // Process 10 at a time
    
    if (!notes || notes.length === 0) return { processed: 0 };
    
    // Batch process with rate limiting
    const operations = notes.map(note => 
      () => storeNoteEmbedding(note.id, note.content)
    );
    
    await rateLimitService.batch(operations);
    
    return { processed: notes.length };
  } catch (error) {
    console.error('Batch embedding failed:', error);
    return { processed: 0, error };
  }
};