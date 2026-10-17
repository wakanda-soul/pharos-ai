export interface DocSource {
  title: string;
  url: string;
}

export interface DocSearchResult {
  query: string;
  isFound: boolean;
  answer: string;
  sources: DocSource[];
  suggestedFollowUps?: string[];
  rawMarkdown?: string;
  responseTimeMs?: number;
}

export interface DocSearchOptions {
  goal?: string;
  json?: boolean;
  timeoutMs?: number;
  verbose?: boolean;
}
