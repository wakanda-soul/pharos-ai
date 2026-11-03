---
name: pharos-builder
description: Autonomous doc-grounded builder agent capable of resolving "how do I do X on Pharos?" questions via Developer Docs MCP, executing actions on Pharos, preparing unsigned calldata for fund movements, and verifying on-chain outcomes.
---

# Pharos Doc-Grounded Builder Agent Skill

This skill equips autonomous AI agents with the ability to plan actions from Pharos Developer Documentation (`docs.pharos.xyz`), cite exact sources, execute non-custodial reads via Chain MCP, prepare unsigned calldata for fund movements, and verify on-chain outcomes.

## Capabilities
1. **Docs MCP Citation Planning**: Searches official docs, extracts authoritative URLs and section headings, and synthesizes structured operational blueprints.
2. **Zero-Guessing Sentinel**: Protects against hallucination by actively detecting unsupported external technologies and reporting documentation gaps.
3. **Non-Custodial Execution**: Executes state queries via Chain MCP (`eth_call`) without moving funds.
4. **Fund-Moving Calldata Preparation**: Formulates unsigned ERC-20 `approve` and ERC-4626 `deposit` payloads with Foundry `cast send` commands, maintaining 100% user key custody.
5. **On-Chain State Verification**: Verifies return values, selector exactness, and block heights against the initial blueprint.

## Usage in Code

```typescript
import { DocGroundedBuilderAgent } from './builder-agent.js';

const agent = new DocGroundedBuilderAgent();

// 1. Natural Language State Inquiry
const outcome = await agent.handleHowDoIRequest(
  'How do I check the circulating total supply and decimals of native PROS on Pharos?'
);

console.log('Status:', outcome.overallStatus);
console.log('Report:', outcome.finalSummaryReport);
```
