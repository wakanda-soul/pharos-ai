import { describe, it, expect } from 'vitest';
import { HarborAdapter } from '../src/adapters/harbor-adapter.js';
import { MorphoAdapter } from '../src/adapters/morpho-adapter.js';
import { FaroSwapAdapter } from '../src/adapters/faroswap-adapter.js';

describe('Task 30: Calldata Encoding & Transaction Preparation', () => {
  const harbor = new HarborAdapter();
  const morpho = new MorphoAdapter();
  const faroswap = new FaroSwapAdapter();

  const userAddress = '0x1000000000000000000000000000000000000001' as const;

  describe('Harbor RWA ERC-4626 Calldata', () => {
    it('should encode ERC-4626 deposit calldata with selector 0x6e553f65', async () => {
      const tx = await harbor.prepareDeposit('harbor:apc3m', '1000', userAddress);

      expect(tx.to).toBe('0x7141528646B971a8F9BF96b21c172d1F0B180A5F');
      expect(tx.data.startsWith('0x6e553f65')).toBe(true);
      expect(tx.chainId).toBe(1672);
      expect(tx.value).toBe('0x0');
      expect(tx.castCommand).toContain('cast send');
      expect(tx.castCommand).toContain('https://rpc.pharos.xyz');
    });

    it('should encode ERC-4626 withdraw calldata with selector 0xb460af94', async () => {
      const tx = await harbor.prepareWithdraw('harbor:apc3m', '500', userAddress);

      expect(tx.to).toBe('0x7141528646B971a8F9BF96b21c172d1F0B180A5F');
      expect(tx.data.startsWith('0xb460af94')).toBe(true);
      expect(tx.chainId).toBe(1672);
      expect(tx.argsSummary.receiver).toBe(userAddress);
    });
  });

  describe('Morpho Blue Calldata', () => {
    it('should prepare valid MetaMorpho deposit transaction', async () => {
      const tx = await morpho.prepareDeposit('morpho:rockawayx-usdc', '2500', userAddress);

      expect(tx.to).toBe('0x4422119933AaBbCcDdEeFf001122334455667788');
      expect(tx.data.startsWith('0x6e553f65')).toBe(true);
      expect(tx.humanReadable).toContain('Supply 2500 USDC into Morpho Blue');
    });

    it('should prepare valid MetaMorpho withdrawal transaction', async () => {
      const tx = await morpho.prepareWithdraw('morpho:rockawayx-usdc', '1250', userAddress);

      expect(tx.to).toBe('0x4422119933AaBbCcDdEeFf001122334455667788');
      expect(tx.data.startsWith('0xb460af94')).toBe(true);
      expect(tx.humanReadable).toContain('Instantly withdraw 1250 USDC');
    });
  });

  describe('FaroSwap AMM Router Calldata', () => {
    it('should encode Uniswap V2 addLiquidity calldata with selector 0xe8e33700', async () => {
      const tx = await faroswap.prepareDeposit('faroswap:wpros-usdc', '1000', userAddress);

      expect(tx.to).toBe('0xba3b00c3b0632b6fa622f990924976725227b68a');
      expect(tx.data.startsWith('0xe8e33700')).toBe(true);
      expect(tx.castCommand).toContain('addLiquidity');
    });

    it('should encode Uniswap V2 removeLiquidity calldata with selector 0xbaa2abde', async () => {
      const tx = await faroswap.prepareWithdraw('faroswap:wpros-usdc', '500', userAddress);

      expect(tx.to).toBe('0xba3b00c3b0632b6fa622f990924976725227b68a');
      expect(tx.data.startsWith('0xbaa2abde')).toBe(true);
      expect(tx.castCommand).toContain('removeLiquidity');
    });
  });
});
