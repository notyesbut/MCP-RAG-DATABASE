/**
 * Performance Configuration for Enterprise Multi-MCP Smart Database System
 * Centralized performance tuning parameters
 */

export interface PerformanceConfig {
  // Core Performance Targets
  targets: {
    writeThoughput: number;      // writes per second
    queryLatencyP95: number;     // milliseconds
    cacheHitRate: number;        // percentage (0-1)
    concurrentQueries: number;   // max simultaneous queries
    errorRateThreshold: number;  // percentage (0-1)
  };

  // HOT/COLD Tier Configuration
  tierClassification: {
    hot: {
      minAccessFrequency: number;    // accesses per hour
      maxQueryTime: number;          // milliseconds
      minCacheHitRatio: number;      // percentage (0-1)
      maxErrorRate: number;          // percentage (0-1)
      maxDataSize: number;           // bytes
    };
    warm: {
      minAccessFrequency: number;
      maxAccessFrequency: number;
      maxQueryTime: number;
      minCacheHitRatio: number;
      maxErrorRate: number;
    };
    cold: {
      maxAccessFrequency: number;
      minLastAccessHours: number;
      maxQueryTime: number;
      compressionBenefit: number;    // percentage (0-1)
    };
  };

  // Cache Configuration
  cache: {
    maxSize: number;              // total cache size in bytes
    l1: {
      sizeRatio: number;          // percentage of total cache
      ttl: number;                // milliseconds
      maxEntries: number;
    };
    l2: {
      sizeRatio: number;
      ttl: number;
      maxEntries: number;
    };
    l3: {
      sizeRatio: number;
      ttl: number;
      maxEntries: number;
    };
    predictionConfig: {
      minConfidence: number;      // minimum prediction confidence
      predictionWindow: number;   // milliseconds
      temporalResolution: number; // milliseconds
    };
  };

  // Query Optimization
  queryOptimization: {
    batchSize: number;            // queries per batch
    parallelism: number;          // concurrent workers
    timeoutMs: number;            // query timeout
    maxRetries: number;
    retryDelayMs: number;
    simdEnabled: boolean;         // SIMD acceleration
  };

  // Connection Pooling
  connectionPool: {
    hot: {
      min: number;
      max: number;
      idleTimeoutMs: number;
    };
    warm: {
      min: number;
      max: number;
      idleTimeoutMs: number;
    };
    cold: {
      min: number;
      max: number;
      idleTimeoutMs: number;
    };
  };

  // Memory Management
  memory: {
    maxHeapUsage: number;         // percentage (0-1)
    gcThreshold: number;          // percentage (0-1)
    objectPooling: {
      enabled: boolean;
      maxPoolSize: number;
      preAllocate: boolean;
    };
    mmapConfig: {
      enabled: boolean;
      maxFileSize: number;        // bytes
      preloadPages: boolean;
    };
  };

  // Auto-Scaling
  autoScaling: {
    enabled: boolean;
    metrics: {
      cpuThreshold: number;       // percentage (0-1)
      memoryThreshold: number;    // percentage (0-1)
      throughputMin: number;      // requests per second
      latencyMax: number;         // milliseconds
    };
    scaleUpFactor: number;        // multiplication factor
    scaleDownFactor: number;      // multiplication factor
    cooldownPeriod: number;       // milliseconds
  };

  // Monitoring and Alerts
  monitoring: {
    metricsInterval: number;      // milliseconds
    alertThresholds: {
      latencyP95: number;         // milliseconds
      throughput: number;         // requests per second
      errorRate: number;          // percentage (0-1)
      cacheHitRate: number;       // percentage (0-1)
      memoryUsage: number;        // percentage (0-1)
      cpuUsage: number;           // percentage (0-1)
    };
    telemetry: {
      enabled: boolean;
      exportInterval: number;     // milliseconds
      samplingRate: number;       // percentage (0-1)
    };
  };
}

// Default Performance Configuration
export const defaultPerformanceConfig: PerformanceConfig = {
  targets: {
    writeThoughput: 10000,        // 10K writes/sec
    queryLatencyP95: 50,          // 50ms
    cacheHitRate: 0.9,            // 90%
    concurrentQueries: 1000,      // 1000 concurrent
    errorRateThreshold: 0.01      // 1% max error rate
  },

  tierClassification: {
    hot: {
      minAccessFrequency: 10,     // 10+ accesses/hour
      maxQueryTime: 100,          // 100ms
      minCacheHitRatio: 0.8,      // 80%
      maxErrorRate: 0.01,         // 1%
      maxDataSize: 10 * 1024 * 1024 * 1024 // 10GB
    },
    warm: {
      minAccessFrequency: 1,      // 1+ accesses/hour
      maxAccessFrequency: 10,     // <10 accesses/hour
      maxQueryTime: 500,          // 500ms
      minCacheHitRatio: 0.5,      // 50%
      maxErrorRate: 0.05          // 5%
    },
    cold: {
      maxAccessFrequency: 1,      // <1 access/hour
      minLastAccessHours: 168,    // 7 days
      maxQueryTime: 5000,         // 5 seconds
      compressionBenefit: 0.3     // 30% compression
    }
  },

  cache: {
    maxSize: 1024 * 1024 * 1024,  // 1GB total
    l1: {
      sizeRatio: 0.2,             // 20% of total
      ttl: 5 * 60 * 1000,         // 5 minutes
      maxEntries: 10000
    },
    l2: {
      sizeRatio: 0.5,             // 50% of total
      ttl: 15 * 60 * 1000,        // 15 minutes
      maxEntries: 50000
    },
    l3: {
      sizeRatio: 0.3,             // 30% of total
      ttl: 60 * 60 * 1000,        // 1 hour
      maxEntries: 100000
    },
    predictionConfig: {
      minConfidence: 0.6,
      predictionWindow: 3600000,  // 1 hour
      temporalResolution: 300000  // 5 minutes
    }
  },

  queryOptimization: {
    batchSize: 100,
    parallelism: 10,
    timeoutMs: 30000,             // 30 seconds
    maxRetries: 3,
    retryDelayMs: 1000,
    simdEnabled: true
  },

  connectionPool: {
    hot: {
      min: 50,
      max: 200,
      idleTimeoutMs: 60000        // 1 minute
    },
    warm: {
      min: 20,
      max: 100,
      idleTimeoutMs: 300000       // 5 minutes
    },
    cold: {
      min: 5,
      max: 20,
      idleTimeoutMs: 600000       // 10 minutes
    }
  },

  memory: {
    maxHeapUsage: 0.8,            // 80%
    gcThreshold: 0.7,             // 70%
    objectPooling: {
      enabled: true,
      maxPoolSize: 1000,
      preAllocate: true
    },
    mmapConfig: {
      enabled: true,
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      preloadPages: true
    }
  },

  autoScaling: {
    enabled: true,
    metrics: {
      cpuThreshold: 0.8,          // 80%
      memoryThreshold: 0.85,      // 85%
      throughputMin: 8000,        // 8K req/sec
      latencyMax: 75              // 75ms
    },
    scaleUpFactor: 1.5,
    scaleDownFactor: 0.8,
    cooldownPeriod: 300000        // 5 minutes
  },

  monitoring: {
    metricsInterval: 100,         // 100ms
    alertThresholds: {
      latencyP95: 75,             // 75ms warning
      throughput: 8000,           // 8K req/sec warning
      errorRate: 0.02,            // 2% warning
      cacheHitRate: 0.85,         // 85% warning
      memoryUsage: 0.85,          // 85% warning
      cpuUsage: 0.80              // 80% warning
    },
    telemetry: {
      enabled: true,
      exportInterval: 60000,      // 1 minute
      samplingRate: 0.1           // 10% sampling
    }
  }
};

// Environment-specific overrides
export const getPerformanceConfig = (environment?: string): PerformanceConfig => {
  const baseConfig = { ...defaultPerformanceConfig };

  switch (environment) {
    case 'production':
      // Production optimizations
      return {
        ...baseConfig,
        targets: {
          ...baseConfig.targets,
          writeThoughput: 15000,  // Higher target for production
          queryLatencyP95: 40     // Stricter latency
        },
        cache: {
          ...baseConfig.cache,
          maxSize: 4 * 1024 * 1024 * 1024 // 4GB in production
        },
        autoScaling: {
          ...baseConfig.autoScaling,
          metrics: {
            ...baseConfig.autoScaling.metrics,
            throughputMin: 12000,
            latencyMax: 60
          }
        }
      };

    case 'development':
      // Development relaxed settings
      return {
        ...baseConfig,
        targets: {
          ...baseConfig.targets,
          writeThoughput: 5000,
          queryLatencyP95: 100
        },
        monitoring: {
          ...baseConfig.monitoring,
          metricsInterval: 1000,  // Less frequent in dev
          telemetry: {
            ...baseConfig.monitoring.telemetry,
            enabled: false
          }
        }
      };

    case 'test':
      // Test environment settings
      return {
        ...baseConfig,
        targets: {
          ...baseConfig.targets,
          writeThoughput: 1000,
          concurrentQueries: 100
        },
        cache: {
          ...baseConfig.cache,
          maxSize: 100 * 1024 * 1024 // 100MB for tests
        },
        queryOptimization: {
          ...baseConfig.queryOptimization,
          timeoutMs: 5000         // Shorter timeout for tests
        }
      };

    default:
      return baseConfig;
  }
};

// Performance tuning helpers
export class PerformanceTuner {
  private config: PerformanceConfig;

  constructor(environment?: string) {
    this.config = getPerformanceConfig(environment);
  }

  // Dynamic adjustment based on current metrics
  adjustForLoad(currentMetrics: {
    cpu: number;
    memory: number;
    throughput: number;
    latency: number;
  }): Partial<PerformanceConfig> {
    const adjustments: Partial<PerformanceConfig> = {};

    // High CPU - reduce parallelism
    if (currentMetrics.cpu > 0.9) {
      adjustments.queryOptimization = {
        ...this.config.queryOptimization,
        parallelism: Math.max(1, this.config.queryOptimization.parallelism - 2)
      };
    }

    // High memory - reduce cache size
    if (currentMetrics.memory > 0.9) {
      adjustments.cache = {
        ...this.config.cache,
        maxSize: this.config.cache.maxSize * 0.8
      };
    }

    // Low throughput - increase batch size
    if (currentMetrics.throughput < this.config.targets.writeThoughput * 0.8) {
      adjustments.queryOptimization = {
        ...this.config.queryOptimization,
        batchSize: Math.min(1000, this.config.queryOptimization.batchSize * 1.5)
      };
    }

    // High latency - adjust timeouts
    if (currentMetrics.latency > this.config.targets.queryLatencyP95 * 1.5) {
      adjustments.queryOptimization = {
        ...this.config.queryOptimization,
        timeoutMs: this.config.queryOptimization.timeoutMs * 0.8
      };
    }

    return adjustments;
  }

  // Get recommended configuration for specific workload
  getWorkloadOptimizedConfig(workloadType: 'read-heavy' | 'write-heavy' | 'balanced'): Partial<PerformanceConfig> {
    switch (workloadType) {
      case 'read-heavy':
        return {
          cache: {
            ...this.config.cache,
            maxSize: this.config.cache.maxSize * 1.5,
            l1: {
              ...this.config.cache.l1,
              sizeRatio: 0.3,
              ttl: 10 * 60 * 1000 // 10 minutes
            }
          },
          connectionPool: {
            ...this.config.connectionPool,
            hot: {
              ...this.config.connectionPool.hot,
              max: 300
            }
          }
        };

      case 'write-heavy':
        return {
          queryOptimization: {
            ...this.config.queryOptimization,
            batchSize: 200,
            parallelism: 15
          },
          cache: {
            ...this.config.cache,
            maxSize: this.config.cache.maxSize * 0.7,
            predictionConfig: {
              ...this.config.cache.predictionConfig,
              minConfidence: 0.8 // More selective caching
            }
          }
        };

      case 'balanced':
      default:
        return {}; // Use default configuration
    }
  }
}

// Export singleton instance
export const performanceConfig = defaultPerformanceConfig;
export const performanceTuner = new PerformanceTuner(process.env.NODE_ENV);