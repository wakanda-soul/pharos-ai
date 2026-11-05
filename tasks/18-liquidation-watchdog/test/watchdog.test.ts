import { describe, it, expect, beforeEach } from 'vitest';
import { LiquidationWatchdogEngine } from '../src/watchdog-engine.js';
import { OnChainPositionReader } from '../src/position-reader.js';
import { LendingMathCalculator } from '../src/position-calculator.js';
import {
  ConsoleNotificationChannel,
  DiscordNotificationChannel,
  InMemoryAlertLedger,
} from '../src/alert-channels.js';
import {
  USDC_ASSET,
  WPROS_ASSET,
} from '../src/config.js';

describe('Task 18: Liquidation Watchdog Engine (Requirements 01-04)', () => {
  const ledger = new InMemoryAlertLedger();
  let watchdog: LiquidationWatchdogEngine;
  const positionReader = new OnChainPositionReader();
  const testBorrower = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`;

  beforeEach(() => {
    ledger.clear();
    watchdog = new LiquidationWatchdogEngine(
      {
        warningHealthFactor: 1.30,
        criticalHealthFactor: 1.10,
        targetSafeHealthFactor: 1.50,
      },
      [ledger]
    );
  });

  describe('Requirement 01: On-Chain Lending Position Reading & Health Factor Calculation', () => {
    it('should read position metrics and calculate collateral value, debt value, and health factor', async () => {
      // 5 WPROS collateral at $2,000 = $10,000 collateral value
      // $5,000 USDC debt
      // Liquidation Threshold = 0.85
      // Expected Health Factor = (10,000 * 0.85) / 5,000 = 1.70 (SAFE)
      const position = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        liquidationThreshold: 0.85,
        overrideCollateralPriceUsd: 2000.0,
      });

      expect(position.collateralValueUsd).toBe(10000.0);
      expect(position.debtValueUsd).toBe(5000.0);
      expect(position.healthFactor).toBe(1.70);
      expect(position.currentLtv).toBe(0.5); // 50% LTV
      // Liquidation Price = 5000 / (5.0 * 0.85) = $1,176.47
      expect(position.liquidationPriceUsd).toBe(1176.47);
    });

    it('should query live Chainlink oracle or realistic fallback without throwing', async () => {
      const price = await positionReader.fetchLiveOraclePriceUsd();
      expect(price).toBeGreaterThan(1000.0);
    });
  });

  describe('Requirement 02: Configurable Warning & Critical Thresholds', () => {
    it('should classify position as SAFE when Health Factor is above warning threshold (HF = 1.70 >= 1.30)', async () => {
      const safePosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 2000.0,
      });

      const outcome = await watchdog.evaluatePosition(safePosition);
      expect(outcome.riskLevel).toBe('SAFE');
      expect(outcome.alertDispatched).toBe(false);
      expect(ledger.dispatchedAlerts.length).toBe(0);
    });

    it('should trigger WARNING alert when Health Factor drops between critical and warning (1.10 <= HF = 1.25 < 1.30)', async () => {
      // Collateral price drops to $1,470:
      // Collateral Value = 5 * 1470 = $7,350
      // Debt Value = $5,000
      // HF = (7,350 * 0.85) / 5,000 = 1.2495 (~1.25)
      const warningPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1470.0,
      });

      const outcome = await watchdog.evaluatePosition(warningPosition);
      expect(outcome.riskLevel).toBe('WARNING');
      expect(outcome.alertDispatched).toBe(true);
      expect(outcome.alertPayload).toBeDefined();
      expect(ledger.dispatchedAlerts.length).toBe(1);
      expect(ledger.dispatchedAlerts[0].riskLevel).toBe('WARNING');
    });

    it('should trigger CRITICAL alert when Health Factor drops below critical threshold (HF = 1.05 < 1.10)', async () => {
      // Collateral price drops to $1,235:
      // Collateral Value = 5 * 1235 = $6,175
      // Debt Value = $5,000
      // HF = (6,175 * 0.85) / 5,000 = 1.049 (~1.05)
      const criticalPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1235.0,
      });

      const outcome = await watchdog.evaluatePosition(criticalPosition);
      expect(outcome.riskLevel).toBe('CRITICAL');
      expect(outcome.alertDispatched).toBe(true);
      expect(ledger.dispatchedAlerts.length).toBe(1);
      expect(ledger.dispatchedAlerts[0].riskLevel).toBe('CRITICAL');
    });

    it('should support custom institutional thresholds (e.g. warn at 1.45 and critical at 1.25)', async () => {
      const strictWatchdog = new LiquidationWatchdogEngine(
        {
          warningHealthFactor: 1.45,
          criticalHealthFactor: 1.25,
        },
        [ledger]
      );

      // HF = 1.40: In default engine this is SAFE (< 1.30), but in strict watchdog it triggers WARNING (< 1.45)
      const strictPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1647.0, // HF ~ 1.40
      });

      const outcome = await strictWatchdog.evaluatePosition(strictPosition);
      expect(outcome.riskLevel).toBe('WARNING');
    });

    it('should trigger LIQUIDATION_IMMINENT when Health Factor drops below 1.0 (underwater collateral)', async () => {
      // Collateral price crashes to $1,100 (below liquidation price $1,176.47):
      // Collateral Value = 5 * 1100 = $5,500
      // Debt Value = $5,000
      // HF = (5,500 * 0.85) / 5,000 = 0.935 (< 1.00)
      const underwaterPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1100.0,
      });

      const outcome = await watchdog.evaluatePosition(underwaterPosition);
      expect(outcome.riskLevel).toBe('LIQUIDATION_IMMINENT');
      expect(outcome.alertDispatched).toBe(true);
      expect(outcome.alertPayload?.bufferToLiquidationPercent).toContain('COLLATERAL UNDERWATER');
    });

    it('should track position evaluation history across market price transitions', async () => {
      // 1. Safe position ($2,000)
      const p1 = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 2000.0,
      });
      await watchdog.evaluatePosition(p1);

      // 2. Warning position ($1,470)
      const p2 = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1470.0,
      });
      await watchdog.evaluatePosition(p2);

      // 3. Critical position ($1,235)
      const p3 = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1235.0,
      });
      await watchdog.evaluatePosition(p3);

      const history = watchdog.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].alert).toBeUndefined(); // Safe: no alert
      expect(history[1].alert?.riskLevel).toBe('WARNING');
      expect(history[2].alert?.riskLevel).toBe('CRITICAL');
    });
  });

  describe('Requirement 03: Multi-Channel Alert Delivery with Timestamps', () => {
    it('should dispatch alert to console and discord channels with ISO timestamps and formatted numbers', async () => {
      const consoleChannel = new ConsoleNotificationChannel();
      const discordChannel = new DiscordNotificationChannel();

      const multiWatchdog = new LiquidationWatchdogEngine(
        { warningHealthFactor: 1.30, criticalHealthFactor: 1.10 },
        [consoleChannel, discordChannel, ledger]
      );

      const dangerPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1200.0,
      });

      const outcome = await multiWatchdog.evaluatePosition(dangerPosition);
      expect(outcome.alertDispatched).toBe(true);

      const alert = ledger.dispatchedAlerts[0];
      expect(alert.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(alert.protocol).toBe('Morpho Blue (Pharos)');
      expect(alert.borrowerAddress).toBe(testBorrower);
      expect(alert.collateralValueUsdFormatted).toContain('$6,000.00');
      expect(alert.debtValueUsdFormatted).toContain('$5,000.00');
    });
  });

  describe('Requirement 04: Concrete Actionable Remediation Suggestions', () => {
    it('should compute exact debt repayment and additional collateral needed to restore Health Factor to safe target', async () => {
      // Collateral = 5 WPROS at $1,470 = $7,350
      // Debt = $5,000 USDC
      // Current HF = 1.25. Target Safe HF = 1.50
      // Max Allowable Debt for HF 1.50 = (7350 * 0.85) / 1.50 = $4,165
      // Debt Repayment Needed = 5000 - 4165 = $835 USDC!
      // Required Collateral for HF 1.50 = (1.50 * 5000) / 0.85 = $8,823.53
      // Additional Collateral Needed = 8,823.53 - 7,350 = $1,473.53 (~1.0024 WPROS)!
      const warningPosition = await positionReader.readPosition({
        borrowerAddress: testBorrower,
        collateralAmountFormatted: 5.0,
        debtAmountFormatted: 5000.0,
        overrideCollateralPriceUsd: 1470.0,
      });

      const outcome = await watchdog.evaluatePosition(warningPosition);
      const action = outcome.alertPayload!.recommendedAction;

      expect(action.debtRepaymentNeededUsd).toBeCloseTo(835.0, 0);
      expect(action.debtRepaymentUnits).toBeCloseTo(835.0, 0);
      expect(action.debtAssetSymbol).toBe('USDC');

      expect(action.additionalCollateralNeededUsd).toBeCloseTo(1473.53, 0);
      expect(action.additionalCollateralUnits).toBeCloseTo(1.0024, 2);
      expect(action.collateralAssetSymbol).toBe('WPROS');

      // Verify the concrete action advice text
      expect(action.actionSummary).toContain('Repay $835.00 USDC');
      expect(action.actionSummary).toContain('add $1473.53 of WPROS');
      expect(action.actionSummary).toContain('restore Health Factor to safe target 1.50');
    });

    it('should handle zero debt safely without suggesting negative repayment', () => {
      const zeroDebtPosition = LendingMathCalculator.evaluatePositionMetrics({
        protocol: 'Harbor Lending',
        borrowerAddress: testBorrower,
        collateralAsset: WPROS_ASSET,
        debtAsset: USDC_ASSET,
        collateralAmountFormatted: 10.0,
        debtAmountFormatted: 0.0,
        collateralPriceUsd: 2200.0,
        debtPriceUsd: 1.0,
        liquidationThreshold: 0.85,
        blockNumber: 12345,
      });

      expect(zeroDebtPosition.healthFactor).toBe(999.0);
      const plan = LendingMathCalculator.calculateRemediationPlan(zeroDebtPosition, watchdog.getConfig());
      expect(plan.debtRepaymentNeededUsd).toBe(0);
      expect(plan.additionalCollateralNeededUsd).toBe(0);
    });
  });
});
