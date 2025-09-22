/**
 * Production Monitoring and Logging Module
 * Comprehensive monitoring, metrics, and observability for MCP server
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
  component?: string;
  requestId?: string;
  userId?: string;
  timestamp?: Date;
}

export interface AlertRule {
  name: string;
  condition: (metrics: MetricData[]) => boolean;
  threshold: number;
  windowMinutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export class ProductionMonitoring {
  private supabase;
  private metrics = new Map<string, MetricData[]>();
  private alertRules: AlertRule[] = [];
  private logBuffer: LogEntry[] = [];
  private metricsBuffer: MetricData[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.setupDefaultAlertRules();
    this.startMetricsCollection();
    this.startPeriodicFlush();
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric: MetricData = {
      name,
      value,
      labels,
      timestamp: new Date()
    };

    // Add to in-memory buffer
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 entries per metric
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Add to flush buffer
    this.metricsBuffer.push(metric);

    // Check alert rules
    this.checkAlertRules(name);
  }

  /**
   * Log an entry with structured data
   */
  log(entry: LogEntry): void {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date()
    };

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const logMessage = `[${entry.level.toUpperCase()}] ${entry.component || 'MCP'}: ${entry.message}`;
      
      switch (entry.level) {
        case 'error':
          console.error(logMessage, entry.metadata);
          break;
        case 'warn':
          console.warn(logMessage, entry.metadata);
          break;
        case 'debug':
          console.debug(logMessage, entry.metadata);
          break;
        default:
          console.log(logMessage, entry.metadata);
      }
    }

    // Add to buffer for database storage
    this.logBuffer.push(logEntry);

    // Immediate flush for errors
    if (entry.level === 'error') {
      this.flushLogs();
    }
  }

  /**
   * Record API call metrics
   */
  recordAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    this.recordMetric('api_request_count', 1, {
      endpoint,
      method,
      status_code: statusCode.toString(),
      success: statusCode < 400 ? 'true' : 'false'
    });

    this.recordMetric('api_request_duration', duration, {
      endpoint,
      method
    });

    if (statusCode >= 400) {
      this.recordMetric('api_error_count', 1, {
        endpoint,
        method,
        status_code: statusCode.toString()
      });
    }

    this.log({
      level: statusCode >= 400 ? 'warn' : 'info',
      message: `API ${method} ${endpoint} - ${statusCode} (${duration}ms)`,
      component: 'API',
      metadata: { endpoint, method, statusCode, duration, userId }
    });
  }

  /**
   * Record AI model usage
   */
  recordAIUsage(
    model: string,
    operation: string,
    tokensUsed: number,
    duration: number,
    success: boolean,
    userId?: string
  ): void {
    this.recordMetric('ai_tokens_used', tokensUsed, {
      model,
      operation,
      success: success.toString()
    });

    this.recordMetric('ai_request_duration', duration, {
      model,
      operation
    });

    this.recordMetric('ai_request_count', 1, {
      model,
      operation,
      success: success.toString()
    });

    this.log({
      level: success ? 'info' : 'warn',
      message: `AI ${operation} with ${model} - ${success ? 'success' : 'failed'} (${duration}ms, ${tokensUsed} tokens)`,
      component: 'AI',
      metadata: { model, operation, tokensUsed, duration, success, userId }
    });
  }

  /**
   * Record database operation metrics
   */
  recordDBOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected: number,
    success: boolean
  ): void {
    this.recordMetric('db_operation_duration', duration, {
      operation,
      table,
      success: success.toString()
    });

    this.recordMetric('db_rows_affected', rowsAffected, {
      operation,
      table
    });

    this.recordMetric('db_operation_count', 1, {
      operation,
      table,
      success: success.toString()
    });

    if (duration > 1000) { // Log slow queries
      this.log({
        level: 'warn',
        message: `Slow database operation: ${operation} on ${table} took ${duration}ms`,
        component: 'Database',
        metadata: { operation, table, duration, rowsAffected }
      });
    }
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(timeRangeMinutes: number = 60): Record<string, any> {
    const cutoff = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
    const summary: Record<string, any> = {};

    for (const [name, metricHistory] of this.metrics.entries()) {
      const recentMetrics = metricHistory.filter(m => m.timestamp! >= cutoff);
      
      if (recentMetrics.length === 0) continue;

      const values = recentMetrics.map(m => m.value);
      summary[name] = {
        count: recentMetrics.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: values[values.length - 1],
        timestamp: recentMetrics[recentMetrics.length - 1].timestamp
      };
    }

    return summary;
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    metrics: Record<string, any>;
  } {
    const recentMetrics = this.getMetricsSummary(5); // Last 5 minutes
    const checks: Record<string, any> = {};

    // Check API error rate
    const apiErrorRate = this.calculateErrorRate('api_request_count', 'api_error_count');
    checks.api_error_rate = {
      status: apiErrorRate < 0.05 ? 'healthy' : apiErrorRate < 0.1 ? 'degraded' : 'unhealthy',
      value: apiErrorRate,
      threshold: 0.05
    };

    // Check AI success rate
    const aiSuccessRate = this.calculateSuccessRate('ai_request_count');
    checks.ai_success_rate = {
      status: aiSuccessRate > 0.95 ? 'healthy' : aiSuccessRate > 0.9 ? 'degraded' : 'unhealthy',
      value: aiSuccessRate,
      threshold: 0.95
    };

    // Check average response time
    const avgResponseTime = recentMetrics.api_request_duration?.avg || 0;
    checks.response_time = {
      status: avgResponseTime < 1000 ? 'healthy' : avgResponseTime < 3000 ? 'degraded' : 'unhealthy',
      value: avgResponseTime,
      threshold: 1000
    };

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    checks.memory_usage = {
      status: memoryUsedMB < 512 ? 'healthy' : memoryUsedMB < 1024 ? 'degraded' : 'unhealthy',
      value: memoryUsedMB,
      threshold: 512
    };

    const overallStatus = Object.values(checks).every(check => check.status === 'healthy') 
      ? 'healthy' 
      : Object.values(checks).some(check => check.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return {
      status: overallStatus,
      checks,
      metrics: recentMetrics
    };
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        name: 'high_error_rate',
        condition: (metrics) => {
          const errorRate = this.calculateErrorRate('api_request_count', 'api_error_count');
          return errorRate > 0.1;
        },
        threshold: 0.1,
        windowMinutes: 5,
        severity: 'high',
        enabled: true
      },
      {
        name: 'slow_response_time',
        condition: (metrics) => {
          const avgTime = this.getMetricsSummary(5).api_request_duration?.avg || 0;
          return avgTime > 3000;
        },
        threshold: 3000,
        windowMinutes: 5,
        severity: 'medium',
        enabled: true
      },
      {
        name: 'ai_failure_rate',
        condition: (metrics) => {
          const successRate = this.calculateSuccessRate('ai_request_count');
          return successRate < 0.9;
        },
        threshold: 0.9,
        windowMinutes: 10,
        severity: 'high',
        enabled: true
      },
      {
        name: 'high_token_usage',
        condition: (metrics) => {
          const tokenUsage = this.getMetricsSummary(60).ai_tokens_used?.sum || 0;
          return tokenUsage > 100000; // 100k tokens per hour
        },
        threshold: 100000,
        windowMinutes: 60,
        severity: 'medium',
        enabled: true
      }
    ];
  }

  /**
   * Check alert rules and trigger alerts
   */
  private checkAlertRules(metricName: string): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const recentMetrics = this.getMetricsInWindow(metricName, rule.windowMinutes);
        
        if (rule.condition(recentMetrics)) {
          this.triggerAlert(rule, recentMetrics);
        }
      } catch (error) {
        this.log({
          level: 'error',
          message: `Failed to check alert rule: ${rule.name}`,
          component: 'Monitoring',
          metadata: { rule, error: error instanceof Error ? error.message : String(error) }
        });
      }
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, metrics: MetricData[]): Promise<void> {
    const alert = {
      id: uuidv4(),
      rule_name: rule.name,
      severity: rule.severity,
      triggered_at: new Date().toISOString(),
      message: `Alert triggered: ${rule.name}`,
      metrics_data: metrics.slice(-10), // Last 10 data points
      status: 'active'
    };

    this.log({
      level: rule.severity === 'critical' ? 'error' : 'warn',
      message: `ALERT: ${rule.name} triggered (severity: ${rule.severity})`,
      component: 'Alerting',
      metadata: alert
    });

    // Store alert in database
    try {
      await this.supabase.from('system_alerts').insert(alert);
    } catch (error) {
      this.log({
        level: 'error',
        message: 'Failed to store alert in database',
        component: 'Alerting',
        metadata: { alert, error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(totalMetric: string, errorMetric: string): number {
    const recentMetrics = this.getMetricsSummary(5);
    const total = recentMetrics[totalMetric]?.sum || 0;
    const errors = recentMetrics[errorMetric]?.sum || 0;
    
    return total > 0 ? errors / total : 0;
  }

  /**
   * Calculate success rate from labeled metrics
   */
  private calculateSuccessRate(metricName: string): number {
    const recentMetrics = this.getMetricsInWindow(metricName, 5);
    
    let totalRequests = 0;
    let successfulRequests = 0;

    for (const metric of recentMetrics) {
      totalRequests += metric.value;
      if (metric.labels?.success === 'true') {
        successfulRequests += metric.value;
      }
    }

    return totalRequests > 0 ? successfulRequests / totalRequests : 1;
  }

  /**
   * Get metrics within a time window
   */
  private getMetricsInWindow(metricName: string, windowMinutes: number): MetricData[] {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const metricHistory = this.metrics.get(metricName) || [];
    
    return metricHistory.filter(m => m.timestamp! >= cutoff);
  }

  /**
   * Start system metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // System metrics
      const memoryUsage = process.memoryUsage();
      this.recordMetric('system_memory_used', memoryUsage.heapUsed);
      this.recordMetric('system_memory_total', memoryUsage.heapTotal);
      this.recordMetric('system_uptime', process.uptime());

      // Event loop lag (simple approximation)
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordMetric('event_loop_lag', lag);
      });

    }, 30000); // Every 30 seconds
  }

  /**
   * Start periodic data flushing
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
      this.flushMetrics();
    }, 60000); // Flush every minute
  }

  /**
   * Flush logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = this.logBuffer.splice(0, 100); // Flush max 100 at a time

    try {
      const logEntries = logsToFlush.map(entry => ({
        id: uuidv4(),
        level: entry.level,
        message: entry.message,
        component: entry.component || 'MCP',
        metadata: entry.metadata || {},
        request_id: entry.requestId,
        user_id: entry.userId,
        created_at: entry.timestamp || new Date()
      }));

      await this.supabase.from('system_logs').insert(logEntries);
    } catch (error) {
      console.error('Failed to flush logs to database:', error);
      // Put logs back in buffer if flush failed
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Flush metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = this.metricsBuffer.splice(0, 500); // Flush max 500 at a time

    try {
      const metricEntries = metricsToFlush.map(metric => ({
        id: uuidv4(),
        name: metric.name,
        value: metric.value,
        labels: metric.labels || {},
        created_at: metric.timestamp || new Date()
      }));

      await this.supabase.from('system_metrics').insert(metricEntries);
    } catch (error) {
      console.error('Failed to flush metrics to database:', error);
      // Put metrics back in buffer if flush failed
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Final flush
    this.flushLogs();
    this.flushMetrics();

    this.log({
      level: 'info',
      message: 'Monitoring system shutdown complete',
      component: 'Monitoring'
    });
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportPrometheusMetrics(): string {
    const metrics = this.getMetricsSummary(5);
    const lines: string[] = [];

    for (const [name, data] of Object.entries(metrics)) {
      const metricName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# HELP ${metricName} Auto-generated metric from MCP server`);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName} ${data.latest || 0}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Export monitoring instance
export const monitoring = new ProductionMonitoring();