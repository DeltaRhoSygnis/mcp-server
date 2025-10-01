/**
 * Google Drive Integration Service
 * Handles OAuth 2.0 authentication and file operations with Google Drive
 * Supports automated Excel/CSV exports for database backups
 */

import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ExportConfig {
  tables: string[];
  format: 'xlsx' | 'csv';
  dateRange?: {
    start: string;
    end: string;
  };
  branchId?: string;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  downloadLink: string;
  size: number;
  uploadedAt: string;
}

export class GoogleDriveService {
  private oauth2Client: any;
  private drive: any;
  private initialized: boolean = false;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize Google OAuth 2.0 client
   */
  private initializeAuth(): void {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
      );

      // Set credentials if refresh token is available
      if (process.env.GOOGLE_REFRESH_TOKEN) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          access_token: process.env.GOOGLE_ACCESS_TOKEN
        });
      }

      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      this.initialized = true;
      console.log('✅ Google Drive service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive service:', error);
      this.initialized = false;
    }
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Store refresh token securely (in production, use encrypted storage)
      console.log('🔐 Store these tokens securely:');
      console.log('GOOGLE_ACCESS_TOKEN=' + tokens.access_token);
      console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
      
      return tokens;
    } catch (error) {
      console.error('❌ Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Check if service is authenticated and ready
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.initialized) return false;
    
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      console.warn('⚠️ Google Drive authentication check failed:', error);
      return false;
    }
  }

  /**
   * Export database tables to Excel format
   */
  async exportToExcel(config: ExportConfig): Promise<string> {
    const workbook = XLSX.utils.book_new();
    
    for (const tableName of config.tables) {
      try {
        console.log(`📊 Exporting table: ${tableName}`);
        
        // Build query with optional filters
        let query = supabase.from(tableName).select('*');
        
        if (config.dateRange) {
          query = query
            .gte('created_at', config.dateRange.start)
            .lte('created_at', config.dateRange.end);
        }
        
        if (config.branchId) {
          query = query.eq('branch_id', config.branchId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error(`❌ Failed to export table ${tableName}:`, error);
          continue;
        }
        
        if (!data || data.length === 0) {
          console.warn(`⚠️ No data found in table ${tableName}`);
          continue;
        }
        
        // Convert to worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, tableName);
        
        console.log(`✅ Exported ${data.length} rows from ${tableName}`);
      } catch (error) {
        console.error(`❌ Error exporting table ${tableName}:`, error);
      }
    }
    
    // Generate temporary file
    const fileName = `chicken_business_export_${new Date().toISOString().split('T')[0]}_${uuidv4().slice(0, 8)}.xlsx`;
    const filePath = join(tmpdir(), fileName);
    
    // Write Excel file
    XLSX.writeFile(workbook, filePath);
    console.log(`📁 Excel file created: ${filePath}`);
    
    return filePath;
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(
    filePath: string, 
    options: {
      fileName?: string;
      folderId?: string;
      description?: string;
    } = {}
  ): Promise<DriveUploadResult> {
    if (!await this.isAuthenticated()) {
      throw new Error('Google Drive service not authenticated');
    }
    
    try {
      const fileName = options.fileName || filePath.split('/').pop() || 'export.xlsx';
      
      const fileMetadata: any = {
        name: fileName,
        description: options.description || `Chicken Business Database Export - ${new Date().toISOString()}`
      };
      
      if (options.folderId) {
        fileMetadata.parents = [options.folderId];
      }
      
      const media = {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: createReadStream(filePath)
      };
      
      console.log(`📤 Uploading file to Google Drive: ${fileName}`);
      
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink,size,createdTime'
      });
      
      const file = response.data;
      
      // Make file shareable (optional - configure based on security needs)
      await this.drive.permissions.create({
        fileId: file.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });
      
      console.log(`✅ File uploaded successfully: ${file.webViewLink}`);
      
      return {
        fileId: file.id,
        fileName: file.name,
        webViewLink: file.webViewLink,
        downloadLink: `https://drive.google.com/uc?id=${file.id}&export=download`,
        size: parseInt(file.size) || 0,
        uploadedAt: file.createdTime
      };
    } catch (error) {
      console.error('❌ Failed to upload file to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Complete export and upload workflow
   */
  async exportAndUpload(config: ExportConfig): Promise<DriveUploadResult> {
    try {
      console.log('🚀 Starting database export and Google Drive upload...');
      
      // Export to Excel
      const filePath = await this.exportToExcel(config);
      
      // Upload to Google Drive
      const uploadResult = await this.uploadFile(filePath, {
        fileName: `chicken_business_backup_${new Date().toISOString().split('T')[0]}.xlsx`,
        description: `Automated database backup - Tables: ${config.tables.join(', ')}`
      });
      
      // Cleanup temporary file
      try {
        unlinkSync(filePath);
        console.log('🗑️ Temporary file cleaned up');
      } catch (error) {
        console.warn('⚠️ Failed to cleanup temporary file:', error);
      }
      
      // Log export record
      await this.logExportRecord(uploadResult, config);
      
      console.log('✅ Export and upload completed successfully');
      return uploadResult;
    } catch (error) {
      console.error('❌ Export and upload failed:', error);
      throw error;
    }
  }

  /**
   * Log export record for audit trail
   */
  private async logExportRecord(uploadResult: DriveUploadResult, config: ExportConfig): Promise<void> {
    try {
      await supabase
        .from('export_logs')
        .insert({
          id: uuidv4(),
          file_id: uploadResult.fileId,
          file_name: uploadResult.fileName,
          file_url: uploadResult.webViewLink,
          tables_exported: config.tables,
          export_config: config,
          file_size: uploadResult.size,
          status: 'completed',
          created_at: new Date().toISOString()
        });
      
      console.log('📝 Export record logged successfully');
    } catch (error) {
      console.warn('⚠️ Failed to log export record:', error);
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('export_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Failed to get export history:', error);
      return [];
    }
  }

  /**
   * Schedule automated exports (placeholder for cron integration)
   */
  async scheduleAutomatedExport(schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    tables: string[];
    time?: string; // HH:MM format
  }): Promise<void> {
    console.log('📅 Scheduling automated export:', schedule);
    // This would integrate with a job scheduler like node-cron
    // Implementation depends on deployment environment
  }
}

// Singleton instance
export const googleDriveService = new GoogleDriveService();