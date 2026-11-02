import { QueuedTransaction } from './types.js';

export interface OptimizerBenchmarkScenario {
  id: string;
  name: string;
  description: string;
  transaction: QueuedTransaction;
  simulationTicks: Array<{ timestampMs: number; gasPriceGwei: number }>;
}

const NOW = 1762080000000; // Reference baseline timestamp

export const SCENARIO_OPPORTUNISTIC_DIP: OptimizerBenchmarkScenario = {
  id: 'SCENARIO_OPPORTUNISTIC_DIP',
  name: 'Opportunistic Dip Execution (Gas Savings Harvested)',
  description:
    'Transaction enqueued during local gas spike (18.0 Gwei) with a 60-second deadline. Gas price dips to 10.5 Gwei within 25 seconds, triggering an optimal early submission and saving 41.7% on execution fees.',
  transaction: {
    txId: 'tx-opt-dip-001',
    from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
    to: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Pharos USDC
    data: '0xa9059cbb0000000000000000000000006119871b4eb66db137dcfad59655853ea6fe58ce0000000000000000000000000000000000000000000000000000000005f5e100',
    value: 0n,
    gasLimit: 65000n, // ERC-20 transfer
    description: 'Non-urgent USDC treasury allocation',
    createdAt: NOW,
    deadline: NOW + 60000, // 60s deadline
    requestGasPriceGwei: 18.0,
    strategy: {
      type: 'DYNAMIC_DECAY',
      targetPercentile: 20,
      decayExponent: 2.0,
      safetyMarginMs: 2000,
    },
  },
  simulationTicks: [
    { timestampMs: NOW + 5000, gasPriceGwei: 17.5 },
    { timestampMs: NOW + 10000, gasPriceGwei: 16.2 },
    { timestampMs: NOW + 15000, gasPriceGwei: 14.8 },
    { timestampMs: NOW + 20000, gasPriceGwei: 13.0 },
    { timestampMs: NOW + 25000, gasPriceGwei: 10.5 }, // Favorable dip! Reservation curve is ~11.2 Gwei
    { timestampMs: NOW + 30000, gasPriceGwei: 11.0 },
    { timestampMs: NOW + 35000, gasPriceGwei: 12.5 },
  ],
};

export const SCENARIO_DEADLINE_FORCED_HIGH_GAS: OptimizerBenchmarkScenario = {
  id: 'SCENARIO_DEADLINE_FORCED_HIGH_GAS',
  name: 'Deadline Enforcement Under Persistent Congestion (Zero-Miss SLA)',
  description:
    'Transaction enqueued with a 40-second deadline. Network experiences sustained congestion with gas climbing to 25.0 Gwei. The engine holds the tx until the safety margin, then forces execution right at the deadline.',
  transaction: {
    txId: 'tx-deadline-forced-002',
    from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
    to: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3
    data: '0x',
    value: 1000000000000n,
    gasLimit: 250000n,
    description: 'Batch liquidation margin top-up',
    createdAt: NOW,
    deadline: NOW + 40000, // 40s deadline
    requestGasPriceGwei: 14.0,
    strategy: {
      type: 'DYNAMIC_DECAY',
      targetPercentile: 15,
      maxAcceptableGwei: 15.0, // Strict cap: only accept <= 15 Gwei unless forced by deadline
      decayExponent: 2.0,
      safetyMarginMs: 2000,
    },
  },
  simulationTicks: [
    { timestampMs: NOW + 5000, gasPriceGwei: 15.0 },
    { timestampMs: NOW + 12000, gasPriceGwei: 16.5 },
    { timestampMs: NOW + 20000, gasPriceGwei: 18.0 },
    { timestampMs: NOW + 28000, gasPriceGwei: 21.0 },
    { timestampMs: NOW + 35000, gasPriceGwei: 23.5 },
    { timestampMs: NOW + 38000, gasPriceGwei: 25.0 }, // Deadline safety threshold reached!
  ],
};

export const BENCHMARK_SCENARIOS = [
  SCENARIO_OPPORTUNISTIC_DIP,
  SCENARIO_DEADLINE_FORCED_HIGH_GAS,
];
