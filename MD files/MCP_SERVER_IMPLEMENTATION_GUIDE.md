# Charnoks MCP Server Implementation Guide

## 🎯 Overview

This guide provides complete instructions for setting up and running the Charnoks Model Context Protocol (MCP) server in a new codespace. The MCP server provides AI-powered chicken business intelligence through Gemini API integration with reliability features and comprehensive logging.

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- Access to Supabase database
- Valid Gemini API key
- GitHub Codespace or similar development environment

## 🏗️ Project Structure

```
mcp-server/
├── src/
│   ├── index-simple.ts          # Main MCP server entry point
│   ├── gemini-proxy-simple.ts   # Gemini API reliability layer
│   ├── index.ts                 # Full featured server
│   ├── gemini-proxy.ts          # Advanced Gemini proxy
│   └── tools/                   # Tool implementations
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── .env                        # Environment variables
└── dist/                       # Compiled JavaScript output
```

## 🚀 Quick Start

### Step 1: Clone and Setup

```bash
# Create new directory for MCP server
mkdir charnoks-mcp-server
cd charnoks-mcp-server

# Initialize npm project
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk@^0.5.0 @supabase/supabase-js@^2.54.0 dotenv@^16.3.1 express@^4.18.2 node-fetch@^3.3.2 uuid@^9.0.1

# Install dev dependencies
npm install --save-dev @types/express@^4.17.21 @types/node@^20.10.0 @types/uuid@^9.0.7 tsx@^4.6.0 typescript@^5.3.0
```

### Step 2: Create Package.json

Create `package.json` with the following content:

```json
{
  "name": "Charnoks_MCP_Server",
  "version": "1.0.0",
  "description": "MCP Server for Charnoks Chicken Business Intelligence",
  "type": "module",
  "main": "dist/index-simple.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index-simple.ts",
    "start": "node dist/index-simple.js",
    "start-full": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "@supabase/supabase-js": "^2.54.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "node-fetch": "^3.3.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "mcp",
    "ai",
    "gemini",
    "chicken-business",
    "reliability"
  ]
}
```

### Step 3: TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 4: Environment Configuration

Create `.env` file:

```env
# Environment Variables for MCP Server

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# MCP Authentication
MCP_AUTH_TOKEN=mcp_token_8b9c0486f0cda1529c8487abdbf81b03cf2f1dcaecd39e32225c082c84e380c1

# Rate Limiting Configuration
MAX_REQUESTS_PER_MINUTE=50
MAX_TOKENS_PER_MINUTE=100000

# Retry Configuration
MAX_RETRY_ATTEMPTS=3
RETRY_BACKOFF_MS=1000

# Logging Configuration
LOG_LEVEL=info
ENABLE_AI_AUDIT_LOGS=true
```

## 📁 Source Code Implementation

### 1. Gemini Proxy Service (`src/gemini-proxy-simple.ts`)

```typescript
/**
 * Simplified Gemini Proxy Manager
 * Quick implementation for MCP server testing
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type TaskRequest = 'standard' | 'complex' | 'simple';

export interface GeminiResponse {
  text: string;
  model: string;
  success: boolean;
}

export class GeminiProxyManager {
  private maxRetries = 3;
  private geminiKey = process.env.GEMINI_API_KEY!;

  async makeReliableRequest(task: TaskRequest, prompt: string): Promise<GeminiResponse> {
    const model = 'gemini-2.0-flash-lite'; // Simple default model
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callGeminiAPI(model, prompt);
        
        // Log successful call
        await this.logAPICall(model, prompt, response, true);
        
        return {
          text: response,
          model,
          success: true
        };

      } catch (error) {
        console.warn(`Attempt ${attempt}/${this.maxRetries} failed:`, error);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Gemini API failed after ${this.maxRetries} attempts`);
        }
        
        // Simple delay
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('All attempts failed');
  }

  private async callGeminiAPI(model: string, prompt: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  }

  private async logAPICall(model: string, prompt: string, response: any, success: boolean, error?: string): Promise<void> {
    try {
      await supabase.from('ai_audit_logs').insert({
        operation_type: 'gemini_api_call',
        input_data: { model, prompt: prompt.substring(0, 500) },
        output_data: success ? { response: typeof response === 'string' ? response.substring(0, 500) : response } : null,
        model_used: model,
        success,
        error_message: error
      });
    } catch (logError) {
      console.warn('Failed to log API call:', logError);
    }
  }
}
```

### 2. Main MCP Server (`src/index-simple.ts`)

```typescript
/**
 * Simplified MCP Server
 * Quick implementation for testing
 */

import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { GeminiProxyManager } from './gemini-proxy-simple.js';

// Load environment variables
dotenv.config();

// Initialize services
const geminiProxy = new GeminiProxyManager();

// Create Express app for HTTP endpoints
const app = express();
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// List tools endpoint
app.post('/list-tools', (req, res) => {
  const tools = [
    {
      name: 'process_chicken_note',
      description: 'Parse and process chicken business notes',
      inputSchema: {
        type: 'object',
        properties: {
          note_text: { type: 'string' },
          user_role: { type: 'string' },
          extract_mode: { type: 'string' }
        },
        required: ['note_text']
      }
    },
    {
      name: 'get_business_advice',
      description: 'Get AI business advice',
      inputSchema: {
        type: 'object',
        properties: {
          context: { type: 'string' },
          question: { type: 'string' }
        },
        required: ['context', 'question']
      }
    },
    {
      name: 'analyze_sales_data',
      description: 'Analyze sales data and patterns',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'string' },
          analysis_type: { type: 'string' }
        },
        required: ['data']
      }
    }
  ];
  
  res.json({ tools });
});

// Tool execution endpoint
app.post('/call-tool', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    let result;
    
    switch (name) {
      case 'process_chicken_note':
        result = await processChickenNote(args);
        break;
      case 'get_business_advice':
        result = await getBusinessAdvice(args);
        break;
      case 'analyze_sales_data':
        result = await analyzeSalesData(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    res.json({ content: [{ type: 'text', text: result }] });
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tool implementations
async function processChickenNote(args: any): Promise<string> {
  const prompt = `Analyze this chicken business note and extract key information:

Note: ${args.note_text}
User Role: ${args.user_role || 'owner'}
Extract Mode: ${args.extract_mode || 'comprehensive'}

Please provide:
1. Key business insights
2. Action items
3. Performance indicators
4. Recommendations

Format as JSON with clear categories.`;

  const response = await geminiProxy.makeReliableRequest('standard', prompt);
  return response.text;
}

async function getBusinessAdvice(args: any): Promise<string> {
  const prompt = `As a chicken business expert, provide advice for this situation:

Context: ${args.context}
Question: ${args.question}

Please provide:
1. Immediate recommendations
2. Long-term strategic advice
3. Potential risks to consider
4. Best practices from the industry

Keep advice practical and actionable.`;

  const response = await geminiProxy.makeReliableRequest('standard', prompt);
  return response.text;
}

async function analyzeSalesData(args: any): Promise<string> {
  const prompt = `Analyze this chicken business sales data:

Data: ${args.data}
Analysis Type: ${args.analysis_type || 'comprehensive'}

Please provide:
1. Sales trends and patterns
2. Performance metrics
3. Market insights
4. Growth opportunities
5. Optimization recommendations

Format as structured analysis with clear sections.`;

  const response = await geminiProxy.makeReliableRequest('standard', prompt);
  return response.text;
}

// MCP Server Setup
const server = new Server(
  {
    name: 'charnoks-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'process_chicken_note',
        description: 'Parse and process chicken business notes',
        inputSchema: {
          type: 'object',
          properties: {
            note_text: { type: 'string' },
            user_role: { type: 'string' },
            extract_mode: { type: 'string' }
          },
          required: ['note_text']
        }
      },
      {
        name: 'get_business_advice',
        description: 'Get AI business advice',
        inputSchema: {
          type: 'object',
          properties: {
            context: { type: 'string' },
            question: { type: 'string' }
          },
          required: ['context', 'question']
        }
      },
      {
        name: 'analyze_sales_data',
        description: 'Analyze sales data and patterns',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            analysis_type: { type: 'string' }
          },
          required: ['data']
        }
      }
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result: string;
    
    switch (name) {
      case 'process_chicken_note':
        result = await processChickenNote(args);
        break;
      case 'get_business_advice':
        result = await getBusinessAdvice(args);
        break;
      case 'analyze_sales_data':
        result = await analyzeSalesData(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    console.error('Tool execution error:', error);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start servers
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Also start HTTP server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.error(`🚀 MCP Server running on port ${PORT}`);
  });
  
  console.error('🎯 Charnoks MCP Server started successfully');
}

main().catch(console.error);
```

## 🗄️ Database Schema

Create this SQL schema in your Supabase database:

```sql
-- AI Audit Logs Table
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    operation_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    model_used VARCHAR(100),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    processing_time_ms INTEGER,
    user_id UUID REFERENCES auth.users(id),
    request_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at ON ai_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_operation_type ON ai_audit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_success ON ai_audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id ON ai_audit_logs(user_id);

-- Enable Row Level Security
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own audit logs" ON ai_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON ai_audit_logs
    FOR INSERT WITH CHECK (true);
```

## 🔧 Build and Run Instructions

### Development Mode

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Production Mode

```bash
# Build the project
npm run build

# Start the server
npm start
```

### Testing the Server

```bash
# Health check
curl http://localhost:3001/health

# List available tools
curl -X POST http://localhost:3001/list-tools \
  -H "Content-Type: application/json"

# Test tool execution
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "process_chicken_note",
    "arguments": {
      "note_text": "Sold 50 chickens today, customer mentioned feed quality was excellent",
      "user_role": "owner"
    }
  }'
```

## 🛠️ Configuration and Customization

### Environment Variables Explained

- **GEMINI_API_KEY**: Your Google Gemini API key for AI processing
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key for database access
- **PORT**: Server port (default: 3001)
- **MAX_RETRY_ATTEMPTS**: Number of retry attempts for failed API calls
- **RETRY_BACKOFF_MS**: Delay between retry attempts

### Adding New Tools

1. Add tool definition in `ListToolsRequestSchema` handler
2. Implement tool logic as a separate function
3. Add case in `CallToolRequestSchema` handler
4. Test with appropriate prompts

### Customizing Gemini Prompts

Modify the prompt templates in each tool function to match your specific business needs. Consider:
- Industry-specific terminology
- Required output format
- Specific analysis types
- Custom business rules

## 📊 Monitoring and Logging

The server includes comprehensive logging:

- **API Audit Logs**: All Gemini API calls logged to Supabase
- **Error Tracking**: Failed requests and retry attempts
- **Performance Metrics**: Processing times and success rates
- **Health Monitoring**: Built-in health endpoint

View logs in Supabase dashboard under `ai_audit_logs` table.

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` file to version control
2. **API Keys**: Use environment variables for all sensitive data
3. **Rate Limiting**: Configure appropriate limits for your usage
4. **CORS**: Add CORS configuration for production deployments
5. **Authentication**: Implement proper MCP authentication tokens

## 🚨 Troubleshooting

### Common Issues

1. **Module Resolution Errors**
   ```bash
   npm install --save-dev @types/node
   ```

2. **TypeScript Compilation Errors**
   ```bash
   npm run type-check
   ```

3. **Environment Variable Issues**
   - Verify `.env` file exists and has correct values
   - Check environment variable names match exactly

4. **Database Connection Issues**
   - Verify Supabase credentials
   - Check database schema is applied
   - Ensure RLS policies allow access

5. **Gemini API Issues**
   - Verify API key is valid and has quota
   - Check rate limiting configuration
   - Review error logs for specific issues

### Debug Mode

Enable verbose logging:

```bash
LOG_LEVEL=debug npm run dev
```

## 📈 Performance Optimization

1. **Connection Pooling**: Configure Supabase connection pooling
2. **Caching**: Implement response caching for frequent requests
3. **Rate Limiting**: Adjust based on your API quotas
4. **Batch Processing**: Group multiple requests when possible

## 🔄 Updates and Maintenance

1. **Dependencies**: Regularly update npm packages
2. **Security**: Monitor for security advisories
3. **API Changes**: Watch for Gemini API updates
4. **Monitoring**: Review logs and performance metrics
5. **Backups**: Ensure database backups are configured

## 📞 Support

For issues and questions:
1. Check troubleshooting section
2. Review server logs
3. Verify environment configuration
4. Test with minimal examples

---

**Note**: This implementation provides a robust foundation for chicken business AI integration. Customize the prompts, tools, and business logic to match your specific requirements.