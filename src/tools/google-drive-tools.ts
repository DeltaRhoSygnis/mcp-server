/**
 * Google Drive MCP Tools
 * Provides MCP tool interface for Google Drive integration and database exports
 */

import { z } from 'zod';
import { googleDriveService, ExportConfig } from '../services/googleDriveService';

// Input schemas for validation
const exportConfigSchema = z.object({
  tables: z.array(z.string()).min(1, 'At least one table must be specified'),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  }).optional(),
  branchId: z.string().uuid().optional()
});

const uploadFileSchema = z.object({
  filePath: z.string(),
  fileName: z.string().optional(),
  folderId: z.string().optional(),
  description: z.string().optional()
});

export class GoogleDriveMCPTools {
  constructor() {
    console.log('🔧 Google Drive MCP Tools initialized');
  }

  /**
   * Export database tables and upload to Google Drive
   * MCP Tool: google_drive_export_and_upload
   */
  async google_drive_export_and_upload(args: {
    tables: string[];
    format?: 'xlsx' | 'csv';
    dateRange?: {
      start: string;
      end: string;
    };
    branchId?: string;
    userId?: string;
  }) {
    try {
      console.log('🚀 Starting Google Drive export and upload...');
      
      // Validate input
      const validatedConfig = exportConfigSchema.parse(args);
      
      // Check authentication
      const isAuthenticated = await googleDriveService.isAuthenticated();
      if (!isAuthenticated) {
        return {
          success: false,
          error: 'Google Drive service not authenticated. Please complete OAuth setup first.',
          authUrl: googleDriveService.generateAuthUrl()
        };
      }
      
      // Perform export and upload
      const result = await googleDriveService.exportAndUpload(validatedConfig as ExportConfig);
      
      return {
        success: true,
        message: `Successfully exported ${validatedConfig.tables.length} tables and uploaded to Google Drive`,
        result: {
          fileId: result.fileId,
          fileName: result.fileName,
          webViewLink: result.webViewLink,
          downloadLink: result.downloadLink,
          size: result.size,
          uploadedAt: result.uploadedAt,
          tablesExported: validatedConfig.tables
        },
        metadata: {
          exportConfig: validatedConfig,
          processingTime: new Date().toISOString(),
          userId: args.userId
        }
      };
    } catch (error) {
      console.error('❌ Google Drive export failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof z.ZodError ? error.errors : undefined
      };
    }
  }

  /**
   * Get Google Drive authentication URL
   * MCP Tool: google_drive_get_auth_url
   */
  async google_drive_get_auth_url(args: {
    userId?: string;
  }) {
    try {
      const authUrl = googleDriveService.generateAuthUrl();
      
      return {
        success: true,
        message: 'Google Drive authorization URL generated',
        authUrl: authUrl,
        instructions: [
          '1. Click the authorization URL to open Google OAuth',
          '2. Grant permissions to access Google Drive',
          '3. Copy the authorization code from the callback',
          '4. Use google_drive_exchange_code tool with the code'
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate auth URL'
      };
    }
  }

  /**
   * Exchange authorization code for tokens
   * MCP Tool: google_drive_exchange_code
   */
  async google_drive_exchange_code(args: {
    code: string;
    userId?: string;
  }) {
    try {
      if (!args.code) {
        return {
          success: false,
          error: 'Authorization code is required'
        };
      }
      
      const tokens = await googleDriveService.exchangeCodeForTokens(args.code);
      
      return {
        success: true,
        message: 'Google Drive authorization completed successfully',
        warning: 'IMPORTANT: Store the refresh token securely in your environment variables',
        tokens: {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiryDate: tokens.expiry_date
        },
        nextSteps: [
          'Add GOOGLE_ACCESS_TOKEN to your environment variables',
          'Add GOOGLE_REFRESH_TOKEN to your environment variables',
          'Restart the service to load the new tokens'
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange authorization code'
      };
    }
  }

  /**
   * Check Google Drive authentication status
   * MCP Tool: google_drive_check_auth
   */
  async google_drive_check_auth(args: {
    userId?: string;
  }) {
    try {
      const isAuthenticated = await googleDriveService.isAuthenticated();
      
      return {
        success: true,
        authenticated: isAuthenticated,
        message: isAuthenticated 
          ? 'Google Drive service is authenticated and ready'
          : 'Google Drive service requires authentication',
        authUrl: isAuthenticated ? undefined : googleDriveService.generateAuthUrl()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check authentication status'
      };
    }
  }

  /**
   * Get export history
   * MCP Tool: google_drive_get_export_history
   */
  async google_drive_get_export_history(args: {
    limit?: number;
    userId?: string;
  }) {
    try {
      const history = await googleDriveService.getExportHistory(args.limit || 10);
      
      return {
        success: true,
        message: `Retrieved ${history.length} export records`,
        exports: history.map(record => ({
          id: record.id,
          fileName: record.file_name,
          webViewLink: record.file_url,
          tablesExported: record.tables_exported,
          fileSize: record.file_size,
          status: record.status,
          createdAt: record.created_at,
          dateRange: record.date_range_start && record.date_range_end ? {
            start: record.date_range_start,
            end: record.date_range_end
          } : undefined
        })),
        totalRecords: history.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve export history'
      };
    }
  }

  /**
   * Export specific business data (common tables)
   * MCP Tool: google_drive_export_business_backup
   */
  async google_drive_export_business_backup(args: {
    dateRange?: {
      start: string;
      end: string;
    };
    branchId?: string;
    includeEmbeddings?: boolean;
    userId?: string;
  }) {
    try {
      console.log('📊 Starting business backup export...');
      
      // Standard business tables for backup
      const businessTables = [
        'notes',
        'operations', 
        'expenses',
        'user_profiles',
        'branches',
        'owners',
        'summaries'
      ];
      
      // Add embeddings tables if requested
      if (args.includeEmbeddings) {
        businessTables.push('note_embeddings', 'entities', 'relations', 'observations');
      }
      
      // Use the main export function
      return await this.google_drive_export_and_upload({
        tables: businessTables,
        format: 'xlsx',
        dateRange: args.dateRange,
        branchId: args.branchId,
        userId: args.userId
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export business backup'
      };
    }
  }

  /**
   * Schedule automated exports (placeholder)
   * MCP Tool: google_drive_schedule_export
   */
  async google_drive_schedule_export(args: {
    frequency: 'daily' | 'weekly' | 'monthly';
    tables: string[];
    time?: string; // HH:MM format
    userId?: string;
  }) {
    try {
      await googleDriveService.scheduleAutomatedExport({
        frequency: args.frequency,
        tables: args.tables,
        time: args.time
      });
      
      return {
        success: true,
        message: `Scheduled ${args.frequency} export for tables: ${args.tables.join(', ')}`,
        schedule: {
          frequency: args.frequency,
          tables: args.tables,
          time: args.time || 'default'
        },
        note: 'Scheduling functionality depends on deployment environment and job scheduler configuration'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule export'
      };
    }
  }
}

// Export schemas for MCP registration
export const googleDriveSchemas = {
  google_drive_export_and_upload: exportConfigSchema.extend({
    userId: z.string().optional()
  }),
  google_drive_get_auth_url: z.object({
    userId: z.string().optional()
  }),
  google_drive_exchange_code: z.object({
    code: z.string(),
    userId: z.string().optional()
  }),
  google_drive_check_auth: z.object({
    userId: z.string().optional()
  }),
  google_drive_get_export_history: z.object({
    limit: z.number().min(1).max(100).default(10),
    userId: z.string().optional()
  }),
  google_drive_export_business_backup: z.object({
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).optional(),
    branchId: z.string().uuid().optional(),
    includeEmbeddings: z.boolean().default(false),
    userId: z.string().optional()
  }),
  google_drive_schedule_export: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    tables: z.array(z.string()).min(1),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    userId: z.string().optional()
  })
};

// Singleton instance for easy import
export const googleDriveMCPTools = new GoogleDriveMCPTools();