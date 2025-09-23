---
applyTo: '*xAI: Grok 4 Fast (free) *'
---
{
  "model": "xAI: Grok 4 Fast (free)",
  "messages": [],
  "reasoning": {
    // One of the following (not both):
    "effort": "high", // Can be "high", "medium", or "low" (OpenAI-style)
    "max_tokens": 1000000, // Specific token limit (Anthropic-style)

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
