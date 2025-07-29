# Thermal Classification System - Technical Diagrams

## 🏗️ System Architecture Diagram

```mermaid
graph TB
    subgraph "Data Ingestion Layer"
        DI[Data Ingestion] --> AP[Access Pattern Analyzer]
        AP --> TC[TierClassifier Engine]
    end
    
    subgraph "Classification Engine"
        TC --> RB[Rule-Based Algorithm]
        TC --> ML[ML-Based Algorithm]
        TC --> CO[Cost-Optimized Algorithm]
        TC --> PO[Performance-Optimized Algorithm]
        
        RB --> ES[Ensemble Scorer]
        ML --> ES
        CO --> ES
        PO --> ES
        
        ES --> TD[Tier Decision]
    end
    
    subgraph "Storage Tiers"
        TD --> HOT[HOT Tier - HotMCP]
        TD --> WARM[WARM Tier - BaseMCP]
        TD --> COLD[COLD Tier - ColdMCP]
        
        HOT --> L1[L1 Cache - Hot Data]
        HOT --> L2[L2 Cache - Preload]
        HOT --> L3[L3 Cache - Query Results]
        
        COLD --> COMP[Compression Engine]
        COLD --> BATCH[Batch Processor]
        COLD --> ARCH[Archive Manager]
    end
    
    subgraph "Migration System"
        ME[Migration Engine] --> HOT
        ME --> WARM
        ME --> COLD
        
        ME --> MP[Migration Planner]
        ME --> MQ[Migration Queue]
        ME --> MR[Migration Rollback]
    end
    
    subgraph "Monitoring & Analytics"
        PM[Performance Monitor] --> HOT
        PM --> WARM
        PM --> COLD
        
        PM --> AL[Alerting System]
        PM --> ME
    end
    
    style HOT fill:#ff6b6b
    style WARM fill:#ffd93d
    style COLD fill:#6bcf7f
    style TC fill:#4ecdc4
    style ME fill:#45b7d1
```

## 🔄 Data Lifecycle Flow

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant AP as Access Pattern Analyzer
    participant TC as TierClassifier
    participant HOT as HOT Tier (HotMCP)
    participant WARM as WARM Tier (BaseMCP)
    participant COLD as COLD Tier (ColdMCP)
    participant ME as Migration Engine
    
    Note over Client,ME: Data Ingestion & Initial Classification
    Client->>AP: Data Write Request
    AP->>AP: Analyze Access Pattern
    AP->>TC: Request Classification
    
    TC->>TC: Run 4 Algorithms
    Note over TC: Rule-Based, ML-Based, Cost-Opt, Perf-Opt
    TC->>TC: Ensemble Decision
    
    alt HOT Tier Classification
        TC->>HOT: Store Data
        HOT->>HOT: L1/L2/L3 Cache
        HOT->>Client: Fast Response (<100ms)
    else COLD Tier Classification
        TC->>COLD: Store Data
        COLD->>COLD: Compress & Batch
        COLD->>Client: Response (~5s)
    end
    
    Note over Client,ME: Continuous Monitoring & Migration
    loop Every 5 minutes
        AP->>TC: Re-analyze Access Patterns
        TC->>ME: Migration Recommendation
        alt Migration Needed
            ME->>ME: Create Migration Plan
            ME->>ME: Execute Migration
            Note over ME: 6 Phases: Prep→Snapshot→Transfer→Validate→Switch→Cleanup
            ME->>HOT: Update Tier
        end
    end
```

## 🧠 Classification Algorithm Decision Tree

```mermaid
flowchart TD
    START([Data Classification Request]) --> INPUT[Access Pattern Input]
    
    INPUT --> RB_START{Rule-Based Algorithm}
    INPUT --> ML_START{ML-Based Algorithm}
    INPUT --> CO_START{Cost-Optimized Algorithm}
    INPUT --> PO_START{Performance-Optimized Algorithm}
    
    subgraph "Rule-Based Classification"
        RB_START --> RB_FREQ{Access Freq ≥ 10/hr?}
        RB_FREQ -->|Yes| RB_LAT{Query Time ≤ 100ms?}
        RB_LAT -->|Yes| RB_CACHE{Cache Hit ≥ 80%?}
        RB_CACHE -->|Yes| RB_HOT[HOT - Confidence: 1.0]
        
        RB_FREQ -->|No| RB_OLD{Last Access > 7 days?}
        RB_OLD -->|Yes| RB_COLD[COLD - Confidence: 0.9]
        RB_OLD -->|No| RB_WARM[WARM - Confidence: 0.8]
        
        RB_LAT -->|No| RB_WARM
        RB_CACHE -->|No| RB_WARM
    end
    
    subgraph "ML-Based Scoring"
        ML_START --> ML_ACCESS[Access Weight: 40%]
        ML_START --> ML_PERF[Performance Weight: 30%]
        ML_START --> ML_TREND[Trend Analysis: 20%]
        ML_START --> ML_BIZ[Business Criticality: 10%]
        
        ML_ACCESS --> ML_SCORE[Combined ML Score]
        ML_PERF --> ML_SCORE
        ML_TREND --> ML_SCORE
        ML_BIZ --> ML_SCORE
        
        ML_SCORE --> ML_HOT{Score > 0.7?}
        ML_HOT -->|Yes| ML_HOT_OUT[HOT - ML Score]
        ML_HOT -->|No| ML_COLD{Score < 0.3?}
        ML_COLD -->|Yes| ML_COLD_OUT[COLD - ML Score]
        ML_COLD -->|No| ML_WARM_OUT[WARM - ML Score]
    end
    
    RB_HOT --> ENSEMBLE[Ensemble Scorer]
    RB_WARM --> ENSEMBLE
    RB_COLD --> ENSEMBLE
    ML_HOT_OUT --> ENSEMBLE
    ML_WARM_OUT --> ENSEMBLE
    ML_COLD_OUT --> ENSEMBLE
    
    CO_START --> CO_CALC[Calculate Total Cost by Tier]
    CO_CALC --> CO_MIN[Select Minimum Cost Tier]
    CO_MIN --> ENSEMBLE
    
    PO_START --> PO_PERF{Query Time > 500ms?}
    PO_PERF -->|Yes| PO_HOT[Force HOT for Performance]
    PO_PERF -->|No| PO_WARM[WARM Sufficient]
    PO_HOT --> ENSEMBLE
    PO_WARM --> ENSEMBLE
    
    ENSEMBLE --> WEIGHT[Apply Weighted Scoring]
    WEIGHT --> FINAL{Final Tier Decision}
    
    FINAL --> FINAL_HOT[🔥 HOT TIER]
    FINAL --> FINAL_WARM[🌤️ WARM TIER]
    FINAL --> FINAL_COLD[❄️ COLD TIER]
    
    style RB_HOT fill:#ff6b6b
    style ML_HOT_OUT fill:#ff6b6b
    style PO_HOT fill:#ff6b6b
    style FINAL_HOT fill:#ff6b6b
    
    style RB_WARM fill:#ffd93d
    style ML_WARM_OUT fill:#ffd93d
    style PO_WARM fill:#ffd93d
    style FINAL_WARM fill:#ffd93d
    
    style RB_COLD fill:#6bcf7f
    style ML_COLD_OUT fill:#6bcf7f
    style FINAL_COLD fill:#6bcf7f
```

## 🏎️ HOT Tier Caching Architecture

```mermaid
graph TB
    subgraph "HOT Tier - Multi-Level Caching"
        CLIENT[Client Request] --> CACHE_CHECK{Cache Check}
        
        subgraph "L1 Cache - Hot Data"
            L1[In-Memory Cache]
            L1_LRU[LRU Strategy]
            L1_LFU[LFU Strategy]
            L1_ADAPTIVE[Adaptive Strategy]
            
            L1 --> L1_LRU
            L1 --> L1_LFU
            L1 --> L1_ADAPTIVE
        end
        
        subgraph "L2 Cache - Preload"
            L2[Preload Cache]
            L2_PREDICT[Access Prediction]
            L2_RELATION[Relationship Loading]
            
            L2 --> L2_PREDICT
            L2 --> L2_RELATION
        end
        
        subgraph "L3 Cache - Query Results"
            L3[Query Result Cache]
            L3_TTL[5-Minute TTL]
            L3_INVALIDATE[Auto Invalidation]
            
            L3 --> L3_TTL
            L3 --> L3_INVALIDATE
        end
        
        CACHE_CHECK -->|Hit| L1
        L1 -->|Miss| L2
        L2 -->|Hit| PROMOTE[Promote to L1]
        L2 -->|Miss| L3
        L3 -->|Hit| L3_RESULT[Return Cached Query]
        L3 -->|Miss| STORAGE[Storage Access]
        
        PROMOTE --> CLIENT
        L3_RESULT --> CLIENT
        STORAGE --> CACHE_POPULATE[Populate All Caches]
        CACHE_POPULATE --> CLIENT
        
        subgraph "Performance Monitoring"
            PERF_MON[Performance Monitor]
            THRESHOLD_CHECK[Threshold Check]
            AUTO_OPTIMIZE[Auto Optimization]
            
            PERF_MON --> THRESHOLD_CHECK
            THRESHOLD_CHECK --> AUTO_OPTIMIZE
            AUTO_OPTIMIZE --> L1
        end
        
        subgraph "Connection Pool"
            CONN_POOL[Connection Pool - 50 Connections]
            CONN_REUSE[Connection Reuse]
            CONN_LIFECYCLE[Lifecycle Management]
            
            CONN_POOL --> CONN_REUSE
            CONN_POOL --> CONN_LIFECYCLE
        end
        
        STORAGE --> CONN_POOL
    end
    
    style L1 fill:#ff6b6b,color:#fff
    style L2 fill:#ff8e53,color:#fff
    style L3 fill:#ffa726,color:#fff
    style CONN_POOL fill:#42a5f5,color:#fff
```

## ❄️ COLD Tier Processing Pipeline

```mermaid
graph TD
    subgraph "COLD Tier - Archival Processing"
        INPUT[Data Input] --> ENRICH[Enrich for Archival]
        ENRICH --> BUFFER[Batch Buffer]
        
        subgraph "Batch Processing"
            BUFFER --> BATCH_FULL{Batch Full?}
            BATCH_FULL -->|Yes| COMPRESS[Compression Engine]
            BATCH_FULL -->|No| WAIT[Wait for More Data]
            WAIT --> BUFFER
            
            COMPRESS --> L1_COMP[Level 1 - 80% Ratio]
            COMPRESS --> L3_COMP[Level 3 - 60% Ratio]
            COMPRESS --> L5_COMP[Level 5 - 20% Ratio]
            
            L1_COMP --> STORE[Store Compressed]
            L3_COMP --> STORE
            L5_COMP --> STORE
        end
        
        subgraph "Retention Management"
            STORE --> RETENTION[Schedule Retention]
            RETENTION --> DEBUG[Debug: 30 days]
            RETENTION --> STANDARD[Standard: 1 year]
            RETENTION --> ARCHIVE[Archive: 7 years]
            RETENTION --> PERMANENT[Permanent: Never]
            
            DEBUG --> CLEANUP[Daily Cleanup]
            STANDARD --> CLEANUP
            ARCHIVE --> CLEANUP
        end
        
        subgraph "Cost Optimization"
            COST_ANALYZER[Cost Analyzer] --> MIGRATE_CHECK{Migration Needed?}
            MIGRATE_CHECK -->|Yes| DEEP_ARCHIVE[Deep Archive]
            MIGRATE_CHECK -->|No| MONITOR[Continue Monitoring]
            
            DEEP_ARCHIVE --> STORAGE_CLASS[Storage Class Migration]
            STORAGE_CLASS --> INFREQUENT[Infrequent Access]
            STORAGE_CLASS --> ARCH_CLASS[Archive Class] 
            STORAGE_CLASS --> DEEP_CLASS[Deep Archive Class]
        end
        
        subgraph "Background Optimization"
            BG_OPT[Background Optimizer] --> COMPRESS_OLD[Compress Uncompressed]
            BG_OPT --> UPDATE_PATTERNS[Update Access Patterns]
            BG_OPT --> CACHE_CLEANUP[Cache Cleanup]
            
            COMPRESS_OLD --> STORE
            UPDATE_PATTERNS --> COST_ANALYZER
        end
        
        STORE --> COST_ANALYZER
        STORE --> BG_OPT
    end
    
    style COMPRESS fill:#6bcf7f,color:#fff
    style DEEP_ARCHIVE fill:#4caf50,color:#fff
    style BG_OPT fill:#81c784,color:#fff
    style CLEANUP fill:#a5d6a7,color:#fff
```

## 🔄 Migration Process Flow

```mermaid
stateDiagram-v2
    [*] --> PLANNED: Create Migration Plan
    
    PLANNED --> QUEUED: Queue Migration
    QUEUED --> PREPARING: Start Execution
    
    PREPARING --> SNAPSHOT: Snapshot Required?
    PREPARING --> DATA_TRANSFER: No Snapshot
    
    SNAPSHOT --> DATA_TRANSFER: Snapshot Complete
    
    DATA_TRANSFER --> VALIDATING: Transfer Complete
    DATA_TRANSFER --> ROLLING_BACK: Transfer Failed
    
    VALIDATING --> COMPLETING: Validation Passed
    VALIDATING --> ROLLING_BACK: Validation Failed
    
    COMPLETING --> COMPLETED: Switch-Over Complete
    COMPLETING --> ROLLING_BACK: Switch-Over Failed
    
    ROLLING_BACK --> ROLLED_BACK: Rollback Complete
    ROLLING_BACK --> FAILED: Rollback Failed
    
    COMPLETED --> [*]
    ROLLED_BACK --> [*]
    FAILED --> [*]
    
    state DATA_TRANSFER {
        [*] --> Batch1: Start Transfer
        Batch1 --> Batch2: 1000 records
        Batch2 --> Batch3: 1000 records
        Batch3 --> BatchN: Continue...
        BatchN --> [*]: All Batches Complete
    }
    
    state VALIDATING {
        [*] --> ChecksumValidation
        ChecksumValidation --> IntegrityCheck
        IntegrityCheck --> PerformanceTest
        PerformanceTest --> [*]
    }
```

## 📊 Performance Metrics Dashboard

```mermaid
graph TB
    subgraph "Performance Monitoring Dashboard"
        subgraph "Response Time Metrics"
            HOT_RT[HOT Tier: <100ms]
            WARM_RT[WARM Tier: <500ms] 
            COLD_RT[COLD Tier: <5000ms]
            
            style HOT_RT fill:#4caf50
            style WARM_RT fill:#ff9800
            style COLD_RT fill:#2196f3
        end
        
        subgraph "Throughput Metrics"
            HOT_TP[HOT: >1000 ops/sec]
            WARM_TP[WARM: >100 ops/sec]
            COLD_TP[COLD: Batch Optimized]
            
            style HOT_TP fill:#4caf50
            style WARM_TP fill:#ff9800
            style COLD_TP fill:#2196f3
        end
        
        subgraph "Cache Performance"
            L1_HIT[L1 Cache: 90%+ Hit Ratio]
            L2_HIT[L2 Cache: Predictive]
            L3_HIT[L3 Cache: Query Results]
            
            style L1_HIT fill:#e91e63
            style L2_HIT fill:#9c27b0
            style L3_HIT fill:#673ab7
        end
        
        subgraph "Classification Accuracy"
            RULE_ACC[Rule-Based: 85%]
            ML_ACC[ML-Based: 92%]
            COST_ACC[Cost-Opt: 78%]
            PERF_ACC[Perf-Opt: 96%]
            
            style ML_ACC fill:#4caf50
            style PERF_ACC fill:#4caf50
            style RULE_ACC fill:#ff9800
            style COST_ACC fill:#ff9800
        end
        
        subgraph "Migration Success"
            MIG_SUCCESS[Success Rate: 98%]
            MIG_ROLLBACK[Rollback Rate: 2%]
            MIG_DURATION[Avg Duration: 15min]
            
            style MIG_SUCCESS fill:#4caf50
            style MIG_ROLLBACK fill:#f44336
            style MIG_DURATION fill:#2196f3
        end
        
        subgraph "Cost Efficiency"
            STORAGE_COST[Storage: 80% Reduction]
            OP_COST[Operations: Optimized]
            COMPRESSION[Compression: 60% Avg]
            
            style STORAGE_COST fill:#4caf50
            style OP_COST fill:#4caf50
            style COMPRESSION fill:#4caf50
        end
        
        subgraph "Alert Thresholds"
            ALERT_LATENCY[Latency > Threshold]
            ALERT_ERROR[Error Rate > 5%]
            ALERT_CACHE[Cache Hit < 70%]
            
            style ALERT_LATENCY fill:#f44336
            style ALERT_ERROR fill:#f44336
            style ALERT_CACHE fill:#f44336
        end
    end
```

## 🎯 Optimization Feedback Loop

```mermaid
graph LR
    subgraph "Continuous Optimization Cycle"
        MONITOR[Monitor Performance] --> ANALYZE[Analyze Patterns]
        ANALYZE --> PREDICT[Predict Trends]
        PREDICT --> OPTIMIZE[Optimize Settings]
        OPTIMIZE --> VALIDATE[Validate Changes]
        VALIDATE --> MONITOR
        
        subgraph "Analysis Components"
            ANALYZE --> ACCESS_PATTERN[Access Pattern Analysis]
            ANALYZE --> PERF_ANALYSIS[Performance Analysis]
            ANALYZE --> COST_ANALYSIS[Cost Analysis]
            
            ACCESS_PATTERN --> ML_MODEL[Update ML Models]
            PERF_ANALYSIS --> THRESHOLD_TUNE[Tune Thresholds]
            COST_ANALYSIS --> TIER_REBALANCE[Rebalance Tiers]
        end
        
        subgraph "Optimization Actions"
            OPTIMIZE --> CACHE_TUNE[Cache Strategy Tuning]
            OPTIMIZE --> COMPRESSION_OPT[Compression Optimization]
            OPTIMIZE --> MIGRATION_SCHED[Migration Scheduling]
            
            CACHE_TUNE --> AUTO_SCALE[Auto-Scale Resources]
            COMPRESSION_OPT --> BATCH_SIZE[Adjust Batch Sizes]
            MIGRATION_SCHED --> LOAD_BALANCE[Load Balancing]
        end
        
        style MONITOR fill:#42a5f5
        style ANALYZE fill:#66bb6a
        style PREDICT fill:#ab47bc
        style OPTIMIZE fill:#ff7043
        style VALIDATE fill:#26a69a
    end
```

---

*These diagrams illustrate the comprehensive thermal classification system architecture, showing the intelligent data flow, multi-algorithm decision making, and continuous optimization processes that ensure optimal performance across all storage tiers.*