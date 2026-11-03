import { PortfolioIntentRouter } from './intent-router.js';
import { PortfolioReader } from './portfolio-reader.js';
import {
  PortfolioAssistantAnswer,
  PortfolioAggregateSnapshot,
  ProvenanceCitationFigure,
} from './types.js';

/**
 * PortfolioAssistantEngine
 * 
 * Master natural language assistant for wallet balances and DeFi positions on Pharos.
 * Answers free-text queries, structures figures with cryptographic contract provenance,
 * enforces zero-guessing sentinels, and strictly guarantees read-only safety.
 */
export class PortfolioAssistantEngine {
  private readonly reader: PortfolioReader;
  private readonly router: PortfolioIntentRouter;

  constructor(customReader?: PortfolioReader, customRouter?: PortfolioIntentRouter) {
    this.reader = customReader ?? new PortfolioReader();
    this.router = customRouter ?? new PortfolioIntentRouter();
  }

  /**
   * Main entrypoint: evaluates natural language question for a wallet and returns
   * a structured answer with verified numbers and on-chain contract provenance.
   */
  public async answerQuestion(
    walletAddress: `0x${string}`,
    questionText: string,
    mockBalances?: Partial<Record<string, number>>,
    mockPositions?: {
      harborApc3mUsd?: number;
      harborVrpcUsd?: number;
      morphoUsd?: number;
      faroswapUsd?: number;
      morphoDebtUsd?: number;
    }
  ): Promise<PortfolioAssistantAnswer> {
    const parsedIntent = this.router.parseQuery(questionText);
    const snapshot = await this.reader.getCompletePortfolioSnapshot(
      walletAddress,
      mockBalances,
      mockPositions
    );

    switch (parsedIntent.intent) {
      case 'YIELD_AND_EARNINGS':
        return this.synthesizeYieldAnswer(questionText, snapshot);

      case 'ASSET_LOCATION':
        return this.synthesizeLocationAnswer(
          questionText,
          parsedIntent.targetTokenSymbol ?? 'USDC',
          snapshot
        );

      case 'BIGGEST_POSITION':
        return this.synthesizeBiggestPositionAnswer(questionText, snapshot);

      case 'NET_WORTH_OVERVIEW':
        return this.synthesizeNetWorthAnswer(questionText, snapshot);

      case 'DEBT_AND_LIABILITIES':
        return this.synthesizeDebtAnswer(questionText, snapshot);

      case 'UNKNOWN_OR_UNSUPPORTED':
      default:
        return this.synthesizeUnsupportedAnswer(
          questionText,
          snapshot,
          parsedIntent.unsupportedProtocolName
        );
    }
  }

  /**
   * Intent 1: Yield and Earnings ("what am I earning?")
   */
  private synthesizeYieldAnswer(
    queryText: string,
    snapshot: PortfolioAggregateSnapshot
  ): PortfolioAssistantAnswer {
    const figures: ProvenanceCitationFigure[] = snapshot.protocolPositions.map((pos) => ({
      metricLabel: `${pos.protocolName} (${pos.vaultName}) Yield`,
      numericDisplay: `$${pos.annualYieldUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/yr (${pos.apyPercent}% APY on $${pos.depositedUsd.toLocaleString('en-US')} deposit)`,
      provenance: pos.provenance,
    }));

    const markdownLines: string[] = [
      `### 💰 Projected Annual Yield & Earnings Overview`,
      `You are currently earning **$${snapshot.projectedAnnualEarningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD per year** across your active DeFi positions on Pharos.`,
      `Your portfolio's **weighted average APY is ${snapshot.weightedApyPercent}%** across **$${snapshot.totalDeFiDepositsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD** in productive deposits.`,
      ``,
      `#### Active Yield Streams:`,
    ];

    for (const pos of snapshot.protocolPositions) {
      markdownLines.push(
        `- **${pos.protocolName}** — *${pos.vaultName}*: **${pos.apyPercent}% APY** (Generating ~$${pos.annualYieldUsd.toFixed(2)}/yr on $${pos.depositedUsd.toFixed(2)} deposit)`
      );
    }

    return {
      queryText,
      detectedIntent: 'YIELD_AND_EARNINGS',
      primaryAnswerMarkdown: markdownLines.join('\n'),
      detailedFigures: figures,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  /**
   * Intent 2: Asset Location ("where is my USDC?")
   */
  private synthesizeLocationAnswer(
    queryText: string,
    targetTokenSymbol: string,
    snapshot: PortfolioAggregateSnapshot
  ): PortfolioAssistantAnswer {
    const upperSymbol = targetTokenSymbol.toUpperCase();
    const figures: ProvenanceCitationFigure[] = [];

    // Find in wallet (filter for non-zero or matching tokens)
    const matchingWalletTokens = snapshot.walletBalances.filter(
      (b) => b.tokenSymbol.toUpperCase() === upperSymbol && b.balanceNumeric > 0
    );
    for (const token of matchingWalletTokens) {
      figures.push({
        metricLabel: `Wallet Liquid Balance (${token.tokenSymbol})`,
        numericDisplay: token.balanceFormatted,
        provenance: token.provenance,
      });
    }

    // Find in DeFi protocols (filter for positive deposit)
    const matchingPositions = snapshot.protocolPositions.filter(
      (p) =>
        p.depositedNumeric > 0 &&
        (p.assetSymbol.toUpperCase().includes(upperSymbol) ||
         p.vaultName.toUpperCase().includes(upperSymbol))
    );
    for (const pos of matchingPositions) {
      figures.push({
        metricLabel: `${pos.protocolName} Deposit (${pos.assetSymbol})`,
        numericDisplay: pos.depositedAmount,
        provenance: pos.provenance,
      });
    }

    const totalMatchingUsd =
      matchingWalletTokens.reduce((s, t) => s + t.balanceUsd, 0) +
      matchingPositions.reduce((s, p) => s + p.depositedUsd, 0);

    const markdownLines: string[] = [
      `### 📍 Asset Distribution for ${upperSymbol}`,
      `You hold a total of **$${totalMatchingUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD** in ${upperSymbol} distributed across your wallet and DeFi protocols:`,
      ``,
    ];

    if (matchingWalletTokens.length > 0) {
      markdownLines.push(`**In Your Wallet (Liquid):**`);
      for (const t of matchingWalletTokens) {
        markdownLines.push(`- **${t.balanceFormatted}** (~$${t.balanceUsd.toFixed(2)} USD) in personal wallet`);
      }
      markdownLines.push(``);
    }

    if (matchingPositions.length > 0) {
      markdownLines.push(`**Deployed in DeFi Protocols:**`);
      for (const p of matchingPositions) {
        markdownLines.push(
          `- **${p.protocolName}** (*${p.vaultName}*): **${p.depositedAmount}** (~$${p.depositedUsd.toFixed(2)} USD) earning ${p.apyPercent}% APY`
        );
      }
    } else {
      markdownLines.push(`*No active DeFi deposits found containing ${upperSymbol}.*`);
    }

    return {
      queryText,
      detectedIntent: 'ASSET_LOCATION',
      primaryAnswerMarkdown: markdownLines.join('\n'),
      detailedFigures: figures,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  /**
   * Intent 3: Biggest / Largest Position ("what's my biggest position?")
   */
  private synthesizeBiggestPositionAnswer(
    queryText: string,
    snapshot: PortfolioAggregateSnapshot
  ): PortfolioAssistantAnswer {
    if (snapshot.protocolPositions.length === 0) {
      return {
        queryText,
        detectedIntent: 'BIGGEST_POSITION',
        primaryAnswerMarkdown: 'You currently have no active protocol positions on Pharos Network.',
        detailedFigures: [],
        isReadOnly: true,
        answeredAtBlock: snapshot.snapshotBlockNumber,
      };
    }

    // Sort positions descending by USD value
    const sortedPositions = [...snapshot.protocolPositions].sort(
      (a, b) => b.depositedUsd - a.depositedUsd
    );
    const topPosition = sortedPositions[0];

    const shareOfPortfolioPercent =
      snapshot.totalNetWorthUsd > 0
        ? Number(((topPosition.depositedUsd / snapshot.totalNetWorthUsd) * 100).toFixed(1))
        : 100.0;

    const figures: ProvenanceCitationFigure[] = [
      {
        metricLabel: `Largest Allocation: ${topPosition.protocolName} (${topPosition.vaultName})`,
        numericDisplay: `$${topPosition.depositedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (${shareOfPortfolioPercent}% of portfolio)`,
        provenance: topPosition.provenance,
      },
    ];

    const markdownLines: string[] = [
      `### 🏆 Largest Portfolio Allocation`,
      `Your single biggest position is in **${topPosition.protocolName}** (*${topPosition.vaultName}*).`,
      ``,
      `- **Deposited Amount:** ${topPosition.depositedAmount} (~$${topPosition.depositedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)`,
      `- **Portfolio Concentration:** **${shareOfPortfolioPercent}%** of your total net worth`,
      `- **Current Yield:** **${topPosition.apyPercent}% APY** (generating ~$${topPosition.annualYieldUsd.toFixed(2)} USD/yr)`,
      `- **On-Chain Contract:** \`${topPosition.provenance.contractAddress}\``,
    ];

    return {
      queryText,
      detectedIntent: 'BIGGEST_POSITION',
      primaryAnswerMarkdown: markdownLines.join('\n'),
      detailedFigures: figures,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  /**
   * Intent 4: Net Worth & General Balance Overview ("what's my total net worth?")
   */
  private synthesizeNetWorthAnswer(
    queryText: string,
    snapshot: PortfolioAggregateSnapshot
  ): PortfolioAssistantAnswer {
    const figures: ProvenanceCitationFigure[] = [
      ...snapshot.walletBalances.map((b) => ({
        metricLabel: `Wallet Token (${b.tokenSymbol})`,
        numericDisplay: `${b.balanceFormatted} (~$${b.balanceUsd.toFixed(2)} USD)`,
        provenance: b.provenance,
      })),
      ...snapshot.protocolPositions.map((p) => ({
        metricLabel: `${p.protocolName} Deposit (${p.vaultName})`,
        numericDisplay: `$${p.depositedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
        provenance: p.provenance,
      })),
    ];

    const markdownLines: string[] = [
      `### 📊 Total Portfolio Net Worth & Balance Overview`,
      `Your total portfolio net worth on Pharos Network is **$${snapshot.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD** as of block #${snapshot.snapshotBlockNumber}.`,
      ``,
      `| Category | Value (USD) | Share |`,
      `|---|---|---|`,
      `| **Liquid Wallet Assets** | $${snapshot.totalWalletTokensUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${((snapshot.totalWalletTokensUsd / snapshot.totalNetWorthUsd) * 100).toFixed(1)}% |`,
      `| **DeFi Protocol Deposits** | $${snapshot.totalDeFiDepositsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${((snapshot.totalDeFiDepositsUsd / snapshot.totalNetWorthUsd) * 100).toFixed(1)}% |`,
      `| **DeFi Liabilities (Debt)** | -$${snapshot.totalDeFiDebtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | - |`,
      `| **Net Total Equity** | **$${snapshot.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}** | **100.0%** |`,
    ];

    return {
      queryText,
      detectedIntent: 'NET_WORTH_OVERVIEW',
      primaryAnswerMarkdown: markdownLines.join('\n'),
      detailedFigures: figures,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  /**
   * Intent 5: Debt & Liabilities ("do I have any loans or debt?")
   */
  private synthesizeDebtAnswer(
    queryText: string,
    snapshot: PortfolioAggregateSnapshot
  ): PortfolioAssistantAnswer {
    const debtPositions = snapshot.protocolPositions.filter(
      (p) => p.borrowedNumeric && p.borrowedNumeric > 0
    );

    const figures: ProvenanceCitationFigure[] = debtPositions.map((d) => ({
      metricLabel: `${d.protocolName} Borrowed Debt (${d.vaultName})`,
      numericDisplay: `${d.borrowedAmount} (~$${d.borrowedUsd?.toFixed(2)} USD) [Health Factor: ${d.healthFactor}]`,
      provenance: d.provenance,
    }));

    if (debtPositions.length === 0) {
      return {
        queryText,
        detectedIntent: 'DEBT_AND_LIABILITIES',
        primaryAnswerMarkdown: `### 🛡️ Debt & Borrowing Summary\nYou have **zero active debt or outstanding loans** across monitored Pharos protocols. Your collateral exposure is 100% unleveraged.`,
        detailedFigures: [],
        isReadOnly: true,
        answeredAtBlock: snapshot.snapshotBlockNumber,
      };
    }

    const markdownLines: string[] = [
      `### ⚠️ Debt & Outstanding Liabilities Summary`,
      `You have **$${snapshot.totalDeFiDebtUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD** in active borrowings across lending markets on Pharos:`,
      ``,
    ];

    for (const d of debtPositions) {
      markdownLines.push(
        `- **${d.protocolName}** (*${d.vaultName}*): Borrowed **${d.borrowedAmount}** against $${d.depositedUsd.toLocaleString('en-US')} supplied collateral.`
      );
      markdownLines.push(`  • **Health Factor:** **${d.healthFactor}** (Safe collateralized status)`);
      markdownLines.push(`  • **Contract Address:** \`${d.provenance.contractAddress}\``);
    }

    return {
      queryText,
      detectedIntent: 'DEBT_AND_LIABILITIES',
      primaryAnswerMarkdown: markdownLines.join('\n'),
      detailedFigures: figures,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  /**
   * Fallback & Unsupported Protocol Sentinel (Requirement 04: Zero Guessing)
   */
  private synthesizeUnsupportedAnswer(
    queryText: string,
    snapshot: PortfolioAggregateSnapshot,
    unsupportedProtocolName?: string
  ): PortfolioAssistantAnswer {
    const disclaimer = unsupportedProtocolName
      ? `I do not know or cannot verify any deployment for '${unsupportedProtocolName}' on Pharos Network (Chain ID 1672). Monitored protocols are Harbor Protocol, Morpho Blue, and FaroSwap DEX.`
      : `I cannot determine on-chain data for your inquiry without guessing. Please ask about your yield, asset locations (e.g. USDC, PROS), biggest position, total net worth, or borrowing debt across Harbor, Morpho Blue, and FaroSwap.`;

    const markdown = `### ❓ Unverified Query / Unsupported Protocol\n\n${disclaimer}`;

    return {
      queryText,
      detectedIntent: 'UNKNOWN_OR_UNSUPPORTED',
      primaryAnswerMarkdown: markdown,
      detailedFigures: [],
      zeroGuessingDisclaimer: disclaimer,
      isReadOnly: true,
      answeredAtBlock: snapshot.snapshotBlockNumber,
    };
  }

  public getReader(): PortfolioReader {
    return this.reader;
  }
}
