/**
 * Performance Monitor - Utility for monitoring application performance
 */

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  startTimer(operation: string): () => PerformanceMetrics {
    const startTime = Date.now();
    
    return (success: boolean = true, error?: string): PerformanceMetrics => {
      const duration = Date.now() - startTime;
      const metric: PerformanceMetrics = {
        operation,
        duration,
        timestamp: startTime,
        success,
        error
      };

      this.addMetric(metric);
      return metric;
    };
  }

  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;
    
    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  getSuccessRate(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;
    
    const successful = operationMetrics.filter(m => m.success).length;
    return successful / operationMetrics.length;
  }

  getSummary(): Record<string, { avgTime: number; successRate: number; count: number }> {
    const operations = new Set(this.metrics.map(m => m.operation));
    const summary: Record<string, { avgTime: number; successRate: number; count: number }> = {};

    for (const operation of operations) {
      const operationMetrics = this.getMetrics(operation);
      summary[operation] = {
        avgTime: this.getAverageTime(operation),
        successRate: this.getSuccessRate(operation),
        count: operationMetrics.length
      };
    }

    return summary;
  }

  clear(): void {
    this.metrics = [];
  }

  // Compatibility methods for aiService.optimized.ts
  endTimer(id: string, success: boolean, error?: string): void {
    console.log(`Timer ended: ${id}, success: ${success}`, error ? `error: ${error}` : '');
  }

  logMetric(name: string, value: number, tags?: any): void {
    console.log(`Metric: ${name} = ${value}`, tags);
  }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();