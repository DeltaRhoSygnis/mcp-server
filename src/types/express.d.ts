/**
 * Express Request Interface Extensions
 * Adds custom properties for authentication, monitoring, and request tracking
 */

declare global {
  namespace Express {
    interface Request {
      user?: any;
      requestId?: string;
      startTime?: number;
    }
  }
}

export {};