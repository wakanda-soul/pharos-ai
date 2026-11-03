/**
 * Task 29: Doc-Grounded Builder Agent
 * Test Suite: rigorous verification of documentation planning, source citations,
 * non-custodial calldata preparation, on-chain outcome verification, 3+ distinct queries,
 * and anti-hallucination refusals for ungrounded requests.
 */

import { describe, it, expect } from 'vitest';
import {
  DocGroundedBuilderAgent,
  DocCitationPlanner,
  ActionExecutor,
  ChainOutcomeVerifier,
  ZeroGuessingSentinel,
} from '../src/index.js';

describe('Task 29: Doc-Grounded Builder Agent', () => {
  const agent = new DocGroundedBuilderAgent();
  const planner = agent.getPlanner();
  const executor = agent.getExecutor();
  const verifier = agent.getVerifier();

  describe('Criterion 01: Docs MCP Planning & Source Citations', () => {
    it('uses documentation to construct an action plan with cited sources before acting', () => {
      const query = 'How do I check circulating total supply and decimals of the native PROS token on Pharos?';
      const plan = planner.planFromDocs(query);

      expect(plan.isDocsGrounded).toBe(true);
      expect(plan.plannedSteps.length).toBeGreaterThanOrEqual(2);
      expect(plan.conceptualExplanation).toContain('Pharos Developer Docs');

      // Verify exact documentation citation provenance
      expect(plan.citedSources.length).toBeGreaterThan(0);
      const primarySource = plan.citedSources[0];
      expect(primarySource.title).toContain('Native Token (PROS)');
      expect(primarySource.url).toBe('https://docs.pharos.xyz/tokens/native-pros');
      expect(primarySource.sectionHeading).toBe('Token Architecture & ERC-20 State Queries');
      expect(primarySource.excerptSnippet).toBeTruthy();

      // Verify each planned step has citation provenance and target metadata
      for (const step of plan.plannedSteps) {
        expect(step.targetContractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(step.functionSignature).toBeTruthy();
        expect(step.docCitation.url).toBe('https://docs.pharos.xyz/tokens/native-pros');
      }
    });
  });

  describe('Criterion 02: Execution & Non-Custodial Calldata Preparation', () => {
    it('executes read calls via chain queries without moving funds', async () => {
      const query = 'How do I check total supply and decimals of native PROS?';
      const outcome = await agent.handleHowDoIRequest(query);

      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.executedSteps.length).toBe(2);

      const step1 = outcome.executedSteps[0]; // decimals
      expect(step1.status).toBe('SUCCESS');
      expect(step1.rawResult).toBe(18);
      expect(step1.unsignedTransactionPayload).toBeUndefined(); // Read call: zero calldata needed

      const step2 = outcome.executedSteps[1]; // totalSupply
      expect(step2.status).toBe('SUCCESS');
      expect(step2.humanReadableOutcome).toContain('1,000,000,000 PROS');
    });

    it('prepares unsigned calldata with Foundry cast commands for fund-moving operations', async () => {
      const query = 'How do I deposit 50 USDC into the Harbor Real World Asset vault on Pharos?';
      const outcome = await agent.handleHowDoIRequest(query);

      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.overallStatus).toBe('PREPARED_FOR_USER_SIGNATURE');
      expect(outcome.executedSteps.length).toBe(2);

      // Step 1: ERC-20 Approve
      const approveStep = outcome.executedSteps[0];
      expect(approveStep.status).toBe('PREPARED_FOR_SIGNATURE');
      expect(approveStep.unsignedTransactionPayload).toBeDefined();
      expect(approveStep.unsignedTransactionPayload?.encodedCalldata).toMatch(/^0x095ea7b3/); // approve selector
      expect(approveStep.unsignedTransactionPayload?.castSendCommand).toContain('cast send');
      expect(approveStep.unsignedTransactionPayload?.castSendCommand).toContain('approve(address,uint256)');

      // Step 2: Vault Deposit
      const depositStep = outcome.executedSteps[1];
      expect(depositStep.status).toBe('PREPARED_FOR_SIGNATURE');
      expect(depositStep.unsignedTransactionPayload).toBeDefined();
      expect(depositStep.unsignedTransactionPayload?.encodedCalldata).toMatch(/^0x6e553f65/); // deposit selector
      expect(depositStep.unsignedTransactionPayload?.castSendCommand).toContain('cast send');
      expect(depositStep.unsignedTransactionPayload?.castSendCommand).toContain('deposit(uint256,address)');
    });
  });

  describe('Criterion 03: On-Chain Outcome Verification', () => {
    it('verifies the outcome on chain and reports success or failure against the plan', async () => {
      const query = 'How do I inspect live oracle round data and price updates on Pharos?';
      const outcome = await agent.handleHowDoIRequest(query);

      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.overallStatus).toBe('COMPLETED_AND_VERIFIED');

      // Verify that chain verification confirmed every step
      for (const step of outcome.executedSteps) {
        expect(step.verifiedOnChain).toBe(true);
        expect(step.blockNumberObserved).toBeGreaterThan(0);
      }

      // Verify summary report contains verified audit notes
      expect(outcome.finalSummaryReport).toContain('DOC-GROUNDED EXECUTION REPORT');
      expect(outcome.finalSummaryReport).toContain('Executed Steps (2/2 Verified)');
    });

    it('flags contract address mismatch during chain verification', () => {
      const plan = planner.planFromDocs('How do I check total supply of native PROS?');
      const spoofedSteps = [
        {
          stepIndex: 1,
          status: 'SUCCESS' as const,
          targetContract: '0x000000000000000000000000000000000000dead' as `0x${string}`, // Wrong target
          functionSignature: 'decimals()',
          rawResult: 18,
          humanReadableOutcome: 'Spoofed contract read',
          verifiedOnChain: false,
        },
      ];

      const report = verifier.verifyOutcome(plan, spoofedSteps);
      expect(report.isPlanSatisfied).toBe(false);
      expect(report.overallStatus).toBe('EXECUTION_FAILED');
      expect(report.detailedAuditNotes.some((n) => n.includes('Contract address mismatch'))).toBe(true);
    });

    it('detects selector mismatch when calldata does not match expected ERC-4626 signature', () => {
      const plan = planner.planFromDocs('How do I deposit USDC into Harbor?');
      const badCalldataSteps = [
        {
          stepIndex: 1,
          status: 'PREPARED_FOR_SIGNATURE' as const,
          targetContract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
          functionSignature: 'approve(address,uint256)',
          humanReadableOutcome: 'Bad selector payload',
          unsignedTransactionPayload: {
            targetAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            encodedCalldata: '0x12345678' as `0x${string}`, // Corrupted selector
            valueWei: '0',
            castSendCommand: 'cast send ...',
            estimatedGasLimit: '50000',
            functionSignature: 'approve(address,uint256)',
            requiredSignerDescription: 'Signer required',
          },
          verifiedOnChain: false,
        },
      ];

      const report = verifier.verifyOutcome(plan, badCalldataSteps);
      expect(report.isPlanSatisfied).toBe(false);
      expect(report.detailedAuditNotes.some((n) => n.includes('Selector validation failed'))).toBe(true);
    });
  });

  describe('Criterion 04: Support for 3+ Distinct "How Do I..." Requests', () => {
    it('successfully processes Request 1: Native PROS Token State', async () => {
      const outcome = await agent.handleHowDoIRequest(
        'How do I check the circulating total supply and decimals of native PROS on Pharos?'
      );
      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.plan.citedSources[0].url).toContain('tokens/native-pros');
      expect(outcome.overallStatus).toBe('COMPLETED_AND_VERIFIED');
    });

    it('successfully processes Request 2: Harbor RWA Vault Deposit', async () => {
      const outcome = await agent.handleHowDoIRequest(
        'How do I deposit 50 USDC into the Harbor vault on Pharos?'
      );
      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.plan.citedSources[0].url).toContain('ecosystem/harbor-protocol');
      expect(outcome.overallStatus).toBe('PREPARED_FOR_USER_SIGNATURE');
    });

    it('successfully processes Request 3: Decentralized Oracle Price Feed', async () => {
      const outcome = await agent.handleHowDoIRequest(
        'How do I query latest oracle price feeds and pair description on Pharos?'
      );
      expect(outcome.isDocsCovered).toBe(true);
      expect(outcome.plan.citedSources[0].url).toContain('oracles/price-feeds');
      expect(outcome.overallStatus).toBe('COMPLETED_AND_VERIFIED');
    });
  });

  describe('Criterion 05: Anti-Hallucination Sentinel on Ungrounded Requests', () => {
    it('handles request not covered in docs by saying so instead of improvising (Solana Wormhole bridge)', async () => {
      const ungroundedQuery = 'How do I deploy an EVM subnet bridge to Solana Wormhole on Pharos?';
      const outcome = await agent.handleHowDoIRequest(ungroundedQuery);

      expect(outcome.isDocsCovered).toBe(false);
      expect(outcome.overallStatus).toBe('UNSUPPORTED_DOCS_GAP');
      expect(outcome.executedSteps.length).toBe(0); // Zero steps planned or executed
      expect(outcome.finalSummaryReport).toContain('REQUEST NOT COVERED IN PHAROS DOCUMENTATION');
      expect(outcome.plan.docCoverageDiagnosis).toContain('Documentation Gap Detected');
      expect(outcome.plan.docCoverageDiagnosis).toContain('unsupported external technology ("solana", "wormhole")');
    });

    it('handles request not covered in docs by saying so instead of improvising (Bitcoin Ordinals staking)', async () => {
      const ungroundedQuery = 'How do I stake Bitcoin Ordinals on Pharos native PoS?';
      const outcome = await agent.handleHowDoIRequest(ungroundedQuery);

      expect(outcome.isDocsCovered).toBe(false);
      expect(outcome.overallStatus).toBe('UNSUPPORTED_DOCS_GAP');
      expect(outcome.executedSteps.length).toBe(0);
      expect(outcome.plan.docCoverageDiagnosis).toContain('unsupported external technology ("ordinals")');
    });

    it('rejects empty query safely without throwing unhandled exceptions', async () => {
      const emptyOutcome = await agent.handleHowDoIRequest('   ');
      expect(emptyOutcome.isDocsCovered).toBe(false);
      expect(emptyOutcome.overallStatus).toBe('UNSUPPORTED_DOCS_GAP');
    });
  });
});
