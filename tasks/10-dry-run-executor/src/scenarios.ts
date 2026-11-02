import { encodeFunctionData, parseAbi, parseUnits } from 'viem';
import { TransactionSimulationRequest } from './types.js';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)',
]);

const DUMMY_ABI = parseAbi([
  'function getReserves() external view returns (uint112, uint112, uint32)',
]);

export interface BenchmarkScenario {
  id: string;
  name: string;
  expectedOutcome: 'SUCCESS' | 'REVERT';
  description: string;
  request: TransactionSimulationRequest;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: 'SCENARIO_VALID_NATIVE_TRANSFER',
    name: 'Native PROS Micro-Transfer (Viable Transfer Interaction)',
    expectedOutcome: 'SUCCESS',
    description: 'Simulates a transaction from an on-chain funded address to verify execution gate clearance, gas fee calculation, and state diff.',
    request: {
      from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
      to: '0x000000000000000000000000000000000000dEaD',
      data: '0x',
      value: 1000000000000n, // 0.000001 PROS
      description: 'Transfer 0.000001 PROS to dead address to benchmark base EVM gas consumption and state change.',
    },
  },
  {
    id: 'SCENARIO_VALID_ORACLE_CALL',
    name: 'Chainlink Price Oracle Query (Contract Call)',
    expectedOutcome: 'SUCCESS',
    description: 'Simulates view execution on Pharos Chainlink Oracle contract without broadcasting.',
    request: {
      from: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
      to: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
      data: encodeFunctionData({
        abi: ORACLE_ABI,
        functionName: 'latestRoundData',
      }),
      value: 0n,
      description: 'Simulate latestRoundData() execution on Chainlink Oracle proxy.',
    },
  },
  {
    id: 'SCENARIO_REVERT_TRANSFER_EXCEEDS_BALANCE',
    name: 'ERC-20 Transfer Exceeding Balance (Insufficient Funds)',
    expectedOutcome: 'REVERT',
    description: 'Simulates transferring 1,000,000 USDC from an unfunded account to trigger and catch an on-chain revert.',
    request: {
      from: '0x000000000000000000000000000000000000dEaD',
      to: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Native USDC
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: ['0x1111111111111111111111111111111111111111', parseUnits('1000000', 6)],
      }),
      value: 0n,
      description: 'Attempt to transfer 1M USDC from empty address. Must revert and lock execution gate.',
    },
  },
  {
    id: 'SCENARIO_REVERT_CUSTOM_TROLL_CONTRACT',
    name: 'Pharos Troll Contract Call (Custom String Revert)',
    expectedOutcome: 'REVERT',
    description: 'Simulates calling an invalid selector on a known reverting contract to extract custom revert messages.',
    request: {
      from: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
      to: '0x936564245b69f5a293b42cbd752e0ee3bb68b470',
      data: encodeFunctionData({
        abi: DUMMY_ABI,
        functionName: 'getReserves',
      }),
      value: 0n,
      description: 'Call getReserves() on reverting contract. Must catch custom revert string.',
    },
  },
];
