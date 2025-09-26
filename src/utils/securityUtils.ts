/**
 * Security Utils - Stub implementation
 * TODO: Implement full security utilities when needed
 */

export const safeLog = (message: string, data?: any): void => {
  // In production, this would sanitize sensitive data
  console.log(message, data);
};

export const sanitizeInput = (input: string): string => {
  // Basic sanitization - would be more robust in production
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

export const validateApiKey = (key: string): boolean => {
  // Basic validation - would be more robust in production
  return typeof key === 'string' && key.length > 10;
};