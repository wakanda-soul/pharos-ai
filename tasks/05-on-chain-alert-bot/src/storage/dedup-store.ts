import fs from "fs";
import path from "path";

interface StoredEntry {
  id: string;
  firstSeenAt: string;
  lastAlertedAt: string;
  count: number;
}

export class DedupStore {
  private cachePath: string;
  private entries: Map<string, StoredEntry> = new Map();

  constructor(customPath?: string) {
    this.cachePath = customPath || path.resolve(process.cwd(), ".state", "alert-dedup-cache.json");
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, "utf-8");
        const list: StoredEntry[] = JSON.parse(raw);
        for (const item of list) {
          this.entries.set(item.id, item);
        }
      }
    } catch {
      // In case of corrupt file, reset gracefully
      this.entries.clear();
    }
  }

  public save(): void {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Keep most recent 5,000 items
      const list = Array.from(this.entries.values());
      const trimmed = list.slice(-5000);

      fs.writeFileSync(this.cachePath, JSON.stringify(trimmed, null, 2), "utf-8");
    } catch (err) {
      console.error(`[DedupStore] Failed to persist dedup state:`, err);
    }
  }

  public has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Evaluates if an alert should be sent or suppressed to prevent repeat spam.
   * @param id Unique fingerprint (e.g. "tx:<hash>:<index>" or "price:ETH/USD:<direction>")
   * @param cooldownSeconds Cooldown for repeating state breaches. If 0 or undefined, one-shot dedup.
   */
  public shouldAlert(id: string, cooldownSeconds?: number): boolean {
    const now = Date.now();
    const existing = this.entries.get(id);

    if (!existing) {
      this.entries.set(id, {
        id,
        firstSeenAt: new Date(now).toISOString(),
        lastAlertedAt: new Date(now).toISOString(),
        count: 1,
      });
      this.save();
      return true;
    }

    // If no cooldown specified, permanent deduplication (one-shot per event)
    if (!cooldownSeconds || cooldownSeconds <= 0) {
      return false;
    }

    const lastAlertTime = new Date(existing.lastAlertedAt).getTime();
    const elapsedSeconds = (now - lastAlertTime) / 1000;

    if (elapsedSeconds >= cooldownSeconds) {
      existing.lastAlertedAt = new Date(now).toISOString();
      existing.count += 1;
      this.entries.set(id, existing);
      this.save();
      return true;
    }

    // Still in cooldown period
    return false;
  }

  public getCount(): number {
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
    try {
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
    } catch {
      // ignore
    }
  }
}
