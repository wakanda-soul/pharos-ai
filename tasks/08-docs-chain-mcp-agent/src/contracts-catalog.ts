import { parseAbi } from 'viem';
import { FunctionTarget } from './types.js';

export const CONTRACT_PRESETS: Record<string, FunctionTarget> = {
  'oracle:latestRoundData': {
    id: 'oracle:latestRoundData',
    contractName: 'Pharos Decentralized Price Feed Oracle',
    contractAddress: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
    functionName: 'latestRoundData',
    functionSignature: 'latestRoundData()',
    abi: parseAbi([
      'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    ]),
    args: [],
    docsQuery: 'how does latestRoundData work in Chainlink AggregatorV3 price feed oracles on Pharos',
    docsExpectedTopic: 'AggregatorV3Interface Oracle Price Feeds',
  },
  'usdc:totalSupply': {
    id: 'usdc:totalSupply',
    contractName: 'Pharos Native USDC Token',
    contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
    functionName: 'totalSupply',
    functionSignature: 'totalSupply()',
    abi: parseAbi([
      'function totalSupply() external view returns (uint256)',
    ]),
    args: [],
    docsQuery: 'what does totalSupply represent in ERC-20 token standard on Pharos and how is it queried',
    docsExpectedTopic: 'ERC-20 Standard Total Supply Function',
  },
  'oracle:description': {
    id: 'oracle:description',
    contractName: 'Pharos Decentralized Price Feed Oracle',
    contractAddress: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
    functionName: 'description',
    functionSignature: 'description()',
    abi: parseAbi([
      'function description() external view returns (string)',
    ]),
    args: [],
    docsQuery: 'what is the description function in Chainlink price oracle feeds on EVM',
    docsExpectedTopic: 'Oracle Feed Identification & Metadata',
  },
  'link:totalSupply': {
    id: 'link:totalSupply',
    contractName: 'ChainLink Token (LINK)',
    contractAddress: '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29',
    functionName: 'totalSupply',
    functionSignature: 'totalSupply()',
    abi: parseAbi([
      'function totalSupply() external view returns (uint256)',
    ]),
    args: [],
    docsQuery: 'what does totalSupply represent in ERC-20 token standard on Pharos',
    docsExpectedTopic: 'ERC-20 Token Economics & Circulating Supply',
  },
};

export function getPresetTarget(targetId: string): FunctionTarget {
  const normalized = targetId.toLowerCase().trim();
  const match = Object.values(CONTRACT_PRESETS).find(
    (p) => p.id.toLowerCase() === normalized || p.id.split(':')[1]?.toLowerCase() === normalized
  );

  if (!match) {
    const available = Object.keys(CONTRACT_PRESETS).join(', ');
    throw new Error(`Unknown contract function preset '${targetId}'. Available presets: ${available}`);
  }

  return match;
}
