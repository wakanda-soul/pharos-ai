import {
  X402PaymentResponsePayload,
} from './types.js';
import { X402ClientExecutionLog } from './x402-client.js';

export class X402TerminalFormatter {
  static formatHeader(): string {
    return [
      '╔══════════════════════════════════════════════════════════════════════════════╗',
      '║            PHAROS x402 HTTP-NATIVE PAYWALLED API ENGINE                      ║',
      '║       Atlantic Testnet (eip155:688689) • Autonomous Facilitator & Client     ║',
      '╚══════════════════════════════════════════════════════════════════════════════╝',
    ].join('\n');
  }

  static formatLog(title: string, log: X402ClientExecutionLog): string {
    const lines: string[] = [];
    lines.push(`================================================================================`);
    lines.push(`▶ ${title}`);
    lines.push(`================================================================================`);

    // Step 1: Initial Handshake
    lines.push(`[HTTP Handshake]: Initial Status = ${log.initialStatus}`);
    if (log.initialStatus === 402) {
      lines.push(`  └─ 402 Payment Required: Server demanded ${log.requiredPriceUsdc} USDC`);
    }

    // Step 2: Payment Authorization
    if (log.authorizationSigned) {
      const auth = log.authorizationSigned;
      lines.push('');
      lines.push(`[EIP-712 Authorization Signed]:`);
      lines.push(`  Payer Address:     ${auth.clientPayerAddress}`);
      lines.push(`  Authorized Amount: ${auth.decimalPriceUsdc} USDC`);
      lines.push(`  Destination:       ${auth.payToRecipient}`);
      lines.push(`  Nonce:             ${auth.nonce}`);
      lines.push(`  Signature:         ${auth.signatureHex.slice(0, 34)}... (${auth.signatureHex.length} chars)`);
    }

    // Step 3: Second Request & Settlement
    lines.push('');
    lines.push(`[Facilitator Settlement]: Second Request Status = ${log.secondStatus}`);
    if (log.paymentResponse) {
      const resp = log.paymentResponse;
      lines.push(`  Status:            ✓ ${resp.status}`);
      lines.push(`  Network:           ${resp.network}`);
      lines.push(`  Amount Settled:    ${resp.amountSettled}`);
      lines.push(`  On-Chain Tx Hash:  ${resp.transactionHash}`);
      lines.push(`  Explorer URL:      🔗 ${resp.explorerUrl}`);
    } else if (log.secondStatus === 402) {
      lines.push(`  Status:            ✗ 402 PAYMENT REJECTED`);
      lines.push(`  Rejection Reason:  ${log.finalBody?.reason || log.finalBody?.error || 'Rejected by Facilitator'}`);
    }

    // Step 4: Paywalled Data
    lines.push('');
    lines.push(`[Payload Response]:`);
    lines.push(JSON.stringify(log.finalBody, null, 2));

    return lines.join('\n');
  }
}
