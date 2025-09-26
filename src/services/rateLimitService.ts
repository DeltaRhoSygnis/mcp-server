import { Request, Response, NextFunction } from 'express';

// Rate limiting and batching for Gemini API calls
class RateLimitService {
  private queue: Array<{ fn: () => Promise<any>, resolve: Function, reject: Function }> = [];
  private processing = false;
  private lastCall = 0;
  private callCount = 0;
  private resetTime = Date.now() + 60000; // Reset every minute

  // Gemini limits: 15 RPM for free tier
  private readonly RPM_LIMIT = 15;
  private readonly MIN_INTERVAL = 60000 / this.RPM_LIMIT; // 4 seconds between calls

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Reset counter every minute
      if (Date.now() > this.resetTime) {
        this.callCount = 0;
        this.resetTime = Date.now() + 60000;
      }
      
      // Check rate limit
      if (this.callCount >= this.RPM_LIMIT) {
        const waitTime = this.resetTime - Date.now();
        if (waitTime > 0) {
          await this.sleep(waitTime);
          this.callCount = 0;
          this.resetTime = Date.now() + 60000;
        }
      }
      
      // Ensure minimum interval between calls
      const timeSinceLastCall = Date.now() - this.lastCall;
      if (timeSinceLastCall < this.MIN_INTERVAL) {
        await this.sleep(this.MIN_INTERVAL - timeSinceLastCall);
      }
      
      const { fn, resolve, reject } = this.queue.shift()!;
      
      try {
        this.lastCall = Date.now();
        this.callCount++;
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch multiple operations
  async batch<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    const results: T[] = [];
    
    for (const op of operations) {
      const result = await this.execute(op);
      results.push(result);
    }
    
    return results;
  }
}

export const rateLimitService = new RateLimitService();

export function getRateLimitKey(req: Request): string {
  const userId = (req as any).user?.userId || 'anonymous';
  return `${req.ip}-${userId}`;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const windowMs = 60000; // 1 min
  const max = 10;

  if (rateLimitMap.has(key)) {
    const item = rateLimitMap.get(key)!;
    if (now - item.resetTime < windowMs) {
      if (item.count >= max) {
        res.status(429).json({ error: { code: 429, message: 'Rate limit exceeded', details: { remaining: 0 } } });
        return;
      }
      item.count++;
    } else {
      item.count = 1;
      item.resetTime = now;
    }
  } else {
    rateLimitMap.set(key, { count: 1, resetTime: now });
  }
  next();
};

// Periodic cleanup (add in index.ts init: setInterval(() => { rateLimitMap.forEach((item, key) => { if (Date.now() - item.resetTime > windowMs) rateLimitMap.delete(key); }); }, 300000); )