import { TransactionDiagnostic } from "./types.js";

export class DiagnosticFormatter {
  /**
   * Formats a clear terminal post-mortem report.
   */
  static formatConsole(diag: TransactionDiagnostic): string {
    const divider = "=".repeat(80);
    const subDivider = "-".repeat(80);

    const isSuccess = diag.status === "SUCCESS";
    const statusIcon = isSuccess ? "🟢 SUCCESS" : "🔴 FAILED";
    const categoryBadge = diag.failureCategory ? `[${diag.failureCategory}]` : "";

    const lines: (string | null)[] = [
      divider,
      `  🩺  PHAROS DAPP SUPPORT AGENT: TRANSACTION POST-MORTEM`,
      divider,
      `Transaction:  ${diag.txHash}`,
      `Status:       ${statusIcon} ${categoryBadge}`,
      `Network:      ${diag.network.toUpperCase()} (Block #${diag.blockNumber})`,
      `Sender:       ${diag.from}`,
      `Contract:     ${diag.to}`,
      `Value:        ${diag.value}`,
      `Gas Limit:    ${diag.gasLimit.toLocaleString()} units`,
      `Gas Consumed: ${diag.gasUsed.toLocaleString()} units (${((Number(diag.gasUsed) / (Number(diag.gasLimit) || 1)) * 100).toFixed(1)}%)`,
      `Effective Gas:${diag.effectiveGasCost} (${diag.gasPriceGwei} Gwei)`,
      subDivider,
      `📋 DIAGNOSIS & PLAIN-LANGUAGE EXPLANATION:`,
      `   ${diag.explanation}`,
    ];

    if (diag.rawRevertReason) {
      lines.push(`   (Raw Revert Identifier: ${diag.rawRevertReason})`);
    }

    if (!isSuccess && diag.remedy.length > 0) {
      lines.push(subDivider);
      lines.push(`💊 HOW TO FIX (ACTIONABLE PRESCRIPTION):`);
      diag.remedy.forEach((step, idx) => {
        lines.push(`   ${idx + 1}. ${step}`);
      });
    }

    if (diag.suggestedCastCommand) {
      lines.push(subDivider);
      lines.push(`💻 QUICK FIX COMMAND (FOUNDRY CAST):`);
      lines.push(`   ${diag.suggestedCastCommand}`);
    }

    lines.push(subDivider);
    lines.push(`🔗 EXPLORER LINK:`);
    lines.push(`   ${diag.explorerUrl}`);
    lines.push(divider);

    return lines.filter(Boolean).join("\n");
  }

  /**
   * Generates a pre-formatted Markdown Support Ticket ready to paste into Discord or GitHub issues.
   */
  static formatMarkdownTicket(diag: TransactionDiagnostic): string {
    return `### 🚨 dApp Incident Report: \`${diag.txHash.slice(0, 10)}...\`

- **Status:** ${diag.status === "SUCCESS" ? "✅ Success" : "❌ Reverted"}
- **Failure Cause:** \`${diag.failureCategory || "N/A"}\`
- **Network:** Pharos ${diag.network} (Block #${diag.blockNumber})
- **Contract Called:** \`${diag.to}\`
- **Sender Address:** \`${diag.from}\`
- **Gas Usage:** ${diag.gasUsed.toLocaleString()} / ${diag.gasLimit.toLocaleString()} (${((Number(diag.gasUsed) / (Number(diag.gasLimit) || 1)) * 100).toFixed(1)}%)
- **Explorer:** [PharosScan Explorer](${diag.explorerUrl})

#### 🔍 What Happened:
${diag.explanation}

#### 🛠️ Recommended Solution:
${diag.remedy.map((r, i) => `${i + 1}. ${r}`).join("\n")}

${diag.suggestedCastCommand ? `\`\`\`bash\n${diag.suggestedCastCommand}\n\`\`\`` : ""}

*Generated autonomously by Pharos dApp Support Agent.*`;
  }
}
