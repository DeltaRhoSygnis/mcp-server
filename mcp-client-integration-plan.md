# MCP Client Frontend Integration Plan

This plan outlines how to integrate the MCP server (tools like note_collection, live_voice_stream, search_business_context) with your existing frontend workspace (basic recording functions). Assume existing frontend is React/Vue/JS with voice recording—enhance for MCP calls, offline sync, graph viz. Focus: Offline-first (IndexedDB queue/sync), auth (JWT from /auth), WS for live voice (Todo 2), RLS Supabase for client DB.

## Prerequisites
- Existing frontend workspace (e.g., React app with recording via Web Speech API).
- .env in frontend: SUPABASE_ANON_KEY (from server .env), SERVER_URL='http://localhost:3002', JWT_SECRET (for local auth if needed).
- Install deps: npm i @supabase/supabase-js dexie react-router-dom ws (for WS); optional react-graph-vis for graph, tailwindcss for UI.

## Phase 1: Auth & MCP Tool Calls (1-2 days)
1. **JWT Auth**: Add login component (fetch /auth with MCP_AUTH_TOKEN from env, store JWT in localStorage). All API calls: fetch(`${SERVER_URL}/api/tools/call`, { headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify({name: 'note_collection', arguments: {content, userRole}}) }).
2. **Tool List**: Fetch /api/tools on load (GET with Bearer), store in state (array of {name, description, inputSchema}).
3. **Notes Input**: Enhance existing form—on submit, call note_collection (params: {content, userRole: 'owner'|'worker'}), display response (note_id, next_step: 'Parse?'). Button for parse_chicken_note (fetch call with note_id).
4. **Apply/Forecast**: Buttons for apply_to_stock (dry_run preview), forecast_stock (salesHistory from local DB).

## Phase 2: Voice Recording with Live Stream (1 day)
1. **WS Integration**: In recording component, on start: const ws = new WebSocket(`${SERVER_URL.replace('http', 'ws')}?token=${jwt}`); recognition.continuous = true; interimResults = true; onresult: ws.send(JSON.stringify({toolName: 'live_voice_stream', params: {streamId: Date.now(), transcriptChunk: result.transcript, products: localProducts }})).
2. **Stream Handling**: ws.onmessage: Parse data—display partialParse (e.g., "Detected: 2 Whole Chicken, confidence 80%"), final for recordSale (call sales tool).
3. **Fallback**: If WS fails, buffer transcript, call voice_parse on end.

## Phase 3: Offline Sync with Supabase RLS (2 days)
1. **Supabase Client**: Create supabaseClient.ts (createClient(SUPABASE_URL, ANON_KEY, {auth: {persistSession: false}})); RLS queries (e.g., .from('notes').select('*').eq('branch_id', localBranch).order('created_at', {ascending: false})).
2. **IndexedDB (Dexie)**: Create db.js (Dexie db with tables 'notes' {id, content, status, localSync: boolean}, 'entities' {name, type, observations}). On offline: db.notes.add({content, status: 'pending', localSync: false}); on online: Queue sync (db.notes.where('localSync').equals(false).toArray(), then supabase.upsert, mark synced).
3. **Sync Logic**: Use navigator.onLine event; periodic sync (setInterval 30s); conflict resolve (server wins or timestamp).
4. **Local State**: Notes list from db (if offline) or Supabase (online, merge).

## Phase 4: Memory Graph Visualization (1 day)
1. **Fetch Context**: Button "View Memory Graph" → fetch /api/tools/call search_business_context ({query: 'chicken stock', entityTypes: ['product', 'supplier']}), get {entities, relations, observations}.
2. **Graph Component**: Use react-graph-vis (npm i react-graph-vis vis-network); nodes: entities (label: name, shape: 'box', color by type); edges: relations (from/to, label: type). Example:
   ```tsx
   import { Graph } from 'react-graph-vis';
   const graph = { nodes: entities.map(e => ({id: e.id, label: e.name})), edges: relations.map(r => ({from: r.from_id, to: r.to_id, label: r.type})) };
   <Graph graph={graph} options={{physics: {enabled: true}}} />
   ```
3. **Integration**: In dashboard route, fetch on mount, render graph; click node → add_observation tool.

## Phase 5: UI/Offline Enhancements & Testing (1 day)
1. **Modern UI**: Add Tailwind (vite.config.ts plugin); components: NotesForm (input + submit), VoiceButton (start/stop recording, display partial), GraphDashboard (fetch/render).
2. **Offline UI**: Show "Offline Mode" banner (navigator.onLine); queue actions (e.g., "Note saved locally, syncing...").
3. **Routes**: React Router: /notes, /voice, /graph, /dashboard (tools list).
4. **Testing**: Manual: Offline (devtools network off, check IndexedDB); online sync; voice chunks → partials; graph render. Unit: Jest for sync logic.

## Deployment
- Build: npm run build (dist/ static).
- Serve: Integrate with server (static serve from index.ts app.use('/client', express.static('client/dist')) or separate Heroku.
- Env: SUPABASE_ANON_KEY, SERVER_URL.

Estimated: 5-7 days. Start with auth/tool calls on existing recording, then offline/graph. Questions? (e.g., existing frontend framework?)