import { createClient } from '@supabase/supabase-js';
import AdvancedGeminiProxy from '../advanced-gemini-proxy';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class ChickenBusinessAI {
  private geminiProxy: AdvancedGeminiProxy;

  constructor(geminiProxy: AdvancedGeminiProxy) {
    this.geminiProxy = geminiProxy;
  }

  async parseBusinessNote(noteContent: string): Promise<any> {
    const prompt = `Parse this chicken business note into structured JSON:

Content: "${noteContent}"

Extract:
1. Purchases: [{supplier, product, bags, units_per_bag, total_cost}]
2. Processing: [{input_bags, output_parts, output_necks}]
3. Sales: [{product, quantity, price, total_revenue}]
4. Transfers: [{from_branch, to_branch, items}]

Return valid JSON only.`;

    const response = await this.geminiProxy.generateText(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.1,
      maxOutputTokens: 1000,
      taskType: { complexity: 'medium', type: 'analysis', priority: 'medium' }
    });

    try {
      return JSON.parse(response.text);
    } catch {
      return { raw_content: noteContent, error: 'Parsing failed' };
    }
  }

  async learnPattern(pattern: any): Promise<void> {
    await supabase.from('business_patterns').insert(pattern);
  }

  // Other methods: analyzeEfficiency, predictDemand, etc.
}

export const chickenBusinessAI = new ChickenBusinessAI(new AdvancedGeminiProxy());
