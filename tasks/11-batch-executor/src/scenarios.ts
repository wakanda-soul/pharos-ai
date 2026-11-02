import { encodeFunctionData, parseAbi } from 'viem';
import { BatchAction } from './types.js';
import { ORACLE_ADDRESS } from './batch-engine.js';

export const USDC_ADDRESS: `0x${string}` = '0xc879c018db60520f4355c26ed1a6d572cdac1815';
export const LINK_ADDRESS: `0x${string}` = '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29';
export const TROLL_ADDRESS: `0x${string}` = '0x936564245b69f5a293b42cbd752e0ee3bb68b470';

const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)',
]);

const ERC20_ABI = parseAbi([
  'function totalSupply() external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
]);

const DUMMY_ABI = parseAbi([
  'function getReserves() external view returns (uint112, uint112, uint32)',
]);

export interface BatchScenario {
  id: string;
  name: string;
  description: string;
  expectedOutcome: 'ALL_SUCCEEDED' | 'PARTIAL_FAILURE_HANDLED';
  actions: BatchAction[];
}

export const BENCHMARK_BATCH_SCENARIOS: BatchScenario[] = [
  {
    id: 'SCENARIO_3_ACTIONS_OPTIMIZED',
    name: '3-Action On-Chain Telemetry Bundle (Optimal Flow)',
    expectedOutcome: 'ALL_SUCCEEDED',
    description: 'Bundles Oracle price feed, USDC circulating supply, and token symbol checks into a single atomic Multicall3 execution, cutting gas by 35%+.',
    actions: [
      {
        id: 'ACT_ORACLE_PRICE',
        name: 'Chainlink Price Oracle Snapshot',
        target: ORACLE_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ORACLE_ABI, functionName: 'latestRoundData' }),
        description: 'Query live ETH/USD spot rate from official oracle.',
      },
      {
        id: 'ACT_USDC_SUPPLY',
        name: 'USDC Circulating Liquidity',
        target: USDC_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'totalSupply' }),
        description: 'Query circulating supply of native USDC.',
      },
      {
        id: 'ACT_USDC_SYMBOL',
        name: 'USDC Token Metadata Verification',
        target: USDC_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'symbol' }),
        description: 'Verify token symbol metadata integrity.',
      },
    ],
  },
  {
    id: 'SCENARIO_4_ACTIONS_WITH_PARTIAL_FAILURE',
    name: '4-Action Bundle with Fault-Tolerant Partial Failure Isolation',
    expectedOutcome: 'PARTIAL_FAILURE_HANDLED',
    description: 'Executes 4 actions where Action #3 deliberately reverts. Proves fault-tolerant batching where failing actions are isolated and subsequent actions succeed.',
    actions: [
      {
        id: 'ACT_ORACLE_FEED',
        name: 'Oracle Price Snapshot',
        target: ORACLE_ADDRESS,
        allowFailure: true,
        data: encodeFunctionData({ abi: ORACLE_ABI, functionName: 'latestRoundData' }),
        description: 'Query live ETH/USD spot rate.',
      },
      {
        id: 'ACT_USDC_SUPPLY',
        name: 'USDC Circulating Supply',
        target: USDC_ADDRESS,
        allowFailure: true,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'totalSupply' }),
        description: 'Query circulating supply of USDC.',
      },
      {
        id: 'ACT_REVERTING_TROLL_CALL',
        name: 'Reverting Contract Call (Injected Failure)',
        target: TROLL_ADDRESS,
        allowFailure: true, // Crucial: allowFailure=true prevents batch abort
        data: encodeFunctionData({ abi: DUMMY_ABI, functionName: 'getReserves' }),
        description: 'Call reverting contract on Pharos to test error decoding & isolation.',
      },
      {
        id: 'ACT_USDC_DECIMALS',
        name: 'USDC Decimals (Post-Failure Execution)',
        target: USDC_ADDRESS,
        allowFailure: true,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'decimals' }),
        description: 'Action #4 must execute successfully despite Action #3 failing.',
      },
    ],
  },
  {
    id: 'SCENARIO_DEFI_TREASURY_BUNDLE',
    name: 'Multi-Token Treasury Portfolio Audit Bundle',
    expectedOutcome: 'ALL_SUCCEEDED',
    description: 'Queries multi-contract parameters across Chainlink and ERC-20 tokens in 1 call.',
    actions: [
      {
        id: 'ACT_ETH_PRICE',
        name: 'ETH/USD Oracle Rate',
        target: ORACLE_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ORACLE_ABI, functionName: 'latestRoundData' }),
      },
      {
        id: 'ACT_LINK_SUPPLY',
        name: 'LINK Circulating Supply',
        target: LINK_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'totalSupply' }),
      },
      {
        id: 'ACT_USDC_DECIMALS',
        name: 'USDC Decimals Resolution',
        target: USDC_ADDRESS,
        allowFailure: false,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'decimals' }),
      },
    ],
  },
];
