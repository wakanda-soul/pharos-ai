import * as fs from 'fs';
import * as path from 'path';
import { PersistentLedgerSnapshot, TemporalObservationRecord } from './types.js';

/**
 * Default location for on-disk persistent observation storage.
 * Can be overridden for testing or specific runtime environments.
 */
const DEFAULT_STORAGE_DIRECTORY = path.resolve(process.cwd(), '.pharos-storage', 'trend-watcher');

/**
 * PersistentObservationStore
 * 
 * Manages atomic disk persistence for market observations. Ensures that observations
 * survive process crashes, reboots, and container restarts without loss or duplication.
 */
export class PersistentObservationStore {
  private readonly storageFilePath: string;
  private readonly temporaryFilePath: string;
  private inMemoryObservationsMap: Map<string, TemporalObservationRecord> = new Map();
  private isStorageHydrated: boolean = false;
  private lastObservedFileMtimeMs: number = 0;

  constructor(customStorageFilePath?: string) {
    if (customStorageFilePath) {
      this.storageFilePath = path.resolve(customStorageFilePath);
    } else {
      this.storageFilePath = path.join(DEFAULT_STORAGE_DIRECTORY, 'observations-ledger.json');
    }
    this.temporaryFilePath = `${this.storageFilePath}.tmp`;

    // Ensure directory exists on initialization
    const parentDirectory = path.dirname(this.storageFilePath);
    if (!fs.existsSync(parentDirectory)) {
      fs.mkdirSync(parentDirectory, { recursive: true });
    }

    this.hydrateFromPersistentDisk();
  }

  /**
   * Reads the persistent JSON ledger from disk and populates the in-memory index.
   * If the file does not exist, starts with an empty clean ledger.
   * Also verifies file mtime to synchronize across external CLI process restarts.
   */
  public hydrateFromPersistentDisk(): void {
    if (fs.existsSync(this.storageFilePath)) {
      try {
        const fileStats = fs.statSync(this.storageFilePath);
        this.lastObservedFileMtimeMs = fileStats.mtimeMs;

        const rawFileContent = fs.readFileSync(this.storageFilePath, 'utf-8');
        if (!rawFileContent || rawFileContent.trim().length === 0) {
          this.inMemoryObservationsMap.clear();
          this.isStorageHydrated = true;
          return;
        }

        const parsedSnapshot: PersistentLedgerSnapshot = JSON.parse(rawFileContent);
        this.inMemoryObservationsMap.clear();

        // Populate in-memory map keyed by observationId for O(1) deduplication
        if (Array.isArray(parsedSnapshot.observations)) {
          for (const observation of parsedSnapshot.observations) {
            this.inMemoryObservationsMap.set(observation.observationId, observation);
          }
        }
      } catch (hydrationError) {
        // Watch out: If power failed during unatomic write, fallback safely
        console.warn(
          `[PersistentObservationStore] Warning: Failed to parse ${this.storageFilePath}, initiating recovery:`,
          (hydrationError as Error).message
        );
        this.inMemoryObservationsMap.clear();
      }
    } else {
      this.inMemoryObservationsMap.clear();
      this.lastObservedFileMtimeMs = 0;
    }

    this.isStorageHydrated = true;
  }

  /**
   * Refreshes in-memory cache if the persistent file was modified on disk by another process.
   */
  private synchronizeDiskStateIfModified(): void {
    if (!fs.existsSync(this.storageFilePath)) {
      if (this.inMemoryObservationsMap.size > 0) {
        this.inMemoryObservationsMap.clear();
        this.lastObservedFileMtimeMs = 0;
      }
      return;
    }

    const currentStats = fs.statSync(this.storageFilePath);
    if (currentStats.mtimeMs > this.lastObservedFileMtimeMs || !this.isStorageHydrated) {
      this.hydrateFromPersistentDisk();
    }
  }

  /**
   * Ingests a new observation record into the ledger.
   * Enforces deduplication: if an observation with the same observationId or
   * identical (metricKey, timestampMs, numericValue) exists, it is ignored cleanly.
   * 
   * Returns true if newly ingested and persisted, false if duplicate skipped.
   */
  public ingestObservation(observation: TemporalObservationRecord): boolean {
    this.synchronizeDiskStateIfModified();

    // Check 1: Direct key collision on observationId
    if (this.inMemoryObservationsMap.has(observation.observationId)) {
      // Don't re-save or duplicate history
      return false;
    }

    // Check 2: Content fingerprint check to prevent duplicates with generated random suffixes
    for (const existingRecord of this.inMemoryObservationsMap.values()) {
      if (
        existingRecord.metricKey === observation.metricKey &&
        existingRecord.timestampMs === observation.timestampMs &&
        Math.abs(existingRecord.numericValue - observation.numericValue) < 0.000001
      ) {
        return false;
      }
    }

    // Store in-memory
    this.inMemoryObservationsMap.set(observation.observationId, observation);

    // Commit atomically to disk
    this.commitToPersistentDisk(observation.metricKey);
    return true;
  }

  /**
   * Flushes current observations atomically to disk.
   * Uses write-to-temporary followed by renameSync to guarantee zero half-written files.
   */
  private commitToPersistentDisk(activeMetricKey: string): void {
    const allRecordsChronological = Array.from(this.inMemoryObservationsMap.values()).sort((a, b) => {
      // Primary sort by timestamp, secondary sort by observationId for deterministic stability
      if (a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs;
      }
      return a.observationId.localeCompare(b.observationId);
    });

    const snapshotPayload: PersistentLedgerSnapshot = {
      version: 1,
      metricKey: activeMetricKey,
      lastPersistedAt: new Date().toISOString(),
      totalObservationsIngested: allRecordsChronological.length,
      observations: allRecordsChronological,
    };

    const serializedPayload = JSON.stringify(snapshotPayload, null, 2);

    // Write to temporary staging file first
    fs.writeFileSync(this.temporaryFilePath, serializedPayload, 'utf-8');

    // Atomic filesystem swap guarantees consistency even during sudden sigkills
    fs.renameSync(this.temporaryFilePath, this.storageFilePath);

    if (fs.existsSync(this.storageFilePath)) {
      this.lastObservedFileMtimeMs = fs.statSync(this.storageFilePath).mtimeMs;
    }
  }

  /**
   * Retrieves all chronological observations for a given metric.
   */
  public queryObservationsForMetric(metricKey: string): TemporalObservationRecord[] {
    this.synchronizeDiskStateIfModified();

    return Array.from(this.inMemoryObservationsMap.values())
      .filter((record) => record.metricKey === metricKey)
      .sort((a, b) => {
        if (a.timestampMs !== b.timestampMs) {
          return a.timestampMs - b.timestampMs;
        }
        return a.observationId.localeCompare(b.observationId);
      });
  }

  /**
   * Returns total count of all persisted observations across all metrics.
   */
  public getStoredObservationsCount(): number {
    return this.inMemoryObservationsMap.size;
  }

  /**
   * Retrieves the physical path to the persistence file on disk.
   */
  public getPersistentStorageFilePath(): string {
    return this.storageFilePath;
  }

  /**
   * Purges persistent storage (primarily used in test fixtures and demo resets).
   */
  public purgeLedger(): void {
    this.inMemoryObservationsMap.clear();
    if (fs.existsSync(this.storageFilePath)) {
      fs.unlinkSync(this.storageFilePath);
    }
    if (fs.existsSync(this.temporaryFilePath)) {
      fs.unlinkSync(this.temporaryFilePath);
    }
  }
}
