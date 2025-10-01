/**
 * 🚀 **COMPLETE EXPRESS.JS APP WITH MCP INTEGRATION**
 * Production-ready Express.js server with comprehensive MCP integration
 */

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { MCPMiddleware } from './comprehensive-mcp-middleware';
import { mcpBackendClient } from './mcpBackendClient';
import { ChickenNote, BusinessAdviceRequest } from './mcpClient';

// === APPLICATION SETUP ===

const app = express();
const server = createServer(app);

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// === SECURITY MIDDLEWARE ===

app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

// === PERFORMANCE MIDDLEWARE ===

app.use(compression());

// === BODY PARSING MIDDLEWARE ===

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// === BASIC MIDDLEWARE STACK ===

const basicMiddleware = MCPMiddleware.complete({
  corsEnabled: true,
  metricsEnabled: true,
  authRequired: false // Will be applied per-route
});

app.use(basicMiddleware);

// === HEALTH CHECK ENDPOINTS ===

app.get('/health', async (req, res) => {
  try {
    const mcpHealthy = await mcpBackendClient.healthCheck();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        mcpServer: mcpHealthy ? 'healthy' : 'unhealthy',
        database: 'healthy', // Add your database check here
        redis: 'healthy'     // Add your Redis check here if applicable
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    const overallHealthy = Object.values(health.services).every(status => status === 'healthy');
    
    res.status(overallHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/health/ready', async (req, res) => {
  try {
    const mcpHealthy = await mcpBackendClient.healthCheck();
    
    if (mcpHealthy) {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'MCP server unavailable' });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      reason: error instanceof Error ? error.message : 'Readiness check failed' 
    });
  }
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// === AUTHENTICATION ENDPOINTS ===

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, authToken } = req.body;

    if (!email && !authToken) {
      return res.status(400).json({
        error: 'Email or auth token required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Here you would typically validate against your user database
    // For this example, we'll simulate authentication
    const user = {
      id: `user_${Date.now()}`,
      email: email || 'api_user',
      role: 'owner' as const,
      branchId: 'main_branch',
      permissions: ['read', 'write', 'admin']
    };

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        permissions: user.permissions
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branchId
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

app.post('/auth/refresh', MCPMiddleware.auth({ required: true }), (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const newToken = jwt.sign(
      {
        userId: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
        permissions: req.user!.permissions
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

// === MCP INTEGRATION ROUTES ===

const mcpAuthMiddleware = MCPMiddleware.auth({ 
  required: true,
  roles: ['owner', 'worker', 'admin'] 
});

const mcpRateLimitMiddleware = MCPMiddleware.rateLimit({
  maxRequests: 100,
  byUser: true
});

// Apply authentication and rate limiting to all MCP routes
app.use('/api/mcp', mcpAuthMiddleware, mcpRateLimitMiddleware);

// === CHICKEN NOTES PROCESSING ===

app.post('/api/mcp/process-note', async (req, res) => {
  try {
    const { content, userRole, localId } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        error: 'Note content is required',
        code: 'MISSING_CONTENT'
      });
    }

    const note: ChickenNote = {
      id: localId || `note_${Date.now()}`,
      branch_id: req.user!.branchId,
      author_id: req.user!.id,
      content: content.trim(),
      user_role: userRole || req.user!.role,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    console.log(`📝 Processing note for user ${req.user!.id}:`, content.substring(0, 100));

    const result = await mcpBackendClient.processChickenNote(note);

    res.json({
      success: true,
      note: {
        ...note,
        status: result.success ? 'parsed' : 'pending'
      },
      result: result.result,
      metadata: {
        processingTime: result.metadata?.processingTime || 0,
        model: result.metadata?.model,
        confidence: result.metadata?.confidence
      }
    });

  } catch (error) {
    console.error('Note processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
      code: 'PROCESSING_ERROR'
    });
  }
});

// === BATCH NOTES PROCESSING ===

app.post('/api/mcp/batch-process-notes', 
  MCPMiddleware.batchProcessing({ maxBatchSize: 20, batchKey: 'notes' }),
  async (req, res) => {
    try {
      const { notes } = req.body;
      const batchMetadata = (req as any).batchMetadata;

      if (!Array.isArray(notes) || notes.length === 0) {
        return res.status(400).json({
          error: 'Notes array is required',
          code: 'MISSING_NOTES'
        });
      }

      console.log(`📝 Batch processing ${notes.length} notes for user ${req.user!.id}`);

      // Prepare notes with user context
      const processedNotes = notes.map((note, index) => ({
        id: note.id || `batch_note_${Date.now()}_${index}`,
        branch_id: req.user!.branchId,
        author_id: req.user!.id,
        content: note.content,
        user_role: note.user_role || req.user!.role,
        status: 'pending' as const,
        created_at: new Date().toISOString()
      }));

      const results = await mcpBackendClient.batchProcessNotes(processedNotes);

      const successCount = results.filter((r: any) => r.success !== false).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          successRate: (successCount / results.length) * 100
        },
        batchMetadata
      });

    } catch (error) {
      console.error('Batch processing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Batch processing failed',
        code: 'BATCH_PROCESSING_ERROR'
      });
    }
  }
);

// === BUSINESS ADVICE ===

app.post('/api/mcp/business-advice', async (req, res) => {
  try {
    const request: BusinessAdviceRequest = {
      type: req.body.type || 'operational',
      context: req.body.context,
      urgency: req.body.urgency || 'medium',
      role: req.user!.role,
      branch_id: req.user!.branchId,
      timeframe: req.body.timeframe,
      specific_questions: req.body.specific_questions
    };

    if (!request.context?.trim()) {
      return res.status(400).json({
        error: 'Context is required for business advice',
        code: 'MISSING_CONTEXT'
      });
    }

    console.log(`💡 Generating business advice for user ${req.user!.id}:`, request.type);

    const result = await mcpBackendClient.getBusinessAdvice(request);

    res.json({
      success: true,
      advice: result.result,
      request: {
        type: request.type,
        urgency: request.urgency,
        timeframe: request.timeframe
      },
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Business advice error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Advice generation failed',
      code: 'ADVICE_GENERATION_ERROR'
    });
  }
});

// === BUSINESS CONTEXT SEARCH ===

app.post('/api/mcp/search-context', async (req, res) => {
  try {
    const { query, entityTypes, limit } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      });
    }

    console.log(`🔍 Searching business context for user ${req.user!.id}:`, query);

    const result = await mcpBackendClient.callTool('search_business_context', {
      query: query.trim(),
      entityTypes: entityTypes || ['product', 'supplier', 'customer'],
      limit: limit || 10,
      branchId: req.user!.branchId
    });

    res.json({
      success: true,
      results: result.result,
      query: {
        text: query,
        entityTypes: entityTypes || ['product', 'supplier', 'customer'],
        limit: limit || 10
      },
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Context search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      code: 'SEARCH_ERROR'
    });
  }
});

// === FORECASTING ===

app.post('/api/mcp/forecast', async (req, res) => {
  try {
    const { salesHistory, timeframe, productTypes } = req.body;

    if (!Array.isArray(salesHistory)) {
      return res.status(400).json({
        error: 'Sales history is required as an array',
        code: 'MISSING_SALES_HISTORY'
      });
    }

    console.log(`📈 Generating forecast for user ${req.user!.id}:`, timeframe || '7_days');

    const result = await mcpBackendClient.callTool('get_sales_forecast', {
      salesHistory,
      timeframe: timeframe || '7_days',
      productTypes: productTypes || ['eggs', 'chickens'],
      branchId: req.user!.branchId
    });

    res.json({
      success: true,
      forecast: result.result,
      parameters: {
        timeframe: timeframe || '7_days',
        historicalDataPoints: salesHistory.length,
        productTypes: productTypes || ['eggs', 'chickens']
      },
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Forecasting error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Forecast generation failed',
      code: 'FORECAST_ERROR'
    });
  }
});

// === GENERIC TOOL CALLING ===

app.post('/api/mcp/call-tool', async (req, res) => {
  try {
    const { toolName, arguments: args } = req.body;

    if (!toolName) {
      return res.status(400).json({
        error: 'Tool name is required',
        code: 'MISSING_TOOL_NAME'
      });
    }

    // Security: Whitelist allowed tools
    const allowedTools = [
      'parse_chicken_note',
      'get_business_advice',
      'search_business_context',
      'get_sales_forecast',
      'apply_to_stock',
      'generate_business_report',
      'get_inventory_forecast'
    ];

    if (!allowedTools.includes(toolName)) {
      return res.status(403).json({
        error: `Tool '${toolName}' is not allowed`,
        code: 'TOOL_NOT_ALLOWED',
        allowedTools
      });
    }

    console.log(`🔧 Calling tool ${toolName} for user ${req.user!.id}`);

    const result = await mcpBackendClient.callTool(toolName, {
      ...args,
      userId: req.user!.id,
      branchId: req.user!.branchId,
      userRole: req.user!.role
    });

    res.json({
      success: true,
      result: result.result,
      toolName,
      arguments: args,
      metadata: result.metadata
    });

  } catch (error) {
    console.error(`Tool call error (${req.body.toolName}):`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Tool call failed',
      code: 'TOOL_CALL_ERROR',
      toolName: req.body.toolName
    });
  }
});

// === AVAILABLE TOOLS ===

app.get('/api/mcp/tools', async (req, res) => {
  try {
    const result = await mcpBackendClient.callTool('list_tools', {});

    res.json({
      success: true,
      tools: result.result || [
        {
          name: 'parse_chicken_note',
          description: 'Parse and process chicken business notes',
          parameters: ['note_content', 'branch_id', 'author_id', 'user_role']
        },
        {
          name: 'get_business_advice',
          description: 'Get AI-powered business advice',
          parameters: ['type', 'context', 'urgency', 'role', 'branch_id']
        },
        {
          name: 'search_business_context',
          description: 'Search business context and memory',
          parameters: ['query', 'entityTypes', 'limit']
        },
        {
          name: 'get_sales_forecast',
          description: 'Generate sales forecasts',
          parameters: ['salesHistory', 'timeframe', 'productTypes']
        }
      ]
    });

  } catch (error) {
    console.error('Tools listing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list tools',
      code: 'TOOLS_LISTING_ERROR'
    });
  }
});

// === METRICS ENDPOINT ===

app.get('/api/mcp/metrics', 
  MCPMiddleware.auth({ required: true, roles: ['admin', 'owner'] }),
  (req, res) => {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      userMetrics: req.mcpMetrics,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      metrics
    });
  }
);

// === ERROR HANDLING ===

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use(MCPMiddleware.errorHandler());

// === SERVER STARTUP ===

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Test MCP connection
    console.log('🔌 Testing MCP server connection...');
    await mcpBackendClient.authenticate();
    const mcpHealthy = await mcpBackendClient.healthCheck();
    
    if (mcpHealthy) {
      console.log('✅ MCP server connection established');
    } else {
      console.warn('⚠️ MCP server appears to be unhealthy, but starting anyway');
    }

    server.listen(PORT, () => {
      console.log('🚀 Charnoks Express.js Server with MCP Integration');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🔗 MCP Server URL: ${process.env.MCP_SERVER_URL}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 MCP Tools: http://localhost:${PORT}/api/mcp/tools`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('🎯 Available MCP Endpoints:');
      console.log('  POST /api/mcp/process-note        - Process single chicken note');
      console.log('  POST /api/mcp/batch-process-notes - Batch process multiple notes');
      console.log('  POST /api/mcp/business-advice     - Get AI business advice');
      console.log('  POST /api/mcp/search-context      - Search business context');
      console.log('  POST /api/mcp/forecast            - Generate sales forecasts');
      console.log('  POST /api/mcp/call-tool           - Generic tool calling');
      console.log('  GET  /api/mcp/tools               - List available tools');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export default app;