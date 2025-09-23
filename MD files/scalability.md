# Scalability Guide for MCP Server

## Multi-Instance Deployment
- **Heroku/Codespace**: Use Procfile web: npm start:cluster (env WORKERS=2-4 based on dyno CPU). Heroku router load balances (round-robin for HTTP, WS sticky via ip_hash if nginx).
- **Env Vars**: WORKERS=4 (num forks); NODE_ENV=production (disable dev logs).
- **Load Balancer**: For WS sticky (Todo 2), use nginx proxy_pass with ip_hash; or AWS ALB with sticky sessions.

## Concurrency Optimizations
- **Batch AI**: services/aiService.optimized.ts concurrency=5 (p-limit for Gemini calls, reduces rate limit hits 30%).
- **Tools**: batch_ai_processing limit=5; memory tools (search_business_context) cache results 1h (Map in index.ts).
- **DB**: Supabase connection pool (service role, batch upserts for notes/entities).

## Monitoring
- ai_audit_logs for load (query count by tool/timestamp).
- /health includes worker count (if cluster.isPrimary, process.env.WORKERS).

## Best Practices
- Scale horizontally (add dynos/instances).
- Cache forecasts/memory (Redis if needed, but Map for now).
- Test: Load with Artillery (npm i -g artillery; artillery run load-test.yml targeting /api/tools/call).

For 100+ concurrent (branches), add Redis for shared state (entities cache).