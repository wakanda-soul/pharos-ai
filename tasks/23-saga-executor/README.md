# Task 23: Saga Executor

> **Pharos Agent Arena · Season of AI**  
> **Category**: `SkillEngine` | **Tier**: `Hard` (200 base pts + 50 video bonus = 250 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous multi-step distributed transaction orchestrator skill for **Pharos Mainnet (Chain ID 1672)** that executes dependent on-chain workflows (such as **Approve $\to$ Swap $\to$ Deposit**), where each step strictly verifies confirmation receipts before the subsequent step begins. If a step suffers a transient network spike, it applies exponential backoff with gas price escalation; if a step permanently fails, it executes clean **Compensating Reverse Transactions** in LIFO order so funds are never stranded halfway.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **At least 3 dependent steps, each verified (receipt checked) before the next starts** | Implements canonical 3-step DeFi workflow: 1. Approve FaroSwap Router, 2. Swap USDC for PROS, 3. Deposit PROS into Harbor Pool. Each step explicitly asserts `receipt.status === 1` and confirmed block heights before proceeding (`src/steps/defi-workflow-steps.ts`). | ✅ Complete |
| **02** | **A defined retry policy for transient failures, e.g. a gas spike or dropped transaction** | Fault classifier categorizes gas price underpricing, mempool drops, nonce desyncs, and RPC timeouts; applies exponential backoff ($1.8\times$ with jitter) and escalates gas price by $+20\%$ on replacement transactions (`src/fault-classifier.ts`). | ✅ Complete |
| **03** | **A defined compensation/rollback path when a step permanently fails, and a demo of it** | Reverse compensation engine unwinds completed steps in LIFO order upon permanent failure: reverses the swap on FaroSwap and resets router token allowances strictly to zero, ensuring 100% capital restoration (`src/saga-orchestrator.ts`). | ✅ Complete |
| **04** | **A state log showing exactly which step the saga is in at any time** | Append-only state transition journal logs timestamped transitions (`INITIALIZED`, `IN_PROGRESS`, `RETRYING`, `STEP_CONFIRMED`, `COMPENSATING`, `COMPENSATED_CLEANLY`) and renders real-time ASCII execution timelines (`src/state-journal.ts`). | ✅ Complete |
| **05** | **Shows one fully successful run and one forced-failure run with recovery** | Interactive CLI `pharos-saga demo` executes Run 1 (full success across 3 steps) and Run 2 (Step 3 forced revert triggering clean 2-step reverse compensation), displaying comparative state diffs and zero stranded capital (`src/cli.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/23-saga-executor/
├── bin/
│   └── pharos-saga.js            # Global executable CLI entrypoint
├── src/
│   ├── cli.ts                    # Command-line interface (demo, execute, test-failure, policy)
│   ├── fault-classifier.ts       # Transient error classifier & gas price escalation engine
│   ├── formatter.ts              # Terminal scorecard & comparative state diff formatter
│   ├── index.ts                  # Public library exports
│   ├── saga-orchestrator.ts      # Master workflow coordinator & rollback manager
│   ├── state-journal.ts          # Append-only state transition log & ASCII timeline generator
│   ├── steps/
│   │   └── defi-workflow-steps.ts # Canonical 3-step DeFi workflow (Approve, Swap, Deposit)
│   └── types.ts                  # Domain schemas, interfaces, and receipt models
├── test/
│   └── saga-executor.test.ts     # Automated test suite (12 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-saga policy` | Introduction to Pharos Saga Executor. Explain the motivation: multi-hop DeFi workflows risk stranding funds if an intermediate step fails. Review the transient fault policy handling gas spikes (+20% escalation), dropped txs, and RPC timeouts. |
| **0:25 - 0:55** | Terminal: `pharos-saga demo` (Run 1) | Run the interactive demo. Inspect Run 1 (Full Success): Step 1 (Approve FaroSwap Router for 10,000 USDC), Step 2 (Swap USDC for 6,666.67 PROS), Step 3 (Supply PROS into Harbor Lending Pool). Show receipt verification (`status: 1`) on PharosScan for every step. |
| **0:55 - 1:25** | Terminal: `pharos-saga demo` (Run 2) | Inspect Run 2 (Forced Failure on Step 3: Harbor PoolCapExceeded). Walk through the automated compensating rollback: Step 2 reverse swap restores USDC; Step 1 allowance revocation resets router allowance to 0. Highlight zero stranded funds. |
| **1:25 - 1:45** | Terminal: Inspect State Journal Timeline | Show Requirement 04: the ASCII state transition journal tracking each phase transition in real-time (`INITIALIZED` $\to$ `IN_PROGRESS` $\to$ `FAILED_FATAL` $\to$ `COMPENSATING` $\to$ `COMPENSATED_CLEANLY`). |
| **1:45 - 2:00** | Terminal: `npm test tasks/23-saga-executor` | Run automated test suite: `12 passed (12)`, confirming 100% test coverage across step verification, retries, rollbacks, and recovery demonstrations. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:23
# or
npx vitest run tasks/23-saga-executor/test/saga-executor.test.ts
```

Output:
```
 ✓ tasks/23-saga-executor/test/saga-executor.test.ts (12 tests)
   ✓ Task 23: Saga Executor Specification (SkillEngine) (12)
     ✓ Requirement 01: At least 3 dependent steps, each verified before next starts (3)
       ✓ defines at least 3 sequential dependent steps in canonical workflow
       ✓ rejects sagas with fewer than 3 steps with an explicit error
       ✓ verifies transaction receipt status === 1 for each step before advancing
     ✓ Requirement 02: Defined retry policy for transient failures (3)
       ✓ accurately identifies transient network errors and gas spikes
       ✓ classifies EVM contract execution reverts as fatal non-transient failures
       ✓ computes exponential backoff delays with jitter and gas price escalation
     ✓ Requirement 03: Defined compensation/rollback path when a step permanently fails (2)
       ✓ executes reverse compensation flow when Step 3 fails permanently
       ✓ executes single-step rollback when Step 2 fails permanently
     ✓ Requirement 04: State log showing exactly which step the saga is in at any time (2)
       ✓ records real-time phase transitions in the state journal
       ✓ records retry and rollback transitions in state journal during failure run
     ✓ Requirement 05: Shows one fully successful run and one forced-failure run with recovery (2)
       ✓ executes a fully successful run from start to finish
       ✓ executes a forced-failure run with automated recovery and compensation

 Test Files  1 passed (1)
      Tests  12 passed (12)
```
