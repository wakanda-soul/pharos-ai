import { encodeFunctionData, parseUnits } from 'viem';
import { ProtocolAdapter } from './base-adapter.js';
import { ProtocolVenue, UserPosition, UnsignedTransaction } from '../types.js';

const ERC4626_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export class MorphoAdapter implements ProtocolAdapter {
  readonly protocolId = 'morpho' as const;
  readonly protocolName = 'Morpho Blue (RockawayX Curated)';

  private readonly defaultRpcUrl = 'https://rpc.pharos.xyz';
  private readonly chainId = 1672;

  private readonly usdcToken: `0x${string}` = '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0';
  private readonly morphoUsdcVault: `0x${string}` = '0x4422119933AaBbCcDdEeFf001122334455667788';

  async fetchRates(): Promise<ProtocolVenue[]> {
    // In production, live rates are pulled from Morpho GraphQL API / on-chain MetaMorpho vault state
    return [
      {
        id: 'morpho:rockawayx-usdc',
        protocolId: 'morpho',
        protocolName: 'Morpho Blue (RockawayX Curated)',
        vaultName: 'RockawayX USDC MetaMorpho Vault',
        underlyingToken: 'USDC',
        tokenAddress: this.usdcToken,
        vaultAddress: this.morphoUsdcVault,
        assetClass: 'Onchain Lending',
        lockupTenor: 'liquid',
        apyPercent: 8.50,
        tvlUsd: 11119914,
        minDepositUsd: 1,
        safetyScore: 94,
        isLive: true,
        statusMessage: 'Overcollateralized lending pool. Instant liquidity with zero lockup period.',
      },
    ];
  }

  async fetchPositions(userAddress: `0x${string}`): Promise<UserPosition[]> {
    return [
      {
        venueId: 'morpho:rockawayx-usdc',
        protocolId: 'morpho',
        protocolName: 'Morpho Blue (RockawayX Curated)',
        vaultName: 'RockawayX USDC MetaMorpho Vault',
        underlyingToken: 'USDC',
        depositedAmount: '2500.00',
        depositedValueUsd: 2500.00,
        earnedYieldUsd: 53.12,
        currentApyPercent: 8.50,
        lockupTenor: 'liquid',
        sharesBalance: '2500000000',
        vaultAddress: this.morphoUsdcVault,
      },
    ];
  }

  async prepareDeposit(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction> {
    const venues = await this.fetchRates();
    const venue = venues.find((v) => v.id === venueId);
    if (!venue) {
      throw new Error(`Morpho venue ${venueId} not found`);
    }

    const parsedAmount = parseUnits(amountUnits, 6);

    const calldata = encodeFunctionData({
      abi: ERC4626_ABI,
      functionName: 'deposit',
      args: [parsedAmount, userAddress],
    });

    const castCommand = `cast send ${venue.vaultAddress} "deposit(uint256,address)" ${parsedAmount.toString()} ${userAddress} --rpc-url ${this.defaultRpcUrl}`;

    return {
      to: venue.vaultAddress,
      from: userAddress,
      data: calldata,
      value: '0x0',
      chainId: this.chainId,
      gasLimit: '110000',
      methodName: 'deposit(uint256 assets, address receiver)',
      argsSummary: {
        protocol: 'Morpho Blue',
        curator: 'RockawayX',
        assets: `${amountUnits} USDC`,
        rawAmount: parsedAmount.toString(),
        receiver: userAddress,
      },
      humanReadable: `Supply ${amountUnits} USDC into Morpho Blue MetaMorpho Vault for instant 8.5% floating APY`,
      castCommand,
    };
  }

  async prepareWithdraw(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction> {
    const venues = await this.fetchRates();
    const venue = venues.find((v) => v.id === venueId);
    if (!venue) {
      throw new Error(`Morpho venue ${venueId} not found`);
    }

    const parsedAmount = parseUnits(amountUnits, 6);

    const calldata = encodeFunctionData({
      abi: ERC4626_ABI,
      functionName: 'withdraw',
      args: [parsedAmount, userAddress, userAddress],
    });

    const castCommand = `cast send ${venue.vaultAddress} "withdraw(uint256,address,address)" ${parsedAmount.toString()} ${userAddress} ${userAddress} --rpc-url ${this.defaultRpcUrl}`;

    return {
      to: venue.vaultAddress,
      from: userAddress,
      data: calldata,
      value: '0x0',
      chainId: this.chainId,
      gasLimit: '130000',
      methodName: 'withdraw(uint256 assets, address receiver, address owner)',
      argsSummary: {
        protocol: 'Morpho Blue',
        assets: `${amountUnits} USDC`,
        rawAmount: parsedAmount.toString(),
        receiver: userAddress,
        owner: userAddress,
      },
      humanReadable: `Instantly withdraw ${amountUnits} USDC from Morpho Blue lending pool back to ${userAddress}`,
      castCommand,
    };
  }
}
