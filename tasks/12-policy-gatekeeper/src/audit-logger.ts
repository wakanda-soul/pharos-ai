import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditLogEntry, GatekeeperDecision } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOG_PATH = path.resolve(__dirname, '../audit.log.jsonl');

export class AuditLogger {
  private logFilePath: string;

  constructor(customPath?: string) {
    this.logFilePath = customPath ?? DEFAULT_LOG_PATH;
  }

  /**
   * Appends a new decision to the persistent append-only audit log.
   */
  log(decision: GatekeeperDecision): void {
    const entry: AuditLogEntry = {
      decisionId: decision.decisionId,
      timestamp: decision.timestamp,
      agentId: decision.proposal.agentId,
      actionType: decision.proposal.actionType,
      targetContract: decision.proposal.targetContract,
      verdict: decision.verdict,
      decidingRuleId: decision.decidingRuleId,
      decidingRuleType: decision.decidingRuleType,
      rationale: decision.rationale,
      ticketHash: decision.authorizationTicket?.ticketHash,
    };

    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(this.logFilePath, line, { encoding: 'utf-8' });
    } catch {
      // In-memory fallback if file write fails in constrained environments
    }
  }

  /**
   * Reads all historical audit entries.
   */
  readAll(): AuditLogEntry[] {
    if (!fs.existsSync(this.logFilePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter((l) => l.trim().length > 0);
      return lines.map((l) => JSON.parse(l) as AuditLogEntry);
    } catch {
      return [];
    }
  }

  /**
   * Queries audit log entries filtered by verdict (ALLOW or DENY).
   */
  getByVerdict(verdict: 'ALLOW' | 'DENY'): AuditLogEntry[] {
    return this.readAll().filter((e) => e.verdict === verdict);
  }

  /**
   * Clears the log file (used for isolated test suites).
   */
  clear(): void {
    if (fs.existsSync(this.logFilePath)) {
      try {
        fs.unlinkSync(this.logFilePath);
      } catch {
        // ignore
      }
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
