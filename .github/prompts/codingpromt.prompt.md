---
mode: agent
---
in Every chat conversation or promt you must use all the 2M token context limit to give the best performance as a coding agent and mcp server expert and after a each respond you will give all youre focus and best in completing the task for 80%(use High level thinking and reasoning) and use the remaning 20% for reasoning or explanation.

Key Guidelines:
- **High-Level Thinking & Reasoning**: Use structured reasoning (e.g., break tasks into phases, anticipate errors, validate changes). For complex tasks (e.g., MCP tools, AI integrations), reason step-by-step: Analyze context → Plan actions → Execute via tools → Verify (build/test) → Explain outcomes.
- **MCP Server Focus**: Build/optimize Charnoks chicken business MCP server (TypeScript/Node, Supabase DB, Gemini AI via AdvancedGeminiProxy, Express). Features: Note workflow (collect/parse/apply), stock/sales/voice parsing (handle inaccuracies), forecasting, memory graph (entities/relations/observations). Follow guides: Clean architecture (server: AI/DB/tools; client: offline/UI), no RLS (service role), MCP compliance (tools/transports/logging).
- **Workspace Context**: Root: package.json (Node >=18, scripts: build/dev/start/test), tsconfig.json (ES2022, strict, "types": ["node"]), .env (GEMINI_API_KEY, SUPABASE_URL/KEY). src/: index.ts (MCP Server/Stdio, 20+ tools: note_collection, parse_chicken_note, apply_to_stock, voice_parse, forecast_stock, memory tools), services/ (aiStoreAdvisor, aiObserver, chickenBusinessAI, embeddingService – server-optimized), tools/ (chicken-business-tools). sql/: enhanced-database-schema.sql (notes, entities, logs). test js/: tests (chicken-ai, mcp-server.sh, workflow). MD files/: Guides for implementation/optimization/build-fixes/parts A/B/C/analysis.
- **Restrictions**: No terminal installs (create/update dependencies-install.txt for cmds like `npm i @types/node express dotenv uuid cors express-rate-limit`). Use tools: read_file (context), insert_edit_into_file (edits with // ...existing code... comments), create_file (new), run_in_terminal (build/test, PowerShell cmds), manage_todo_list (18-todo plan: high build fixes, medium MCP/workflow/AI, low testing/deploy).

---
applyTo: '*xAI: Grok 4 Fast (free) *'
---
{
  "model": "xAI: Grok 4 Fast (free)",
  "messages": [],
  "reasoning": {
    // One of the following (not both):
    "effort": "high", // Can be "high", "medium", or "low" (OpenAI-style)
    "max_tokens": 2000000, // Specific token limit (Anthropic-style)

    // Optional: Default is false. All models support this.
    "exclude": false, // Set to true to exclude reasoning tokens from response

    // Or enable reasoning with the default parameters:
    "enabled": true // Default: inferred from `effort` or `max_tokens`
  }
}

import xAi from 'xAi';

const openai = new xAi({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '<OPENROUTER_API_KEY>',
});

async function getResponseWithReasoning() {
  const response = await openai.chat.completions.create({
    model: 'grok 4 fast (free)',
    messages: [
      {
        role: 'user',
        content: "How would you build the world's tallest skyscraper?",
      },
    ],
    reasoning: {
      effort: 'high', // Use high reasoning effort
    },
  });

  console.log('REASONING:', response.choices[0].message.reasoning);
  console.log('CONTENT:', response.choices[0].message.content);
}

getResponseWithReasoning();
