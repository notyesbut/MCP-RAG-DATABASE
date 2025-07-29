/**
 * MCP Migration Engine - Handles data movement between tiers
 * Optimized for minimal downtime and data integrity
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseMCP } from '../../core/mcp/base_mcp';
import { MCPTier, MCPPerformanceTier, MCPStatus, MCPResult, MCPMetadata } from '../../types/mcp.types';
import { TierClassifier, ClassificationResult } from '../classification/TierClassifier';
import { MCPRegistry } from '../registry/MCPRegistry';

export interface MigrationPlan {
  id: string;
  sourceMcpId: string;
  targetTier: MCPTier;
  estimatedDuration: number;     // in milliseconds
  estimatedCost: number;
  strategy: MigrationStrategy;
  priority: MigrationPriority;
  scheduledTime?: Date;
  dependencies: string[];        // Other migration IDs this depends on
  rollbackPlan: RollbackPlan;
}

export interface MigrationStrategy {
  type: 'copy_then_switch' | 'streaming' | 'hybrid' | 'background_sync';
  batchSize: number;
  parallelism: number;
  checksumValidation: boolean;
  compressionEnabled: boolean;
  encryptionRequired: boolean;
}

export enum MigrationPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RollbackPlan {
  enabled: boolean;
  snapshotRequired: boolean;
  maxRollbackTimeMs: number;
  rollbackTriggers: string[];    // Conditions that trigger rollback
}

export interface MigrationProgress {
  migrationId: string;
  status: MigrationStatus;
  progress: number;              // 0-1
  startTime: Date;
  estimatedCompletion?: Date;
  transferredData: number;       // bytes
  totalData: number;             // bytes
  currentPhase: MigrationPhase;
  errors: MigrationError[];
  metrics: MigrationMetrics;
}

export enum MigrationStatus {
  PLANNED = 'planned',
  QUEUED = 'queued',
  PREPARING = 'preparing',
  IN_PROGRESS = 'in_progress',
  VALIDATING = 'validating',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

export enum MigrationPhase {
  PREPARATION = 'preparation',
  SNAPSHOT = 'snapshot',
  DATA_TRANSFER = 'data_transfer',
  VALIDATION = 'validation',
  SWITCH_OVER = 'switch_over',
  CLEANUP = 'cleanup'
}

export interface MigrationError {
  timestamp: Date;
  phase: MigrationPhase;
  error: string;
  severity: 'warning' | 'error' | 'critical';
  recoverable: boolean;
}

export interface MigrationMetrics {
  throughputBytesPerSec: number;
  avgLatencyMs: number;
  checksumValidations: number;
  retries: number;
  networkUtilization: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

export class MCPMigrationEngine extends EventEmitter {
  private activeMigrations: Map<string, MigrationProgress>;
  private migrationQueue: MigrationPlan[];
  private classifier: TierClassifier;
  private mcpRegistry: MCPRegistry;
  private isProcessing: boolean;
  private maxConcurrentMigrations: number;
  private migrationHistory: Map<string, MigrationProgress[]>;

  constructor(registry: MCPRegistry, classifier: TierClassifier, maxConcurrentMigrations: number = 3) {
    super();
    
    this.activeMigrations = new Map();
    this.migrationQueue = [];
    this.classifier = classifier;
    this.mcpRegistry = registry;
    this.isProcessing = false;
    this.maxConcurrentMigrations = maxConcurrentMigrations;
    this.migrationHistory = new Map();

    this.startMigrationProcessor();
  }

  // MCP Registration methods required by MCPOrchestrator
  registerMCP(mcpId: string, mcp: BaseMCP): void {
    // Register MCP for migration tracking
    if (!this.migrationHistory.has(mcpId)) {
      this.migrationHistory.set(mcpId, []);
    }
    this.emit('mcp-registered', { mcpId, mcp });
  }

  unregisterMCP(mcpId: string): void {
    // Cancel any active migrations for this MCP
    const activeMigration = Array.from(this.activeMigrations.entries())
      .find(([, progress]) => progress.migrationId.includes(mcpId));
    
    if (activeMigration) {
      this.cancelMigration(activeMigration[0]).catch(error => {
        this.emit('migration-cancellation-failed', { mcpId, error });
      });
    }

    // Remove from queue
    this.migrationQueue = this.migrationQueue.filter(plan => plan.sourceMcpId !== mcpId);
    
    this.emit('mcp-unregistered', { mcpId });
  }

  // Create migration plan
  async createMigrationPlan(
    mcpId: string, 
    targetTier: MCPTier,
    options: Partial<{
      priority: MigrationPriority;
      strategy: Partial<MigrationStrategy>;
      scheduledTime: Date;
      rollbackPlan: Partial<RollbackPlan>;
    }> = {}
  ): Promise<MigrationPlan> {
    const mcp = await this.mcpRegistry.getMCP(mcpId);
    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    const metadata = await mcp.getMetadata();
    const currentTier = metadata.tier;
    
    if (currentTier === targetTier) {
      throw new Error(`MCP already in target tier: ${targetTier}`);
    }

    // Estimate migration parameters
    const estimatedDuration = this.estimateMigrationDuration(metadata, targetTier);
    const estimatedCost = this.estimateMigrationCost(metadata, targetTier);
    
    const strategy: MigrationStrategy = {
      type: this.selectOptimalStrategy(metadata, targetTier),
      batchSize: Math.min(10000, Math.max(1000, metadata.recordCount / 1000)),
      parallelism: this.calculateOptimalParallelism(metadata),
      checksumValidation: true,
      compressionEnabled: targetTier === MCPTier.COLD,
      encryptionRequired: metadata.tags.includes('encrypted'),
      ...options.strategy
    };

    const rollbackPlan: RollbackPlan = {
      enabled: true,
      snapshotRequired: metadata.recordCount > 1000000, // > 1M records
      maxRollbackTimeMs: estimatedDuration * 2,
      rollbackTriggers: ['error_rate_high', 'performance_degraded', 'validation_failed'],
      ...options.rollbackPlan
    };

    const plan: MigrationPlan = {
      id: this.generateMigrationId(),
      sourceMcpId: mcpId,
      targetTier,
      estimatedDuration,
      estimatedCost,
      strategy,
      priority: options.priority || MigrationPriority.NORMAL,
      scheduledTime: options.scheduledTime,
      dependencies: [],
      rollbackPlan
    };

    this.emit('migration-plan-created', plan);
    return plan;
  }

  // Queue migration for execution
  async queueMigration(plan: MigrationPlan): Promise<void> {
    // Validate plan
    await this.validateMigrationPlan(plan);
    
    // Add to queue with priority ordering
    this.insertIntoQueue(plan);
    
    const progress: MigrationProgress = {
      migrationId: plan.id,
      status: MigrationStatus.QUEUED,
      progress: 0,
      startTime: new Date(),
      transferredData: 0,
      totalData: 0,
      currentPhase: MigrationPhase.PREPARATION,
      errors: [],
      metrics: this.getInitialMetrics()
    };
    
    this.activeMigrations.set(plan.id, progress);
    this.emit('migration-queued', { plan, progress });
  }

  // Execute migration immediately (bypasses queue)
  async executeMigration(plan: MigrationPlan): Promise<MigrationProgress> {
    await this.validateMigrationPlan(plan);
    
    const progress: MigrationProgress = {
      migrationId: plan.id,
      status: MigrationStatus.PREPARING,
      progress: 0,
      startTime: new Date(),
      transferredData: 0,
      totalData: 0,
      currentPhase: MigrationPhase.PREPARATION,
      errors: [],
      metrics: this.getInitialMetrics()
    };
    
    this.activeMigrations.set(plan.id, progress);
    
    try {
      await this.performMigration(plan, progress);
      return progress;
    } catch (error) {
      progress.status = MigrationStatus.FAILED;
      progress.errors.push({
        timestamp: new Date(),
        phase: progress.currentPhase,
        error: error instanceof Error ? error.message : String(error),
        severity: 'critical',
        recoverable: false
      });
      
      this.emit('migration-failed', { plan, progress, error });
      throw error;
    }
  }

  // Get migration status
  getMigrationProgress(migrationId: string): MigrationProgress | null {
    return this.activeMigrations.get(migrationId) || null;
  }

  // Get all active migrations
  getActiveMigrations(): Map<string, MigrationProgress> {
    return new Map(this.activeMigrations);
  }

  // Cancel migration
  async cancelMigration(migrationId: string): Promise<void> {
    const progress = this.activeMigrations.get(migrationId);
    if (!progress) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    if ([MigrationStatus.COMPLETED, MigrationStatus.FAILED, MigrationStatus.ROLLED_BACK].includes(progress.status)) {
      throw new Error(`Cannot cancel migration in status: ${progress.status}`);
    }

    // Initiate rollback if migration is in progress
    if (progress.status === MigrationStatus.IN_PROGRESS) {
      await this.initiateRollback(migrationId);
    } else {
      // Remove from queue if not started
      this.migrationQueue = this.migrationQueue.filter(plan => plan.id !== migrationId);
      this.activeMigrations.delete(migrationId);
    }

    this.emit('migration-cancelled', { migrationId });
  }

  // Rollback migration
  async rollbackMigration(migrationId: string): Promise<void> {
    await this.initiateRollback(migrationId);
  }

  // Get migration history for an MCP
  getMigrationHistory(mcpId: string): MigrationProgress[] {
    return this.migrationHistory.get(mcpId) || [];
  }

  // Auto-migrate based on classification
  async autoMigrate(mcpId: string, classification: ClassificationResult): Promise<MigrationPlan | null> {
    const mcp = await this.mcpRegistry.getMCP(mcpId);
    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    const metadata = await mcp.getMetadata();
    
    // Only migrate if confidence is high enough and there's a significant benefit
    if (classification.confidence < 0.7 || classification.expectedBenefit < 0.3) {
      return null;
    }

    const plan = await this.createMigrationPlan(mcpId, classification.recommendedTier, {
      priority: classification.confidence > 0.9 ? MigrationPriority.HIGH : MigrationPriority.NORMAL
    });

    await this.queueMigration(plan);
    return plan;
  }

  // Private implementation methods
  private async performMigration(plan: MigrationPlan, progress: MigrationProgress): Promise<void> {
    const mcp = await this.mcpRegistry.getMCP(plan.sourceMcpId);
    if (!mcp) {
      throw new Error(`Source MCP not found: ${plan.sourceMcpId}`);
    }

    try {
      // Phase 1: Preparation
      await this.executePhase(MigrationPhase.PREPARATION, plan, progress, async () => {
        await this.prepareMigration(mcp, plan);
      });

      // Phase 2: Snapshot (if required)
      if (plan.rollbackPlan.snapshotRequired) {
        await this.executePhase(MigrationPhase.SNAPSHOT, plan, progress, async () => {
          await this.createMigrationSnapshot(mcp, plan);
        });
      }

      // Phase 3: Data Transfer
      await this.executePhase(MigrationPhase.DATA_TRANSFER, plan, progress, async () => {
        await this.transferData(mcp, plan, progress);
      });

      // Phase 4: Validation
      await this.executePhase(MigrationPhase.VALIDATION, plan, progress, async () => {
        await this.validateMigration(mcp, plan);
      });

      // Phase 5: Switch Over
      await this.executePhase(MigrationPhase.SWITCH_OVER, plan, progress, async () => {
        await this.switchOver(mcp, plan);
      });

      // Phase 6: Cleanup
      await this.executePhase(MigrationPhase.CLEANUP, plan, progress, async () => {
        await this.cleanupMigration(mcp, plan);
      });

      progress.status = MigrationStatus.COMPLETED;
      progress.progress = 1.0;
      
      // Store in history
      this.storeMigrationHistory(plan.sourceMcpId, progress);
      
      this.emit('migration-completed', { plan, progress });
      
    } catch (error) {
      progress.status = MigrationStatus.FAILED;
      progress.errors.push({
        timestamp: new Date(),
        phase: progress.currentPhase,
        error: error instanceof Error ? error.message : String(error),
        severity: 'critical',
        recoverable: false
      });
      
      // Attempt rollback if enabled
      if (plan.rollbackPlan.enabled) {
        await this.initiateRollback(plan.id);
      }
      
      throw error;
    } finally {
      this.activeMigrations.delete(plan.id);
    }
  }

  private async executePhase(
    phase: MigrationPhase,
    plan: MigrationPlan,
    progress: MigrationProgress,
    phaseFunction: () => Promise<void>
  ): Promise<void> {
    progress.currentPhase = phase;
    this.emit('migration-phase-started', { plan, progress, phase });
    
    const startTime = Date.now();
    
    try {
      await phaseFunction();
      
      const duration = Date.now() - startTime;
      this.emit('migration-phase-completed', { plan, progress, phase, duration });
      
    } catch (error) {
      progress.errors.push({
        timestamp: new Date(),
        phase,
        error: error instanceof Error ? error.message : String(error),
        severity: 'error',
        recoverable: true
      });
      
      this.emit('migration-phase-failed', { plan, progress, phase, error });
      throw error;
    }
  }

  private async prepareMigration(mcp: BaseMCP, plan: MigrationPlan): Promise<void> {
    // Set MCP to migration status
    await mcp.setStatus('migrating');
    
    // Validate source MCP health
    const healthCheck = await mcp.getHealth();
    if (healthCheck.status !== 'healthy') {
      throw new Error(`Source MCP unhealthy: ${healthCheck.status}`);
    }
    
    // Clear caches to ensure consistency
    await mcp.clearCache();
  }

  private async createMigrationSnapshot(mcp: BaseMCP, plan: MigrationPlan): Promise<void> {
    const snapshot = await mcp.prepareForMigration();
    // Store snapshot for potential rollback
    // Implementation would store snapshot to persistent storage
  }

  private async transferData(mcp: BaseMCP, plan: MigrationPlan, progress: MigrationProgress): Promise<void> {
    const metadata = await mcp.getMetadata();
    progress.totalData = metadata.recordCount;
    
    // Simulate data transfer with progress updates
    const batchSize = plan.strategy.batchSize;
    let transferred = 0;
    
    while (transferred < progress.totalData) {
      const batchStart = Date.now();
      
      // Simulate batch transfer
      const transferAmount = Math.min(batchSize, progress.totalData - transferred);
      await this.simulateDataTransfer(transferAmount);
      
      transferred += transferAmount;
      progress.transferredData = transferred;
      progress.progress = transferred / progress.totalData;
      
      // Update metrics
      const batchDuration = Date.now() - batchStart;
      progress.metrics.throughputBytesPerSec = transferAmount / (batchDuration / 1000);
      
      this.emit('migration-progress-updated', { plan, progress });
      
      // Check for cancellation
      if (progress.status === MigrationStatus.ROLLING_BACK) {
        throw new Error('Migration cancelled');
      }
    }
  }

  private async validateMigration(mcp: BaseMCP, plan: MigrationPlan): Promise<void> {
    // Perform data integrity checks
    if (plan.strategy.checksumValidation) {
      // Implementation would verify checksums
    }
    
    // Verify target tier is accessible and functional
    // Implementation would test the new tier
  }

  private async switchOver(mcp: BaseMCP, plan: MigrationPlan): Promise<void> {
    // Update MCP metadata to reflect new tier
    await mcp.updateMetadata({ tier: plan.targetTier });
    
    // Update MCP status
    await mcp.setStatus('active');
  }

  private async cleanupMigration(mcp: BaseMCP, plan: MigrationPlan): Promise<void> {
    // Clean up temporary files and resources
    // Implementation would remove temporary migration artifacts
  }

  private async initiateRollback(migrationId: string): Promise<void> {
    const progress = this.activeMigrations.get(migrationId);
    if (!progress) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    progress.status = MigrationStatus.ROLLING_BACK;
    this.emit('migration-rollback-started', { migrationId, progress });

    try {
      // Implementation would restore from snapshot and revert changes
      progress.status = MigrationStatus.ROLLED_BACK;
      this.emit('migration-rollback-completed', { migrationId, progress });
    } catch (error) {
      this.emit('migration-rollback-failed', { migrationId, progress, error });
      throw error;
    }
  }

  private startMigrationProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.migrationQueue.length === 0) {
        return;
      }

      if (this.activeMigrations.size >= this.maxConcurrentMigrations) {
        return;
      }

      this.isProcessing = true;
      
      try {
        // Get next migration from queue
        const plan = this.getNextMigrationFromQueue();
        if (plan) {
          await this.executeMigration(plan);
        }
      } catch (error) {
        this.emit('migration-processor-error', error);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Check every 5 seconds
  }

  private insertIntoQueue(plan: MigrationPlan): void {
    // Insert based on priority and scheduled time
    const priorityOrder = {
      [MigrationPriority.CRITICAL]: 0,
      [MigrationPriority.HIGH]: 1,
      [MigrationPriority.NORMAL]: 2,
      [MigrationPriority.LOW]: 3
    };

    let insertIndex = this.migrationQueue.length;
    
    for (let i = 0; i < this.migrationQueue.length; i++) {
      const queuedPlan = this.migrationQueue[i];
      
      if (priorityOrder[plan.priority] < priorityOrder[queuedPlan.priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.migrationQueue.splice(insertIndex, 0, plan);
  }

  private getNextMigrationFromQueue(): MigrationPlan | null {
    const now = new Date();
    
    for (let i = 0; i < this.migrationQueue.length; i++) {
      const plan = this.migrationQueue[i];
      
      // Check if scheduled time has passed (or no schedule)
      if (!plan.scheduledTime || plan.scheduledTime <= now) {
        // Check dependencies
        if (this.areDependenciesCompleted(plan.dependencies)) {
          return this.migrationQueue.splice(i, 1)[0];
        }
      }
    }
    
    return null;
  }

  // Helper methods
  private generateMigrationId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateMigrationDuration(metadata: MCPMetadata, targetTier: MCPTier): number {
    // Simplified estimation - would be more sophisticated in production
    const baseTimePerGB = 60000; // 1 minute per GB
    const dataSizeGB = metadata.recordCount / (1024 * 1024 * 1024);
    
    let multiplier = 1;
    if (targetTier === MCPTier.HOT) multiplier = 0.5; // Faster
    if (targetTier === MCPTier.COLD) multiplier = 2.0; // Slower

    return dataSizeGB * baseTimePerGB * multiplier;
  }

  private estimateMigrationCost(metadata: MCPMetadata, targetTier: MCPTier): number {
    // Simplified cost estimation
    const dataSizeGB = metadata.recordCount / (1024 * 1024 * 1024);
    const baseCostPerGB = 0.01;
    
    return dataSizeGB * baseCostPerGB;
  }

  private selectOptimalStrategy(metadata: MCPMetadata, targetTier: MCPTier): MigrationStrategy['type'] {
    const dataSizeGB = metadata.recordCount / (1024 * 1024 * 1024);
    
    if (dataSizeGB < 1) return 'copy_then_switch';
    if (dataSizeGB < 10) return 'streaming';
    return 'hybrid';
  }

  private calculateOptimalParallelism(metadata: MCPMetadata): number {
    const dataSizeGB = metadata.recordCount / (1024 * 1024 * 1024);
    return Math.min(8, Math.max(1, Math.floor(dataSizeGB / 5)));
  }

  private async validateMigrationPlan(plan: MigrationPlan): Promise<void> {
    const mcp = await this.mcpRegistry.getMCP(plan.sourceMcpId);
    if (!mcp) {
      throw new Error(`Source MCP not found: ${plan.sourceMcpId}`);
    }

    const status = await mcp.getStatus();
    if (status === 'migrating') {
      throw new Error('MCP is already being migrated');
    }
  }

  private areDependenciesCompleted(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const progress = this.activeMigrations.get(depId);
      return !progress || progress.status === MigrationStatus.COMPLETED;
    });
  }

  private getInitialMetrics(): MigrationMetrics {
    return {
      throughputBytesPerSec: 0,
      avgLatencyMs: 0,
      checksumValidations: 0,
      retries: 0,
      networkUtilization: 0,
      cpuUtilization: 0,
      memoryUtilization: 0
    };
  }

  private async simulateDataTransfer(bytes: number): Promise<void> {
    // Simulate transfer time based on throughput
    const simulatedThroughput = 50 * 1024 * 1024; // 50 MB/s
    const transferTime = (bytes / simulatedThroughput) * 1000;
    
    return new Promise(resolve => setTimeout(resolve, transferTime));
  }

  private storeMigrationHistory(mcpId: string, progress: MigrationProgress): void {
    if (!this.migrationHistory.has(mcpId)) {
      this.migrationHistory.set(mcpId, []);
    }
    
    const history = this.migrationHistory.get(mcpId)!;
    history.push({ ...progress });
    
    // Keep only last 20 migrations
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }
}

export default MCPMigrationEngine;