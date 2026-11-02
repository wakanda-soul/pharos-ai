import { GatekeeperDecision, PolicyConfig, AuditLogEntry } from './types.js';

// ANSI escape styling helpers with zero third-party dependencies
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

export function formatPolicySummary(policy: PolicyConfig): string {
  const lines: string[] = [];
  lines.push(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  lines.push(`${c.bold}${c.cyan}║                   PHAROS ZERO-TRUST POLICY GATEKEEPER ENGINE                 ║${c.reset}`);
  lines.push(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  lines.push('');
  lines.push(`${c.bold}Policy ID:${c.reset}      ${c.yellow}${policy.policyId}${c.reset} (v${policy.version})`);
  lines.push(`${c.bold}Policy Name:${c.reset}    ${c.white}${policy.name}${c.reset}`);
  lines.push(`${c.bold}Description:${c.reset}    ${c.gray}${policy.description}${c.reset}`);
  lines.push('');
  lines.push(`${c.bold}${c.magenta}─── RULE DEFINITIONS ──────────────────────────────────────────────────────────${c.reset}`);

  // Spend Limits
  const spend = policy.rules.spendLimits;
  lines.push(`  ${c.bold}${c.yellow}1. Spend Limits:${c.reset} [${spend.id}]`);
  lines.push(`     • Native Ceiling:     ${c.green}${spend.maxPerTxNativePros.toFixed(2)} PROS${c.reset}`);
  lines.push(`     • Token Ceiling:      ${c.green}${spend.maxPerTxTokenUsdc.toFixed(2)} USDC${c.reset}`);
  lines.push(`     • Global USD Ceiling: ${c.green}$${spend.maxGlobalPerTxUsd.toFixed(2)} USD${c.reset}`);
  lines.push(`     • Daily Rolling Cap:  ${c.green}$${spend.rollingDailyBudgetUsd.toFixed(2)} USD${c.reset}`);
  lines.push('');

  // Allowlists
  const allow = policy.rules.allowlist;
  lines.push(`  ${c.bold}${c.blue}2. Allowlist Boundaries:${c.reset} [${allow.id}]`);
  lines.push(`     • Allowed Contracts:    ${c.cyan}${allow.allowedContracts.length} addresses${c.reset}`);
  for (const item of allow.allowedContracts) {
    lines.push(`       └─ ${c.gray}${item}${c.reset}`);
  }
  lines.push(`     • Blocked Blacklist:    ${c.red}${allow.blockedAddresses.length} addresses${c.reset}`);
  for (const b of allow.blockedAddresses) {
    lines.push(`       └─ ${c.red}${b} (BLOCKED)${c.reset}`);
  }
  lines.push(`     • Authorized Selectors: ${c.cyan}${allow.allowedFunctionSelectors.length} methods${c.reset}`);
  lines.push('');

  // Time Window
  const time = policy.rules.timeWindow;
  lines.push(`  ${c.bold}${c.cyan}3. Time Window Policies:${c.reset} [${time.id}]`);
  lines.push(`     • Operational Hours:    ${c.green}${time.allowedUtcHours.start}:00 - ${time.allowedUtcHours.end}:00 UTC${c.reset}`);
  lines.push(`     • Active Days:          ${c.green}${time.allowedDaysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}${c.reset}`);
  if (time.blackoutWindows?.length) {
    lines.push(`     • Blackout Windows:     ${c.yellow}${time.blackoutWindows.length} maintenance window(s) scheduled${c.reset}`);
  }
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  return lines.join('\n');
}

export function formatDecisionReport(decision: GatekeeperDecision): string {
  const lines: string[] = [];
  const isAllow = decision.verdict === 'ALLOW';

  const banner = isAllow
    ? `${c.bold}${c.bgGreen} ✓ [ALLOW] ACTION AUTHORIZED FOR ON-CHAIN DISPATCH ${c.reset}`
    : `${c.bold}${c.bgRed} ⛔ [DENY] ACTION INTERCEPTED - ON-CHAIN EXECUTION BLOCKED ${c.reset}`;

  lines.push('');
  lines.push(banner);
  lines.push('');
  lines.push(`${c.bold}Decision ID:${c.reset}      ${c.white}${decision.decisionId}${c.reset}`);
  lines.push(`${c.bold}Evaluated At:${c.reset}     ${c.gray}${decision.timestamp}${c.reset}`);
  lines.push(`${c.bold}Agent ID:${c.reset}         ${c.yellow}${decision.proposal.agentId}${c.reset}`);
  lines.push(`${c.bold}Action Type:${c.reset}      ${c.cyan}${decision.proposal.actionType}${c.reset}`);
  lines.push(`${c.bold}Target Contract:${c.reset}  ${c.blue}${decision.proposal.targetContract}${c.reset}`);
  lines.push(`${c.bold}Function Method:${c.reset}  ${c.magenta}${decision.proposal.functionSelector}${c.reset}`);
  lines.push(`${c.bold}Value Payload:${c.reset}    ${c.white}${decision.proposal.nativeValuePros ?? 0} PROS | ${decision.proposal.tokenValueUsdc ?? 0} USDC${c.reset} (≈ $${decision.telemetry.computedUsdValue.toFixed(2)} USD @ $${decision.telemetry.oraclePriceUsd.toFixed(2)}/ETH)`);
  lines.push('');
  lines.push(`${c.bold}─── DECIDING RULE ─────────────────────────────────────────────────────────────${c.reset}`);
  lines.push(`${c.bold}Rule ID:${c.reset}           ${c.yellow}${decision.decidingRuleId}${c.reset}`);
  lines.push(`${c.bold}Rule Category:${c.reset}     ${c.cyan}${decision.decidingRuleType}${c.reset}`);
  lines.push(`${c.bold}Rule Title:${c.reset}        ${c.white}${decision.decidingRuleName}${c.reset}`);
  lines.push(`${c.bold}Verdict:${c.reset}           ${isAllow ? `${c.green}${c.bold}ALLOW` : `${c.red}${c.bold}DENY`}${c.reset}`);
  lines.push(`${c.bold}Governance Reason:${c.reset} ${isAllow ? `${c.green}${decision.rationale}` : `${c.red}${decision.rationale}`}${c.reset}`);
  lines.push('');
  lines.push(`${c.bold}─── RULE EVALUATION MATRIX ────────────────────────────────────────────────────${c.reset}`);
  for (const ev of decision.evaluations) {
    const statusIcon = ev.passed ? `${c.green}✓ PASS${c.reset}` : `${c.red}✗ FAIL${c.reset}`;
    lines.push(`  ${statusIcon} [${c.yellow}${ev.ruleId}${c.reset}] ${c.gray}${ev.message}${c.reset}`);
  }

  if (isAllow && decision.authorizationTicket) {
    const ticket = decision.authorizationTicket;
    lines.push('');
    lines.push(`${c.bold}${c.green}─── AUTHORIZATION TICKET ──────────────────────────────────────────────────────${c.reset}`);
    lines.push(`${c.bold}Ticket Hash:${c.reset}      ${c.cyan}${ticket.ticketHash}${c.reset}`);
    lines.push(`${c.bold}Valid Until:${c.reset}      ${c.gray}${ticket.expiresAt}${c.reset}`);
    lines.push(`${c.bold}Cast Command:${c.reset}     ${c.yellow}${ticket.castCommand}${c.reset}`);
  } else {
    lines.push('');
    lines.push(`${c.bold}${c.red}─── SECURITY ENFORCEMENT ──────────────────────────────────────────────────────${c.reset}`);
    lines.push(`${c.red}  ⛔ Action ticket WITHHELD. Execution payload was safely neutralized.${c.reset}`);
    lines.push(`${c.red}  ⛔ No Foundry cast dispatch command generated. No network state mutated.${c.reset}`);
  }
  lines.push('───────────────────────────────────────────────────────────────────────────────');

  return lines.join('\n');
}

export function formatAuditLogTable(entries: AuditLogEntry[]): string {
  if (entries.length === 0) {
    return `${c.gray}No audit log entries recorded.${c.reset}`;
  }

  const lines: string[] = [];
  lines.push(`${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  lines.push(`${c.bold}${c.cyan}║                                HISTORICAL AUDIT LOG LEDGER                                             ║${c.reset}`);
  lines.push(`${c.bold}${c.cyan}╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
  lines.push(
    `${c.bold}Timestamp (UTC)          | Agent ID             | Verdict | Deciding Rule                  | Target${c.reset}`
  );
  lines.push(`${c.gray}${'─'.repeat(100)}${c.reset}`);

  for (const e of entries) {
    const vStr = e.verdict === 'ALLOW' ? `${c.green}${c.bold}ALLOW${c.reset}` : `${c.red}${c.bold}DENY ${c.reset}`;
    const timeStr = `${c.gray}${e.timestamp.slice(0, 19).replace('T', ' ')}${c.reset}`;
    const agentStr = `${c.yellow}${e.agentId.padEnd(20).slice(0, 20)}${c.reset}`;
    const ruleStr = `${c.cyan}${e.decidingRuleId.padEnd(30).slice(0, 30)}${c.reset}`;
    const targetStr = `${c.gray}${e.targetContract.slice(0, 10)}...${e.targetContract.slice(-4)}${c.reset}`;
    lines.push(`${timeStr} | ${agentStr} | ${vStr}   | ${ruleStr} | ${targetStr}`);
  }
  lines.push(`${c.gray}${'─'.repeat(100)}${c.reset}`);
  lines.push(`${c.bold}Total Recorded Entries: ${entries.length}${c.reset}`);

  return lines.join('\n');
}
