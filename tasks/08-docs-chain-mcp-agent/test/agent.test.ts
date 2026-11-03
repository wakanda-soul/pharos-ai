import { describe, it, expect } from 'vitest';
import { ExplainThenActAgent } from '../src/agent.js';
import { getPresetTarget } from '../src/contracts-catalog.js';

describe('Task 08: Docs MCP + Chain MCP Agent', () => {
  const agent = new ExplainThenActAgent();

  it('Requirement 01: The explanation comes from Docs MCP, with sources referenced', async () => {
    const target = getPresetTarget('usdc:totalSupply');
    const docs = await agent.explainFunction(target);

    expect(docs.query).toBe(target.docsQuery);
    expect(docs.explanation).toBeTruthy();
    expect(docs.sources.length).toBeGreaterThan(0);
    for (const src of docs.sources) {
      expect(src.url.startsWith('https://docs.pharos.xyz')).toBe(true);
    }
  }, 40000);

  it('Requirement 02: The agent then calls the same function on chain via Chain MCP', async () => {
    const target = getPresetTarget('usdc:totalSupply');
    const chainCall = await agent.executeOnChain(target);

    expect(chainCall.contractAddress).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815');
    expect(chainCall.functionName).toBe('totalSupply');
    expect(chainCall.rawCalldata.startsWith('0x18160ddd')).toBe(true);
    expect(chainCall.rawOutputHex).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(typeof chainCall.decodedResult).toBe('bigint');
    expect(chainCall.blockNumber).toBeGreaterThan(1000000);
  }, 20000);

  it('Requirement 03: Interprets the result in the context of the explanation', async () => {
    const target = getPresetTarget('usdc:totalSupply');
    const docs = await agent.explainFunction(target);
    const chainCall = await agent.executeOnChain(target);
    const interpretation = agent.interpretResult(target, docs, chainCall);

    expect(interpretation.consistencyWithDocs).toBe('VERIFIED_CONSISTENT');
    expect(interpretation.summary).toContain('circulating supply');
    expect(interpretation.insights.length).toBeGreaterThan(0);
    expect(interpretation.detailedAnalysis).toContain('totalSupply');
  }, 25000);

  it('Requirement 04: Works for at least 2 different functions or contracts', async () => {
    // Contract 1: Oracle latestRoundData()
    const oracleResult = await agent.explainAndAct('oracle:latestRoundData');
    expect(oracleResult.target.contractName).toContain('Oracle');
    expect(oracleResult.docsExplanation.sources.length).toBeGreaterThan(0);
    expect(oracleResult.chainCall.functionName).toBe('latestRoundData');
    expect(Array.isArray(oracleResult.chainCall.decodedResult)).toBe(true);
    expect(oracleResult.interpretation.summary).toContain('Oracle');

    // Contract 2: Native USDC totalSupply()
    const usdcResult = await agent.explainAndAct('usdc:totalSupply');
    expect(usdcResult.target.contractName).toContain('USDC');
    expect(usdcResult.docsExplanation.sources.length).toBeGreaterThan(0);
    expect(usdcResult.chainCall.functionName).toBe('totalSupply');
    expect(typeof usdcResult.chainCall.decodedResult).toBe('bigint');
    expect(usdcResult.interpretation.summary).toContain('USDC');
  }, 40000);
});
