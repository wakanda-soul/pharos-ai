/**
 * Individual Risk Signal Evaluators for Pharos Network.
 * Checks contract maturity, bytecode transparency, threat directory taint,
 * dangerous token allowances, and fresh wallet funding anomalies.
 */

import { type EvaluatedRiskSignal, type OnChainAccountProfile } from './types.js';
import { ThreatIntelligenceRegistry } from './flag-catalog.js';

/**
 * Signal 1: Contract Age & Deployment Maturity Check.
 * Flash-deployed contracts are commonly used in exit scams and zero-day exploits.
 */
export function evaluateContractAgeSignal(profile: OnChainAccountProfile): EvaluatedRiskSignal {
  if (profile.accountType === 'EOA' || profile.accountType === 'UNINITIALIZED_ZERO_NONCE') {
    return {
      signalCategory: 'CONTRACT_AGE',
      signalName: 'Contract Age Maturity',
      isTriggered: false,
      severity: 'BENIGN',
      scoreContribution: 0,
      plainLanguageExplanation: 'Account is an externally owned address (EOA); contract deployment age check is not applicable.',
      observedEvidence: `Account type is ${profile.accountType} with ${profile.transactionCount} total transactions.`,
    };
  }

  // Contract age evaluation
  const hours = profile.accountAgeHours;
  if (hours < 24) {
    return {
      signalCategory: 'CONTRACT_AGE',
      signalName: 'Freshly Deployed Immature Contract',
      isTriggered: true,
      severity: 'CRITICAL',
      scoreContribution: 30,
      plainLanguageExplanation:
        'This contract was deployed less than 24 hours ago. Brand-new contracts have no proven security track record and frequently represent experimental tests or newly deployed exploit tools.',
      observedEvidence: `Contract deployed only ${hours.toFixed(1)} hours ago at block ${profile.firstSeenBlockNumber}.`,
    };
  }

  if (hours < 168) {
    // Under 7 days
    return {
      signalCategory: 'CONTRACT_AGE',
      signalName: 'Young Smart Contract (< 7 Days)',
      isTriggered: true,
      severity: 'MEDIUM',
      scoreContribution: 15,
      plainLanguageExplanation:
        'This contract is less than one week old. While not necessarily malicious, it has not yet accumulated sufficient production longevity.',
      observedEvidence: `Contract age is ${(hours / 24).toFixed(1)} days (less than 7-day recommended incubation threshold).`,
    };
  }

  return {
    signalCategory: 'CONTRACT_AGE',
    signalName: 'Mature Smart Contract',
    isTriggered: false,
    severity: 'BENIGN',
    scoreContribution: 0,
    plainLanguageExplanation:
      'Contract exhibits established operational history with over 7 days of verified on-chain runtime.',
    observedEvidence: `Contract has been live for ${(hours / 24).toFixed(0)} days across ${profile.transactionCount} transactions.`,
  };
}

/**
 * Signal 2: Bytecode Source Code Verification Check.
 * Opaque, unverified bytecode prevents security auditing and hides backdoor logic.
 */
export function evaluateCodeVerificationSignal(profile: OnChainAccountProfile): EvaluatedRiskSignal {
  if (!profile.hasBytecode) {
    return {
      signalCategory: 'CODE_VERIFICATION',
      signalName: 'Bytecode Verification',
      isTriggered: false,
      severity: 'BENIGN',
      scoreContribution: 0,
      plainLanguageExplanation:
        'Target is an Externally Owned Account (EOA) and holds no smart contract bytecode.',
      observedEvidence: 'Zero bytecode deployed at address.',
    };
  }

  if (!profile.isSourceCodeVerified) {
    return {
      signalCategory: 'CODE_VERIFICATION',
      signalName: 'Unverified Opaque Bytecode',
      isTriggered: true,
      severity: 'CRITICAL',
      scoreContribution: 35,
      plainLanguageExplanation:
        'The contract source code is completely unverified on PharosScan. You cannot review what internal functions, mint capabilities, or fund-draining routines exist behind the bytecode.',
      observedEvidence: 'Unverified raw EVM bytecode detected; source repository or compiler metadata unavailable.',
    };
  }

  return {
    signalCategory: 'CODE_VERIFICATION',
    signalName: 'Verified Open Source Code',
    isTriggered: false,
    severity: 'BENIGN',
    scoreContribution: 0,
    plainLanguageExplanation:
      'Contract source code is publicly verified on PharosScan, allowing independent security review of logic and permissions.',
    observedEvidence: 'Verified Solidity source code matching deployed bytecode hash.',
  };
}

/**
 * Signal 3: Interaction with Flagged Illicit / Malicious Addresses.
 * Checks if the address has transacted with or received funding from known phishing drainers or exploiters.
 */
export function evaluateFlaggedAssociationSignal(
  profile: OnChainAccountProfile,
  threatRegistry: ThreatIntelligenceRegistry,
): EvaluatedRiskSignal {
  const isDirectFundingFlagged =
    profile.fundingSourceAddress && threatRegistry.isFlaggedAddress(profile.fundingSourceAddress);
  const totalFlaggedIncidents = profile.flaggedInteractionsCount + (isDirectFundingFlagged ? 1 : 0);

  if (totalFlaggedIncidents > 0) {
    const threatDetails = profile.fundingSourceAddress
      ? threatRegistry.lookupThreat(profile.fundingSourceAddress)
      : undefined;

    const threatName = threatDetails?.entityName ?? 'Known Pharos Drainer / Exploiter';

    return {
      signalCategory: 'FLAGGED_ASSOCIATION',
      signalName: 'Direct Association with Flagged Threat Entity',
      isTriggered: true,
      severity: 'CRITICAL',
      scoreContribution: 45,
      plainLanguageExplanation:
        `This address has direct transaction or funding ties to a known threat entity: ${threatName}. Interacting with this account poses an immediate risk of loss or tainted counterparty exposure.`,
      observedEvidence: `Detected ${totalFlaggedIncidents} interaction(s) with flagged security blacklist entries (Funding Source: ${profile.fundingSourceAddress ?? 'None'}).`,
    };
  }

  return {
    signalCategory: 'FLAGGED_ASSOCIATION',
    signalName: 'No Flagged Security Threats',
    isTriggered: false,
    severity: 'BENIGN',
    scoreContribution: 0,
    plainLanguageExplanation:
      'No historical interactions, inbound funding, or approvals linked to known blacklist entries or phishing syndicates.',
    observedEvidence: 'Zero interactions with known illicit Pharos addresses.',
  };
}

/**
 * Signal 4: Unusual / Unlimited Token Approvals.
 * Dangling unlimited allowances to unverified spenders allow unexpected balance drains.
 */
export function evaluateApprovalAnomaliesSignal(profile: OnChainAccountProfile): EvaluatedRiskSignal {
  if (profile.highRiskAllowancesCount > 0) {
    return {
      signalCategory: 'APPROVAL_ANOMALIES',
      signalName: 'Dangerous Unlimited Token Approvals',
      isTriggered: true,
      severity: 'HIGH',
      scoreContribution: 25,
      plainLanguageExplanation:
        'This wallet has granted unlimited (MaxUint256) token spending approvals to unverified or suspicious external contracts. If those spenders are exploited or rogue, your tokens can be swept instantly.',
      observedEvidence: `${profile.highRiskAllowancesCount} unlimited ERC-20 token allowance(s) active on-chain.`,
    };
  }

  return {
    signalCategory: 'APPROVAL_ANOMALIES',
    signalName: 'Healthy Token Allowances',
    isTriggered: false,
    severity: 'BENIGN',
    scoreContribution: 0,
    plainLanguageExplanation:
      'No dangling unlimited approvals to untrusted contracts found. Allowance posture is clean.',
    observedEvidence: 'Zero dangerous token allowances detected.',
  };
}

/**
 * Signal 5: Freshly Funded Account / Burner Sybil Check.
 * Brand new accounts with low transaction count created right before a transaction are prime phishing vectors.
 */
export function evaluateFundingFreshnessSignal(profile: OnChainAccountProfile): EvaluatedRiskSignal {
  // Edge Case: Completely uninitialized address with zero nonce and zero balance
  // (e.g., a friend's new wallet receiving its first inbound transfer)
  if (profile.accountType === 'UNINITIALIZED_ZERO_NONCE' || (profile.transactionCount === 0 && Number(profile.nativeBalanceEther) === 0)) {
    return {
      signalCategory: 'FUNDING_FRESHNESS',
      signalName: 'Uninitialized Recipient Address (Zero Nonce)',
      isTriggered: true,
      severity: 'LOW',
      scoreContribution: 10,
      plainLanguageExplanation:
        'This address has zero prior on-chain transactions and holds zero balance. It appears to be a brand new or uninitialized wallet. Normal for first-time payment recipients, but verify address spelling with the owner.',
      observedEvidence: 'Zero historical transactions (nonce: 0) and zero native coin balance.',
    };
  }

  const isBrandNew = profile.accountAgeHours < 12;
  const hasVeryLowHistory = profile.transactionCount <= 2;

  if (isBrandNew && hasVeryLowHistory) {
    return {
      signalCategory: 'FUNDING_FRESHNESS',
      signalName: 'Freshly Created Active Burner Wallet',
      isTriggered: true,
      severity: 'HIGH',
      scoreContribution: 25,
      plainLanguageExplanation:
        'This account was created less than 12 hours ago and has virtually no transaction history (<= 2 txs). Scammers routinely generate disposable burner addresses to lure victims.',
      observedEvidence: `Account age: ${profile.accountAgeHours.toFixed(1)} hours with only ${profile.transactionCount} prior transaction(s).`,
    };
  }

  if (profile.accountAgeHours < 48 && profile.transactionCount <= 5) {
    return {
      signalCategory: 'FUNDING_FRESHNESS',
      signalName: 'Recently Funded Low-Activity Wallet',
      isTriggered: true,
      severity: 'MEDIUM',
      scoreContribution: 10,
      plainLanguageExplanation:
        'Wallet was funded within the last 48 hours and has conducted very few transactions. Exercise heightened vigilance.',
      observedEvidence: `Account age: ${(profile.accountAgeHours / 24).toFixed(1)} days with ${profile.transactionCount} transaction(s).`,
    };
  }

  return {
    signalCategory: 'FUNDING_FRESHNESS',
    signalName: 'Established Account Longevity',
    isTriggered: false,
    severity: 'BENIGN',
    scoreContribution: 0,
    plainLanguageExplanation:
      'Account demonstrates organic age and normal historical activity on Pharos Network.',
    observedEvidence: `Account has been active for ${(profile.accountAgeHours / 24).toFixed(0)} days across ${profile.transactionCount} transactions.`,
  };
}
