/**
 * Terminal UI Formatter for Pharos Wallet Risk Checker.
 * Renders structured risk appraisal cards, signal breakdowns,
 * visual risk score meters, and plain-language guidance banners.
 */

import { type EvaluatedRiskSignal, type RiskAssessmentReport, type RiskLevel, type SignalSeverity } from './types.js';

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
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
};

function getRiskLevelBadge(level: RiskLevel): string {
  switch (level) {
    case 'HIGH':
      return `${c.bgRed}${c.white}${c.bold} 🛑 HIGH RISK DETECTED ${c.reset}`;
    case 'MEDIUM':
      return `${c.bgYellow}${c.white}${c.bold} ⚠️  MEDIUM RISK · CAUTION ${c.reset}`;
    case 'LOW':
      return `${c.bgGreen}${c.white}${c.bold} ✅ LOW RISK · CLEAN ${c.reset}`;
  }
}

function getSeverityBadge(severity: SignalSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return `${c.red}${c.bold}[CRITICAL]${c.reset}`;
    case 'HIGH':
      return `${c.red}[HIGH]${c.reset}`;
    case 'MEDIUM':
      return `${c.yellow}[MEDIUM]${c.reset}`;
    case 'LOW':
      return `${c.blue}[LOW]${c.reset}`;
    case 'BENIGN':
    default:
      return `${c.dim}[CLEAN]${c.reset}`;
  }
}

function renderScoreMeter(score: number): string {
  const totalBlocks = 20;
  const filledBlocks = Math.round((score / 100) * totalBlocks);
  const color = score >= 60 ? c.red : score >= 25 ? c.yellow : c.green;
  const bar = color + '█'.repeat(filledBlocks) + c.dim + '░'.repeat(totalBlocks - filledBlocks) + c.reset;
  return `${bar} ${c.bold}${score}/100${c.reset}`;
}

export function formatRiskAssessmentCard(report: RiskAssessmentReport): string {
  const profile = report.accountProfile;
  const badge = getRiskLevelBadge(report.riskLevel);
  const meter = renderScoreMeter(report.numericalRiskScore);

  const lines: string[] = [
    `┌─────────────────────────────────────────────────────────────────────────────┐`,
    `│ ${badge}  ${c.dim}${report.evaluatedAtIso}${c.reset}`.padEnd(85) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Target Address:${c.reset}  ${c.bold}${report.analyzedAddress}${c.reset}`.padEnd(85) + '│',
    `│  ${c.bold}Account Type:${c.reset}    ${profile.accountType} (${profile.hasBytecode ? 'Smart Contract' : 'EOA Wallet'})`.padEnd(85) + '│',
    `│  ${c.bold}Account Age:${c.reset}     ${(profile.accountAgeHours / 24).toFixed(1)} days (${profile.accountAgeHours.toFixed(1)} hours)`.padEnd(85) + '│',
    `│  ${c.bold}Total Activity:${c.reset}  ${profile.transactionCount} transactions · Balance: ${profile.nativeBalanceEther} PROS`.padEnd(85) + '│',
    `│  ${c.bold}Source Code:${c.reset}     ${profile.hasBytecode ? (profile.isSourceCodeVerified ? `${c.green}Verified on PharosScan${c.reset}` : `${c.red}${c.bold}UNVERIFIED OPAQUE BYTECODE${c.reset}`) : `${c.dim}N/A (EOA Wallet)${c.reset}`}`.padEnd(95) + '│',
    `│  ${c.bold}Threat Score:${c.reset}    ${meter}`.padEnd(95) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}${c.cyan}Evaluated Security Signals (${report.triggeredFlagsCount} of ${report.totalSignalsEvaluated} Triggered):${c.reset}`.padEnd(85) + '│',
  ];

  for (const signal of report.evaluatedSignals) {
    const icon = signal.isTriggered ? (signal.severity === 'CRITICAL' ? '🚨' : '⚠️ ') : '✅';
    const nameStr = `${icon} ${signal.signalName}`;
    const sev = getSeverityBadge(signal.severity);

    lines.push(
      `│   • ${c.bold}${nameStr}${c.reset} ${sev}`.padEnd(95) + '│',
      `│     ${c.dim}Evidence:${c.reset} ${signal.observedEvidence}`.padEnd(85) + '│',
      `│     ${c.white}${signal.plainLanguageExplanation}${c.reset}`.padEnd(85) + '│',
      `│`.padEnd(78) + '│',
    );
  }

  lines.push(
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}${c.magenta}Actionable Recommendation:${c.reset}`.padEnd(85) + '│',
    `│  ${report.summaryRecommendation}`.padEnd(85) + '│',
    `└─────────────────────────────────────────────────────────────────────────────┘`,
  );

  return lines.join('\n');
}
