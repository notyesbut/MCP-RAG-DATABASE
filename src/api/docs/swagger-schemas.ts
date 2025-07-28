/**
 * OpenAPI/Swagger Schema Definitions
 * Comprehensive API documentation schemas
 */

import { SwaggerDefinition } from 'swagger-jsdoc';

export const swaggerSchemas = {
  // User and Authentication Schemas
  User: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Unique user identifier'
      },
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        description: 'Username'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      role: {
        type: 'string',
        enum: ['admin', 'user', 'readonly'],
        description: 'User role'
      },
      permissions: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'List of user permissions'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Account creation timestamp'
      },
      lastLogin: {
        type: 'string',
        format: 'date-time',
        description: 'Last login timestamp'
      }
    },
    required: ['id', 'username', 'email', 'role', 'permissions', 'createdAt']
  },

  LoginRequest: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        description: 'Username or email'
      },
      password: {
        type: 'string',
        description: 'User password'
      },
      rememberMe: {
        type: 'boolean',
        default: false,
        description: 'Remember login session'
      }
    },
    required: ['username', 'password']
  },

  RegisterRequest: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_]+$',
        description: 'Unique username'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Valid email address'
      },
      password: {
        type: 'string',
        minLength: 8,
        description: 'Strong password (min 8 chars, uppercase, lowercase, number, special char)'
      },
      confirmPassword: {
        type: 'string',
        description: 'Password confirmation'
      },
      role: {
        type: 'string',
        enum: ['user', 'readonly'],
        default: 'user',
        description: 'User role'
      }
    },
    required: ['username', 'email', 'password', 'confirmPassword']
  },

  AuthResponse: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'JWT authentication token'
      },
      user: {
        $ref: '#/components/schemas/User'
      },
      expiresIn: {
        type: 'string',
        description: 'Token expiration time'
      },
      tokenType: {
        type: 'string',
        default: 'Bearer',
        description: 'Token type'
      }
    },
    required: ['token', 'user', 'expiresIn']
  },

  // Data Ingestion Schemas
  IngestionRequest: {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        description: 'Data to be ingested'
      },
      metadata: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Data source identifier'
          },
          type: {
            type: 'string',
            description: 'Data type classification'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Processing priority'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Data tags'
          },
          schema: {
            type: 'object',
            description: 'Data schema definition'
          }
        }
      },
      routing: {
        type: 'object',
        properties: {
          preferredMCPs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Preferred MCP instances'
          },
          excludeMCPs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'MCP instances to exclude'
          },
          distributionStrategy: {
            type: 'string',
            enum: ['single', 'replicated', 'sharded'],
            default: 'single',
            description: 'Data distribution strategy'
          }
        }
      }
    },
    required: ['data']
  },

  IngestionResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Ingestion operation ID'
      },
      status: {
        type: 'string',
        enum: ['accepted', 'processing', 'completed', 'failed'],
        description: 'Current status'
      },
      mcpPlacements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            mcpId: {
              type: 'string',
              description: 'MCP instance ID'
            },
            mcpType: {
              type: 'string',
              enum: ['hot', 'cold'],
              description: 'MCP type'
            },
            recordId: {
              type: 'string',
              description: 'Record ID in MCP'
            },
            indexed: {
              type: 'boolean',
              description: 'Whether record is indexed'
            }
          }
        }
      },
      processingTime: {
        type: 'number',
        description: 'Processing time in milliseconds'
      },
      ragAnalysis: {
        type: 'object',
        properties: {
          classification: {
            type: 'string',
            description: 'Data classification'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Classification confidence'
          },
          suggestedMCPs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Suggested MCPs for this data'
          }
        }
      }
    },
    required: ['id', 'status', 'processingTime']
  },

  BatchIngestionRequest: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/IngestionRequest'
        },
        minItems: 1,
        maxItems: 100,
        description: 'Array of items to ingest'
      },
      options: {
        type: 'object',
        properties: {
          parallelProcessing: {
            type: 'boolean',
            default: true,
            description: 'Process items in parallel'
          },
          failFast: {
            type: 'boolean',
            default: false,
            description: 'Stop on first failure'
          },
          generateReport: {
            type: 'boolean',
            default: true,
            description: 'Generate processing report'
          }
        }
      }
    },
    required: ['items']
  },

  // Query Schemas
  QueryRequest: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        description: 'Natural language query'
      },
      context: {
        type: 'object',
        properties: {
          user: {
            type: 'string',
            description: 'User context'
          },
          session: {
            type: 'string',
            description: 'Session identifier'
          },
          filters: {
            type: 'object',
            description: 'Query filters'
          },
          preferences: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'number',
                minimum: 1,
                maximum: 1000,
                description: 'Maximum number of results'
              },
              timeout: {
                type: 'number',
                minimum: 1000,
                maximum: 60000,
                description: 'Query timeout in milliseconds'
              },
              includeMCPSource: {
                type: 'boolean',
                description: 'Include MCP source information'
              },
              aggregationLevel: {
                type: 'string',
                enum: ['minimal', 'standard', 'detailed'],
                description: 'Result aggregation level'
              }
            }
          }
        }
      },
      options: {
        type: 'object',
        properties: {
          explain: {
            type: 'boolean',
            description: 'Include execution plan'
          },
          cache: {
            type: 'boolean',
            description: 'Use cached results'
          },
          realtime: {
            type: 'boolean',
            description: 'Force real-time execution'
          }
        }
      }
    },
    required: ['query']
  },

  QueryResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Query execution ID'
      },
      results: {
        type: 'array',
        items: {
          type: 'object'
        },
        description: 'Query results'
      },
      executionPlan: {
        type: 'object',
        properties: {
          parsedQuery: {
            type: 'object',
            properties: {
              intent: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              entities: {
                type: 'object'
              },
              filters: {
                type: 'object'
              }
            }
          },
          targetMCPs: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          queryStrategy: {
            type: 'string'
          },
          estimatedCost: {
            type: 'number'
          }
        }
      },
      metadata: {
        type: 'object',
        properties: {
          totalResults: {
            type: 'number'
          },
          executionTime: {
            type: 'number'
          },
          mcpResponseTimes: {
            type: 'object'
          },
          cacheHit: {
            type: 'boolean'
          },
          aggregationStrategy: {
            type: 'string'
          }
        }
      }
    },
    required: ['id', 'results']
  },

  // MCP Management Schemas
  MCPStatus: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'MCP instance ID'
      },
      name: {
        type: 'string',
        description: 'MCP instance name'
      },
      type: {
        type: 'string',
        enum: ['hot', 'cold'],
        description: 'MCP type'
      },
      status: {
        type: 'string',
        enum: ['healthy', 'degraded', 'unhealthy', 'offline'],
        description: 'Current status'
      },
      metrics: {
        type: 'object',
        properties: {
          recordCount: {
            type: 'number',
            description: 'Number of records'
          },
          queryCount: {
            type: 'number',
            description: 'Total queries processed'
          },
          lastAccess: {
            type: 'string',
            format: 'date-time',
            description: 'Last access time'
          },
          avgResponseTime: {
            type: 'number',
            description: 'Average response time in milliseconds'
          },
          errorRate: {
            type: 'number',
            description: 'Error rate percentage'
          },
          storageUsed: {
            type: 'number',
            description: 'Storage used in bytes'
          },
          indexCount: {
            type: 'number',
            description: 'Number of indexes'
          }
        }
      },
      configuration: {
        type: 'object',
        properties: {
          maxRecords: {
            type: 'number',
            description: 'Maximum records capacity'
          },
          autoMigration: {
            type: 'boolean',
            description: 'Auto-migration enabled'
          },
          replicationFactor: {
            type: 'number',
            description: 'Replication factor'
          },
          indexStrategies: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Indexing strategies'
          }
        }
      }
    },
    required: ['id', 'name', 'type', 'status']
  },

  MCPConfigPayload: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'MCP instance name'
      },
      type: {
        type: 'string',
        enum: ['hot', 'cold'],
        description: 'MCP type'
      },
      configuration: {
        type: 'object',
        properties: {
          maxRecords: {
            type: 'number',
            minimum: 1,
            description: 'Maximum records'
          },
          autoMigration: {
            type: 'boolean',
            description: 'Enable auto-migration'
          },
          replicationFactor: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            description: 'Replication factor'
          },
          indexStrategies: {
            type: 'array',
            items: {
              type: 'string'
            },
            minItems: 1,
            description: 'Index strategies'
          }
        },
        required: ['maxRecords', 'autoMigration', 'replicationFactor', 'indexStrategies']
      },
      connectionString: {
        type: 'string',
        description: 'Database connection string'
      },
      priority: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        default: 5,
        description: 'MCP priority'
      }
    },
    required: ['name', 'type', 'configuration']
  },

  SystemMetrics: {
    type: 'object',
    properties: {
      timestamp: {
        type: 'string',
        format: 'date-time'
      },
      mcps: {
        type: 'object',
        properties: {
          total: {
            type: 'number'
          },
          hot: {
            type: 'number'
          },
          cold: {
            type: 'number'
          },
          healthy: {
            type: 'number'
          }
        }
      },
      performance: {
        type: 'object',
        properties: {
          avgQueryTime: {
            type: 'number'
          },
          avgIngestionTime: {
            type: 'number'
          },
          throughput: {
            type: 'object',
            properties: {
              queriesPerSecond: {
                type: 'number'
              },
              ingestionsPerSecond: {
                type: 'number'
              }
            }
          },
          cacheHitRate: {
            type: 'number'
          }
        }
      },
      resources: {
        type: 'object',
        properties: {
          memoryUsage: {
            type: 'number'
          },
          cpuUsage: {
            type: 'number'
          },
          storageUsed: {
            type: 'number'
          },
          networkIO: {
            type: 'object',
            properties: {
              inbound: {
                type: 'number'
              },
              outbound: {
                type: 'number'
              }
            }
          }
        }
      }
    }
  },

  // Health Check Schemas
  HealthCheckResult: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['healthy', 'degraded', 'unhealthy']
      },
      timestamp: {
        type: 'string',
        format: 'date-time'
      },
      uptime: {
        type: 'number',
        description: 'Uptime in seconds'
      },
      services: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['up', 'down', 'degraded']
            },
            responseTime: {
              type: 'number'
            },
            error: {
              type: 'string'
            }
          }
        }
      },
      metrics: {
        type: 'object',
        properties: {
          memoryUsage: {
            type: 'number'
          },
          cpuUsage: {
            type: 'number'
          },
          diskUsage: {
            type: 'number'
          },
          networkLatency: {
            type: 'number'
          },
          activeConnections: {
            type: 'number'
          },
          queueDepth: {
            type: 'number'
          },
          errorRate: {
            type: 'number'
          },
          throughput: {
            type: 'number'
          }
        }
      }
    },
    required: ['status', 'timestamp', 'uptime']
  },

  // Common API Response Schema
  ApiResponse: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Operation success status'
      },
      data: {
        type: 'object',
        description: 'Response data'
      },
      error: {
        type: 'string',
        description: 'Error message if success is false'
      },
      message: {
        type: 'string',
        description: 'Additional message'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Response timestamp'
      },
      requestId: {
        type: 'string',
        description: 'Request identifier'
      },
      details: {
        type: 'object',
        description: 'Additional details'
      }
    },
    required: ['success', 'timestamp', 'requestId']
  },

  // Pagination Schema
  PaginatedResponse: {
    allOf: [
      { $ref: '#/components/schemas/ApiResponse' },
      {
        type: 'object',
        properties: {
          pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                minimum: 1
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 1000
              },
              total: {
                type: 'number',
                minimum: 0
              },
              totalPages: {
                type: 'number',
                minimum: 0
              },
              hasNext: {
                type: 'boolean'
              },
              hasPrev: {
                type: 'boolean'
              }
            },
            required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
          }
        },
        required: ['pagination']
      }
    ]
  },

  // Error Schema
  ErrorResponse: {
    allOf: [
      { $ref: '#/components/schemas/ApiResponse' },
      {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            enum: [false]
          },
          error: {
            type: 'string'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          details: {
            type: 'object',
            description: 'Error details'
          }
        },
        required: ['success', 'error']
      }
    ]
  }
};

// Security schemes
export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT token obtained from /api/v1/auth/login'
  }
};

// Common parameters
export const commonParameters = {
  requestId: {
    name: 'X-Request-ID',
    in: 'header',
    description: 'Unique request identifier',
    schema: {
      type: 'string',
      format: 'uuid'
    }
  },
  page: {
    name: 'page',
    in: 'query',
    description: 'Page number for pagination',
    schema: {
      type: 'number',
      minimum: 1,
      default: 1
    }
  },
  limit: {
    name: 'limit',
    in: 'query',
    description: 'Number of items per page',
    schema: {
      type: 'number',
      minimum: 1,
      maximum: 1000,
      default: 20
    }
  }
};

export default {
  swaggerSchemas,
  securitySchemes,
  commonParameters
};