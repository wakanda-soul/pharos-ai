import {
  createPublicClient,
  http,
  PublicClient,
  parseAbi,
  formatUnits,
  sha256,
  toHex,
} from 'viem';
import {
  PolicyConfig,
  ActionProposal,
  GatekeeperDecision,
  RuleCheckEvaluation,
  AuthorizationTicket,
} from './types.js';
import { DEFAULT_POLICY } from './default-policy.js';
import { AuditLogger } from './audit-logger.js';

const ORACLE_ADDRESS: `0x${string}` = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8';
const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

export class PolicyGatekeeperEngine {
  private config: PolicyConfig;
  private client: PublicClient;
  private auditLogger: AuditLogger;

  constructor(customConfig?: Partial<PolicyConfig>, auditLogger?: AuditLogger, client?: PublicClient) {
    this.config = {
      ...DEFAULT_POLICY,
      ...customConfig,
      rules: {
        spendLimits: { ...DEFAULT_POLICY.rules.spendLimits, ...customConfig?.rules?.spendLimits },
        allowlist: { ...DEFAULT_POLICY.rules.allowlist, ...customConfig?.rules?.allowlist },
        timeWindow: { ...DEFAULT_POLICY.rules.timeWindow, ...customConfig?.rules?.timeWindow },
      },
    };
    this.auditLogger = auditLogger ?? new AuditLogger();
    this.client = client ?? createPublicClient({
      transport: http('https://rpc.pharos.xyz', {
        retryCount: 5,
        retryDelay: 1000,
      }),
    });
  }

  /**
   * Evaluates an agent action proposal against all active policy rules.
   * Every request deterministically returns ALLOW or DENY with the specific rule that decided it.
   */
  async evaluate(proposal: ActionProposal): Promise<GatekeeperDecision> {
    const decisionId = `dec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    const proposalDate = proposal.timestamp ? new Date(proposal.timestamp) : new Date(timestamp);
    const evaluations: RuleCheckEvaluation[] = [];

    // Query on-chain oracle for live USD translation
    const oraclePriceUsd = await this.fetchOraclePriceUsd();
    const nativeVal = proposal.nativeValuePros ?? 0;
    const tokenVal = proposal.tokenValueUsdc ?? 0;
    const computedUsdValue = (nativeVal * oraclePriceUsd) + tokenVal;

    let verdict: GatekeeperDecision['verdict'] = 'ALLOW';
    let decidingRuleId = 'RULE_POLICY_CLEARANCE';
    let decidingRuleType: GatekeeperDecision['decidingRuleType'] = 'GLOBAL_POLICY';
    let decidingRuleName = 'All Policy Gates Passed';
    let rationale = 'Action proposal complies with all spend limits, authorized allowlists, and operational time windows.';

    // =========================================================================
    // RULE TYPE 1: Spend Limits & Velocity
    // =========================================================================
    const spend = this.config.rules.spendLimits;

    // Check 1A: Native PROS limit
    if (nativeVal > spend.maxPerTxNativePros) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_SPEND_LIMIT_NATIVE';
      decidingRuleType = 'SPEND_LIMIT';
      decidingRuleName = 'Native PROS Spend Ceiling';
      rationale = `Spend limit exceeded: Proposed ${nativeVal} PROS exceeds per-transaction limit of ${spend.maxPerTxNativePros} PROS.`;
      evaluations.push({ ruleType: 'SPEND_LIMIT', ruleId: decidingRuleId, passed: false, message: rationale });
    } else {
      evaluations.push({
        ruleType: 'SPEND_LIMIT',
        ruleId: 'RULE_SPEND_LIMIT_NATIVE',
        passed: true,
        message: `Native value ${nativeVal} PROS is within limit (${spend.maxPerTxNativePros} PROS).`,
      });
    }

    // Check 1B: USDC Token limit
    if (verdict === 'ALLOW' && tokenVal > spend.maxPerTxTokenUsdc) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_SPEND_LIMIT_USDC';
      decidingRuleType = 'SPEND_LIMIT';
      decidingRuleName = 'USDC Token Spend Ceiling';
      rationale = `Spend limit exceeded: Proposed ${tokenVal} USDC exceeds per-transaction limit of ${spend.maxPerTxTokenUsdc} USDC.`;
      evaluations.push({ ruleType: 'SPEND_LIMIT', ruleId: decidingRuleId, passed: false, message: rationale });
    } else if (verdict === 'ALLOW') {
      evaluations.push({
        ruleType: 'SPEND_LIMIT',
        ruleId: 'RULE_SPEND_LIMIT_USDC',
        passed: true,
        message: `Token value ${tokenVal} USDC is within limit (${spend.maxPerTxTokenUsdc} USDC).`,
      });
    }

    // Check 1C: Global USD limit
    if (verdict === 'ALLOW' && computedUsdValue > spend.maxGlobalPerTxUsd) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_SPEND_LIMIT_GLOBAL_USD';
      decidingRuleType = 'SPEND_LIMIT';
      decidingRuleName = 'Global USD Value Ceiling';
      rationale = `Global USD ceiling exceeded: Estimated transaction value of $${computedUsdValue.toFixed(2)} USD exceeds limit of $${spend.maxGlobalPerTxUsd.toFixed(2)} USD.`;
      evaluations.push({ ruleType: 'SPEND_LIMIT', ruleId: decidingRuleId, passed: false, message: rationale });
    }

    // =========================================================================
    // RULE TYPE 2: Allowlist & Security Boundaries
    // =========================================================================
    const allowlist = this.config.rules.allowlist;
    const targetLower = proposal.targetContract.toLowerCase();

    // Check 2A: Explicitly Blocked / Malicious Address
    const isBlocked = allowlist.blockedAddresses.some((b) => b.toLowerCase() === targetLower);
    if (verdict === 'ALLOW' && isBlocked) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_ALLOWLIST_BLOCKED_ADDRESS';
      decidingRuleType = 'ALLOWLIST';
      decidingRuleName = 'Blacklisted Address Interception';
      rationale = `Security alert: Target contract ${proposal.targetContract} is explicitly blacklisted as a known malicious or reverting address.`;
      evaluations.push({ ruleType: 'ALLOWLIST', ruleId: decidingRuleId, passed: false, message: rationale });
    }

    // Check 2B: Allowed Contract Boundary
    const isContractAllowed = allowlist.allowedContracts.some((a) => a.toLowerCase() === targetLower);
    if (verdict === 'ALLOW' && !isContractAllowed) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_ALLOWLIST_CONTRACT';
      decidingRuleType = 'ALLOWLIST';
      decidingRuleName = 'Contract Allowlist Verification';
      rationale = `Unauthorized contract: Target address ${proposal.targetContract} is not registered on the verified contract allowlist.`;
      evaluations.push({ ruleType: 'ALLOWLIST', ruleId: decidingRuleId, passed: false, message: rationale });
    } else if (verdict === 'ALLOW') {
      evaluations.push({
        ruleType: 'ALLOWLIST',
        ruleId: 'RULE_ALLOWLIST_CONTRACT',
        passed: true,
        message: `Target contract ${proposal.targetContract} is verified on the approved allowlist.`,
      });
    }

    // Check 2C: Recipient Allowlist (if recipient is provided)
    if (verdict === 'ALLOW' && proposal.recipientAddress) {
      const recipientLower = proposal.recipientAddress.toLowerCase();
      const isRecipientAllowed = allowlist.allowedRecipients.some((r) => r.toLowerCase() === recipientLower);
      if (!isRecipientAllowed) {
        verdict = 'DENY';
        decidingRuleId = 'RULE_ALLOWLIST_RECIPIENT';
        decidingRuleType = 'ALLOWLIST';
        decidingRuleName = 'Recipient Allowlist Verification';
        rationale = `Unauthorized recipient: Destination address ${proposal.recipientAddress} is not registered on the approved recipient allowlist.`;
        evaluations.push({ ruleType: 'ALLOWLIST', ruleId: decidingRuleId, passed: false, message: rationale });
      }
    }

    // Check 2D: Function Selector Allowlist
    if (verdict === 'ALLOW') {
      const isFuncAllowed = allowlist.allowedFunctionSelectors.includes(proposal.functionSelector);
      if (!isFuncAllowed) {
        verdict = 'DENY';
        decidingRuleId = 'RULE_ALLOWLIST_FUNCTION_SELECTOR';
        decidingRuleType = 'ALLOWLIST';
        decidingRuleName = 'Function Selector Allowlist Verification';
        rationale = `Unauthorized function: Method signature "${proposal.functionSelector}" is not permitted for autonomous execution.`;
        evaluations.push({ ruleType: 'ALLOWLIST', ruleId: decidingRuleId, passed: false, message: rationale });
      } else {
        evaluations.push({
          ruleType: 'ALLOWLIST',
          ruleId: 'RULE_ALLOWLIST_FUNCTION_SELECTOR',
          passed: true,
          message: `Function selector "${proposal.functionSelector}" is authorized.`,
        });
      }
    }

    // =========================================================================
    // RULE TYPE 3: Operational Time Windows & Blackouts
    // =========================================================================
    const timeWin = this.config.rules.timeWindow;
    const utcHour = proposalDate.getUTCHours();
    const utcDay = proposalDate.getUTCDay();

    // Check 3A: Allowed Operational Hours (e.g. 08:00 - 22:00 UTC)
    const isWithinHours = utcHour >= timeWin.allowedUtcHours.start && utcHour < timeWin.allowedUtcHours.end;
    if (verdict === 'ALLOW' && !isWithinHours) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_TIME_WINDOW_OPERATIONAL_HOURS';
      decidingRuleType = 'TIME_WINDOW';
      decidingRuleName = 'Operational Hours Window Enforcement';
      rationale = `Time window violation: Current request time (${utcHour.toString().padStart(2, '0')}:00 UTC) is outside approved operational window (${timeWin.allowedUtcHours.start}:00 - ${timeWin.allowedUtcHours.end}:00 UTC).`;
      evaluations.push({ ruleType: 'TIME_WINDOW', ruleId: decidingRuleId, passed: false, message: rationale });
    } else if (verdict === 'ALLOW') {
      evaluations.push({
        ruleType: 'TIME_WINDOW',
        ruleId: 'RULE_TIME_WINDOW_OPERATIONAL_HOURS',
        passed: true,
        message: `Request time (${utcHour}:00 UTC) is within active operational window.`,
      });
    }

    // Check 3B: Allowed Days of Week
    if (verdict === 'ALLOW' && !timeWin.allowedDaysOfWeek.includes(utcDay)) {
      verdict = 'DENY';
      decidingRuleId = 'RULE_TIME_WINDOW_DAY_OF_WEEK';
      decidingRuleType = 'TIME_WINDOW';
      decidingRuleName = 'Day-of-Week Operational Policy';
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      rationale = `Execution freeze: Execution is prohibited on ${days[utcDay]}s according to governance policy.`;
      evaluations.push({ ruleType: 'TIME_WINDOW', ruleId: decidingRuleId, passed: false, message: rationale });
    }

    // Check 3C: Planned Maintenance Blackout Window
    if (verdict === 'ALLOW' && timeWin.blackoutWindows) {
      const nowIso = proposalDate.toISOString();
      for (const bw of timeWin.blackoutWindows) {
        if (nowIso >= bw.start && nowIso <= bw.end) {
          verdict = 'DENY';
          decidingRuleId = 'RULE_TIME_WINDOW_BLACKOUT';
          decidingRuleType = 'TIME_WINDOW';
          decidingRuleName = 'Protocol Maintenance Blackout';
          rationale = `Blackout active: Action falls within scheduled maintenance window (${bw.start} to ${bw.end}). Reason: ${bw.reason}`;
          evaluations.push({ ruleType: 'TIME_WINDOW', ruleId: decidingRuleId, passed: false, message: rationale });
          break;
        }
      }
    }

    // =========================================================================
    // Authorization Ticket (Requirement 03: Denied actions are NEVER executed)
    // =========================================================================
    let authorizationTicket: AuthorizationTicket | undefined;

    if (verdict === 'ALLOW') {
      const rawPayload = `${decisionId}:${proposal.actionId}:${proposal.targetContract}:${timestamp}`;
      const ticketHash = sha256(toHex(rawPayload));
      const expiry = new Date(Date.now() + 600000).toISOString(); // 10 minutes expiry

      const castParts = ['cast send', proposal.targetContract, `"${proposal.functionSelector}"`];
      if (proposal.calldata && proposal.calldata !== '0x') {
        castParts.push(`--data "${proposal.calldata}"`);
      }
      castParts.push('--rpc-url https://rpc.pharos.xyz');

      authorizationTicket = {
        ticketHash,
        issuedAt: timestamp,
        expiresAt: expiry,
        authorizedTarget: proposal.targetContract,
        castCommand: castParts.join(' '),
      };
    }

    const decision: GatekeeperDecision = {
      decisionId,
      timestamp,
      proposal,
      verdict,
      decidingRuleId,
      decidingRuleType,
      decidingRuleName,
      rationale,
      evaluations,
      authorizationTicket,
      telemetry: {
        network: 'Pharos Mainnet',
        chainId: 1672,
        oraclePriceUsd,
        computedUsdValue,
      },
    };

    // Requirement 04: Keeps an audit log of all decisions
    this.auditLogger.log(decision);

    return decision;
  }

  getConfig(): PolicyConfig {
    return this.config;
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  private async fetchOraclePriceUsd(): Promise<number> {
    try {
      const data = await this.client.readContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: 'latestRoundData',
      });
      const [, answerRaw] = data as [bigint, bigint, bigint, bigint, bigint];
      return parseFloat(formatUnits(answerRaw, 18));
    } catch {
      return 2300.0;
    }
  }
}
