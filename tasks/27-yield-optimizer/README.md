# Task 27: Yield Optimizer

> **Pharos Agent Arena · Season of AI**  
> **Category**: `DeFi / Portfolio` | **Tier**: `Hard` (200 base pts + 50 video bonus = 250 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous cross-protocol yield surveillance and capital rebalancing engine for **Pharos Mainnet (Chain ID 1672)**. In decentralized finance, migrating funds between vaults incurs exit fees, entry fees, and EVM gas costs. Naively moving capital whenever a higher nominal APY appears can easily lead to negative returns.

The **Yield Optimizer** compares live yields across at least 3 distinct venues (Harbor APC3M, Morpho Blue RockawayX, Harbor VRPC, FaroSwap LP), calculates an **itemized switching friction waterfall**, amortizes costs across user holding periods, outputs a clear recommendation (`REBALANCE_RECOMMENDED` with dollar net gain or `STAY_PUT` with plain-language explanation), and synthesizes a 3-step unsigned transaction pipeline ready for user signature without ever holding private keys.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Compares at least 3 yield sources using live on-chain data** | Ingests live APYs, TVLs, and fee tiers from 4 distinct venues: Harbor APC3M (13.8%), Morpho Blue RockawayX (9.4%), Harbor VRPC (16.5%), and FaroSwap LP (22.4%) (`src/yield-reader.ts`). | ✅ Complete |
| **02** | **Accounts for gas, entry/exit fees, and a minimum holding period before recommending a move** | Deducts exit fee from source vault, entry fee into target vault, and 320,000 gas units; computes exact break-even holding days and enforces vault lockup tenors (`src/friction-calculator.ts`, `src/optimizer-engine.ts`). | ✅ Complete |
| **03** | **Outputs a clear recommendation with expected net gain, or "stay put" with the reason** | Emits `REBALANCE_RECOMMENDED` with net profit ($), annualized net ROI, and break-even days when profitable; emits `STAY_PUT` with clear explanation when friction exceeds gain or horizon is too short (`src/optimizer-engine.ts`, `src/formatter.ts`). | ✅ Complete |
| **04** | **If executing: prepares transactions for user signature only. The agent never holds keys** | Strictly non-custodial: outputs 3-step unsigned transaction pipeline (Withdraw $\to$ Approve $\to$ Deposit) with ABI-encoded calldata and ready-to-run Foundry `cast send` commands (`src/optimizer-engine.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/27-yield-optimizer/
├── bin/
│   └── pharos-yield.js           # Global executable CLI entrypoint
├── src/
│   ├── cli.ts                    # Command-line interface (demo, compare, rebalance, optimize)
│   ├── formatter.ts              # Terminal scorecards & friction waterfall tables
│   ├── friction-calculator.ts    # Exit/entry fee and gas cost calculator
│   ├── index.ts                  # Public library exports
│   ├── optimizer-engine.ts       # Rebalancing logic, holding amortization & calldata generator
│   ├── types.ts                  # Domain models, report schemas & calldata interfaces
│   └── yield-reader.ts           # Multi-venue on-chain yield reader
├── test/
│   └── yield-optimizer.test.ts   # Automated test suite (13 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-yield compare` | Introduction to Pharos Yield Optimizer. Explain the challenge: switching vaults incurs exit fees, entry fees, and gas that can wipe out higher APYs. Inspect live Pharos yield venues: Harbor APC3M (13.8%), Morpho Blue (9.4%), Harbor VRPC (16.5%), and FaroSwap (22.4%). |
| **0:25 - 0:55** | Terminal: `pharos-yield demo` (Scenario 1) | Inspect Scenario 1: Rebalance Recommended. User has $10,000 in Morpho Blue (9.4%) with a 90-day holding horizon. Target: Harbor VRPC (16.5%, +7.1% spread). Review the Itemized Friction Waterfall: Entry fee ($15.00) + Gas ($0.0006) = $15.00 friction. Gross gain is $175.07 $\to$ **+$160.07 USD net gain** (+6.49% net APY, break-even 8 days). |
| **0:55 - 1:25** | Terminal: `pharos-yield demo` (Unsigned Calldata) | Show Requirement 04: The non-custodial execution pipeline. Inspect the 3 prepared unsigned transactions (Step 1: Withdraw from Morpho, Step 2: Approve USDC for Harbor VRPC, Step 3: Deposit into Harbor VRPC) with verified contract addresses, raw calldata, and copy-paste Foundry `cast send` commands. Emphasize zero key custody. |
| **1:25 - 1:45** | Terminal: `pharos-yield demo` (Scenario 2) | Inspect Scenario 2: Stay Put. User has $2,000 in Morpho Blue with only a 3-day holding horizon. Moving to Harbor APC3M generates $0.72 in gross yield, but incurs $2.00 in friction $\to$ projects **-$1.28 net loss**. The optimizer gates execution and outputs `STAY_PUT` with a clear explanation of why switching is not worth it. |
| **1:45 - 2:00** | Terminal: `npm test tasks/27-yield-optimizer` | Run automated test suite: `13 passed (13)`, confirming 100% test coverage across 3+ venue comparison, friction deduction, holding period amortization, stay-put rationale, and non-custodial unsigned calldata synthesis. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:27
# or
npm test tasks/27-yield-optimizer
```

Output:
```
 ✓ tasks/27-yield-optimizer/test/yield-optimizer.test.ts (13 tests) 53ms
   ✓ Task 27: Yield Optimizer Specification (DeFi / Portfolio) (13)
     ✓ Requirement 01: Compares at least 3 yield sources using live on-chain data (3)
       ✓ returns at least 3 distinct live yield venues for USDC
       ✓ verifies all venues contain verified EVM contract addresses and confirmed block numbers
       ✓ rejects venue sets with fewer than 3 yield sources
     ✓ Requirement 02: Accounts for gas, entry/exit fees, and holding period (3)
       ✓ calculates itemized friction including exit fee, entry fee, and gas costs
       ✓ demonstrates holding period amortization: longer holding horizon increases net yield
       ✓ enforces lockup tenor constraints: rejects rebalancing if lockup tenor exceeds holding period
     ✓ Requirement 03: Outputs clear recommendation with net gain, or stay put with reason (4)
       ✓ outputs REBALANCE_RECOMMENDED with expected net gain when spread clears friction
       ✓ outputs STAY_PUT with reason when holding period is too short to amortize friction
       ✓ outputs STAY_PUT when target venue offers lower or equal APY
       ✓ outputs STAY_PUT when net gain fails to clear configured hurdle ($25.00)
     ✓ Requirement 04: Prepares transactions for user signature only; never holds keys (3)
       ✓ strictly asserts agentHoldsKeys === false on all evaluations
       ✓ synthesizes 3-step unsigned transaction sequence with valid hex calldata and cast commands
       ✓ guarantees zero private key custody across all engine instances

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

---

## CLI Commands

```bash
# Run interactive live demonstration (Scenario 1 & 2)
pharos-yield demo

# Compare live yields across all monitored Pharos venues
pharos-yield compare

# Rebalance evaluation for custom capital and horizon
pharos-yield rebalance --from morpho:rockawayx-usdc --to harbor:vrpc --capital 10000 --days 90

# Optimize capital across all available candidate venues
pharos-yield optimize --from morpho:rockawayx-usdc --capital 25000 --days 180
```
