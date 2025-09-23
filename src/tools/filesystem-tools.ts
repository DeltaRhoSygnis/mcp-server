/**
 * Filesystem MCP Tools Implementation
 * Secure file operations with configurable access controls for business data
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export class FilesystemMCPTools {
  private allowedBasePaths: string[];
  private readOnlyMode: boolean;
  private maxFileSize: number;

  constructor() {
    // Configure allowed directories for security
    this.allowedBasePaths = [
      path.resolve('./data'),
      path.resolve('./uploads'),
      path.resolve('./reports'),
      path.resolve('./exports'),
      path.resolve('./backups')
    ];
    
    this.readOnlyMode = process.env.FILESYSTEM_READONLY === 'true';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '50000000'); // 50MB default
  }

  /**
   * Read file content with business context awareness
   */
  async filesystem_read(args: {
    path: string;
    encoding?: string;
    maxSize?: number;
  }) {
    const fullPath = await this.validateAndResolvePath(args.path);
    
    try {
      // Check file size before reading
      const stats = await fs.stat(fullPath);
      const maxSize = args.maxSize || this.maxFileSize;
      
      if (stats.size > maxSize) {
        throw new Error(`File size ${stats.size} exceeds maximum ${maxSize} bytes`);
      }

      const content = await fs.readFile(fullPath, args.encoding || 'utf-8');
      
      // Analyze content for business relevance
      const businessMetadata = await this.analyzeFileForBusiness(content, fullPath);
      
      return {
        path: args.path,
        content,
        metadata: {
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          encoding: args.encoding || 'utf-8',
          isBusinessData: businessMetadata.isBusinessData,
          dataType: businessMetadata.dataType,
          extractedInfo: businessMetadata.extractedInfo
        }
      };

    } catch (error) {
      throw new Error(`Failed to read file ${args.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write file content with business validation
   */
  async filesystem_write(args: {
    path: string;
    content: string;
    encoding?: string;
    createDirs?: boolean;
    businessContext?: string;
  }) {
    if (this.readOnlyMode) {
      throw new Error('Filesystem is in read-only mode');
    }

    const fullPath = await this.validateAndResolvePath(args.path);
    
    try {
      // Validate content size
      const contentSize = Buffer.byteLength(args.content, args.encoding || 'utf-8');
      if (contentSize > this.maxFileSize) {
        throw new Error(`Content size ${contentSize} exceeds maximum ${this.maxFileSize} bytes`);
      }

      // Create directories if requested
      if (args.createDirs) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
      }

      // Validate business content if context provided
      if (args.businessContext) {
        const validation = await this.validateBusinessContent(args.content, args.businessContext);
        if (!validation.isValid) {
          throw new Error(`Business validation failed: ${validation.errors.join(', ')}`);
        }
      }

      await fs.writeFile(fullPath, args.content, args.encoding || 'utf-8');
      const stats = await fs.stat(fullPath);
      
      return {
        path: args.path,
        size: stats.size,
        written: true,
        timestamp: new Date(),
        businessContext: args.businessContext,
        metadata: {
          encoding: args.encoding || 'utf-8',
          created: stats.birthtime,
          modified: stats.mtime
        }
      };

    } catch (error) {
      throw new Error(`Failed to write file ${args.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List directory contents with business file classification
   */
  async filesystem_list(args: {
    path: string;
    recursive?: boolean;
    includeHidden?: boolean;
    businessFilter?: string;
  }) {
    const fullPath = await this.validateAndResolvePath(args.path);
    
    try {
      const entries = await this.listDirectoryRecursive(
        fullPath, 
        args.recursive || false,
        args.includeHidden || false
      );

      // Classify business files
      const classifiedEntries = await Promise.all(
        entries.map(async (entry) => {
          const businessInfo = await this.classifyBusinessFile(entry);
          return {
            ...entry,
            businessInfo
          };
        })
      );

      // Filter by business context if specified
      let filteredEntries = classifiedEntries;
      if (args.businessFilter) {
        filteredEntries = classifiedEntries.filter(entry => 
          entry.businessInfo.category === args.businessFilter ||
          entry.businessInfo.tags.includes(args.businessFilter)
        );
      }

      return {
        path: args.path,
        entries: filteredEntries,
        summary: {
          total_files: filteredEntries.filter(e => e.type === 'file').length,
          total_directories: filteredEntries.filter(e => e.type === 'directory').length,
          business_files: filteredEntries.filter(e => e.businessInfo.isBusinessData).length,
          categories: this.summarizeBusinessCategories(filteredEntries)
        }
      };

    } catch (error) {
      throw new Error(`Failed to list directory ${args.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete file or directory with business impact analysis
   */
  async filesystem_delete(args: {
    path: string;
    recursive?: boolean;
    analyzeImpact?: boolean;
  }) {
    if (this.readOnlyMode) {
      throw new Error('Filesystem is in read-only mode');
    }

    const fullPath = await this.validateAndResolvePath(args.path);
    
    try {
      const stats = await fs.stat(fullPath);
      let impactAnalysis = null;

      // Analyze business impact before deletion
      if (args.analyzeImpact) {
        impactAnalysis = await this.analyzeDeleteImpact(fullPath, stats.isDirectory());
      }

      if (stats.isDirectory()) {
        if (!args.recursive) {
          // Check if directory is empty
          const entries = await fs.readdir(fullPath);
          if (entries.length > 0) {
            throw new Error('Directory is not empty. Use recursive=true to delete non-empty directories.');
          }
        }
        await fs.rm(fullPath, { recursive: args.recursive || false, force: true });
      } else {
        await fs.unlink(fullPath);
      }

      return {
        path: args.path,
        deleted: true,
        type: stats.isDirectory() ? 'directory' : 'file',
        timestamp: new Date(),
        impactAnalysis,
        size_freed: stats.isFile() ? stats.size : null
      };

    } catch (error) {
      throw new Error(`Failed to delete ${args.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Copy file with business metadata preservation
   */
  async filesystem_copy(args: {
    sourcePath: string;
    destinationPath: string;
    preserveMetadata?: boolean;
    businessContext?: string;
  }) {
    if (this.readOnlyMode) {
      throw new Error('Filesystem is in read-only mode');
    }

    const sourceFullPath = await this.validateAndResolvePath(args.sourcePath);
    const destFullPath = await this.validateAndResolvePath(args.destinationPath);
    
    try {
      const sourceStats = await fs.stat(sourceFullPath);
      
      if (sourceStats.isDirectory()) {
        throw new Error('Directory copying not yet implemented. Use individual file operations.');
      }

      // Create destination directory if needed
      await fs.mkdir(path.dirname(destFullPath), { recursive: true });

      // Copy file content
      await pipeline(
        createReadStream(sourceFullPath),
        createWriteStream(destFullPath)
      );

      // Preserve metadata if requested
      if (args.preserveMetadata) {
        await fs.utimes(destFullPath, sourceStats.atime, sourceStats.mtime);
      }

      const destStats = await fs.stat(destFullPath);

      return {
        sourcePath: args.sourcePath,
        destinationPath: args.destinationPath,
        copied: true,
        size: destStats.size,
        timestamp: new Date(),
        businessContext: args.businessContext,
        metadata_preserved: args.preserveMetadata || false
      };

    } catch (error) {
      throw new Error(`Failed to copy ${args.sourcePath} to ${args.destinationPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search files by content with business intelligence
   */
  async filesystem_search(args: {
    path: string;
    pattern: string;
    fileTypes?: string[];
    businessContext?: string;
    maxResults?: number;
  }) {
    const fullPath = await this.validateAndResolvePath(args.path);
    
    try {
      const searchResults = await this.searchFiles(
        fullPath,
        args.pattern,
        args.fileTypes || [],
        args.maxResults || 50
      );

      // Enhance results with business intelligence
      const enhancedResults = await Promise.all(
        searchResults.map(async (result) => {
          const businessRelevance = await this.assessBusinessRelevance(
            result.content,
            args.businessContext || ''
          );
          
          return {
            ...result,
            businessRelevance
          };
        })
      );

      // Sort by business relevance if context provided
      if (args.businessContext) {
        enhancedResults.sort((a, b) => b.businessRelevance.score - a.businessRelevance.score);
      }

      return {
        pattern: args.pattern,
        searchPath: args.path,
        results: enhancedResults,
        summary: {
          total_matches: enhancedResults.length,
          high_relevance: enhancedResults.filter(r => r.businessRelevance.score > 0.8).length,
          file_types: [...new Set(enhancedResults.map(r => r.fileType))]
        }
      };

    } catch (error) {
      throw new Error(`Search failed in ${args.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Private helper methods
   */
  private async validateAndResolvePath(inputPath: string): Promise<string> {
    const resolvedPath = path.resolve(inputPath);
    
    // Check if path is within allowed directories
    const isAllowed = this.allowedBasePaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      throw new Error(`Access denied: Path ${inputPath} is not in allowed directories`);
    }

    return resolvedPath;
  }

  private async listDirectoryRecursive(
    dirPath: string, 
    recursive: boolean, 
    includeHidden: boolean
  ): Promise<Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number | null;
    modified: Date;
    created: Date;
  }>> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(entryPath);

      const entryInfo = {
        name: entry.name,
        path: path.relative(process.cwd(), entryPath),
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
        size: entry.isFile() ? stats.size : null,
        modified: stats.mtime,
        created: stats.birthtime
      };

      results.push(entryInfo);

      // Recurse into subdirectories if requested
      if (recursive && entry.isDirectory()) {
        const subEntries = await this.listDirectoryRecursive(entryPath, true, includeHidden);
        results.push(...subEntries);
      }
    }

    return results;
  }

  private async analyzeFileForBusiness(content: string, filePath: string): Promise<{
    isBusinessData: boolean;
    dataType: string;
    extractedInfo: any;
  }> {
    const fileName = path.basename(filePath).toLowerCase();
    const fileExt = path.extname(filePath).toLowerCase();

    // Simple business data detection
    const businessKeywords = [
      'chicken', 'poultry', 'sales', 'purchase', 'stock', 'inventory',
      'supplier', 'customer', 'revenue', 'expense', 'profit', 'forecast'
    ];

    const isBusinessData = businessKeywords.some(keyword => 
      fileName.includes(keyword) || content.toLowerCase().includes(keyword)
    );

    let dataType = 'unknown';
    if (fileExt === '.json') dataType = 'json_data';
    else if (fileExt === '.csv') dataType = 'csv_data';
    else if (fileExt === '.txt') dataType = 'text_notes';
    else if (fileExt === '.md') dataType = 'markdown_docs';

    return {
      isBusinessData,
      dataType,
      extractedInfo: {
        keywords_found: businessKeywords.filter(keyword => 
          content.toLowerCase().includes(keyword)
        ),
        file_extension: fileExt,
        content_length: content.length
      }
    };
  }

  private async validateBusinessContent(content: string, businessContext: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors = [];

    // Basic validation rules
    if (content.length === 0) {
      errors.push('Content cannot be empty');
    }

    if (businessContext === 'financial_data') {
      // Validate financial data format
      if (!content.includes('amount') && !content.includes('price') && !content.includes('cost')) {
        errors.push('Financial data should contain amount, price, or cost information');
      }
    }

    if (businessContext === 'inventory_data') {
      // Validate inventory data format
      if (!content.includes('quantity') && !content.includes('stock') && !content.includes('items')) {
        errors.push('Inventory data should contain quantity, stock, or items information');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async classifyBusinessFile(entry: any): Promise<{
    isBusinessData: boolean;
    category: string;
    tags: string[];
    confidence: number;
  }> {
    const fileName = entry.name.toLowerCase();
    
    // Business file classification
    const classifications = {
      sales: ['sales', 'revenue', 'income'],
      inventory: ['stock', 'inventory', 'items'],
      financial: ['finance', 'expense', 'cost', 'profit'],
      reports: ['report', 'summary', 'analysis'],
      notes: ['notes', 'memo', 'log']
    };

    let category = 'general';
    const tags = [];
    let confidence = 0;

    for (const [cat, keywords] of Object.entries(classifications)) {
      const matches = keywords.filter(keyword => fileName.includes(keyword));
      if (matches.length > 0) {
        category = cat;
        tags.push(...matches);
        confidence = matches.length / keywords.length;
        break;
      }
    }

    return {
      isBusinessData: confidence > 0,
      category,
      tags,
      confidence
    };
  }

  private async analyzeDeleteImpact(filePath: string, isDirectory: boolean): Promise<{
    impactLevel: 'low' | 'medium' | 'high';
    warnings: string[];
    affectedSystems: string[];
  }> {
    const warnings = [];
    const affectedSystems = [];
    let impactLevel: 'low' | 'medium' | 'high' = 'low';

    const fileName = path.basename(filePath).toLowerCase();

    // Check for important business files
    if (fileName.includes('backup') || fileName.includes('export')) {
      warnings.push('This appears to be a backup or export file');
      impactLevel = 'medium';
    }

    if (fileName.includes('config') || fileName.includes('settings')) {
      warnings.push('This appears to be a configuration file');
      affectedSystems.push('system_configuration');
      impactLevel = 'high';
    }

    if (isDirectory && fileName.includes('data')) {
      warnings.push('This directory may contain important business data');
      affectedSystems.push('business_data');
      impactLevel = 'high';
    }

    return { impactLevel, warnings, affectedSystems };
  }

  private summarizeBusinessCategories(entries: any[]): Record<string, number> {
    return entries
      .filter(entry => entry.businessInfo.isBusinessData)
      .reduce((acc, entry) => {
        const category = entry.businessInfo.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});
  }

  private async searchFiles(
    dirPath: string,
    pattern: string,
    fileTypes: string[],
    maxResults: number
  ): Promise<Array<{
    file: string;
    matches: Array<{ line: number; content: string; }>;
    content: string;
    fileType: string;
  }>> {
    const results = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        
        // Filter by file type if specified
        if (fileTypes.length > 0 && !fileTypes.includes(ext)) {
          continue;
        }

        try {
          const content = await fs.readFile(entryPath, 'utf-8');
          const lines = content.split('\n');
          const matches = [];

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(pattern.toLowerCase())) {
              matches.push({
                line: index + 1,
                content: line.trim()
              });
            }
          });

          if (matches.length > 0) {
            results.push({
              file: path.relative(process.cwd(), entryPath),
              matches,
              content: content.substring(0, 1000), // First 1KB for context
              fileType: ext || 'no_extension'
            });
          }
        } catch (error) {
          // Skip files that can't be read as text
          continue;
        }
      }
    }

    return results;
  }

  private async assessBusinessRelevance(content: string, businessContext: string): Promise<{
    score: number;
    reasons: string[];
  }> {
    const reasons = [];
    let score = 0;

    if (businessContext) {
      const contextWords = businessContext.toLowerCase().split(/\s+/);
      const contentLower = content.toLowerCase();
      
      const matches = contextWords.filter(word => contentLower.includes(word));
      score = matches.length / contextWords.length;
      
      if (matches.length > 0) {
        reasons.push(`Matches business context: ${matches.join(', ')}`);
      }
    }

    // Business keyword relevance
    const businessKeywords = ['chicken', 'sales', 'inventory', 'profit', 'customer'];
    const businessMatches = businessKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    if (businessMatches.length > 0) {
      score += businessMatches.length * 0.1;
      reasons.push(`Contains business keywords: ${businessMatches.join(', ')}`);
    }

    return {
      score: Math.min(score, 1.0), // Cap at 1.0
      reasons
    };
  }
}

// Export singleton instance
export const filesystemMCPTools = new FilesystemMCPTools();

// Export schemas for validation
export const filesystemSchemas = {
  filesystem_read: z.object({
    path: z.string(),
    encoding: z.string().optional(),
    maxSize: z.number().optional()
  }),

  filesystem_write: z.object({
    path: z.string(),
    content: z.string(),
    encoding: z.string().optional(),
    createDirs: z.boolean().optional(),
    businessContext: z.string().optional()
  }),

  filesystem_list: z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
    includeHidden: z.boolean().optional(),
    businessFilter: z.string().optional()
  }),

  filesystem_delete: z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
    analyzeImpact: z.boolean().optional()
  }),

  filesystem_copy: z.object({
    sourcePath: z.string(),
    destinationPath: z.string(),
    preserveMetadata: z.boolean().optional(),
    businessContext: z.string().optional()
  }),

  filesystem_search: z.object({
    path: z.string(),
    pattern: z.string(),
    fileTypes: z.array(z.string()).optional(),
    businessContext: z.string().optional(),
    maxResults: z.number().optional()
  })
};