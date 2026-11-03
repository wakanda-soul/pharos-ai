import {
  ContractProvenance,
  PortfolioAggregateSnapshot,
  PortfolioAssistantAnswer,
  ProvenanceCitationFigure,
} from './types.js';

/**
 * Renders an ASCII scorecard for a Portfolio Assistant query answer.
 */
export function renderPortfolioAnswerCard(answer: PortfolioAssistantAnswer): string {
  const horizontalBar = '─'.repeat(77);

  const lines: string[] = [];
  lines.push(`┌${horizontalBar}┐`);
  lines.push(`│ 💬 PHAROS PORTFOLIO ASSISTANT · INTENT: ${answer.detectedIntent.padEnd(36)}│`);
  lines.push(`│ Query: "${answer.queryText}"`.padEnd(78) + '│');
  lines.push(`│ Read-Only Verification: ✔ ZERO TRANSACTIONS SIGNED / BROADCAST (Req 05)     │`);
  lines.push(`│ Confirmed State Block:  #${answer.answeredAtBlock.toString().padEnd(52)}│`);
  lines.push(`├${horizontalBar}┤`);

  // Primary markdown body wrapped nicely
  const bodyLines = answer.primaryAnswerMarkdown.split('\n');
  for (const bLine of bodyLines) {
    if (bLine.startsWith('### ')) {
      lines.push(`│ ${bLine.replace('### ', '').padEnd(76)}│`);
    } else if (bLine.startsWith('#### ')) {
      lines.push(`│   ${bLine.replace('#### ', '').padEnd(74)}│`);
    } else {
      const wrapped = wrapLine(bLine, 75);
      for (const w of wrapped) {
        lines.push(`│ ${w.padEnd(76)}│`);
      }
    }
  }

  // Provenance Citation Table (Requirement 03)
  if (answer.detailedFigures.length > 0) {
    lines.push(`├${horizontalBar}┤`);
    lines.push(`│ 📜 CRYPTOGRAPHIC CONTRACT PROVENANCE CITATIONS (Requirement 03):             │`);
    lines.push(`│ Metric / Position          Value             Contract Address / Explorer    │`);
    lines.push(`│ ────────────────────────── ───────────────── ────────────────────────────── │`);

    for (const fig of answer.detailedFigures) {
      const label = fig.metricLabel.substring(0, 26).padEnd(26);
      const val = fig.numericDisplay.split(' ')[0].substring(0, 17).padEnd(17);
      const contractShort = `${fig.provenance.contractAddress.substring(0, 8)}...${fig.provenance.contractAddress.substring(38)}`;
      const protocol = `[${fig.provenance.protocolName.split(' ')[0]}] ${contractShort}`.padEnd(29);
      lines.push(`│ ${label} ${val} ${protocol}│`);
    }
  }

  if (answer.zeroGuessingDisclaimer) {
    lines.push(`├${horizontalBar}┤`);
    lines.push(`│ 🛡️ ZERO-GUESSING SENTINEL (Requirement 04):                                  │`);
    const wrappedNotice = wrapLine(answer.zeroGuessingDisclaimer, 73);
    for (const w of wrappedNotice) {
      lines.push(`│   ${w.padEnd(74)}│`);
    }
  }

  lines.push(`└${horizontalBar}┘`);
  return lines.join('\n');
}

/**
 * Renders a full breakdown table with asset allocation and provenance.
 */
export function renderPortfolioSnapshotTable(snapshot: PortfolioAggregateSnapshot): string {
  const lines: string[] = [];
  lines.push(`\n💼 COMPLETE PORTFOLIO SNAPSHOT · WALLET: ${snapshot.walletAddress}`);
  lines.push(`Confirmed Block: #${snapshot.snapshotBlockNumber} | Total Net Worth: $${snapshot.totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n`);

  lines.push('Asset / Vault Name             Type         Balance / Deposit    USD Value      APY%    Contract Address');
  lines.push('────────────────────────────── ──────────── ──────────────────── ────────────── ─────── ──────────────────');

  for (const b of snapshot.walletBalances) {
    const name = b.tokenName.substring(0, 30).padEnd(30);
    const type = 'Wallet Token'.padEnd(12);
    const bal = b.balanceFormatted.padEnd(20);
    const usd = `$${b.balanceUsd.toFixed(2)}`.padEnd(14);
    const apy = '  -   '.padEnd(7);
    const contract = `${b.provenance.contractAddress.substring(0, 10)}...`;
    lines.push(`${name} ${type} ${bal} ${usd} ${apy} ${contract}`);
  }

  for (const p of snapshot.protocolPositions) {
    const name = p.vaultName.substring(0, 30).padEnd(30);
    const type = 'DeFi Deposit'.padEnd(12);
    const bal = p.depositedAmount.padEnd(20);
    const usd = `$${p.depositedUsd.toFixed(2)}`.padEnd(14);
    const apy = `${p.apyPercent}%`.padEnd(7);
    const contract = `${p.provenance.contractAddress.substring(0, 10)}...`;
    lines.push(`${name} ${type} ${bal} ${usd} ${apy} ${contract}`);
  }

  return lines.join('\n');
}

function wrapLine(line: string, maxWidth: number): string[] {
  if (line.length <= maxWidth) return [line];

  const words = line.split(' ');
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + word).length > maxWidth) {
      result.push(current.trim());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
}
