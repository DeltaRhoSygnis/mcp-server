/**
 * 🛠️ **COMPREHENSIVE MCP EXPRESS MIDDLEWARE**
 * Complete middleware collection for MCP backend integration
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { mcpBackendClient } from './mcpBackendClient';

// === TYPES ===

export interface MCPUser {
  id: string;
  role: 'owner' | 'worker' | 'customer' | 'admin';
  branchId: string;
  permissions: string[];
  email?: string;
  name?: string;
}

export interface MCPRequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: MCPUser;
      mcpMetrics?: MCPRequestMetrics;
      requestId?: string;
    }
  }
}

// === AUTHENTICATION MIDDLEWARE ===

export function createMCPAuthMiddleware(options: {
  required?: boolean;
  roles?: MCPUser['role'][];
  permissions?: string[];
} = {}) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-auth-token'] as string ||
                   req.query.token as string;
      
      if (!token) {
        if (options.required !== false) {
          return res.status(401).json({ 
            error: 'No authentication token provided',
            code: 'AUTH_TOKEN_MISSING'
          });
        } else {
          return next(); // Optional auth
        }
      }

      // Verify JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
      } catch (jwtError) {
        return res.status(401).json({ 
          error: 'Invalid authentication token',
          code: 'AUTH_TOKEN_INVALID'
        });
      }

      // Create user object
      const user: MCPUser = {
        id: decoded.userId || decoded.id,
        role: decoded.role || 'customer',
        branchId: decoded.branchId || 'default',
        permissions: decoded.permissions || [],
        email: decoded.email,
        name: decoded.name
      };

      // Check role requirements
      if (options.roles && !options.roles.includes(user.role)) {
        return res.status(403).json({ 
          error: `Access denied. Required roles: ${options.roles.join(', ')}`,
          code: 'AUTH_INSUFFICIENT_ROLE'
        });
      }

      // Check permission requirements
      if (options.permissions) {
        const hasPermission = options.permissions.some(perm => 
          user.permissions.includes(perm)
        );
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: `Access denied. Required permissions: ${options.permissions.join(', ')}`,
            code: 'AUTH_INSUFFICIENT_PERMISSIONS'
          });
        }
      }

      req.user = user;
      next();

    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({ 
        error: 'Authentication system error',
        code: 'AUTH_SYSTEM_ERROR'
      });
    }
  };
}

// === RATE LIMITING MIDDLEWARE ===

export function createMCPRateLimitMiddleware(options: {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  byUser?: boolean;
  byBranch?: boolean;
} = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute
  const maxRequests = options.maxRequests || parseInt(process.env.MCP_RATE_LIMIT_RPM || '60');

  let keyGenerator: (req: express.Request) => string;

  if (options.byUser) {
    keyGenerator = (req) => `user:${req.user?.id || req.ip}`;
  } else if (options.byBranch) {
    keyGenerator = (req) => `branch:${req.user?.branchId || 'default'}:${req.ip}`;
  } else {
    keyGenerator = (req) => req.ip;
  }

  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    skipFailedRequests: options.skipFailedRequests,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for ${keyGenerator(req)}`);
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000),
        limit: maxRequests,
        windowMs
      });
    }
  });
}

// === REQUEST LOGGING MIDDLEWARE ===

export function createMCPLoggingMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.requestId = requestId;

    // Log request start
    console.log(`📥 [${requestId}] ${req.method} ${req.path}`, {
      userId: req.user?.id,
      branchId: req.user?.branchId,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function(body: any) {
      const responseTime = Date.now() - startTime;
      
      console.log(`📤 [${requestId}] ${res.statusCode} - ${responseTime}ms`, {
        success: res.statusCode < 400,
        responseSize: JSON.stringify(body).length
      });

      return originalJson.call(this, body);
    };

    next();
  };
}

// === MCP HEALTH CHECK MIDDLEWARE ===

export function createMCPHealthCheckMiddleware() {
  let lastHealthCheck: Date | null = null;
  let isHealthy = false;
  const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = new Date();

    // Check if we need to refresh health status
    if (!lastHealthCheck || (now.getTime() - lastHealthCheck.getTime()) > HEALTH_CHECK_INTERVAL) {
      try {
        isHealthy = await mcpBackendClient.healthCheck();
        lastHealthCheck = now;
      } catch (error) {
        isHealthy = false;
        console.error('MCP health check failed:', error);
      }
    }

    // Add health status to request for downstream use
    (req as any).mcpHealthy = isHealthy;

    if (!isHealthy) {
      console.warn('⚠️ MCP Server is unhealthy, but continuing request');
      // Note: We don't block requests, just warn
    }

    next();
  };
}

// === CORS MIDDLEWARE ===

export function createMCPCorsMiddleware() {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const allowedBackendOrigins = (process.env.ALLOWED_BACKEND_ORIGINS || '').split(',').filter(Boolean);
  
  const allOrigins = [...allowedOrigins, ...allowedBackendOrigins];

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      // Allow if in whitelist
      if (allOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Auth-Token',
      'X-User-ID', 
      'X-Branch-ID',
      'X-Request-ID',
      'X-Client-Type'
    ],
    exposedHeaders: [
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining', 
      'X-Rate-Limit-Reset',
      'X-Request-ID'
    ]
  });
}

// === REQUEST METRICS MIDDLEWARE ===

export function createMCPMetricsMiddleware() {
  const metrics = new Map<string, MCPRequestMetrics>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    const userId = req.user?.id || 'anonymous';

    // Initialize metrics for user if not exists
    if (!metrics.has(userId)) {
      metrics.set(userId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date()
      });
    }

    const userMetrics = metrics.get(userId)!;
    userMetrics.totalRequests++;
    userMetrics.lastRequestTime = new Date();

    req.mcpMetrics = userMetrics;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      if (res.statusCode < 400) {
        userMetrics.successfulRequests++;
      } else {
        userMetrics.failedRequests++;
      }

      // Update average response time
      const totalResponses = userMetrics.successfulRequests + userMetrics.failedRequests;
      userMetrics.averageResponseTime = 
        (userMetrics.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;

      return originalEnd.apply(this, args);
    };

    next();
  };
}

// === ERROR HANDLING MIDDLEWARE ===

export function createMCPErrorHandlerMiddleware() {
  return (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`❌ [${req.requestId}] MCP Error:`, {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      branchId: req.user?.branchId
    });

    // Determine error type and response
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = error.message;
    } else if (error.name === 'UnauthorizedError' || error.message.includes('auth')) {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (error.name === 'ForbiddenError' || error.message.includes('permission')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
      message = 'Insufficient permissions';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
      message = 'Too many requests';
    }

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: message,
      code: errorCode,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.details
      })
    });
  };
}

// === VALIDATION MIDDLEWARE ===

export function createMCPValidationMiddleware(schema: {
  body?: any;
  query?: any;
  params?: any;
}) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      // Validate request body
      if (schema.body) {
        const bodyResult = schema.body.safeParse(req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            error: 'Invalid request body',
            code: 'VALIDATION_ERROR',
            details: bodyResult.error.errors
          });
        }
        req.body = bodyResult.data;
      }

      // Validate query parameters
      if (schema.query) {
        const queryResult = schema.query.safeParse(req.query);
        if (!queryResult.success) {
          return res.status(400).json({
            error: 'Invalid query parameters',
            code: 'VALIDATION_ERROR', 
            details: queryResult.error.errors
          });
        }
        req.query = queryResult.data;
      }

      // Validate URL parameters
      if (schema.params) {
        const paramsResult = schema.params.safeParse(req.params);
        if (!paramsResult.success) {
          return res.status(400).json({
            error: 'Invalid URL parameters',
            code: 'VALIDATION_ERROR',
            details: paramsResult.error.errors
          });
        }
        req.params = paramsResult.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// === RESPONSE FORMATTING MIDDLEWARE ===

export function createMCPResponseMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Add helper method for consistent API responses
    res.mcpSuccess = function(data: any, metadata?: any) {
      return this.json({
        success: true,
        data,
        metadata: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - (req as any).startTime,
          ...metadata
        }
      });
    };

    res.mcpError = function(message: string, code?: string, statusCode: number = 500) {
      return this.status(statusCode).json({
        success: false,
        error: message,
        code: code || 'INTERNAL_ERROR',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    };

    // Track request start time
    (req as any).startTime = Date.now();

    next();
  };
}

// === BATCH PROCESSING MIDDLEWARE ===

export function createMCPBatchProcessingMiddleware(options: {
  maxBatchSize?: number;
  batchKey?: string;
} = {}) {
  const maxBatchSize = options.maxBatchSize || parseInt(process.env.MCP_BATCH_SIZE || '10');
  const batchKey = options.batchKey || 'items';

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const batchData = req.body[batchKey];

    if (Array.isArray(batchData)) {
      if (batchData.length > maxBatchSize) {
        return res.status(400).json({
          error: `Batch size too large. Maximum ${maxBatchSize} items allowed`,
          code: 'BATCH_SIZE_EXCEEDED',
          maxSize: maxBatchSize,
          receivedSize: batchData.length
        });
      }

      // Add batch metadata to request
      (req as any).batchMetadata = {
        size: batchData.length,
        maxSize: maxBatchSize,
        isBatch: true
      };
    } else {
      (req as any).batchMetadata = {
        size: 1,
        maxSize: maxBatchSize,
        isBatch: false
      };
    }

    next();
  };
}

// === COMPLETE MIDDLEWARE STACK ===

export function createCompleteMCPMiddlewareStack(options: {
  authRequired?: boolean;
  roles?: MCPUser['role'][];
  permissions?: string[];
  rateLimitOptions?: any;
  corsEnabled?: boolean;
  metricsEnabled?: boolean;
  batchProcessing?: boolean;
} = {}) {
  const middlewares: express.RequestHandler[] = [];

  // 1. CORS (if enabled)
  if (options.corsEnabled !== false) {
    middlewares.push(createMCPCorsMiddleware());
  }

  // 2. Request logging
  middlewares.push(createMCPLoggingMiddleware());

  // 3. Response formatting
  middlewares.push(createMCPResponseMiddleware());

  // 4. Health check
  middlewares.push(createMCPHealthCheckMiddleware());

  // 5. Rate limiting
  middlewares.push(createMCPRateLimitMiddleware(options.rateLimitOptions));

  // 6. Authentication
  middlewares.push(createMCPAuthMiddleware({
    required: options.authRequired,
    roles: options.roles,
    permissions: options.permissions
  }));

  // 7. Metrics (if enabled)
  if (options.metricsEnabled !== false) {
    middlewares.push(createMCPMetricsMiddleware());
  }

  // 8. Batch processing (if enabled)
  if (options.batchProcessing) {
    middlewares.push(createMCPBatchProcessingMiddleware());
  }

  return middlewares;
}

// === MIDDLEWARE COLLECTIONS ===

export const MCPMiddleware = {
  auth: createMCPAuthMiddleware,
  rateLimit: createMCPRateLimitMiddleware,
  logging: createMCPLoggingMiddleware,
  healthCheck: createMCPHealthCheckMiddleware,
  cors: createMCPCorsMiddleware,
  metrics: createMCPMetricsMiddleware,
  errorHandler: createMCPErrorHandlerMiddleware,
  validation: createMCPValidationMiddleware,
  response: createMCPResponseMiddleware,
  batchProcessing: createMCPBatchProcessingMiddleware,
  complete: createCompleteMCPMiddlewareStack
};

export default MCPMiddleware;

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      mcpSuccess(data: any, metadata?: any): Response;
      mcpError(message: string, code?: string, statusCode?: number): Response;
    }
  }
}