import { ActionProposal } from './types.js';

/**
 * Predefined realistic scenarios demonstrating Policy Gatekeeper enforcement.
 * Demonstrates:
 * 1. An allowed compliant action receiving an authorization ticket.
 * 2. Spend Limit Denial (transfer exceeds allowed token/PROS threshold).
 * 3. Allowlist Denial (contract is blacklisted / not in allowlist).
 * 4. Time Window Denial (execution attempted during off-hours freeze).
 */

export const SCENARIO_ALLOWED_TRANSACTION: ActionProposal = {
  actionId: 'prop-allow-01',
  agentId: 'agent-treasury-rebalancer',
  actionType: 'USDC_TREASURY_TRANSFER',
  targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Pharos Native USDC
  recipientAddress: '0x6119871b4eb66db137dcfad59655853ea6fe58ce', // Enterprise Treasury Hot Wallet
  functionSelector: 'transfer(address,uint256)',
  calldata: '0xa9059cbb0000000000000000000000006119871b4eb66db137dcfad59655853ea6fe58ce000000000000000000000000000000000000000000000000000000001dcd6500',
  nativeValuePros: 0,
  tokenValueUsdc: 500.0, // <= 1000 limit
  timestamp: '2026-11-02T14:30:00Z', // 14:30 UTC on Monday (within 08:00 - 22:00 UTC)
  description: 'Routine liquidity allocation of 500 USDC to verified operational hot wallet.',
};

export const SCENARIO_DENY_SPEND_LIMIT: ActionProposal = {
  actionId: 'prop-deny-spend-02',
  agentId: 'agent-arbitrage-bot',
  actionType: 'EXCESSIVE_TREASURY_TRANSFER',
  targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Pharos Native USDC
  recipientAddress: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  functionSelector: 'transfer(address,uint256)',
  calldata: '0xa9059cbb0000000000000000000000006119871b4eb66db137dcfad59655853ea6fe58ce000000000000000000000000000000000000000000000000000000012a05f200',
  nativeValuePros: 0,
  tokenValueUsdc: 5000.0, // EXCEEDS 1,000 USDC limit!
  timestamp: '2026-11-02T15:00:00Z',
  description: 'Unusual out-of-bounds transfer of 5,000 USDC attempting to bypass normal tranches.',
};

export const SCENARIO_DENY_ALLOWLIST: ActionProposal = {
  actionId: 'prop-deny-allowlist-03',
  agentId: 'agent-speculative-yield',
  actionType: 'CALL_UNVERIFIED_CONTRACT',
  targetContract: '0x936564245b69f5a293b42cbd752e0ee3bb68b470', // Pharos Reverting Troll Contract (Blacklisted)
  recipientAddress: '0x936564245b69f5a293b42cbd752e0ee3bb68b470',
  functionSelector: 'executeRebalance(uint256,address)',
  calldata: '0x',
  nativeValuePros: 1.0,
  tokenValueUsdc: 0,
  timestamp: '2026-11-02T16:00:00Z',
  description: 'Yield farm deposit to unverified blacklisted troll address.',
};

export const SCENARIO_DENY_TIME_WINDOW: ActionProposal = {
  actionId: 'prop-deny-timewindow-04',
  agentId: 'agent-nightly-indexer',
  actionType: 'OFF_HOURS_SETTLEMENT',
  targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Pharos Native USDC
  recipientAddress: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  functionSelector: 'transfer(address,uint256)',
  calldata: '0xa9059cbb0000000000000000000000006119871b4eb66db137dcfad59655853ea6fe58ce0000000000000000000000000000000000000000000000000000000005f5e100',
  nativeValuePros: 0,
  tokenValueUsdc: 100.0,
  timestamp: '2026-11-02T03:15:00Z', // 03:15 UTC (Night freeze: outside 08:00 - 22:00 UTC)
  description: 'Automated settlement attempt triggered during nighttime operational maintenance freeze.',
};

export const DEMO_SCENARIOS = [
  SCENARIO_ALLOWED_TRANSACTION,
  SCENARIO_DENY_SPEND_LIMIT,
  SCENARIO_DENY_ALLOWLIST,
  SCENARIO_DENY_TIME_WINDOW,
];
