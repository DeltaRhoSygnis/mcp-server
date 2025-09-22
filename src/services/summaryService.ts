import { supabase } from '../src/supabaseConfig';
import { logAIInteraction } from '../utils/qPrompts';

// ChatGPT Plan: Generate daily summaries for branches
export const generateDailySummary = async (branchId: string, date: string, operations: any[]) => {
  try {
    const prompt = `Using these operations ${JSON.stringify(operations)}, produce a detailed human-readable summary for ${branchId} for ${date} that includes:
- total bags received,
- total parts produced, 
- total cooked,
- total sold (by part & neck),
- leftovers (count & suggested price),
- anomalies (e.g., mismatch between produced and accounted-for).
Output JSON:
{"branch_id":"${branchId}","date":"${date}","total_received_bags":0,"total_parts_produced":0,"total_cooked_parts":0,"total_sold_parts":0,"leftovers":[],"anomalies":[]}`;

    // Calculate summary from operations
    const summary = {
      branch_id: branchId,
      date,
      total_received_bags: operations.filter(op => op.type === 'transfer').reduce((sum, op) => sum + (op.data.bags || 0), 0),
      total_parts_produced: operations.filter(op => op.type === 'production').reduce((sum, op) => sum + (op.data.parts || 0), 0),
      total_cooked_parts: operations.filter(op => op.type === 'cook').reduce((sum, op) => sum + (op.data.parts || 0), 0),
      total_sold_parts: operations.filter(op => op.type === 'sale').reduce((sum, op) => sum + (op.data.parts_sold || 0), 0),
      leftovers: [],
      anomalies: []
    };

    // Store in summaries table
    const { data, error } = await supabase
      .from('summaries')
      .upsert({ branch_id: branchId, date, summary })
      .select()
      .single();

    if (error) throw error;

    // Log AI interaction
    await logAIInteraction(prompt, JSON.stringify(summary));

    return { success: true, data };
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return { success: false, error: 'Summary generation failed' };
  }
};