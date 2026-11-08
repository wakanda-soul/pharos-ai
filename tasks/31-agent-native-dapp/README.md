# Pharos x402 Intelligence Mesh · Agent-Native Data Marketplace

> **Capstone Project for Pharos Agent Arena**  
> **Network**: Pharos Mainnet (Chain ID `1672`)  
> **Native USDC**: `0xc879c018db60520f4355c26ed1a6d572cdac1815` (6 decimals)  
> **WPROS**: `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` (18 decimals)  
> **Curator**: `wakanda-soul` (`0x1bF848814D174F5A85bD3FDf9f6C920100000000`)  
> **Base Fee**: `0.001 USDC` (1,000 atomic micro-units)  
> **Sandboxed Engine**: Google Gemini 3.8 Flash (`gemini-3.8-flash-low` in Bubblewrap jail)  
> **Design Language**: Styled directly after [`port.pharos.xyz`](https://port.pharos.xyz)

---

## 1. Overview & Problem Solved

As autonomous agents proliferate on high-throughput L1s like **Pharos**, they require fresh, verifiable on-chain intelligence—such as DEX pool solvency, high-frequency price dispersion, whale flow telemetry, and smart contract honeypot scans.

Traditional Web2 SaaS subscriptions are fundamentally broken for AI agents:
1. **Agents do not have credit cards** or corporate invoices.
2. **Subscription models overcharge** agents who need only 2 to 5 targeted data queries per day.
3. **Interactive wallet signature prompts ruin autonomy**: An agent cannot pause mid-execution to ask a human to sign MetaMask for a $0.001 data point.
4. **Bait-and-Switch Scams**: Unvetted API publishers can initially serve clean data, then mutate their endpoints into malicious exploits once integrated.

### The Solution: The x402 Intelligence Mesh
The **Pharos x402 Intelligence Mesh** solves this natively on Pharos Mainnet:
- **HTTP 402 Paywall Protocol**: Standardized `WWW-Authenticate: x402` challenge-response flow.
- **Embedded Agent Wallets**: Non-custodial session keys pre-funded with small allowances (e.g. 0.50 USDC) that settle micro-transactions (0.001 USDC) autonomously in the background without UI interruption.
- **Anti-Scam Mutation Lockdown**: Endpoints are strictly curated by the designated administrator (`wakanda-soul`). Any mutation to an endpoint path or schema automatically resets status to `PENDING_AUDIT`.
- **Sandboxed AI Copilot (Gemini Integration)**: A 3-layer guarded AI assistant that brokers queries, refuses off-topic code generation with witty banter, and enforces deterministic budget caps.

---

## 2. System Architecture

```
                                  [ User / Protocol ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             [ Web3 DApp Interface ]               [ Sandboxed AI Copilot ]
             (port.pharos.xyz design)                 (Gemini 1.5 Engine)
                        │                                     │
                        │                                     ▼
                        │                         ┌───────────────────────┐
                        │                         │ Layer 1: Prompt Shield│ (Witty code refusal)
                        │                         ├───────────────────────┤
                        │                         │ Layer 2: Tool-Gating  │ (search / buy / report)
                        │                         ├───────────────────────┤
                        │                         │ Layer 3: Policy Gate  │ (Max $0.005, Balance)
                        │                         └───────────┬───────────┘
                        │                                     │
                        ▼                                     ▼
       ┌───────────────────────────────────────────────────────────────┐
       │             Embedded Agent Wallet (Privy Pattern)             │
       │       Signs EIP-712 Payment Authorizations on Pharos Mainnet  │
       └───────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
       ┌───────────────────────────────────────────────────────────────┐
       │                 HTTP 402 Settlement Gateway                   │
       │           WWW-Authenticate: x402 (0.001 Native USDC)          │
       └───────────────────────────────┬───────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   [ Whale Radar Feed ]      [ Harbor Solvency Feed ]   [ Contract Risk Feed ]
    (/api/x402/whale-radar)   (/api/x402/harbor-solvency)(/api/x402/contract-risk)
```

---

## 3. The 3-Layer Copilot Security Shield

| Layer | Component | Functionality |
|---|---|---|
| **Layer 1** | **Persona & Role Shield** | Rejects off-topic prompts, code generation requests (e.g., Python swap scripts), and prompt jailbreaks with dry, witty refusals. |
| **Layer 2** | **Strict Tool-Gating** | The LLM has zero shell, zero filesystem, and zero code execution tools. It possesses only 3 read/broker tools: `search_feeds`, `buy_intelligence_feed`, `synthesize_mesh_report`. |
| **Layer 3** | **Deterministic Backend Policy Gatekeeper** | Runs completely independently of the LLM. Enforces that endpoints are in `ACTIVE` curator state, rejects any price exceeding `0.005 USDC`, and verifies wallet balance pre-flight. |

---

## 4. Curated Intelligence Feeds (0.001 USDC Base Price)

1. **Pharos Whale Movement Radar** (`/api/x402/whale-radar`):
   - Detects on-chain transfers > 50,000 units, smart money accumulation, and protocol inflows.
   - Price: 0.001 USDC (1,000 micro-units).
2. **Harbor DEX Pool Solvency & Depth** (`/api/x402/harbor-solvency`):
   - Real-time audit of liquidity pool depth, reserve ratios, and impermanent loss risk.
   - Price: 0.001 USDC (1,000 micro-units).
3. **Pharos Volatility Radar** (`/api/x402/dex-volatility`):
   - High-frequency price dispersion across AMMs, detecting sudden arbitrage gaps.
   - Price: 0.001 USDC (1,000 micro-units).
4. **Smart Contract Risk & Honeypot Scanner** (`/api/x402/contract-risk`):
   - Disassembles bytecode to detect hidden mints, proxy anomalies, or non-standard reentrancy.
   - Price: 0.001 USDC (1,000 micro-units).

---

## 5. Anti-Scam Curation & Publisher Dashboard

- **Curator Governance**: Only endpoints verified by the curator (`wakanda-soul`) receive the `ACTIVE` status required for payment settlement.
- **Editable Pricing**: Publishers can fine-tune their per-call price in the Publisher Hub (minimum 0.0001 USDC, default 0.001 USDC).
- **Mutation Lockdown**: If a publisher edits their API route or updates the schema fingerprint, the feed status **automatically drops to `PENDING_AUDIT`**. It cannot receive funds until re-approved by the curator.

---

## 6. Smart Contracts (Pharos Mainnet)

- `contracts/X402MarketplaceRegistry.sol`:
  - EIP-712 payment authorization settlement engine.
  - Replay protection with buyer nonces.
  - Native USDC atomic transfers (`0xc879c018db60520f4355c26ed1a6d572cdac1815`).
  - Curator whitelist and mutation lockdown hooks.
- `contracts/IX402PaywallReceipt.sol`:
  - Interface emitting `PaymentSettled`, `FeedRegistered`, and `FeedCurated` events.

---

## 7. Running & Testing Locally

### Prerequisites
- Node.js 20+
- npm or pnpm

### Quickstart
```bash
# Navigate to task directory
cd tasks/31-agent-native-dapp

# Install dependencies
npm install

# Run full Vitest suite (20 unit & integration tests)
npm test

# Build production Next.js bundle
npm run build

# Start local server on port 3000
npm run dev
```

### Verification Suite
```
 Test Files  4 passed (4)
      Tests  20 passed (20)
   Duration  8.13s
```

---

## 8. License

MIT License. Designed and authored by `wakanda-soul` for the Pharos Agent Arena Capstone.
