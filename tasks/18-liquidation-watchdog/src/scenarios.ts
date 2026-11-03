/**
 * Production lending position scenarios for demonstration and simulation.
 */

export interface WatchdogSimulationScenario {
  readonly title: string;
  readonly description: string;
  readonly borrowerAddress: `0x${string}`;
  readonly collateralAmount: number; // e.g. 10 WPROS
  readonly debtAmount: number; // e.g. 12,000 USDC
  readonly collateralPriceUsd: number;
  readonly liquidationThreshold: number; // 0.85
  readonly expectedRisk: string;
}

export const WATCHDOG_SCENARIOS: WatchdogSimulationScenario[] = [
  {
    title: 'Baseline Solvent Position',
    description: 'Borrower with 10 WPROS ($2,300) collateral and $12,000 USDC debt. Healthy margin.',
    borrowerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    collateralAmount: 10.0,
    debtAmount: 12000.0,
    collateralPriceUsd: 2300.0, // Collateral = $23,000. HF = (23,000 * 0.85) / 12,000 = 1.629 (SAFE)
    liquidationThreshold: 0.85,
    expectedRisk: 'SAFE',
  },
  {
    title: 'Market Pullback — Warning Threshold Breached',
    description: 'WPROS drops from $2,300 to $1,750 (-23.9%). Health Factor drops below 1.30 warning trigger.',
    borrowerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    collateralAmount: 10.0,
    debtAmount: 12000.0,
    collateralPriceUsd: 1750.0, // Collateral = $17,500. HF = (17,500 * 0.85) / 12,000 = 1.239 (WARNING)
    liquidationThreshold: 0.85,
    expectedRisk: 'WARNING',
  },
  {
    title: 'Volatility Spike — Critical Threshold Breached',
    description: 'WPROS drops further to $1,500 (-34.7%). Health Factor drops below 1.10 critical trigger.',
    borrowerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    collateralAmount: 10.0,
    debtAmount: 12000.0,
    collateralPriceUsd: 1500.0, // Collateral = $15,000. HF = (15,000 * 0.85) / 12,000 = 1.062 (CRITICAL)
    liquidationThreshold: 0.85,
    expectedRisk: 'CRITICAL',
  },
  {
    title: 'Flash Crash — Liquidation Imminent',
    description: 'WPROS crashes to $1,350 (-41.3%). Health Factor drops below 1.00 (underwater position).',
    borrowerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    collateralAmount: 10.0,
    debtAmount: 12000.0,
    collateralPriceUsd: 1350.0, // Collateral = $13,500. HF = (13,500 * 0.85) / 12,000 = 0.956 (IMMINENT)
    liquidationThreshold: 0.85,
    expectedRisk: 'LIQUIDATION_IMMINENT',
  },
];
