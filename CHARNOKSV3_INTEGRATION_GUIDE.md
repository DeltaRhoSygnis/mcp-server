# MCP Integration Setup Guide for Charnoksv3 Repository

This guide shows you exactly how to integrate your MCP server with your Charnoksv3 frontend/backend repository.

## Quick Start

1. **Deploy MCP Server to Render** (follow RENDER_DEPLOYMENT_GUIDE.md)
2. **Copy integration files to Charnoksv3**
3. **Update environment variables**
4. **Test integration**

## File Integration Steps

### Step 1: Copy Files to Charnoksv3

Copy these files from your MCP server to your Charnoksv3 repository:

```bash
# Copy integration files
cp mcpClient.ts /path/to/Charnoksv3/src/services/
cp mcpWebSocket.ts /path/to/Charnoksv3/src/services/
cp mcpIntegrationExamples.ts /path/to/Charnoksv3/src/services/
```

### Step 2: Install Required Dependencies

In your Charnoksv3 repository, install these dependencies if not already present:

```bash
npm install axios ws
npm install --save-dev @types/ws
```

### Step 3: Environment Configuration

Create or update your `.env` file in Charnoksv3:

```env
# MCP Server Configuration
MCP_SERVER_URL=https://your-mcp-server.onrender.com
MCP_AUTH_TOKEN=your_secure_auth_token_here
MCP_WEBSOCKET_URL=wss://your-mcp-server.onrender.com

# For development
# MCP_SERVER_URL=http://localhost:3002
# MCP_WEBSOCKET_URL=ws://localhost:3002
```

### Step 4: Initialize MCP Client

In your main application file (e.g., `src/App.tsx` or `src/main.ts`):

```typescript
import { initializeMCPClient } from './services/mcpIntegrationExamples';

// Initialize MCP client when app starts
const mcpClient = initializeMCPClient();

// Test connection
mcpClient.getHealthStatus().then(result => {
  console.log('MCP Server Status:', result);
});
```

## Integration Examples

### React Component Integration

```typescript
// In your React components
import { ChickenNoteProcessor, VoiceRecorder, MCPChatInterface } from './services/mcpIntegrationExamples';

function App() {
  return (
    <div className="app">
      <h1>Chicken Business Management</h1>
      
      {/* Process business notes */}
      <ChickenNoteProcessor />
      
      {/* Voice recording */}
      <VoiceRecorder />
      
      {/* AI chat */}
      <MCPChatInterface />
    </div>
  );
}
```

### Backend/API Integration

If you have a backend in Charnoksv3, add these API endpoints:

```typescript
// In your Express.js app
import express from 'express';
import { createNotesAPI, createMCPAuthMiddleware } from './services/mcpIntegrationExamples';
import { mcpClient } from './services/mcpClient';

const app = express();

// Add MCP authentication middleware
app.use('/api', createMCPAuthMiddleware(mcpClient));

// Add MCP endpoints
createNotesAPI(app, mcpClient);

app.listen(3000, () => {
  console.log('Server running with MCP integration');
});
```

### Direct API Usage

```typescript
// Anywhere in your code
import { mcpClient } from './services/mcpClient';

// Process a business note
async function handleBusinessNote(noteText: string) {
  const result = await mcpClient.processChickenNote({
    content: noteText,
    userRole: 'owner',
    branchId: 'main'
  });
  
  if (result.success) {
    console.log('Processed:', result.result);
    return result.result;
  } else {
    console.error('Error:', result.error);
    throw new Error(result.error);
  }
}

// Get AI business advice
async function getAIAdvice(question: string) {
  const result = await mcpClient.getBusinessAdvice({
    question,
    userRole: 'owner',
    context: { /* your business context */ }
  });
  
  return result.success ? result.result : null;
}
```

## Features Available

### 1. Business Note Processing
- Automatic parsing of chicken business transactions
- Stock level updates
- Financial tracking
- Inventory management

### 2. AI Business Advisory
- Smart business recommendations
- Profit optimization suggestions
- Market analysis
- Financial planning

### 3. Voice Recognition
- Real-time voice-to-text
- Business note dictation
- Hands-free operation
- Multi-language support

### 4. Real-time Chat
- AI assistant chat
- WebSocket-based communication
- Instant responses
- Context-aware conversations

### 5. Offline Support
- IndexedDB for offline storage
- Automatic sync when online
- Offline-first architecture
- Data persistence

## Testing the Integration

### 1. Basic Health Check

```typescript
import { mcpClient } from './services/mcpClient';

// Test if MCP server is running
async function testConnection() {
  const health = await mcpClient.getHealthStatus();
  console.log('MCP Server Health:', health);
  
  if (health.success) {
    console.log('✅ MCP server is running');
    console.log('Server info:', health.result);
  } else {
    console.log('❌ MCP server connection failed');
  }
}

testConnection();
```

### 2. Test Note Processing

```typescript
async function testNoteProcessing() {
  const result = await mcpClient.processChickenNote({
    content: "Sold 50 pieces whole chicken at 280 each to customer Maria",
    userRole: 'owner',
    branchId: 'main'
  });
  
  console.log('Note processing result:', result);
}
```

### 3. Test AI Advice

```typescript
async function testAIAdvice() {
  const result = await mcpClient.getBusinessAdvice({
    question: "How can I improve my profit margins?",
    userRole: 'owner',
    context: {
      currentMargin: 20,
      monthlySales: 100000
    }
  });
  
  console.log('AI advice:', result);
}
```

## Troubleshooting

### Common Issues

1. **Connection Error**: Check MCP_SERVER_URL in environment variables
2. **Authentication Failed**: Verify MCP_AUTH_TOKEN
3. **WebSocket Issues**: Ensure MCP_WEBSOCKET_URL is correct
4. **CORS Errors**: MCP server already has CORS enabled, check browser console

### Debug Mode

Enable debug logging:

```typescript
// Set debug mode
localStorage.setItem('mcp_debug', 'true');

// Or in Node.js
process.env.MCP_DEBUG = 'true';
```

### Health Check Endpoint

Your MCP server provides a health check endpoint:

```
GET https://your-mcp-server.onrender.com/health
```

## Production Considerations

1. **Environment Variables**: Use secure tokens in production
2. **Rate Limiting**: MCP server has built-in rate limiting
3. **Error Handling**: All methods return success/error objects
4. **Monitoring**: Check server logs on Render dashboard
5. **Backup**: MCP server integrates with your existing database

## Next Steps

1. Deploy your MCP server to Render using the deployment guide
2. Copy the integration files to your Charnoksv3 repository
3. Update your environment variables
4. Test the integration
5. Integrate the components into your existing UI

## Support

- Check MCP server logs on Render dashboard
- Use the health check endpoints
- Enable debug mode for detailed logging
- Review the integration examples for usage patterns

The MCP server is production-ready with all the features your chicken business management system needs!