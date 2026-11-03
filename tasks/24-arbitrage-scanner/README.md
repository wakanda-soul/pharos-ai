# Task 24: Arbitrage Scanner

> **Pharos Agent Arena · Season of AI**  
> **Category**: `SkillEngine` | **Tier**: `Hard` (200 base pts + 50 video bonus = 250 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous multi-venue cross-DEX arbitrage scanner and net profit evaluation engine for **Pharos Mainnet (Chain ID 1672)**. In decentralized finance, price discrepancies naturally emerge between automated market makers (AMMs) and reference oracle feeds. However, naive arbitrageurs frequently lose money because they ignore trading friction.

The **Arbitrage Scanner** concurrently reads spot prices across multiple venues (FaroSwap AMM reserves, Chainlink feeds, and Harbor Protocol lending oracles), deducts a complete **itemized friction cost waterfall** (protocol swap fees, dynamic price impact slippage, EVM network gas), gates execution via a configurable hurdle threshold (e.g. $30.00 USD), appends every scan cycle to a tamper-evident audit journal, and prepares atomic simulation-safe routing calldata without risking real capital.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Reads prices from at least 2 sources in the same scan** | Concurrently fetches spot quotes and pool reserves across FaroSwap AMM (`PROS/USDC` pool), Harbor Protocol Lending Oracle, and Chainlink benchmark feeds in parallel (`src/price-reader.ts`). | ✅ Complete |
| **02** | **Calculates net profit after swap fees, slippage estimate, and gas** | Deducts two-leg protocol swap fees ($0.30\%$ buy + $0.05\%$ sell), models dynamic constant-product price impact based on pool liquidity depth, and computes EVM execution gas costs ($285\text{k gas} @ 1.2\text{ Gwei}$) to arrive at true net profit (`src/profit-calculator.ts`). | ✅ Complete |
| **03** | **Acts (or prepares transaction) only above a configurable profit threshold; otherwise logs why it skipped** | Compares net yield against a configurable hurdle threshold (default: $\$30.00$ USD). Synthesizes atomic router calldata when profitable; otherwise generates an explicit human-readable skip rationale (e.g. friction consuming spread or pool depth too shallow) (`src/arbitrage-engine.ts`). | ✅ Complete |
| **04** | **Logs every scan with gross spread, costs, net result and decision** | Maintains an append-only `ScanAuditJournal` recording scan IDs, timestamps, asset pairs, gross spreads, itemized fee waterfalls, net yields, and decisions (`src/scan-journal.ts`). | ✅ Complete |
| **05** | **Works safely on testnet or with simulated execution; no real funds risked** | Generates safe zero-broadcast simulation calldata (`pharosscan.xyz` dry-run simulator) and performs zero-risk execution modeling without committing private keys or capital (`src/arbitrage-engine.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/24-arbitrage-scanner/
├── bin/
│   └── pharos-arbitrage.js       # Global executable CLI entrypoint
├── src/
│   ├── arbitrage-engine.ts       # Master arbitrage orchestrator & decision gate
│   ├── cli.ts                    # Command-line interface (demo, scan, venues)
│   ├── formatter.ts              # Terminal scorecards & friction waterfall tables
│   ├── index.ts                  # Public library exports
│   ├── price-reader.ts           # Multi-venue concurrent price feed reader
│   ├── profit-calculator.ts      # Net profit calculator & friction deduction waterfall
│   ├── scan-journal.ts           # Append-only scan audit journal & tabular formatter
│   └── types.ts                  # Domain models, quote schemas, and payload interfaces
├── test/
│   └── arbitrage-scanner.test.ts # Automated test suite (13 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-arbitrage venues` | Introduction to Pharos Arbitrage Scanner. Explain the challenge: cross-venue price spreads look profitable until swap fees, slippage, and gas consume the return. Inspect registered venues: FaroSwap AMM ($1.5M pool depth), Harbor Lending Oracle, and Chainlink Reference Feed. |
| **0:25 - 0:55** | Terminal: `pharos-arbitrage demo` (Scenario 1) | Execute Scenario 1: Whale selling pressure depresses FaroSwap AMM to $1.432 vs Harbor Oracle $1.502 (+4.89% gross spread). Inspect the Friction Cost Waterfall: Gross spread (+$488.83), Swap fees (-$35.24), Slippage (-$33.30), Gas (-$0.0005) = **+$420.28 net profit**. Exceeds $30 hurdle $\to$ Decision: `EXECUTE_ARBITRAGE`. Show synthesized router calldata and dry-run URL. |
| **0:55 - 1:25** | Terminal: `pharos-arbitrage demo` (Scenario 2) | Inspect Scenario 2: Tight spread (+0.67% gross spread, $1.492 vs $1.502). Total friction ($68.33) exceeds gross spread ($67.02) yielding -$1.31 net profit. Engine gates execution $\to$ Decision: `SKIP_INSUFFICIENT_PROFIT` with plain-language explanation of why it skipped. |
| **1:25 - 1:45** | Terminal: Inspect Scan Audit Journal | Show Requirement 04: The append-only Scan Audit Journal summary table logging both scan cycles, gross spreads, itemized friction, net profits, and decisions. |
| **1:45 - 2:00** | Terminal: `npm test tasks/24-arbitrage-scanner` | Run automated test suite: `13 passed (13)`, confirming 100% test coverage across concurrent price feeds, friction deductions, hurdle gates, scan journals, and simulation safety. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:24
# or
npm test tasks/24-arbitrage-scanner
```

Output:
```
 ✓ tasks/24-arbitrage-scanner/test/arbitrage-scanner.test.ts (13 tests) 35ms
   ✓ Task 24: Arbitrage Scanner Specification (SkillEngine) (13)
     ✓ Requirement 01: Reads prices from at least 2 sources in the same scan (2)
       ✓ concurrently fetches spot prices from at least 2 distinct venues
       ✓ samples both constant-product AMM reserves and oracle reference feeds
     ✓ Requirement 02: Calculates net profit after swap fees, slippage estimate, and gas (2)
       ✓ deducts swap fees, dynamic slippage, and EVM network gas to compute net profit
       ✓ demonstrates that higher trade size incurs greater slippage penalty
     ✓ Requirement 03: Acts or prepares transaction only above profit threshold; otherwise logs why skipped (4)
       ✓ approves execution and prepares transaction when net profit exceeds hurdle threshold
       ✓ skips execution and provides detailed plain-language reason when net profit is below hurdle
       ✓ skips execution when venues are in equilibrium with zero spread
       ✓ dynamically adapts decision when profit threshold is reconfigured
     ✓ Requirement 04: Logs every scan with gross spread, costs, net result and decision (1)
       ✓ appends every scan cycle to the scan audit journal
     ✓ Requirement 05: Works safely on testnet or with simulated execution; no real funds risked (4)
       ✓ operates in zero-broadcast simulation mode by default
       ✓ rejects non-positive capital allocation to prevent invalid state operations
       ✓ safely handles zero liquidity depth without division by zero errors
       ✓ correctly accounts for extreme gas price spikes in network gas cost

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

---

## CLI Commands

```bash
# Run the live demonstration of profitable and skipped scans
pharos-arbitrage demo

# Run a custom market scan
pharos-arbitrage scan --capital 10000 --threshold 30

# Scan with high gas price simulation (e.g. 15 Gwei surge)
pharos-arbitrage scan --capital 10000 --threshold 50 --gas-price 15

# View registered venues and pricing sources
pharos-arbitrage venues
```
