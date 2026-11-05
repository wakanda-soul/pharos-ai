import { PolicyConfig } from './types.js';

export const DEFAULT_POLICY: PolicyConfig = {
  policyId: 'POL-ENTERPRISE-TREASURY-01',
  name: 'Enterprise Agent Execution Policy',
  version: '1.2.0',
  description: 'Zero-trust governance policy enforcing multi-asset spend limits, contract allowlists, and operational time windows.',
  rules: {
    // Rule Type 1: Spend Limits
    spendLimits: {
      id: 'RULE_SPEND_LIMITS',
      name: 'Transaction Value & Spend Ceilings',
      maxPerTxNativePros: 10.0,
      maxPerTxTokenUsdc: 1000.0,
      maxGlobalPerTxUsd: 2500.0,
      rollingDailyBudgetUsd: 10000.0,
      description: 'Caps individual transaction outflows: Max 10 PROS, 1,000 USDC, or $2,500 USD total transaction value.',
    },

    // Rule Type 2: Allowlist & Security Boundary
    allowlist: {
      id: 'RULE_ALLOWLIST_SECURITY',
      name: 'Protocol & Recipient Security Boundary',
      allowedContracts: [
        '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3
        '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8', // Chainlink Price Oracle
        '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Native USDC Token
        '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29', // LINK Token
        '0xba3b00c3b0632b6fa622f990924976725227b68a', // FaroSwap DEX Router
        '0x6119871b4eb66db137dcfad59655853ea6fe58ce', // Verified Operator
      ],
      allowedRecipients: [
        '0x000000000000000000000000000000000000dEaD', // Burn / Dead Address
        '0x6119871b4eb66db137dcfad59655853ea6fe58ce', // Enterprise Treasury Hot Wallet
        '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932', // Cold Vault Reserve
      ],
      allowedFunctionSelectors: [
        'transfer(address,uint256)',
        'transferFrom(address,address,uint256)',
        'approve(address,uint256)',
        'latestRoundData()',
        'totalSupply()',
        'decimals()',
        'symbol()',
        'aggregate3((address,bool,bytes)[])',
        'executeRebalance(uint256,address)',
      ],
      blockedAddresses: [
        '0x936564245b69f5a293b42cbd752e0ee3bb68b470', // Pharos Reverting Troll Contract
        '0x6666666666666666666666666666666666666666', // Known Phishing / Exploiter Address
      ],
      description: 'Restricts interactions strictly to audited Pharos protocol contracts, approved recipients, and sanctioned functions.',
    },

    // Rule Type 3: Operational Time Windows
    timeWindow: {
      id: 'RULE_TIME_WINDOW_OPERATIONS',
      name: 'Operational Hours & Freeze Windows',
      allowedUtcHours: {
        start: 8, // 08:00 UTC
        end: 22,  // 22:00 UTC
      },
      allowedDaysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday (Weekdays)
      cooldownPeriodSeconds: 30,
      blackoutWindows: [
        {
          start: '2026-11-16T14:00:00Z',
          end: '2026-11-16T18:00:00Z',
          reason: 'Scheduled Hard Fork / Protocol Network Upgrade Window',
        },
      ],
      description: 'Authorizes agent execution only during active treasury operational windows (08:00 - 22:00 UTC, Weekdays).',
    },
  },
};
