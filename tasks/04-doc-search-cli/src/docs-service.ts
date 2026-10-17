import { DocSearchResult, DocSource, DocSearchOptions } from "./types";

const DOCS_BASE_URL = "https://docs.pharos.xyz";

/**
 * Service to query Pharos Developer Documentation and parse structured answers.
 */
export class PharosDocsService {
  /**
   * Search Pharos Developer Documentation with a natural-language query.
   */
  async search(query: string, options: DocSearchOptions = {}): Promise<DocSearchResult> {
    const startTime = Date.now();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return {
        query: "",
        isFound: false,
        answer: "Please provide a valid question to search Pharos documentation.",
        sources: [],
        suggestedFollowUps: [],
        responseTimeMs: 0,
      };
    }

    const askUrl = new URL(`${DOCS_BASE_URL}/index.md`);
    askUrl.searchParams.set("ask", trimmedQuery);
    if (options.goal) {
      askUrl.searchParams.set("goal", options.goal);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

    try {
      const response = await fetch(askUrl.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "text/markdown, text/plain",
          "User-Agent": "pharos-docs-cli/1.0.0 (AgentArena; wakanda-soul)",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Docs endpoint returned HTTP ${response.status}: ${response.statusText}`);
      }

      const markdown = await response.text();
      return this.parseMarkdownResponse(trimmedQuery, markdown, Date.now() - startTime);
    } catch (err: any) {
      clearTimeout(timeout);

      // Graceful offline fallback for core queries if internet connectivity glitches
      const fallback = this.checkOfflineKnowledge(trimmedQuery);
      if (fallback) {
        return {
          ...fallback,
          responseTimeMs: Date.now() - startTime,
        };
      }

      return {
        query: trimmedQuery,
        isFound: false,
        answer: `Could not retrieve documentation response: ${err.message}`,
        sources: [
          {
            title: "Pharos Official Documentation Index",
            url: `${DOCS_BASE_URL}/sitemap.md`,
          },
        ],
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse GitBook markdown response into a structured DocSearchResult.
   */
  private parseMarkdownResponse(query: string, rawMarkdown: string, responseTimeMs: number): DocSearchResult {
    const lines = rawMarkdown.split("\n");

    let title = "";
    let answerLines: string[] = [];
    const sources: DocSource[] = [];
    const followUps: string[] = [];

    let currentSection: "header" | "answer" | "followups" | "sources" = "header";

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("# Suggested Follow-up Questions") || trimmed.startsWith("## Suggested Follow-up Questions")) {
        currentSection = "followups";
        continue;
      }

      if (trimmed.startsWith("# Sources:") || trimmed.startsWith("## Sources:") || trimmed.startsWith("# Sources") || trimmed.startsWith("### Sources")) {
        currentSection = "sources";
        continue;
      }

      if (currentSection === "header") {
        if (trimmed.startsWith("# ")) {
          title = trimmed.replace(/^#\s+/, "");
          currentSection = "answer";
          continue;
        }
      }

      if (currentSection === "answer") {
        answerLines.push(line);
      } else if (currentSection === "followups") {
        const linkMatch = trimmed.match(/- \[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          followUps.push(linkMatch[1]);
        }
      } else if (currentSection === "sources") {
        const sourceMatch = trimmed.match(/- \[(.*?)\]\((.*?)\)/);
        if (sourceMatch) {
          const sTitle = sourceMatch[1];
          let sUrl = sourceMatch[2];
          if (sUrl.startsWith("/")) {
            sUrl = `${DOCS_BASE_URL}${sUrl}`;
          }
          // Avoid duplicate URLs
          if (!sources.some((s) => s.url === sUrl)) {
            sources.push({ title: sTitle, url: sUrl });
          }
        }
      }
    }

    const answer = answerLines.join("\n").trim();

    // Check if the answer indicates "no good answer found"
    const negativeIndicators = [
      "i can’t help with",
      "i can't help with",
      "i cannot help with",
      "no good answer found",
      "no direct answer found",
      "not covered in the documentation",
      "i'm here to help with information in these docs",
    ];

    const lowerAnswer = answer.toLowerCase();
    const isNegative = negativeIndicators.some((indicator) => lowerAnswer.includes(indicator));
    const isFound = !isNegative && answer.length > 0;

    return {
      query,
      isFound,
      answer: isFound ? answer : (answer.length > 0 ? answer : "No matching documentation found for this question in Pharos Developer Docs."),
      sources: isFound ? sources : this.getRecommendedGeneralSources(),
      suggestedFollowUps: followUps,
      rawMarkdown,
      responseTimeMs,
    };
  }

  /**
   * General fallback sources when a specific answer is not found.
   */
  private getRecommendedGeneralSources(): DocSource[] {
    return [
      { title: "Pharos Overview & Architecture", url: `${DOCS_BASE_URL}/introduction/readme.md` },
      { title: "Pacific Mainnet Network Configuration", url: `${DOCS_BASE_URL}/getting-started/network/pacific-mainnet.md` },
      { title: "Atlantic Testnet Network Configuration", url: `${DOCS_BASE_URL}/getting-started/network/atlantic-testnet.md` },
      { title: "Foundry Smart Contract Guide", url: `${DOCS_BASE_URL}/developer-guide/foundry.md` },
      { title: "Pharos Chain MCP Guide", url: `${DOCS_BASE_URL}/tooling-and-infrastructure/mcp.md` },
    ];
  }

  /**
   * Offline knowledge base for fundamental queries if the network is unavailable.
   */
  private checkOfflineKnowledge(query: string): Omit<DocSearchResult, "responseTimeMs"> | null {
    const q = query.toLowerCase();

    if (q.includes("chain id") || q.includes("rpc") || q.includes("network")) {
      return {
        query,
        isFound: true,
        answer: `**Pharos Network Specifications:**\n\n` +
          `• **Pacific Mainnet**:\n` +
          `  - Chain ID: \`1672\` (\`0x688\`)\n` +
          `  - RPC URL: \`https://rpc.pharos.xyz\`\n` +
          `  - Currency: \`PROS\` (18 decimals)\n` +
          `  - Explorer: \`https://pharosscan.xyz\`\n\n` +
          `• **Atlantic Testnet**:\n` +
          `  - Chain ID: \`688689\` (\`0xa8231\`)\n` +
          `  - RPC URL: \`https://atlantic.dplabs-internal.com\`\n` +
          `  - Currency: \`PHRS\` (18 decimals)\n` +
          `  - Explorer: \`https://atlantic.pharosscan.xyz\``,
        sources: [
          { title: "Pacific Mainnet", url: `${DOCS_BASE_URL}/getting-started/network/pacific-mainnet.md` },
          { title: "Atlantic Testnet", url: `${DOCS_BASE_URL}/getting-started/network/atlantic-testnet.md` },
        ],
      };
    }

    return null;
  }
}
