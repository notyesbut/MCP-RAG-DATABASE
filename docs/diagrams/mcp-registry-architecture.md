# MCP Registry Architecture Diagrams

## 1. Overall MCP System Architecture

```mermaid
graph TB
    subgraph "MCP Orchestration Layer"
        ORCH[MCPOrchestrator<br/>Main Coordinator]
        ORCH --> |orchestrates| REG[MCPRegistry<br/>Central Management]
        ORCH --> |uses| CLASS[TierClassifier<br/>AI Classification]
        ORCH --> |manages| MIG[MCPMigrationEngine<br/>Data Migration]
        ORCH --> |coordinates| COMM[MCPCommunicationHub<br/>Inter-MCP Messaging]
    end

    subgraph "MCP Instances"
        MCP1[UserMCP<br/>User Data]
        MCP2[ChatMCP<br/>Chat History]
        MCP3[StatsMCP<br/>Analytics]
        MCP4[LogsMCP<br/>System Logs]
        MCPN[Additional MCPs...]
    end

    subgraph "Data Tiers"
        HOT[(HOT Tier<br/>High Performance<br/>Frequent Access)]
        WARM[(WARM Tier<br/>Balanced<br/>Moderate Access)]
        COLD[(COLD Tier<br/>Archive<br/>Infrequent Access)]
    end

    subgraph "External Systems"
        API[REST API Server]
        RAG[RAG Systems<br/>RAG1 & RAG2]
        INTEL[Intelligence<br/>Coordinator]
    end

    %% Registry manages all MCPs
    REG --> |creates/manages| MCP1
    REG --> |creates/manages| MCP2
    REG --> |creates/manages| MCP3
    REG --> |creates/manages| MCP4
    REG --> |creates/manages| MCPN

    %% Classification determines tier placement
    CLASS --> |classifies| HOT
    CLASS --> |classifies| WARM
    CLASS --> |classifies| COLD

    %% Migration moves data between tiers
    MIG --> |migrates to| HOT
    MIG --> |migrates to| WARM
    MIG --> |migrates to| COLD

    %% Communication hub connects all MCPs
    COMM --> |coordinates| MCP1
    COMM --> |coordinates| MCP2
    COMM --> |coordinates| MCP3
    COMM --> |coordinates| MCP4

    %% External system integration
    API --> |queries| ORCH
    RAG --> |uses| ORCH
    INTEL --> |optimizes| ORCH

    %% Event flows
    ORCH -.-> |events| API
    CLASS -.-> |recommendations| MIG
    COMM -.-> |health checks| REG

    style ORCH fill:#e1f5fe
    style REG fill:#f3e5f5
    style CLASS fill:#e8f5e8
    style MIG fill:#fff3e0
    style COMM fill:#fce4ec
    style HOT fill:#ffebee
    style WARM fill:#fff8e1
    style COLD fill:#e0f2f1
```

## 2. MCPRegistry Component Architecture

```mermaid
graph TB
%% ─────────── MCPRegistry Core ───────────
    subgraph MCPRegistry_Core ["MCPRegistry Core"]
        REG["MCPRegistry<br/>EventEmitter"]
        FACTORIES["MCP Factories<br/>Map&lt;MCPType, Factory&gt;"]
        MCPS["Active MCPs<br/>Map&lt;string, BaseMCP&gt;"]
        CONFIG["Registry Config<br/>maxMCPs, autoScaling, etc."]
    end

%% ─────────── Background Tasks ───────────
    subgraph Background_Tasks ["Background Tasks"]
        CLEANUP["Cleanup Timer<br/>Cache &amp; Storage Optimization"]
        PERF_MON["Performance Monitor<br/>Tier Optimization"]
        HEALTH["Health Checker<br/>MCP Status Monitoring"]
    end

%% ─────────── MCP Lifecycle Management ───────────
    subgraph MCP_Lifecycle_Management ["MCP Lifecycle Management"]
        CREATE["createMCP()<br/>Factory Pattern"]
        REGISTER["registerMCP()<br/>Legacy Support"]
        REMOVE["removeMCP()<br/>With Backup"]
        QUERY["Query Operations<br/>By Type/Tier/Tag/Domain"]
    end

%% ─────────── Tier Management ───────────
    subgraph Tier_Management ["Tier Management"]
        OPTIMIZE["optimizeAllTiers()<br/>Auto Promotion/Demotion"]
        PROMOTE["promoteMCPToHot()"]
        DEMOTE["demoteMCPToCold()"]
        THRESHOLDS["Performance Thresholds<br/>Access &amp; Latency"]
    end

%% ─────────── Monitoring & Stats ───────────
    subgraph Monitoring_Stats ["Monitoring &amp; Stats"]
        STATS["getRegistryStats()<br/>Performance Metrics"]
        HEALTH_CHECK["performHealthCheck()"]
        METRICS["getSystemMetrics()"]
        LOGS["getLogs()"]
    end

%% ─────────── Backup & Recovery ───────────
    subgraph Backup_Recovery ["Backup &amp; Recovery"]
        BACKUP_MCP["backupMCP()"]
        BACKUP_ALL["backupAll()"]
        MAINTENANCE["startMaintenance()"]
        RESTORE["Restore Operations"]
    end

%% ── Core connections
    REG --> FACTORIES
    REG --> MCPS
    REG --> CONFIG

%% ── Lifecycle management
    CREATE --> FACTORIES
    CREATE --> MCPS
    REGISTER --> CREATE
    REMOVE --> MCPS

%% ── Background tasks
    REG --> CLEANUP
    REG --> PERF_MON
    REG --> HEALTH

%% ── Tier management
    OPTIMIZE --> PROMOTE
    OPTIMIZE --> DEMOTE
    OPTIMIZE --> THRESHOLDS

%% ── Operations
    STATS --> MCPS
    HEALTH_CHECK --> MCPS
    METRICS --> MCPS

%% ── Backup operations
    BACKUP_ALL --> BACKUP_MCP
    MAINTENANCE --> BACKUP_MCP

%% ── Event flows (dashed)
    REG -. events .-> CREATE
    REG -. events .-> REMOVE
    REG -. events .-> OPTIMIZE
    REG -. events .-> BACKUP_ALL

%% ── Styling
    style REG          fill:#e1f5fe
    style FACTORIES    fill:#f3e5f5
    style MCPS         fill:#e8f5e8
    style CREATE       fill:#fff3e0
    style OPTIMIZE     fill:#fce4ec
    style STATS        fill:#f1f8e9

```

## 3. MCPOrchestrator Workflow

```mermaid
flowchart TD
    START([System Start]) --> INIT[Initialize Orchestrator]
    INIT --> REG_INIT[Initialize Registry]
    REG_INIT --> CLASS_INIT[Initialize Classifier]
    CLASS_INIT --> MIG_INIT[Initialize Migration Engine]
    MIG_INIT --> COMM_INIT[Initialize Communication Hub]
    COMM_INIT --> BG_TASKS[Start Background Tasks]

    subgraph "Background Tasks"
        BG_TASKS --> AUTO_CLASS[Auto Classification<br/>Every Hour]
        BG_TASKS --> SYS_OPT[System Optimization<br/>Every Hour]
        BG_TASKS --> HEALTH_MON[Health Monitoring<br/>Every Minute]
    end

    subgraph "Auto Classification Flow"
        AUTO_CLASS --> GET_MCPS[Get All MCPs]
        GET_MCPS --> ANALYZE[Analyze Each MCP<br/>Metadata + Performance]
        ANALYZE --> CLASSIFY[Run Classification<br/>ML + Rules + Cost]
        CLASSIFY --> CHECK_BENEFIT{Benefit > Threshold?}
        CHECK_BENEFIT -->|Yes| TRIGGER_MIG[Trigger Auto Migration]
        CHECK_BENEFIT -->|No| SKIP[Skip Migration]
        TRIGGER_MIG --> MIG_ENGINE[Migration Engine]
    end

    subgraph "Query Processing"
        QUERY_IN[Query Request] --> CACHE_CHECK{Cache Hit?}
        CACHE_CHECK -->|Yes| RETURN_CACHE[Return Cached Result]
        CACHE_CHECK -->|No| ROUTE_DECISION{Use Distribution?}
        ROUTE_DECISION -->|Yes| DIST_QUERY[Distributed Query]
        ROUTE_DECISION -->|No| SELECT_MCP[Select Optimal MCP]
        SELECT_MCP --> EXEC_QUERY[Execute Query]
        DIST_QUERY --> COMM_HUB[Communication Hub]
        COMM_HUB --> AGGREGATE[Aggregate Results]
        EXEC_QUERY --> CACHE_RESULT[Cache Result]
        AGGREGATE --> CACHE_RESULT
        CACHE_RESULT --> RETURN_RESULT[Return Result]
    end

    subgraph "System Health"
        HEALTH_MON --> CHECK_METRICS[Collect Metrics]
        CHECK_METRICS --> EVAL_THRESHOLDS{Thresholds OK?}
        EVAL_THRESHOLDS -->|No| CREATE_ALERT[Create Alert]
        EVAL_THRESHOLDS -->|Yes| CONTINUE[Continue Monitoring]
        CREATE_ALERT --> NOTIFY[Notify Stakeholders]
    end

    %% Error handling
    INIT -.-> |error| ERROR_HANDLER[Error Handler]
    AUTO_CLASS -.-> |error| ERROR_HANDLER
    EXEC_QUERY -.-> |error| ERROR_HANDLER
    ERROR_HANDLER --> CREATE_ALERT

    style START fill:#e8f5e8
    style INIT fill:#e1f5fe
    style AUTO_CLASS fill:#fff3e0
    style QUERY_IN fill:#f3e5f5
    style HEALTH_MON fill:#fce4ec
    style ERROR_HANDLER fill:#ffebee
```

## 4. TierClassifier Decision Engine

```mermaid
graph TB
    subgraph "Input Data"
        METADATA[MCP Metadata<br/>Size, Access Count, etc.]
        PERFORMANCE[Performance Metrics<br/>Query Time, Cache Hit, etc.]
        ACCESS_HIST[Access History<br/>24-hour pattern]
    end

    subgraph "Classification Algorithms"
        RULE_BASED[Rule-Based<br/>Threshold Evaluation]
        ML_BASED[ML-Based<br/>Pattern Analysis]
        COST_OPT[Cost-Optimized<br/>Storage vs Access Cost]
        PERF_OPT[Performance-Optimized<br/>Query Speed Priority]
    end

    subgraph "Pattern Analysis"
        ACCESS_PATTERN[Access Pattern Analysis<br/>Trend, Seasonality, Volatility]
        CRITERIA[Extract Criteria<br/>Frequency, Latency, Business Critical]
    end

    subgraph "Scoring System"
        HOT_SCORE[HOT Tier Score<br/>Access Weight + Perf Weight]
        WARM_SCORE[WARM Tier Score<br/>Balanced Scoring]
        COLD_SCORE[COLD Tier Score<br/>Storage Optimization]
    end

    subgraph "Ensemble Decision"
        WEIGHT_CALC[Calculate Weights<br/>Cost Sensitivity + Confidence]
        ENSEMBLE[Ensemble Results<br/>Weighted Average]
        FINAL_DECISION[Final Classification<br/>Tier + Confidence + Reason]
    end

    subgraph "Output"
        RECOMMENDATION[Tier Recommendation]
        CONFIDENCE[Confidence Score 0-1]
        MIGRATION_COST[Estimated Migration Cost]
        EXPECTED_BENEFIT[Expected Benefit]
        WARNINGS[Warnings & Alternatives]
    end

    %% Data flow
    METADATA --> CRITERIA
    PERFORMANCE --> CRITERIA
    ACCESS_HIST --> ACCESS_PATTERN
    ACCESS_PATTERN --> CRITERIA

    %% Classification algorithms
    CRITERIA --> RULE_BASED
    CRITERIA --> ML_BASED
    CRITERIA --> COST_OPT
    CRITERIA --> PERF_OPT

    %% ML-based scoring
    ML_BASED --> HOT_SCORE
    ML_BASED --> WARM_SCORE
    ML_BASED --> COLD_SCORE

    %% Ensemble processing
    RULE_BASED --> WEIGHT_CALC
    ML_BASED --> WEIGHT_CALC
    COST_OPT --> WEIGHT_CALC
    PERF_OPT --> WEIGHT_CALC

    WEIGHT_CALC --> ENSEMBLE
    ENSEMBLE --> FINAL_DECISION

    %% Output generation
    FINAL_DECISION --> RECOMMENDATION
    FINAL_DECISION --> CONFIDENCE
    FINAL_DECISION --> MIGRATION_COST
    FINAL_DECISION --> EXPECTED_BENEFIT
    FINAL_DECISION --> WARNINGS

    %% Styling
    style METADATA fill:#e1f5fe
    style PERFORMANCE fill:#f3e5f5
    style ACCESS_HIST fill:#e8f5e8
    style RULE_BASED fill:#fff3e0
    style ML_BASED fill:#fce4ec
    style ENSEMBLE fill:#f1f8e9
    style FINAL_DECISION fill:#e8eaf6
```

## 5. Migration Engine State Machine

```mermaid
stateDiagram-v2
    [*] --> Planned : Create Migration Plan
    Planned --> Queued : Queue Migration
    Queued --> Preparing : Start Execution
    
    Preparing --> Snapshot : Rollback Required
    Preparing --> DataTransfer : No Snapshot Needed
    Snapshot --> DataTransfer : Snapshot Complete
    
    DataTransfer --> Validating : Transfer Complete
    DataTransfer --> RollingBack : Transfer Failed
    
    Validating --> SwitchOver : Validation Passed
    Validating --> RollingBack : Validation Failed
    
    SwitchOver --> Cleanup : Switch Complete
    SwitchOver --> RollingBack : Switch Failed
    
    Cleanup --> Completed : Cleanup Complete
    Cleanup --> Failed : Cleanup Failed
    
    RollingBack --> RolledBack : Rollback Complete
    RollingBack --> Failed : Rollback Failed
    
    Completed --> [*]
    Failed --> [*]
    RolledBack --> [*]
    
    note right of Preparing
        - Set MCP to migrating status
        - Validate health
        - Clear caches
    end note
    
    note right of DataTransfer
        - Batch transfer with progress
        - Checksum validation
        - Parallel processing
    end note
    
    note right of Validating
        - Data integrity checks
        - Performance validation
        - Target tier accessibility
    end note
    
    note right of SwitchOver
        - Update metadata
        - Set status to active
        - Register with hub
    end note
```

## 6. Communication Hub Message Flow

```mermaid
sequenceDiagram
    participant API as External API
    participant ORCH as MCPOrchestrator
    participant HUB as CommunicationHub
    participant MCP1 as MCP Instance 1
    participant MCP2 as MCP Instance 2
    participant MCP3 as MCP Instance 3

    API->>ORCH: Execute Distributed Query
    ORCH->>HUB: executeDistributedQuery()
    
    Note over HUB: Select Target MCPs<br/>Based on Strategy
    
    HUB->>HUB: Create DistributedQuery Plan
    
    par Parallel Query Execution
        HUB->>MCP1: Execute Query (Timeout)
        HUB->>MCP2: Execute Query (Timeout)
        HUB->>MCP3: Execute Query (Timeout)
    end
    
    MCP1-->>HUB: Query Result
    MCP2-->>HUB: Query Result  
    MCP3-->>HUB: Query Error
    
    Note over HUB: Aggregate Results<br/>Based on AggregationType
    
    HUB->>HUB: Calculate Execution Stats
    HUB->>HUB: Update Performance Metrics
    
    HUB-->>ORCH: QueryResult with Stats
    ORCH-->>API: Final Result
    
    Note over HUB: Health Check Flow
    HUB->>MCP1: Health Check
    HUB->>MCP2: Health Check
    HUB->>MCP3: Health Check
    
    MCP1-->>HUB: Healthy
    MCP2-->>HUB: Healthy
    MCP3-->>HUB: Degraded
    
    HUB->>HUB: Update Topology<br/>Reduce MCP3 Connectivity
    
    Note over HUB: Cache Invalidation
    HUB->>MCP1: Invalidate Cache Keys
    HUB->>MCP2: Invalidate Cache Keys
    
    MCP1-->>HUB: Cache Cleared
    MCP2-->>HUB: Cache Cleared
```

## 7. Event-Driven Architecture Flow

```mermaid
graph LR
    subgraph "Event Sources"
        MCP_EVENTS[MCP Events<br/>status-changed<br/>performance-updated<br/>error]
        REG_EVENTS[Registry Events<br/>mcp-created<br/>mcp-removed<br/>tier-optimization]
        MIG_EVENTS[Migration Events<br/>migration-completed<br/>migration-failed<br/>rollback-started]
        COMM_EVENTS[Communication Events<br/>message-processed<br/>topology-updated<br/>health-check]
    end

    subgraph "Event Hub"
        ORCH_EVENTS[Orchestrator<br/>EventEmitter]
    end

    subgraph "Event Handlers"
        ALERT_HANDLER[Alert Handler<br/>Create & Manage Alerts]
        METRICS_HANDLER[Metrics Handler<br/>Update System Metrics]
        COORD_HANDLER[Coordination Handler<br/>Cross-Component Actions]
        LOG_HANDLER[Log Handler<br/>Audit & Monitoring]
    end

    subgraph "External Notifications"
        API_NOTIFY[API Notifications]
        MONITORING[Monitoring Systems]
        ADMIN_ALERTS[Admin Alerts]
    end

    %% Event flows
    MCP_EVENTS --> ORCH_EVENTS
    REG_EVENTS --> ORCH_EVENTS
    MIG_EVENTS --> ORCH_EVENTS
    COMM_EVENTS --> ORCH_EVENTS

    ORCH_EVENTS --> ALERT_HANDLER
    ORCH_EVENTS --> METRICS_HANDLER
    ORCH_EVENTS --> COORD_HANDLER
    ORCH_EVENTS --> LOG_HANDLER

    ALERT_HANDLER --> API_NOTIFY
    ALERT_HANDLER --> ADMIN_ALERTS
    METRICS_HANDLER --> MONITORING
    LOG_HANDLER --> MONITORING

    %% Bidirectional coordination
    COORD_HANDLER -.-> MCP_EVENTS
    COORD_HANDLER -.-> REG_EVENTS
    COORD_HANDLER -.-> MIG_EVENTS

    style ORCH_EVENTS fill:#e1f5fe
    style ALERT_HANDLER fill:#ffebee
    style METRICS_HANDLER fill:#e8f5e8
    style COORD_HANDLER fill:#fff3e0
```

## Key Architecture Principles

1. **Event-Driven Design**: All components use EventEmitter for loose coupling
2. **Factory Pattern**: MCPRegistry uses factories for dynamic MCP creation
3. **Strategy Pattern**: Multiple algorithms for classification, migration, and query distribution
4. **Observer Pattern**: Health monitoring and metrics collection
5. **State Machine**: Migration engine with well-defined state transitions
6. **Pub-Sub**: Communication hub for inter-MCP messaging
7. **CQRS**: Separate query and command handling paths
8. **Circuit Breaker**: Health checks with automatic failover
9. **Batching**: Background tasks for optimization and cleanup
10. **Caching**: Query result caching with TTL and size limits