/**
 * Task 08: Docs MCP + Chain MCP Agent Types
 * Data models for explaining contract functions via Docs MCP and executing via Chain MCP.
 */

export interface FunctionTarget {
  id: string;
  contractName: string;
  contractAddress: `0x${string}`;
  functionName: string;
  functionSignature: string;
  abi: any;
  args: any[];
  docsQuery: string;
  docsExpectedTopic: string;
}

export interface DocsSource {
  title: string;
  url: string;
}

export interface DocsExplanation {
  query: string;
  explanation: string;
  parametersDescription: Record<string, string>;
  returnDescription: string;
  sources: DocsSource[];
  isRetrievedFromDocs: boolean;
}

export interface ChainCallResult {
  contractAddress: `0x${string}`;
  functionName: string;
  functionSignature: string;
  rawCalldata: `0x${string}`;
  rawOutputHex: `0x${string}`;
  decodedResult: any;
  blockNumber: number;
  network: string;
  chainId: number;
}

export interface ContextualInterpretation {
  summary: string;
  insights: string[];
  consistencyWithDocs: 'VERIFIED_CONSISTENT' | 'UNEXPECTED_STATE';
  detailedAnalysis: string;
}

export interface ExplainAndActResult {
  executionId: string;
  timestamp: string;
  target: FunctionTarget;
  docsExplanation: DocsExplanation;
  chainCall: ChainCallResult;
  interpretation: ContextualInterpretation;
}
