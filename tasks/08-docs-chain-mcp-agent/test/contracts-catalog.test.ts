import { describe, it, expect } from 'vitest';
import { CONTRACT_PRESETS, getPresetTarget } from '../src/contracts-catalog.js';

describe('Task 08: Contracts Catalog', () => {
  it('should contain at least 2 verified contracts on Pharos Mainnet', () => {
    const keys = Object.keys(CONTRACT_PRESETS);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(CONTRACT_PRESETS['oracle:latestRoundData']).toBeDefined();
    expect(CONTRACT_PRESETS['usdc:totalSupply']).toBeDefined();
  });

  it('should find preset by full id or short function name', () => {
    const target1 = getPresetTarget('oracle:latestRoundData');
    expect(target1.contractAddress).toBe('0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8');

    const target2 = getPresetTarget('totalSupply');
    expect(target2.contractAddress).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815');
  });

  it('should throw an informative error when an unknown preset is requested', () => {
    expect(() => getPresetTarget('nonexistent:function')).toThrowError(/Unknown contract function preset/);
  });
});
