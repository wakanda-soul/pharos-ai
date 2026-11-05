---
name: pharos-policy-gatekeeper
description: Policy gatekeeper for autonomous agents on Pharos that evaluates transaction proposals against multi-asset spend limits, contract allowlists, and operational time windows, issuing authorization tickets only for compliant actions.
---

# Pharos Skill: Policy Gatekeeper

## Purpose
The **Policy Gatekeeper** provides pre-execution transaction validation for autonomous bots and agents on Pharos. It prevents unauthorized asset outflows, blocks calls to unverified or malicious contracts, and restricts operations to approved operating windows.

### Core Capabilities:
1. **Multi-Asset Spend Limits**:
   - Caps per-transaction native PROS (default: 10 PROS) and ERC-20 tokens (default: 1,000 USDC).
   - Computes total USD transaction exposure using the live Chainlink Price Feed on Pharos (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`) with fallback tolerance.
2. **Allowlist & Blacklist Security**:
   - Enforces approved contract targets (Multicall3, FaroSwap, Native USDC, LINK).
   - Verifies recipient addresses and permitted function selector signatures.
   - Actively blacklists known malicious or reverting contracts (e.g. `0x936564245b69f5a293b42cbd752e0ee3bb68b470`).
3. **Operational Time Windows**:
   - Enforces standard operational hours (08:00 - 22:00 UTC, Monday through Friday).
   - Enforces scheduled maintenance blackout windows (e.g. network hard forks).
4. **Deterministic Deciding Rule & Non-Execution Invariant**:
   - Returns a structured `ALLOW` or `DENY` decision with the exact `decidingRuleId` that determined the verdict.
   - Denied actions are safely neutralized: no execution ticket or `cast send` payload is minted.
5. **Append-Only Audit Trail**:
   - Records all decisions to `audit.log.jsonl` with timestamps, agent IDs, verdicts, and ticket hashes.

---

## Quick Start & Usage

```bash
# Run scenario demo covering ALLOW and all 3 DENY rule types
pharos-gatekeeper demo

# Inspect active policy rules
pharos-gatekeeper policy

# Evaluate a JSON action proposal
pharos-gatekeeper evaluate ./proposal.json

# View audit logs
pharos-gatekeeper audit
```
