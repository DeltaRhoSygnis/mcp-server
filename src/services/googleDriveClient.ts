/**
 * Google Drive Client for Chicken Business MCP Server
 * Handles automated Excel exports and file uploads to Google Drive
 * Integrated with backup and overflow management system
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as XLSX from 'xlsx';

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri?: string;
}

export interface UploadFileOptions {
  name: string;
  data: Buffer | string;
  folder?: string;
  mimeType?: string;
  description?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  downloadUrl: string;
}

export class GoogleDriveClient {
  private auth: OAuth2Client;
  private drive: any;
  private config: GoogleDriveConfig;
  private isInitialized: boolean = false;

  constructor(config: GoogleDriveConfig) {
    this.config = {
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
      ...config
    };

    // Use google.auth.OAuth2 with proper type compatibility
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    ) as any; // Type assertion for compatibility
  }

  /**
   * Initialize Google Drive client with authentication
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set refresh token
      this.auth.setCredentials({
        refresh_token: this.config.refreshToken
      });

      // Initialize Drive API
      this.drive = google.drive({ version: 'v3', auth: this.auth as any });

      // Test connection
      await this.drive.about.get({ fields: 'user' });

      this.isInitialized = true;
      console.log('✅ Google Drive client initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Google Drive client:', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(options: UploadFileOptions): Promise<DriveFile> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let folderId: string | undefined;

      // Create or find folder if specified
      if (options.folder) {
        folderId = await this.ensureFolderExists(options.folder);
      }

      // Determine MIME type
      const mimeType = options.mimeType || this.getMimeType(options.name);

      // Upload file
      const response = await this.drive.files.create({
        requestBody: {
          name: options.name,
          parents: folderId ? [folderId] : undefined,
          description: options.description
        },
        media: {
          mimeType,
          body: options.data
        },
        fields: 'id,name,size,modifiedTime,webViewLink'
      });

      const file = response.data;

      // Generate download link
      const downloadUrl = `https://drive.google.com/uc?id=${file.id}&export=download`;

      return {
        id: file.id,
        name: file.name,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        downloadUrl
      };

    } catch (error) {
      console.error('Failed to upload file to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create Excel file from business data and upload to Drive
   */
  async exportBusinessDataToExcel(data: {
    sales?: any[];
    expenses?: any[];
    dailySummaries?: any[];
    tableName: string;
    dateRange?: { from: string; to: string };
  }): Promise<DriveFile> {
    try {
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      // Add sales sheet if data exists
      if (data.sales && data.sales.length > 0) {
        const salesSheet = XLSX.utils.json_to_sheet(data.sales);
        XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales');
      }

      // Add expenses sheet if data exists
      if (data.expenses && data.expenses.length > 0) {
        const expensesSheet = XLSX.utils.json_to_sheet(data.expenses);
        XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');
      }

      // Add daily summaries sheet if data exists
      if (data.dailySummaries && data.dailySummaries.length > 0) {
        const summariesSheet = XLSX.utils.json_to_sheet(data.dailySummaries);
        XLSX.utils.book_append_sheet(workbook, summariesSheet, 'Daily Summaries');
      }

      // Add metadata sheet
      const metadata = {
        'Export Date': new Date().toISOString(),
        'Table Name': data.tableName,
        'Date Range From': data.dateRange?.from || 'All time',
        'Date Range To': data.dateRange?.to || 'All time',
        'Sales Records': data.sales?.length || 0,
        'Expense Records': data.expenses?.length || 0,
        'Summary Records': data.dailySummaries?.length || 0
      };
      const metadataSheet = XLSX.utils.json_to_sheet([metadata]);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Export Info');

      // Convert to buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${data.tableName}_export_${timestamp}.xlsx`;

      // Upload to Google Drive
      return await this.uploadFile({
        name: filename,
        data: excelBuffer,
        folder: 'chicken-business-exports',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: `Automated export of ${data.tableName} data from Chicken Business MCP Server`
      });

    } catch (error) {
      console.error('Failed to export business data to Excel:', error);
      throw error;
    }
  }

  /**
   * List files in a specific folder
   */
  async listFiles(folderName?: string, limit: number = 10): Promise<DriveFile[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let query = "trashed=false";
      
      if (folderName) {
        const folderId = await this.findFolder(folderName);
        if (folderId) {
          query += ` and '${folderId}' in parents`;
        }
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize: limit,
        fields: 'files(id,name,size,modifiedTime,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        downloadUrl: `https://drive.google.com/uc?id=${file.id}&export=download`
      }));

    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.drive.files.delete({ fileId });
      console.log(`✅ File ${fileId} deleted from Google Drive`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(fileId: string): Promise<DriveFile> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,size,modifiedTime,webViewLink'
      });

      const file = response.data;
      return {
        id: file.id,
        name: file.name,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        downloadUrl: `https://drive.google.com/uc?id=${file.id}&export=download`
      };

    } catch (error) {
      console.error('Failed to get file info:', error);
      throw error;
    }
  }

  /**
   * Ensure folder exists, create if it doesn't
   */
  private async ensureFolderExists(folderName: string): Promise<string> {
    // First try to find existing folder
    const existingFolderId = await this.findFolder(folderName);
    if (existingFolderId) {
      return existingFolderId;
    }

    // Create new folder
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });

      console.log(`✅ Created folder: ${folderName}`);
      return response.data.id;

    } catch (error) {
      console.error(`Failed to create folder ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Find folder by name
   */
  private async findFolder(folderName: string): Promise<string | null> {
    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)'
      });

      const folders = response.data.files;
      return folders.length > 0 ? folders[0].id : null;

    } catch (error) {
      console.error('Failed to find folder:', error);
      return null;
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg'
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Create automated backup schedule for chicken business data
   */
  async scheduleBusinessBackup(schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    tables: string[];
    retentionDays: number;
  }): Promise<void> {
    // This would typically integrate with a job scheduler
    // For now, we'll create a simple configuration file
    const backupConfig = {
      schedule: schedule.frequency,
      tables: schedule.tables,
      retention: schedule.retentionDays,
      lastRun: null,
      nextRun: this.calculateNextRun(schedule.frequency),
      enabled: true
    };

    // Store configuration (in practice, this would be in a database or config service)
    const configBuffer = Buffer.from(JSON.stringify(backupConfig, null, 2));
    
    await this.uploadFile({
      name: 'backup_schedule_config.json',
      data: configBuffer,
      folder: 'chicken-business-config',
      description: 'Automated backup schedule configuration'
    });

    console.log(`✅ Backup schedule configured: ${schedule.frequency}`);
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): string {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }

    return now.toISOString();
  }

  /**
   * Clean up old backup files based on retention policy
   */
  async cleanupOldBackups(folderName: string, retentionDays: number): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const files = await this.listFiles(folderName, 100);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const file of files) {
        const fileDate = new Date(file.modifiedTime);
        if (fileDate < cutoffDate) {
          await this.deleteFile(file.id);
          deletedCount++;
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} old backup files`);
      return deletedCount;

    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      throw error;
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageInfo(): Promise<{
    total: number;
    used: number;
    available: number;
    usagePercentage: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota;
      const total = parseInt(quota.limit || '0');
      const used = parseInt(quota.usage || '0');
      const available = total - used;
      const usagePercentage = total > 0 ? (used / total) * 100 : 0;

      return {
        total,
        used,
        available,
        usagePercentage
      };

    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }

  /**
   * Health check for Google Drive connectivity
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    authenticated: boolean;
    error?: string;
    storageInfo?: any;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test basic connectivity
      const aboutResponse = await this.drive.about.get({ fields: 'user,storageQuota' });
      
      // Get storage info
      const storageInfo = await this.getStorageInfo();

      return {
        healthy: true,
        authenticated: true,
        storageInfo
      };

    } catch (error) {
      return {
        healthy: false,
        authenticated: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export singleton instance
export const googleDriveClient = new GoogleDriveClient({
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
  refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!
});