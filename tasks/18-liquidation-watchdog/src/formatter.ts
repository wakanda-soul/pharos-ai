import {
  LendingPositionSnapshot,
  WatchdogThresholdConfig,
} from './types.js';

export class WatchdogFormatter {
  static formatHeader(): string {
    return [
      '╔══════════════════════════════════════════════════════════════════════════════╗',
      '║            PHAROS AUTONOMOUS LIQUIDATION WATCHDOG SENTINEL                   ║',
      '║        Real-Time Lending Risk Monitoring & Actionable Debt Advice            ║',
      '╚══════════════════════════════════════════════════════════════════════════════╝',
    ].join('\n');
  }

  static formatConfig(config: WatchdogThresholdConfig): string {
    return [
      '┌─ ACTIVE WATCHDOG THRESHOLDS (Requirement 02) ───────────────────────────────┐',
      `│ Warning Health Factor Trigger:  ${config.warningHealthFactor.toFixed(2)}                                        │`,
      `│ Critical Health Factor Trigger: ${config.criticalHealthFactor.toFixed(2)}                                        │`,
      `│ Target Safe Restoration Target: ${config.targetSafeHealthFactor.toFixed(2)}                                        │`,
      '└─────────────────────────────────────────────────────────────────────────────┘',
    ].join('\n');
  }

  static formatPositionTable(positions: LendingPositionSnapshot[]): string {
    const lines: string[] = [];
    lines.push('Borrower Address    | Collateral Val | Debt Val     | Price   | Health Factor | Status');
    lines.push('───────────────────────────────────────────────────────────────────────────────────────');
    for (const pos of positions) {
      const addrShort = `${pos.borrowerAddress.slice(0, 10)}...${pos.borrowerAddress.slice(-4)}`;
      const colVal = `$${pos.collateralValueUsd.toFixed(0)}`.padEnd(14);
      const debtVal = `$${pos.debtValueUsd.toFixed(0)}`.padEnd(12);
      const price = `$${pos.collateralPriceUsd.toFixed(0)}`.padEnd(7);
      const hf = pos.healthFactor.toFixed(3).padEnd(13);

      let status = '✓ SAFE';
      if (pos.healthFactor < 1.0) {
        status = '💀 LIQUIDATE';
      } else if (pos.healthFactor < 1.10) {
        status = '🚨 CRITICAL';
      } else if (pos.healthFactor < 1.30) {
        status = '⚠️ WARNING';
      }

      lines.push(`${addrShort} | ${colVal} | ${debtVal} | ${price} | ${hf} | ${status}`);
    }
    return lines.join('\n');
  }
}
