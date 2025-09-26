/**
 * Error Handler - Utility for centralized error handling
 */

export class ErrorHandler {
  static log(error: Error | string, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const timestamp = new Date().toISOString();
    
    console.error(`[${timestamp}] ${context ? `[${context}] ` : ''}${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  static logAndThrow(error: Error | string, context?: string): never {
    this.log(error, context);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(error);
    }
  }

  static wrap<T>(fn: () => T, context?: string): T {
    try {
      return fn();
    } catch (error) {
      this.log(error as Error, context);
      throw error;
    }
  }

  static async wrapAsync<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.log(error as Error, context);
      throw error;
    }
  }

  static handleBusinessLogicError(message: string, context?: any): Error {
    const error = new Error(message);
    this.log(error, 'BusinessLogic');
    console.error('Business logic context:', context);
    return error;
  }

  static handleFirebaseError(error: any, context?: any): Error {
    this.log(error, 'Firebase');
    console.error('Firebase context:', context);
    return error instanceof Error ? error : new Error(String(error));
  }
}