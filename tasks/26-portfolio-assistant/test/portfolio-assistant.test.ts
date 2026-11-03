import { describe, it, expect } from 'vitest';
import { PortfolioReader, PHAROS_CONTRACT_REGISTRY } from '../src/portfolio-reader.js';
import { PortfolioIntentRouter } from '../src/intent-router.js';
import { PortfolioAssistantEngine } from '../src/assistant-engine.js';

const DEMO_WALLET = '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E' as `0x${string}`;

describe('Task 26: Portfolio Assistant Specification (DeFi / Portfolio)', () => {
  describe('Requirement 01: Reads positions from at least 2 protocols plus wallet balances', () => {
    it('reads positions across at least 2 protocols (Harbor RWA, Morpho Blue, FaroSwap)', async () => {
      const reader = new PortfolioReader();
      const positions = await reader.readProtocolPositions(DEMO_WALLET);

      // Must cover at least 2 protocols
      const distinctProtocols = new Set(positions.map((p) => p.protocolName));
      expect(distinctProtocols.size).toBeGreaterThanOrEqual(2);
      expect(distinctProtocols.has('Harbor Protocol')).toBe(true);
      expect(distinctProtocols.has('Morpho Blue')).toBe(true);
      expect(distinctProtocols.has('FaroSwap DEX')).toBe(true);

      // Verify positive deposited amounts
      for (const pos of positions) {
        expect(pos.depositedNumeric).toBeGreaterThan(0);
        expect(pos.depositedUsd).toBeGreaterThan(0);
        expect(pos.apyPercent).toBeGreaterThan(0);
      }
    });

    it('reads native PROS and ERC-20 token balances in wallet', async () => {
      const reader = new PortfolioReader();
      const balances = await reader.readWalletBalances(DEMO_WALLET);

      expect(balances.length).toBeGreaterThanOrEqual(3);
      const symbols = balances.map((b) => b.tokenSymbol);
      expect(symbols).toContain('PROS');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');

      for (const token of balances) {
        expect(token.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(token.balanceNumeric).toBeGreaterThan(0);
        expect(token.balanceUsd).toBeGreaterThan(0);
      }
    });

    it('calculates correct aggregated net worth, total deposits, and total debt', async () => {
      const reader = new PortfolioReader();
      const snapshot = await reader.getCompletePortfolioSnapshot(DEMO_WALLET);

      expect(snapshot.totalWalletTokensUsd).toBeGreaterThan(0);
      expect(snapshot.totalDeFiDepositsUsd).toBeGreaterThan(0);
      expect(snapshot.totalDeFiDebtUsd).toBeGreaterThan(0);

      const expectedNetWorth = Number(
        (snapshot.totalWalletTokensUsd + snapshot.totalDeFiDepositsUsd - snapshot.totalDeFiDebtUsd).toFixed(2)
      );
      expect(snapshot.totalNetWorthUsd).toBe(expectedNetWorth);
      expect(snapshot.weightedApyPercent).toBeGreaterThan(0);
      expect(snapshot.projectedAnnualEarningsUsd).toBeGreaterThan(0);
    });
  });

  describe('Requirement 02: Answers at least 5 different natural-language question types correctly', () => {
    const engine = new PortfolioAssistantEngine();

    it('Type 1 (Yield & Earnings): answers "what am I earning?" with APY and annual income', async () => {
      const answer = await engine.answerQuestion(DEMO_WALLET, 'what am I earning?');

      expect(answer.detectedIntent).toBe('YIELD_AND_EARNINGS');
      expect(answer.primaryAnswerMarkdown).toContain('Projected Annual Yield');
      expect(answer.primaryAnswerMarkdown).toContain('weighted average APY');
      expect(answer.detailedFigures.length).toBeGreaterThanOrEqual(2);
      expect(answer.detailedFigures[0].metricLabel).toMatch(/Yield/);
    });

    it('Type 2 (Asset Location): answers "where is my USDC?" with exact venue distribution', async () => {
      const answer = await engine.answerQuestion(DEMO_WALLET, 'where is my USDC?');

      expect(answer.detectedIntent).toBe('ASSET_LOCATION');
      expect(answer.primaryAnswerMarkdown).toContain('Asset Distribution for USDC');
      expect(answer.primaryAnswerMarkdown).toContain('In Your Wallet');
      expect(answer.primaryAnswerMarkdown).toContain('Deployed in DeFi Protocols');
      expect(answer.detailedFigures.some((f) => f.metricLabel.includes('Wallet Liquid Balance'))).toBe(true);
      expect(answer.detailedFigures.some((f) => f.metricLabel.includes('Harbor Protocol'))).toBe(true);
    });

    it('Type 3 (Biggest Position): answers "what\'s my biggest position?" with concentration %', async () => {
      const answer = await engine.answerQuestion(DEMO_WALLET, "what's my biggest position?");

      expect(answer.detectedIntent).toBe('BIGGEST_POSITION');
      expect(answer.primaryAnswerMarkdown).toContain('Largest Portfolio Allocation');
      expect(answer.primaryAnswerMarkdown).toContain('Portfolio Concentration');
      expect(answer.detailedFigures).toHaveLength(1);
      expect(answer.detailedFigures[0].metricLabel).toContain('Largest Allocation');
    });

    it('Type 4 (Net Worth Overview): answers "what is my total net worth?" with categorized balance overview', async () => {
      const answer = await engine.answerQuestion(DEMO_WALLET, 'what is my total net worth?');

      expect(answer.detectedIntent).toBe('NET_WORTH_OVERVIEW');
      expect(answer.primaryAnswerMarkdown).toContain('Total Portfolio Net Worth');
      expect(answer.primaryAnswerMarkdown).toContain('Liquid Wallet Assets');
      expect(answer.primaryAnswerMarkdown).toContain('DeFi Protocol Deposits');
      expect(answer.primaryAnswerMarkdown).toContain('Net Total Equity');
      expect(answer.detailedFigures.length).toBeGreaterThan(4);
    });

    it('Type 5 (Debt & Liabilities): answers "do I have any loans or debt?" with borrowing balances and health factor', async () => {
      const answer = await engine.answerQuestion(DEMO_WALLET, 'do I have any loans or debt?');

      expect(answer.detectedIntent).toBe('DEBT_AND_LIABILITIES');
      expect(answer.primaryAnswerMarkdown).toContain('Debt & Outstanding Liabilities');
      expect(answer.primaryAnswerMarkdown).toContain('Morpho Blue');
      expect(answer.primaryAnswerMarkdown).toContain('Health Factor');
      expect(answer.detailedFigures.length).toBeGreaterThanOrEqual(1);
      expect(answer.detailedFigures[0].metricLabel).toContain('Borrowed Debt');
    });
  });

  describe('Requirement 03: Shows numbers with sources: contract address and block number', () => {
    it('cites physical EVM contract address and block height for every figure', async () => {
      const engine = new PortfolioAssistantEngine();
      const answer = await engine.answerQuestion(DEMO_WALLET, 'where is my USDC?');

      expect(answer.detailedFigures.length).toBeGreaterThan(0);
      for (const fig of answer.detailedFigures) {
        expect(fig.provenance).toBeDefined();
        expect(fig.provenance.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(fig.provenance.blockNumber).toBeGreaterThan(0);
        expect(fig.provenance.explorerUrl).toContain('https://pharosscan.xyz/address/0x');
        expect(fig.provenance.protocolName.length).toBeGreaterThan(0);
      }
    });

    it('reflects updated block heights across reader queries', async () => {
      const reader = new PortfolioReader(1845000);
      reader.advanceBlockHeight(1850000);

      const snapshot = await reader.getCompletePortfolioSnapshot(DEMO_WALLET);
      expect(snapshot.snapshotBlockNumber).toBe(1850000);
      expect(snapshot.walletBalances[0].provenance.blockNumber).toBe(1850000);
      expect(snapshot.protocolPositions[0].provenance.blockNumber).toBe(1850000);
    });
  });

  describe('Requirement 04: Says clearly when it doesn\'t know rather than guessing', () => {
    it('strictly rejects questions about unsupported foreign protocols with clear disclaimer', async () => {
      const engine = new PortfolioAssistantEngine();

      const aaveAnswer = await engine.answerQuestion(DEMO_WALLET, 'how much do I have in Aave?');
      expect(aaveAnswer.detectedIntent).toBe('UNKNOWN_OR_UNSUPPORTED');
      expect(aaveAnswer.zeroGuessingDisclaimer).toContain("cannot verify any deployment for 'Aave' on Pharos Network");
      expect(aaveAnswer.primaryAnswerMarkdown).toContain('Unsupported Protocol');

      const compoundAnswer = await engine.answerQuestion(DEMO_WALLET, 'what are my Compound rewards?');
      expect(compoundAnswer.detectedIntent).toBe('UNKNOWN_OR_UNSUPPORTED');
      expect(compoundAnswer.zeroGuessingDisclaimer).toContain("cannot verify any deployment for 'Compound' on Pharos Network");

      const uniswapAnswer = await engine.answerQuestion(DEMO_WALLET, 'show my Uniswap LP pools');
      expect(uniswapAnswer.detectedIntent).toBe('UNKNOWN_OR_UNSUPPORTED');
      expect(uniswapAnswer.zeroGuessingDisclaimer).toContain("cannot verify any deployment for 'Uniswap' on Pharos Network");
    });

    it('rejects unsupported protocols even if combined with a recognizable keyword', async () => {
      const router = new PortfolioIntentRouter();
      const result = router.parseQuery('what is my USDC yield in Yearn?');

      expect(result.intent).toBe('UNKNOWN_OR_UNSUPPORTED');
      expect(result.unsupportedProtocolName).toBe('Yearn Finance');
    });

    it('provides clear guidance when natural language query is completely unrecognizable', async () => {
      const engine = new PortfolioAssistantEngine();
      const obscureAnswer = await engine.answerQuestion(DEMO_WALLET, 'tell me a joke about Bitcoin miners');

      expect(obscureAnswer.detectedIntent).toBe('UNKNOWN_OR_UNSUPPORTED');
      expect(obscureAnswer.zeroGuessingDisclaimer).toContain('cannot determine on-chain data for your inquiry without guessing');
    });
  });

  describe('Requirement 05: Read-only: never initiates transactions', () => {
    it('strictly guarantees read-only mode in all answers and engines', async () => {
      const engine = new PortfolioAssistantEngine();
      const answer = await engine.answerQuestion(DEMO_WALLET, 'what is my total net worth?');

      expect(answer.isReadOnly).toBe(true);
      // Engine and reader do not expose any write, broadcast, sign, or sendTransaction methods
      expect((engine as any).sendTransaction).toBeUndefined();
      expect((engine as any).signMessage).toBeUndefined();
      expect((engine.getReader() as any).sendTransaction).toBeUndefined();
    });
  });
});
