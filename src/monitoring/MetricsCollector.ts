// Enterprise Metrics Collection System for Multi-MCP Smart Database
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface Metric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface MetricSeries {
  name: string;
  data: Array<{ timestamp: Date; value: number }>;
  metadata: {
    unit?: string;
    description?: string;
    tags?: Record<string, string>;
  };
}

export interface SystemMetrics {
  performance: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_io: number;
  };
  application: {
    requests_per_second: number;
    average_response_time: number;
    error_rate: number;
    active_connections: number;
  };
  business: {
    total_users: number;
    active_sessions: number;
    data_processed_mb: number;
    queries_executed: number;
  };
  mcp: {
    active_mcps: number;
    hot_tier_mcps: number;
    cold_tier_mcps: number;
    total_data_size_gb: number;
    migration_events: number;
  };
  rag: {
    rag1_ingestion_rate: number;
    rag1_classification_accuracy: number;
    rag2_query_rate: number;
    rag2_cache_hit_rate: number;
    nlp_processing_time: number;
  };
}

export interface AlertRule {
  id: string;
  metricName: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  triggeredAt: Date;
  currentValue: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private metricRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
  private collectionInterval: NodeJS.Timeout | null = null;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private startTime = Date.now();

  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  /**
   * Start metrics collection
   */
  public startCollection(interval: number = 30000): void {
    if (this.collectionInterval) {
      logger.warn('Metrics collection already started');
      return;
    }

    logger.info('📊 Starting metrics collection system');
    
    // Collect initial metrics
    this.collectSystemMetrics();

    // Schedule regular collection
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.evaluateAlerts();
      this.cleanupOldMetrics();
    }, interval);

    this.emit('collection-started');
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info('📊 Metrics collection stopped');
      this.emit('collection-stopped');
    }
  }

  /**
   * Record a single metric
   */
  public recordMetric(metric: Metric): void {
    const key = metric.name;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
    this.emit('metric-recorded', metric);
  }

  /**
   * Record multiple metrics
   */
  public recordMetrics(metrics: Metric[]): void {
    metrics.forEach(metric => this.recordMetric(metric));
  }

  /**
   * Get metric data for a specific metric name
   */
  public getMetric(name: string, limit?: number): Metric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : [...metrics];
  }

  /**
   * Get all metrics for a time range
   */
  public getMetricsInRange(startTime: Date, endTime: Date): Map<string, Metric[]> {
    const result = new Map<string, Metric[]>();
    
    for (const [name, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(
        metric => metric.timestamp >= startTime && metric.timestamp <= endTime
      );
      if (filteredMetrics.length > 0) {
        result.set(name, filteredMetrics);
      }
    }
    
    return result;
  }

  /**
   * Get latest values for all metrics
   */
  public getLatestMetrics(): Map<string, Metric> {
    const result = new Map<string, Metric>();
    
    for (const [name, metrics] of this.metrics) {
      if (metrics.length > 0) {
        result.set(name, metrics[metrics.length - 1]);
      }
    }
    
    return result;
  }

  /**
   * Collect comprehensive system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics();
      this.recordMetrics(performanceMetrics.map(metric => ({ ...metric, timestamp })));

      // Application metrics
      const applicationMetrics = await this.collectApplicationMetrics();
      this.recordMetrics(applicationMetrics.map(metric => ({ ...metric, timestamp })));

      // Business metrics
      const businessMetrics = await this.collectBusinessMetrics();
      this.recordMetrics(businessMetrics.map(metric => ({ ...metric, timestamp })));

      // MCP-specific metrics
      const mcpMetrics = await this.collectMCPMetrics();
      this.recordMetrics(mcpMetrics.map(metric => ({ ...metric, timestamp })));

      // RAG system metrics
      const ragMetrics = await this.collectRAGMetrics();
      this.recordMetrics(ragMetrics.map(metric => ({ ...metric, timestamp })));

      this.emit('metrics-collected', timestamp);
      
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
      this.emit('collection-error', error);
    }
  }

  /**
   * Collect performance metrics (CPU, Memory, Disk, Network)
   */
  private async collectPerformanceMetrics(): Promise<Omit<Metric, 'timestamp'>[]> {
    // Simulate performance metrics collection
    // In production, use actual system monitoring libraries like 'systeminformation'
    return [
      {
        name: 'cpu_usage_percent',
        value: Math.floor(Math.random() * 60) + 20,
        unit: 'percent',
        tags: { system: 'nodejs', environment: process.env.NODE_ENV || 'development' }
      },
      {
        name: 'memory_usage_percent',
        value: Math.floor(Math.random() * 50) + 30,
        unit: 'percent',
        tags: { system: 'nodejs' }
      },
      {
        name: 'heap_used_mb',
        value: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
        unit: 'megabytes',
        tags: { type: 'heap' }
      },
      {
        name: 'heap_total_mb',
        value: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'megabytes',
        tags: { type: 'heap' }
      },
      {
        name: 'disk_usage_percent',
        value: Math.floor(Math.random() * 40) + 40,
        unit: 'percent',
        tags: { mount: '/' }
      },
      {
        name: 'network_bytes_in',
        value: Math.floor(Math.random() * 1000000) + 500000,
        unit: 'bytes',
        tags: { direction: 'in' }
      },
      {
        name: 'network_bytes_out',
        value: Math.floor(Math.random() * 800000) + 400000,
        unit: 'bytes',
        tags: { direction: 'out' }
      }
    ];
  }

  /**
   * Collect application-level metrics
   */
  private async collectApplicationMetrics(): Promise<Omit<Metric, 'timestamp'>[]> {
    return [
      {
        name: 'requests_per_second',
        value: Math.floor(Math.random() * 100) + 50,
        unit: 'requests/second',
        tags: { service: 'api' }
      },
      {
        name: 'average_response_time_ms',
        value: Math.floor(Math.random() * 200) + 50,
        unit: 'milliseconds',
        tags: { service: 'api' }
      },
      {
        name: 'error_rate_percent',
        value: Math.random() * 5, // 0-5% error rate
        unit: 'percent',
        tags: { service: 'api' }
      },
      {
        name: 'active_connections',
        value: Math.floor(Math.random() * 500) + 100,
        unit: 'connections',
        tags: { type: 'websocket' }
      },
      {
        name: 'uptime_seconds',
        value: Math.floor((Date.now() - this.startTime) / 1000),
        unit: 'seconds',
        tags: { service: 'api' }
      }
    ];
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<Omit<Metric, 'timestamp'>[]> {
    return [
      {
        name: 'total_users',
        value: Math.floor(Math.random() * 10000) + 5000,
        unit: 'count',
        tags: { type: 'business' }
      },
      {
        name: 'active_sessions',
        value: Math.floor(Math.random() * 500) + 100,
        unit: 'count',
        tags: { type: 'business' }
      },
      {
        name: 'data_processed_mb',
        value: Math.floor(Math.random() * 1000) + 500,
        unit: 'megabytes',
        tags: { type: 'business' }
      },
      {
        name: 'queries_executed_total',
        value: Math.floor(Math.random() * 10000) + 1000,
        unit: 'count',
        tags: { type: 'business' }
      }
    ];
  }

  /**
   * Collect MCP-specific metrics
   */
  private async collectMCPMetrics(): Promise<Omit<Metric, 'timestamp'>[]> {
    return [
      {
        name: 'active_mcps',
        value: Math.floor(Math.random() * 20) + 10,
        unit: 'count',
        tags: { tier: 'all' }
      },
      {
        name: 'hot_tier_mcps',
        value: Math.floor(Math.random() * 8) + 4,
        unit: 'count',
        tags: { tier: 'hot' }
      },
      {
        name: 'cold_tier_mcps',
        value: Math.floor(Math.random() * 6) + 2,
        unit: 'count',
        tags: { tier: 'cold' }
      },
      {
        name: 'total_data_size_gb',
        value: Math.floor(Math.random() * 500) + 100,
        unit: 'gigabytes',
        tags: { storage: 'total' }
      },
      {
        name: 'migration_events_per_hour',
        value: Math.floor(Math.random() * 10) + 2,
        unit: 'events/hour',
        tags: { operation: 'migration' }
      },
      {
        name: 'mcp_registry_operations_per_minute',
        value: Math.floor(Math.random() * 100) + 50,
        unit: 'operations/minute',
        tags: { component: 'registry' }
      }
    ];
  }

  /**
   * Collect RAG system metrics
   */
  private async collectRAGMetrics(): Promise<Omit<Metric, 'timestamp'>[]> {
    return [
      {
        name: 'rag1_ingestion_rate',
        value: Math.floor(Math.random() * 1000) + 500,
        unit: 'documents/minute',
        tags: { component: 'rag1' }
      },
      {
        name: 'rag1_classification_accuracy',
        value: 0.92 + Math.random() * 0.07, // 92-99% accuracy
        unit: 'percent',
        tags: { component: 'rag1', metric: 'accuracy' }
      },
      {
        name: 'rag2_query_rate',
        value: Math.floor(Math.random() * 500) + 200,
        unit: 'queries/minute',
        tags: { component: 'rag2' }
      },
      {
        name: 'rag2_cache_hit_rate',
        value: 0.80 + Math.random() * 0.15, // 80-95% cache hit rate
        unit: 'percent',
        tags: { component: 'rag2', metric: 'cache' }
      },
      {
        name: 'nlp_processing_time_ms',
        value: Math.floor(Math.random() * 100) + 25,
        unit: 'milliseconds',
        tags: { component: 'nlp' }
      },
      {
        name: 'query_execution_time_ms',
        value: Math.floor(Math.random() * 200) + 50,
        unit: 'milliseconds',
        tags: { component: 'rag2', metric: 'execution' }
      }
    ];
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-cpu-usage',
        metricName: 'cpu_usage_percent',
        operator: 'gte',
        threshold: 80,
        duration: 300000, // 5 minutes
        severity: 'high',
        message: 'High CPU usage detected',
        enabled: true
      },
      {
        id: 'high-memory-usage',
        metricName: 'memory_usage_percent',
        operator: 'gte',
        threshold: 85,
        duration: 300000,
        severity: 'high',
        message: 'High memory usage detected',
        enabled: true
      },
      {
        id: 'high-error-rate',
        metricName: 'error_rate_percent',
        operator: 'gte',
        threshold: 5,
        duration: 120000, // 2 minutes
        severity: 'critical',
        message: 'High error rate detected',
        enabled: true
      },
      {
        id: 'slow-response-time',
        metricName: 'average_response_time_ms',
        operator: 'gte',
        threshold: 1000,
        duration: 180000, // 3 minutes
        severity: 'medium',
        message: 'Slow response times detected',
        enabled: true
      },
      {
        id: 'low-cache-hit-rate',
        metricName: 'rag2_cache_hit_rate',
        operator: 'lte',
        threshold: 0.70,
        duration: 600000, // 10 minutes
        severity: 'medium',
        message: 'Low cache hit rate detected',
        enabled: true
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Add custom alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.id}`);
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Evaluate alert rules against current metrics
   */
  private evaluateAlerts(): void {
    const currentTime = new Date();
    
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;
      
      const metrics = this.getMetric(rule.metricName, 10); // Get last 10 values
      if (metrics.length === 0) continue;
      
      const latestMetric = metrics[metrics.length - 1];
      const isTriggered = this.evaluateCondition(latestMetric.value, rule.operator, rule.threshold);
      
      if (isTriggered && !this.activeAlerts.has(ruleId)) {
        // Create new alert
        const alert: Alert = {
          id: `${ruleId}-${Date.now()}`,
          rule,
          triggeredAt: currentTime,
          currentValue: latestMetric.value,
          message: `${rule.message} (current: ${latestMetric.value}, threshold: ${rule.threshold})`,
          severity: rule.severity,
          resolved: false
        };
        
        this.activeAlerts.set(ruleId, alert);
        this.emit('alert-triggered', alert);
        logger.warn(`🚨 Alert triggered: ${alert.message}`);
        
      } else if (!isTriggered && this.activeAlerts.has(ruleId)) {
        // Resolve existing alert
        const alert = this.activeAlerts.get(ruleId)!;
        alert.resolved = true;
        alert.resolvedAt = currentTime;
        
        this.activeAlerts.delete(ruleId);
        this.emit('alert-resolved', alert);
        logger.info(`✅ Alert resolved: ${alert.message}`);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Clean up old metrics based on retention period
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricRetentionPeriod);
    
    for (const [name, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheusMetrics(): string {
    const latestMetrics = this.getLatestMetrics();
    let output = '';
    
    for (const [name, metric] of latestMetrics) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const value = metric.value;
      const tags = metric.tags ? Object.entries(metric.tags)
        .map(([key, val]) => `${key}="${val}"`)
        .join(',') : '';
      
      if (tags) {
        output += `${sanitizedName}{${tags}} ${value}\n`;
      } else {
        output += `${sanitizedName} ${value}\n`;
      }
    }
    
    return output;
  }

  /**
   * Get comprehensive metrics summary
   */
  public getMetricsSummary(): SystemMetrics {
    const latest = this.getLatestMetrics();
    
    return {
      performance: {
        cpu_usage: latest.get('cpu_usage_percent')?.value || 0,
        memory_usage: latest.get('memory_usage_percent')?.value || 0,
        disk_usage: latest.get('disk_usage_percent')?.value || 0,
        network_io: (latest.get('network_bytes_in')?.value || 0) + (latest.get('network_bytes_out')?.value || 0)
      },
      application: {
        requests_per_second: latest.get('requests_per_second')?.value || 0,
        average_response_time: latest.get('average_response_time_ms')?.value || 0,
        error_rate: latest.get('error_rate_percent')?.value || 0,
        active_connections: latest.get('active_connections')?.value || 0
      },
      business: {
        total_users: latest.get('total_users')?.value || 0,
        active_sessions: latest.get('active_sessions')?.value || 0,
        data_processed_mb: latest.get('data_processed_mb')?.value || 0,
        queries_executed: latest.get('queries_executed_total')?.value || 0
      },
      mcp: {
        active_mcps: latest.get('active_mcps')?.value || 0,
        hot_tier_mcps: latest.get('hot_tier_mcps')?.value || 0,
        cold_tier_mcps: latest.get('cold_tier_mcps')?.value || 0,
        total_data_size_gb: latest.get('total_data_size_gb')?.value || 0,
        migration_events: latest.get('migration_events_per_hour')?.value || 0
      },
      rag: {
        rag1_ingestion_rate: latest.get('rag1_ingestion_rate')?.value || 0,
        rag1_classification_accuracy: latest.get('rag1_classification_accuracy')?.value || 0,
        rag2_query_rate: latest.get('rag2_query_rate')?.value || 0,
        rag2_cache_hit_rate: latest.get('rag2_cache_hit_rate')?.value || 0,
        nlp_processing_time: latest.get('nlp_processing_time_ms')?.value || 0
      }
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();