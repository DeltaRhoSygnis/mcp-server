/**
 * MCP Time Tools Implementation
 * Provides trusted temporal context and scheduling capabilities
 * Prevents AI hallucinations about dates/times, enables accurate business forecasting
 * Integrates with memory/business systems for time-based operations
 * Supports timezone awareness, scheduling, TTL management, and audit timestamps
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Timezone support (default to Philippines for chicken business)
const DEFAULT_TIMEZONE = 'Asia/Manila';

interface TimeAuditLog {
  id: string;
  operation: string;
  timestamp: Date;
  timezone: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  scheduled_time: Date;
  timezone: string;
  task_type: 'reminder' | 'archive' | 'forecast' | 'backup' | 'custom';
  task_data: Record<string, any>;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_by?: string;
  created_at: Date;
  completed_at?: Date;
}

// Audit helper
const logTimeAudit = async (operation: string, timezone: string, userId?: string, metadata?: Record<string, any>): Promise<void> => {
  const log: TimeAuditLog = {
    id: uuidv4(),
    operation,
    timestamp: new Date(),
    timezone,
    userId,
    metadata
  };
  await supabase.from('ai_audit_logs').insert({
    operation_type: `time_${operation}`,
    input_data: { timezone, metadata },
    output_data: log,
    success: true,
    user_id: userId
  });
};

class MCPTimeTools {
  /**
   * Get current timestamp with timezone (prevents hallucinations)
   * MCP Tool: time_get_current
   */
  async time_get_current(args: {
    timezone?: string;
    format?: 'iso' | 'unix' | 'readable' | 'business';
    include_metadata?: boolean;
  }) {
    const schema = z.object({
      timezone: z.string().optional().default(DEFAULT_TIMEZONE),
      format: z.enum(['iso', 'unix', 'readable', 'business']).optional().default('iso'),
      include_metadata: z.boolean().optional().default(false)
    });
    const validated = schema.parse(args);

    const now = new Date();
    
    // Format timestamp
    let formatted: string | number;
    switch (validated.format) {
      case 'unix':
        formatted = Math.floor(now.getTime() / 1000);
        break;
      case 'readable':
        formatted = now.toLocaleString('en-US', { timeZone: validated.timezone });
        break;
      case 'business':
        formatted = now.toLocaleString('en-US', { 
          timeZone: validated.timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        break;
      default: // iso
        formatted = now.toISOString();
    }

    const result = {
      timestamp: formatted,
      timezone: validated.timezone,
      utc_offset: now.getTimezoneOffset(),
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: validated.timezone }),
      is_business_hours: this.isBusinessHours(now, validated.timezone),
      metadata: validated.include_metadata ? {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        date: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
        is_weekend: [0, 6].includes(now.getDay()),
        quarter: Math.ceil((now.getMonth() + 1) / 3)
      } : undefined
    };

    await logTimeAudit('get_current', validated.timezone, undefined, { format: validated.format });
    return result;
  }

  /**
   * Calculate time differences and durations
   * MCP Tool: time_calculate_duration
   */
  async time_calculate_duration(args: {
    start_time: string | number;
    end_time?: string | number; // Default to now
    unit?: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
    business_days_only?: boolean;
  }) {
    const schema = z.object({
      start_time: z.union([z.string(), z.number()]),
      end_time: z.union([z.string(), z.number()]).optional(),
      unit: z.enum(['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months']).optional().default('hours'),
      business_days_only: z.boolean().optional().default(false)
    });
    const validated = schema.parse(args);

    const startDate = new Date(validated.start_time);
    const endDate = validated.end_time ? new Date(validated.end_time) : new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }

    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    
    let duration: number;
    switch (validated.unit) {
      case 'milliseconds': duration = diffMs; break;
      case 'seconds': duration = diffMs / 1000; break;
      case 'minutes': duration = diffMs / (1000 * 60); break;
      case 'hours': duration = diffMs / (1000 * 60 * 60); break;
      case 'days': duration = diffMs / (1000 * 60 * 60 * 24); break;
      case 'weeks': duration = diffMs / (1000 * 60 * 60 * 24 * 7); break;
      case 'months': duration = diffMs / (1000 * 60 * 60 * 24 * 30.44); break; // Average month
    }

    // Business days calculation (exclude weekends)
    let businessDays: number | undefined;
    if (validated.business_days_only || validated.unit === 'days') {
      businessDays = this.calculateBusinessDays(startDate, endDate);
      if (validated.business_days_only) {
        duration = businessDays;
      }
    }

    const result = {
      duration: Math.round(duration * 100) / 100, // Round to 2 decimals
      unit: validated.unit,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      business_days: businessDays,
      is_future: endDate > new Date(),
      human_readable: this.formatDurationHuman(duration, validated.unit)
    };

    await logTimeAudit('calculate_duration', DEFAULT_TIMEZONE, undefined, { unit: validated.unit });
    return result;
  }

  /**
   * Schedule tasks/reminders (business context: archival, forecasts, reminders)
   * MCP Tool: time_schedule_task
   */
  async time_schedule_task(args: {
    name: string;
    description: string;
    scheduled_time: string | number;
    timezone?: string;
    task_type: 'reminder' | 'archive' | 'forecast' | 'backup' | 'custom';
    task_data?: Record<string, any>;
    userId?: string;
  }) {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      scheduled_time: z.union([z.string(), z.number()]),
      timezone: z.string().optional().default(DEFAULT_TIMEZONE),
      task_type: z.enum(['reminder', 'archive', 'forecast', 'backup', 'custom']),
      task_data: z.record(z.any()).optional().default({}),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    const scheduledDate = new Date(validated.scheduled_time);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduled_time format');
    }

    if (scheduledDate <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const task: ScheduledTask = {
      id: uuidv4(),
      name: validated.name,
      description: validated.description,
      scheduled_time: scheduledDate,
      timezone: validated.timezone,
      task_type: validated.task_type,
      task_data: validated.task_data || {},
      status: 'pending',
      created_by: validated.userId,
      created_at: new Date()
    };

    // Store in database (assume scheduled_tasks table exists or create)
    const { error } = await supabase
      .from('scheduled_tasks')
      .insert({
        id: task.id,
        name: task.name,
        description: task.description,
        scheduled_time: task.scheduled_time.toISOString(),
        timezone: task.timezone,
        task_type: task.task_type,
        task_data: task.task_data,
        status: task.status,
        created_by: task.created_by,
        created_at: task.created_at.toISOString()
      });

    if (error) throw error;

    await logTimeAudit('schedule_task', validated.timezone, validated.userId, { 
      task_id: task.id, 
      task_type: validated.task_type 
    });

    return {
      task_id: task.id,
      name: task.name,
      scheduled_time: scheduledDate.toISOString(),
      timezone: validated.timezone,
      status: 'scheduled',
      time_until_execution: this.formatDurationHuman(
        (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60),
        'hours'
      ),
      business_context: this.getBusinessTimeContext(scheduledDate, validated.timezone)
    };
  }

  /**
   * List and manage scheduled tasks
   * MCP Tool: time_list_scheduled_tasks
   */
  async time_list_scheduled_tasks(args: {
    status?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'all';
    task_type?: 'reminder' | 'archive' | 'forecast' | 'backup' | 'custom';
    limit?: number;
    userId?: string;
  }) {
    const schema = z.object({
      status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'all']).optional().default('pending'),
      task_type: z.enum(['reminder', 'archive', 'forecast', 'backup', 'custom']).optional(),
      limit: z.number().optional().default(20),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    let query = supabase.from('scheduled_tasks').select('*');

    if (validated.status !== 'all') {
      query = query.eq('status', validated.status);
    }
    if (validated.task_type) {
      query = query.eq('task_type', validated.task_type);
    }
    if (validated.userId) {
      query = query.eq('created_by', validated.userId);
    }

    const { data: tasks, error } = await query
      .order('scheduled_time', { ascending: true })
      .limit(validated.limit);

    if (error) throw error;

    const enrichedTasks = (tasks || []).map(task => ({
      ...task,
      time_until_execution: task.status === 'pending' ? 
        this.formatDurationHuman((new Date(task.scheduled_time).getTime() - Date.now()) / (1000 * 60 * 60), 'hours') : 
        null,
      is_overdue: task.status === 'pending' && new Date(task.scheduled_time) < new Date(),
      business_context: this.getBusinessTimeContext(new Date(task.scheduled_time), task.timezone)
    }));

    await logTimeAudit('list_scheduled_tasks', DEFAULT_TIMEZONE, validated.userId, { count: tasks?.length || 0 });
    return {
      tasks: enrichedTasks,
      total_count: enrichedTasks.length,
      pending_count: enrichedTasks.filter(t => t.status === 'pending').length,
      overdue_count: enrichedTasks.filter(t => t.is_overdue).length
    };
  }

  /**
   * Check and expire TTL records (memory cleanup integration)
   * MCP Tool: time_check_ttl_expiry
   */
  async time_check_ttl_expiry(args: {
    table_name?: string; // Default to observations
    ttl_column?: string; // Default to expires_at
    dry_run?: boolean;
    userId?: string;
  }) {
    const schema = z.object({
      table_name: z.string().optional().default('observations'),
      ttl_column: z.string().optional().default('expires_at'),
      dry_run: z.boolean().optional().default(true),
      userId: z.string().optional()
    });
    const validated = schema.parse(args);

    // Find expired records
    const { data: expired, error } = await supabase
      .from(validated.table_name)
      .select('id, created_at, expires_at')
      .lt(validated.ttl_column, new Date().toISOString())
      .limit(1000); // Safety limit

    if (error) throw error;

    let deletedCount = 0;
    if (!validated.dry_run && expired?.length) {
      const expiredIds = expired.map(r => r.id);
      const { error: deleteError } = await supabase
        .from(validated.table_name)
        .delete()
        .in('id', expiredIds);

      if (!deleteError) {
        deletedCount = expiredIds.length;
      }
    }

    await logTimeAudit('check_ttl_expiry', DEFAULT_TIMEZONE, validated.userId, {
      table: validated.table_name,
      found: expired?.length || 0,
      deleted: deletedCount,
      dry_run: validated.dry_run
    });

    return {
      expired_found: expired?.length || 0,
      deleted_count: deletedCount,
      dry_run: validated.dry_run,
      expired_records: validated.dry_run ? expired?.slice(0, 10) : undefined, // Sample for dry-run
      next_expiry: await this.getNextExpiry(validated.table_name, validated.ttl_column)
    };
  }

  /**
   * Generate business time reports (sales periods, forecasting windows)
   * MCP Tool: time_business_periods
   */
  async time_business_periods(args: {
    period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    periods_back?: number; // How many periods to go back
    timezone?: string;
    include_forecasts?: boolean;
  }) {
    const schema = z.object({
      period_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
      periods_back: z.number().optional().default(4),
      timezone: z.string().optional().default(DEFAULT_TIMEZONE),
      include_forecasts: z.boolean().optional().default(false)
    });
    const validated = schema.parse(args);

    const now = new Date();
    const periods = [];

    for (let i = 0; i < validated.periods_back; i++) {
      const period = this.calculatePeriod(now, validated.period_type, i, validated.timezone);
      periods.push(period);
    }

    // Add forecast periods if requested
    if (validated.include_forecasts) {
      for (let i = 1; i <= 2; i++) { // Next 2 periods
        const forecastPeriod = this.calculatePeriod(now, validated.period_type, -i, validated.timezone);
        forecastPeriod.is_forecast = true;
        periods.push(forecastPeriod);
      }
    }

    await logTimeAudit('business_periods', validated.timezone, undefined, {
      period_type: validated.period_type,
      periods_generated: periods.length
    });

    return {
      period_type: validated.period_type,
      timezone: validated.timezone,
      current_period: periods[0],
      periods,
      business_insights: {
        current_is_weekend: [0, 6].includes(now.getDay()),
        current_is_business_hours: this.isBusinessHours(now, validated.timezone),
        quarter: Math.ceil((now.getMonth() + 1) / 3),
        fiscal_year: now.getFullYear() // Assume calendar year
      }
    };
  }

  // Helper methods
  private isBusinessHours(date: Date, timezone: string): boolean {
    const localTime = date.toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const hour = parseInt(localTime.split(',')[1]?.trim().split(':')[0] || '0');
    const dayOfWeek = date.getDay();
    
    // Business hours: Mon-Sat 8AM-6PM (chicken store typical)
    return dayOfWeek >= 1 && dayOfWeek <= 6 && hour >= 8 && hour < 18;
  }

  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  private formatDurationHuman(duration: number, unit: string): string {
    const rounded = Math.round(duration);
    if (rounded === 0) return `Less than 1 ${unit.slice(0, -1)}`;
    if (rounded === 1) return `1 ${unit.slice(0, -1)}`;
    return `${rounded} ${unit}`;
  }

  private getBusinessTimeContext(date: Date, timezone: string): any {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
    const isWeekend = [0, 6].includes(date.getDay());
    const isBusinessHours = this.isBusinessHours(date, timezone);
    
    return {
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      is_business_hours: isBusinessHours,
      is_peak_hours: this.isPeakHours(date, timezone), // 11AM-2PM, 5PM-7PM
      season: this.getSeason(date),
      month_name: date.toLocaleDateString('en-US', { month: 'long', timeZone: timezone })
    };
  }

  private isPeakHours(date: Date, timezone: string): boolean {
    const hour = parseInt(date.toLocaleString('en-US', { timeZone: timezone, hour12: false }).split(',')[1]?.trim().split(':')[0] || '0');
    return (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 19);
  }

  private getSeason(date: Date): string {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  private calculatePeriod(baseDate: Date, periodType: string, periodsAgo: number, timezone: string): any {
    const date = new Date(baseDate);
    
    switch (periodType) {
      case 'daily':
        date.setDate(date.getDate() - periodsAgo);
        return {
          period_start: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
          period_end: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
          label: date.toLocaleDateString('en-US', { timeZone: timezone }),
          business_context: this.getBusinessTimeContext(date, timezone)
        };
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() - (7 * periodsAgo));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return {
          period_start: weekStart.toISOString(),
          period_end: weekEnd.toISOString(),
          label: `Week of ${weekStart.toLocaleDateString('en-US', { timeZone: timezone })}`,
          business_context: this.getBusinessTimeContext(weekStart, timezone)
        };
      case 'monthly':
        const monthDate = new Date(date.getFullYear(), date.getMonth() - periodsAgo, 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          period_start: monthDate.toISOString(),
          period_end: monthEnd.toISOString(),
          label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: timezone }),
          business_context: this.getBusinessTimeContext(monthDate, timezone)
        };
      // Add quarterly, yearly as needed
      default:
        return { error: 'Unsupported period type' };
    }
  }

  private async getNextExpiry(tableName: string, ttlColumn: string): Promise<string | null> {
    const { data } = await supabase
      .from(tableName)
      .select(ttlColumn)
      .gt(ttlColumn, new Date().toISOString())
      .order(ttlColumn, { ascending: true })
      .limit(1);
    
    return (data?.[0]?.[ttlColumn as keyof typeof data[0]] as string) || null;
  }
}

// Schemas for MCP validation
export const timeSchemas = {
  time_get_current: z.object({
    timezone: z.string().optional(),
    format: z.enum(['iso', 'unix', 'readable', 'business']).optional(),
    include_metadata: z.boolean().optional()
  }),
  time_calculate_duration: z.object({
    start_time: z.union([z.string(), z.number()]),
    end_time: z.union([z.string(), z.number()]).optional(),
    unit: z.enum(['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months']).optional(),
    business_days_only: z.boolean().optional()
  }),
  time_schedule_task: z.object({
    name: z.string(),
    description: z.string(),
    scheduled_time: z.union([z.string(), z.number()]),
    timezone: z.string().optional(),
    task_type: z.enum(['reminder', 'archive', 'forecast', 'backup', 'custom']),
    task_data: z.record(z.any()).optional(),
    userId: z.string().optional()
  }),
  time_list_scheduled_tasks: z.object({
    status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'all']).optional(),
    task_type: z.enum(['reminder', 'archive', 'forecast', 'backup', 'custom']).optional(),
    limit: z.number().optional(),
    userId: z.string().optional()
  }),
  time_check_ttl_expiry: z.object({
    table_name: z.string().optional(),
    ttl_column: z.string().optional(),
    dry_run: z.boolean().optional(),
    userId: z.string().optional()
  }),
  time_business_periods: z.object({
    period_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    periods_back: z.number().optional(),
    timezone: z.string().optional(),
    include_forecasts: z.boolean().optional()
  })
};

// Export singleton
export const mcpTimeTools = new MCPTimeTools();