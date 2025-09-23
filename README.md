# mcp-server

Add to .env:
JWT_SECRET=your_jwt_secret_here (generate a strong one, e.g., via openssl rand -hex 32)

## Real-Time WebSockets

For live voice parsing (e.g., orders with inaccuracies), use WebSockets on port 3002.

### Client Example (Browser with Web Speech API)
```javascript
const ws = new WebSocket('ws://localhost:3002'); // Add ?token=your-jwt for auth
ws.onopen = () => console.log('Connected');
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.onresult = (event) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const chunk = event.results[i][0].transcript;
    ws.send(JSON.stringify({
      toolName: 'live_voice_stream',
      params: { streamId: 'session1', transcriptChunk: chunk, products: [{id: 'whole', name: 'Whole Chicken'}] }
    }));
  }
};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.partialParse) console.log('Partial:', data.partialParse); // e.g., {items: [{productId: 'whole', qty: 2}], confidence: 0.8}
  if (data.final) console.log('Final sales:', data.final); // Structured {items, payment}
  if (data.streamChunk) console.log('Gemini correction:', data.streamChunk);
};
recognition.start();
```

### Server Protocol
- Connect: ws://localhost:3002 (upgrade with Authorization: Bearer <jwt>)
- Send: JSON {toolName: 'live_voice_stream', params: {streamId, transcriptChunk, products?}}
- Receive: Streamed {partialParse: {...}, confidence: number} or {final: {structuredSales: {...}}, streamId}
- Timeout: 5s for final parse; fuzzy + Gemini streaming handles "chikin" → "Whole Chicken".

Integrate with Todo 1 auth for secure streams.

## Database Migrations

The server auto-migrates the DB on startup using service role (runs sql/enhanced-database-schema.sql if tables missing, idempotent check via notes table).

- **Auto**: On npm run dev/start, migrate() called in constructor—logs to ai_audit_logs.
- **Manual**: Build (npm run build), then node dist/migrate.js (standalone run, logs errors).
- **Schema**: Edit sql/enhanced-database-schema.sql for changes (tables: notes, entities, relations, observations, ai_audit_logs, products, sales; pgvector indexes).
- **Fallback**: If fails, manual Supabase SQL editor run schema.sql (service role bypasses RLS).

## Scalability

For production scale, use cluster mode:
- Run: npm run start:cluster (env WORKERS=4 for multi-core).
- Guide: See [MD files/scalability.md](MD files/scalability.md) for multi-instance, concurrency opts (batch=5), load balancing (WS sticky).

## API Integration Examples

### Note Workflow (curl with JWT)
1. Auth: curl -X POST http://localhost:3002/auth -H "Content-Type: application/json" -d '{"token":"your_mcp_auth_token"}' → {"token": "jwt_here"}

2. Collect note: curl -X POST http://localhost:3002/api/tools/call -H "Authorization: Bearer jwt_here" -H "Content-Type: application/json" -d '{"name":"note_collection","arguments":{"content":"Bought 20 bags whole chicken for 10000 pesos","userRole":"owner"}}' → {"success":true,"result":{"note_id":"uuid","message":"Note collected"}}

3. Parse: curl -X POST ... -d '{"name":"parse_chicken_note","arguments":{"note_id":"uuid"}}' → {"success":true,"result":{"parsed_data":{"purchases":[{"productId":"whole","qty":20,"cost":10000}],"status":"parsed"}}}

4. Apply: curl -X POST ... -d '{"name":"apply_to_stock","arguments":{"note_id":"uuid"}}' → {"success":true,"message":"Stock updated"}

### Deployment (Heroku/Codespace)
- Heroku: heroku create, git push heroku main, heroku config:set GEMINI_API_KEY=... SUPABASE_URL=... JWT_SECRET=... WORKERS=4
- Procfile: web: npm run start:cluster
- Codespace: npm run dev:cluster (env WORKERS=2)
- Scale: heroku ps:scale web=2 (multi-dyno load balance)

### Troubleshooting
- Proxy retries: AdvancedGeminiProxy backoff 3x on 429/5xx (check logs).
- Rate limits: 10/min/user (Todo 1, 429 error); increase env MAX_REQUESTS_PER_MINUTE.
- DB issues: Auto-migrate on start; manual node dist/migrate.js if fail (check ai_audit_logs).
- WS auth: ws://localhost:3002?token=jwt_here for live_voice_stream.

## Integration Examples

### Note Workflow (curl with JWT)
1. Auth: curl -X POST http://localhost:3002/auth -H "Content-Type: application/json" -d '{"token":"your_mcp_auth_token"}' (get JWT).

2. Collect Note: curl -X POST http://localhost:3002/api/tools/call -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" -d '{"name":"note_collection","arguments":{"content":"Bought 20 bags whole chicken for ₱10k","userRole":"owner"}}' (response {note_id, success}).

3. Parse: curl -X POST ... -d '{"name":"parse_chicken_note","arguments":{"note_id":"<id>"}}' (response {parsed: {purchases: [{productId:"whole", qty:20, cost:10000}]}}).

4. Apply: curl -X POST ... -d '{"name":"apply_to_stock","arguments":{"note_id":"<id>","dry_run":false}}' (response {success, stockUpdated}).

### Voice Stream (WS)
See Real-Time WebSockets section.

### Forecast: curl -X POST ... -d '{"name":"forecast_stock","arguments":{"salesHistory":[{"date":"2025-09-22","amount":5000}]}}' (response {predictedSales: [{day:"1", amount:5500, confidence:0.8}], summary}).

## Deployment

### Heroku
1. Procfile: web: npm start:cluster
2. Env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MCP_AUTH_TOKEN, JWT_SECRET, PORT=3002, WORKERS=2
3. Deploy: git push heroku main; heroku scale web=2 (multi-dyno for scale).

### Codespace
1. .devcontainer/devcontainer.json: postCreateCommand "npm i && npm run build"
2. Run: npm run dev:cluster (env WORKERS=4)

See scalability.md for multi-instance.

## Troubleshooting

- **Proxy Retries**: advanced-gemini-proxy.ts backoff on 429/5xx (env GEMINI_RETRY_MAX=3).
- **Rate Limits**: 10/min/user (per Todo 1); 429 response—wait 60s.
- **DB Issues**: Auto-migrate on start; manual node dist/migrate.js if fail (check Supabase logs).
- **Auth Errors**: 401/403—verify JWT expiry (1h, refresh via /auth); MCP_AUTH_TOKEN in .env.
- **Tool Errors**: 422 validation (check schemas in openapi.yaml); log ai_audit_logs for details.
- **WS Disconnect**: Reconnect on close, pass token in query ?token=<jwt>.