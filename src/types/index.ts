/**
 * Central type exports for MCP Server
 * Aggregates all type definitions from across the application
 */

// Export business intelligence types
export * from './business';

// Re-export common types from services
export type { BusinessMemory, ContextualAdvice, BusinessState } from '../services/aiStoreAdvisor';
export type { BusinessInsight, DailySummary } from '../services/aiObserver';

// Export configuration interfaces
export interface MCPServerConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  database: {
    url: string;
    maxConnections: number;
  };
  ai: {
    geminiApiKey: string;
    cohereApiKey?: string;
    openrouterApiKey?: string;
    hfToken?: string;
  };
  features: {
    enableAuditLogs: boolean;
    enableMetrics: boolean;
    enableCaching: boolean;
  };
}

// Common utility types
export type UUID = string;
export type Timestamp = string;
export type Currency = number;

// API response wrapper
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Timestamp;
  requestId?: string;
}

// Database entity base
export interface BaseEntity {
  id: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// User roles for business context
export type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

// Business operation types
export type BusinessOperation = 'sale' | 'expense' | 'inventory' | 'note' | 'report';

// Priority levels used across the system
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Status types for various entities
export type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled';