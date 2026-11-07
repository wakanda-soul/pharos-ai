import { IntelligenceFeed } from './feed';

export interface ToolCallExecution {
  toolName:
    | 'search_feeds'
    | 'buy_intelligence_feed'
    | 'synthesize_mesh_report'
    | 'call_chain_mcp'
    | 'query_docs_mcp';
  arguments: Record<string, any>;
  output?: any;
  paymentReceipt?: string;
  costUsdc?: number;
}

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'policy_gatekeeper';
  text: string;
  timestamp: string;
  toolCalls?: ToolCallExecution[];
  attachedIntelligence?: Record<string, unknown>;
  policyFlags?: {
    isRefusal: boolean;
    refusalCategory?: 'CODE_GENERATION_PROHIBITED' | 'OFF_TOPIC' | 'PROMPT_INJECTION' | 'BUDGET_CAP_EXCEEDED';
    humorousRemark?: string;
  };
}

export interface PolicyGatekeeperVerdict {
  isPermitted: boolean;
  reason?: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedCorrection?: string;
}

export interface EmbeddedAgentWalletState {
  address: string;
  balanceUsdc: number;
  balanceNativePros: number;
  nonce: number;
  isAuthed: boolean;
  walletMode: 'PRIVY_EMBEDDED' | 'DIRECT_SESSION' | 'BROWSER_EXTENSION';
}
