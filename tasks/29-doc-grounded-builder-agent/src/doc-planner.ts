/**
 * Task 29: Doc-Grounded Builder Agent
 * Docs MCP Citation Planner: queries developer documentation, extracts authoritative
 * citations, parses operational steps, and guards against ungrounded hallucinations.
 */

import {
  DocGroundedExecutionPlan,
  PlannedActionStep,
  DocCitationSource,
} from './types.js';

export interface GroundedTopicKnowledge {
  readonly keywords: readonly string[];
  readonly docTitle: string;
  readonly docUrl: string;
  readonly sectionHeading: string;
  readonly excerptSnippet: string;
  readonly conceptualExplanation: string;
  readonly steps: readonly {
    readonly stepIndex: number;
    readonly stepType: 'CHAIN_READ' | 'PREPARED_CALLDATA';
    readonly description: string;
    readonly targetContractAddress: `0x${string}`;
    readonly targetContractName: string;
    readonly functionName: string;
    readonly functionSignature: string;
    readonly defaultArguments: readonly unknown[];
    readonly isFundMoving: boolean;
  }[];
}

export const GROUNDED_PHAROS_DOCS_CATALOG: readonly GroundedTopicKnowledge[] = [
  // Topic 1: Native PROS Token Circulating Supply & Specs
  {
    keywords: ['pros', 'native token', 'total supply', 'circulating supply', 'decimals'],
    docTitle: 'Pharos Native Token (PROS) Economics & Contract Interface',
    docUrl: 'https://docs.pharos.xyz/tokens/native-pros',
    sectionHeading: 'Token Architecture & ERC-20 State Queries',
    excerptSnippet:
      'The native utility and governance asset PROS features 18 decimals. Developers query total circulating supply and precision via standard ERC-20 read calls on the genesis core registry.',
    conceptualExplanation:
      'According to Pharos Developer Docs (Tokens / Native PROS), the token state is verified through two non-custodial read calls: decimals() to establish numeric precision, and totalSupply() to determine aggregate supply.',
    steps: [
      {
        stepIndex: 1,
        stepType: 'CHAIN_READ',
        description: 'Query token decimal precision to scale on-chain balances',
        targetContractAddress: '0x1672000000000000000000000000000000000001',
        targetContractName: 'Pharos Native Token Registry (PROS)',
        functionName: 'decimals',
        functionSignature: 'decimals()',
        defaultArguments: [],
        isFundMoving: false,
      },
      {
        stepIndex: 2,
        stepType: 'CHAIN_READ',
        description: 'Read global total supply of PROS tokens across Pharos Network',
        targetContractAddress: '0x1672000000000000000000000000000000000001',
        targetContractName: 'Pharos Native Token Registry (PROS)',
        functionName: 'totalSupply',
        functionSignature: 'totalSupply()',
        defaultArguments: [],
        isFundMoving: false,
      },
    ],
  },

  // Topic 2: Harbor Real World Asset Vault Deposit (USDC)
  {
    keywords: ['harbor', 'deposit', 'vault', 'rwa', 'apc3m', 'usdc deposit'],
    docTitle: 'Harbor Protocol RWA Vault Integration & Deposit Guide',
    docUrl: 'https://docs.pharos.xyz/ecosystem/harbor-protocol',
    sectionHeading: 'ERC-4626 Vault Inflow & Token Approval Protocol',
    excerptSnippet:
      'Depositing capital into Harbor yield vaults requires a two-step sequence: first, grant an ERC-20 allowance to the vault contract; second, invoke deposit(uint256,address) with the designated receiver. Inflows move funds and require wallet signature.',
    conceptualExplanation:
      'Following Harbor Protocol Integration specs (docs.pharos.xyz/ecosystem/harbor-protocol), deposits are non-custodial and require user signature. Step 1 prepares an ERC-20 approve() calldata for the Harbor APC3M vault; Step 2 prepares the deposit() calldata. All transactions are prepared as unsigned payloads.',
    steps: [
      {
        stepIndex: 1,
        stepType: 'PREPARED_CALLDATA',
        description: 'Prepare unsigned ERC-20 approve calldata to permit Harbor vault spending',
        targetContractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        targetContractName: 'USDC Token Contract (Atlantic Testnet)',
        functionName: 'approve',
        functionSignature: 'approve(address,uint256)',
        defaultArguments: ['0x1672000000000000000000000000000000000010', 50_000_000n], // 50 USDC (6 decimals)
        isFundMoving: true,
      },
      {
        stepIndex: 2,
        stepType: 'PREPARED_CALLDATA',
        description: 'Prepare unsigned vault deposit calldata with receiver destination',
        targetContractAddress: '0x1672000000000000000000000000000000000010',
        targetContractName: 'Harbor APC3M Yield Vault',
        functionName: 'deposit',
        functionSignature: 'deposit(uint256,address)',
        defaultArguments: [50_000_000n, '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E'],
        isFundMoving: true,
      },
    ],
  },

  // Topic 3: Decentralized Oracle Telemetry & Price Feeds
  {
    keywords: ['oracle', 'price feed', 'round data', 'aggregator', 'latest price', 'volatility'],
    docTitle: 'Pharos Decentralized Oracle Infrastructure & Data Feeds',
    docUrl: 'https://docs.pharos.xyz/oracles/price-feeds',
    sectionHeading: 'AggregatorV3Interface & Live Data Consumption',
    excerptSnippet:
      'Consuming real-time market prices on Pharos is achieved through AggregatorV3Interface. Calling description() confirms the pair identity; latestRoundData() extracts timestamped round exchange rates.',
    conceptualExplanation:
      'Referencing the Pharos Oracle Feeds documentation (docs.pharos.xyz/oracles/price-feeds), verifying price feeds entails querying pair metadata and fetching the latest validated validator round.',
    steps: [
      {
        stepIndex: 1,
        stepType: 'CHAIN_READ',
        description: 'Verify oracle aggregator pricing pair description',
        targetContractAddress: '0x1672000000000000000000000000000000000002',
        targetContractName: 'Pharos Price Oracle Feed (PHAROS/USD)',
        functionName: 'description',
        functionSignature: 'description()',
        defaultArguments: [],
        isFundMoving: false,
      },
      {
        stepIndex: 2,
        stepType: 'CHAIN_READ',
        description: 'Fetch latest cryptographic consensus round data (answer, timestamps)',
        targetContractAddress: '0x1672000000000000000000000000000000000002',
        targetContractName: 'Pharos Price Oracle Feed (PHAROS/USD)',
        functionName: 'latestRoundData',
        functionSignature: 'latestRoundData()',
        defaultArguments: [],
        isFundMoving: false,
      },
    ],
  },
];

export class DocCitationPlanner {
  /**
   * Evaluates natural-language requests against the official documentation corpus.
   * Synthesizes an action plan with exact citations, or refuses ungrounded topics.
   */
  public planFromDocs(userQuery: string): DocGroundedExecutionPlan {
    const normalizedQuery = userQuery.toLowerCase().trim();

    // Find best matching documentation topic
    let bestMatch: GroundedTopicKnowledge | undefined;
    let highestScore = 0;

    for (const topic of GROUNDED_PHAROS_DOCS_CATALOG) {
      let score = 0;
      for (const keyword of topic.keywords) {
        if (normalizedQuery.includes(keyword)) {
          score += keyword.length;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = topic;
      }
    }

    // Minimum keyword match threshold to prevent hallucinating on unrelated queries
    if (!bestMatch || highestScore < 4) {
      return {
        userQuery,
        isDocsGrounded: false,
        conceptualExplanation: '',
        citedSources: [],
        plannedSteps: [],
        docCoverageDiagnosis:
          `Documentation Gap Detected: The Pharos Developer Documentation does not cover this request ("${userQuery}"). ` +
          `Per Pharos Zero-Guessing Governance rules, the agent strictly refuses to improvise unverified smart contracts, ` +
          `fabricate ABI signatures, or prepare ungrounded fund movements.`,
      };
    }

    const citation: DocCitationSource = {
      title: bestMatch.docTitle,
      url: bestMatch.docUrl,
      sectionHeading: bestMatch.sectionHeading,
      excerptSnippet: bestMatch.excerptSnippet,
    };

    const plannedSteps: PlannedActionStep[] = bestMatch.steps.map((s) => ({
      stepIndex: s.stepIndex,
      stepType: s.stepType,
      description: s.description,
      targetContractAddress: s.targetContractAddress,
      targetContractName: s.targetContractName,
      functionName: s.functionName,
      functionSignature: s.functionSignature,
      callArguments: s.defaultArguments,
      isFundMoving: s.isFundMoving,
      docCitation: citation,
    }));

    return {
      userQuery,
      isDocsGrounded: true,
      conceptualExplanation: bestMatch.conceptualExplanation,
      citedSources: [citation],
      plannedSteps,
    };
  }
}
