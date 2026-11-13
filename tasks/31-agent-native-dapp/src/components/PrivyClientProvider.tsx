'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PrivyProvider, usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { pharosMainnet, pharosPublicClient, PHAROS_CONSTANTS, ERC20_ABI } from '@/lib/pharos-chain';
import { formatEther, formatUnits, encodeFunctionData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  X402_EIP712_DOMAIN,
  X402_PAYMENT_VOUCHER_TYPES,
  X402VoucherSigningRequest,
} from '@/types/x402';

interface PharosAuthContextType {
  isPrivyReady: boolean;
  isPrivyConfigured: boolean;
  privyAppId: string;
  setPrivyAppId: (id: string) => void;
  authenticated: boolean;
  walletAddress: string | null;
  walletBalanceUsdc: number;
  walletBalancePros: number;
  login: () => void;
  logout: () => void;
  setSessionWalletAddress?: (address: string | null) => void;
  refreshBalances: () => Promise<void>;
  deductBalance: (amountUsdc: number) => void;
  depositBalance: (amountUsdc: number) => void;
  signPaymentVoucher: (params: X402VoucherSigningRequest) => Promise<string>;
  sendOnChainClaim: (
    targetPublisherAddress: string,
    amountUsdc: number
  ) => Promise<{ txHash: string; blockNumber?: number }>;
}

const PharosAuthContext = createContext<PharosAuthContextType>({
  isPrivyReady: false,
  isPrivyConfigured: false,
  privyAppId: '',
  setPrivyAppId: () => {},
  authenticated: false,
  walletAddress: null,
  walletBalanceUsdc: 0,
  walletBalancePros: 0,
  login: () => {},
  logout: () => {},
  setSessionWalletAddress: () => {},
  refreshBalances: async () => {},
  deductBalance: () => {},
  depositBalance: () => {},
  signPaymentVoucher: async () => '',
  sendOnChainClaim: async () => ({ txHash: '' }),
});

export const usePharosAuth = () => useContext(PharosAuthContext);

// Internal component that uses Privy hooks when PrivyProvider is active
function ActivePrivyAuthConsumer({
  children,
  privyAppId,
  setPrivyAppId,
}: {
  children: React.ReactNode;
  privyAppId: string;
  setPrivyAppId: (id: string) => void;
}) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin({
    onComplete: (userParam, isNewUser) => {
      console.log('Privy auth completed for user:', userParam?.id, 'isNew:', isNewUser);
    },
    onError: (err) => {
      console.warn('Privy login error or cancelled:', err);
    },
  });
  const { wallets } = useWallets();

  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState(0);
  const [walletBalancePros, setWalletBalancePros] = useState(0);
  const [localAgentAddress, setLocalAgentAddress] = useState<string | null>(null);
  const [isExplicitlyDisconnected, setIsExplicitlyDisconnected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pharos_session_disconnected') === 'true';
    }
    return false;
  });

  // Initialize or restore autonomous session key only if NOT explicitly disconnected
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDisconnected = localStorage.getItem('pharos_session_disconnected') === 'true';
      if (isDisconnected) {
        setIsExplicitlyDisconnected(true);
        setLocalAgentAddress(null);
        return;
      }
      let storedPk = localStorage.getItem('pharos_agent_session_pk');
      let storedAddr = localStorage.getItem('pharos_agent_wallet_address');
      if (!storedPk || !storedAddr) {
        const freshPk = generatePrivateKey();
        const account = privateKeyToAccount(freshPk);
        localStorage.setItem('pharos_agent_session_pk', freshPk);
        localStorage.setItem('pharos_agent_wallet_address', account.address);
        storedAddr = account.address;
      }
      setLocalAgentAddress(storedAddr);
    }
  }, []);

  const handleLogout = async () => {
    setIsExplicitlyDisconnected(true);
    setLocalAgentAddress(null);
    setWalletBalanceUsdc(0);
    setWalletBalancePros(0);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_session_disconnected', 'true');
      localStorage.removeItem('pharos_agent_wallet_address');
      localStorage.removeItem('pharos_agent_session_pk');
      localStorage.removeItem('pharos_agent_provider');
    }
    try {
      if (authenticated) {
        await logout();
      }
    } catch (err) {
      console.warn('Privy logout warning:', err);
    }
  };

  const handleLogin = () => {
    setIsExplicitlyDisconnected(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pharos_session_disconnected');
    }
    login();
  };

  const setSessionWalletAddress = (addr: string | null) => {
    if (addr) {
      setIsExplicitlyDisconnected(false);
      setLocalAgentAddress(addr);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pharos_session_disconnected');
        localStorage.setItem('pharos_agent_wallet_address', addr);
      }
    } else {
      setIsExplicitlyDisconnected(true);
      setLocalAgentAddress(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_session_disconnected', 'true');
        localStorage.removeItem('pharos_agent_wallet_address');
        localStorage.removeItem('pharos_agent_session_pk');
      }
    }
  };

  // Derived agent embedded wallet or primary connected wallet
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
  const activeCandidate = authenticated ? (user?.wallet?.address || embeddedWallet?.address) : localAgentAddress;
  const walletAddress = isExplicitlyDisconnected ? null : (activeCandidate || null);

  const refreshBalances = async () => {
    if (!walletAddress) return;
    try {
      const [prosRaw, usdcRaw] = await Promise.all([
        pharosPublicClient.getBalance({ address: walletAddress as `0x${string}` }),
        pharosPublicClient.readContract({
          address: PHAROS_CONSTANTS.nativeUsdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        }).catch(() => BigInt(0)),
      ]);

      const onChainPros = parseFloat(formatEther(prosRaw));
      const onChainUsdc = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));

      const addrKey = walletAddress.toLowerCase();
      let sessionDeposit = 0;
      let sessionSpent = 0;
      if (typeof window !== 'undefined') {
        sessionDeposit = parseFloat(localStorage.getItem(`pharos_session_deposit_${addrKey}`) || '0');
        sessionSpent = parseFloat(localStorage.getItem(`pharos_session_spent_${addrKey}`) || '0');
      }

      // Base balance: real on-chain Native USDC or a 0.010 USDC baseline for zero-balance test drive
      const baselineUsdc = Math.max(onChainUsdc, 0.010);
      const effectiveUsdc = Math.max(0, Number((baselineUsdc + sessionDeposit - sessionSpent).toFixed(4)));

      setWalletBalancePros(onChainPros);
      setWalletBalanceUsdc(effectiveUsdc);
    } catch (err) {
      console.warn('Failed to fetch Privy wallet balances on Pharos Mainnet:', err);
    }
  };

  const deductBalance = (amountUsdc: number) => {
    if (!walletAddress) return;
    const addrKey = walletAddress.toLowerCase();
    const spentKey = `pharos_session_spent_${addrKey}`;
    if (typeof window !== 'undefined') {
      const prevSpent = parseFloat(localStorage.getItem(spentKey) || '0');
      const updatedSpent = Number((prevSpent + amountUsdc).toFixed(4));
      localStorage.setItem(spentKey, updatedSpent.toString());
    }
    setWalletBalanceUsdc((prev) => Math.max(0, Number((prev - amountUsdc).toFixed(4))));
  };

  const depositBalance = (amountUsdc: number) => {
    if (!walletAddress) return;
    const addrKey = walletAddress.toLowerCase();
    const depositKey = `pharos_session_deposit_${addrKey}`;
    if (typeof window !== 'undefined') {
      const prevDeposit = parseFloat(localStorage.getItem(depositKey) || '0');
      const updatedDeposit = Number((prevDeposit + amountUsdc).toFixed(4));
      localStorage.setItem(depositKey, updatedDeposit.toString());
    }
    setWalletBalanceUsdc((prev) => Number((prev + amountUsdc).toFixed(4)));
  };

  // Cryptographically sign an EIP-712 payment voucher using the active Privy embedded account
  const signPaymentVoucher = async (params: X402VoucherSigningRequest): Promise<string> => {
    const embeddedPrivyWallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
    const activeSignerAddress = (walletAddress || embeddedPrivyWallet?.address) as `0x${string}`;

    if (embeddedPrivyWallet) {
      try {
        const provider = await embeddedPrivyWallet.getEthereumProvider();
        const structuredPayload = {
          domain: X402_EIP712_DOMAIN,
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            X402PaymentVoucher: [
              { name: 'buyerAddress', type: 'address' },
              { name: 'feedSlug', type: 'string' },
              { name: 'priceUsdcAtomic', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' },
            ],
          },
          primaryType: 'X402PaymentVoucher',
          message: {
            buyerAddress: activeSignerAddress,
            feedSlug: params.feedSlug,
            priceUsdcAtomic: BigInt(params.priceUsdcAtomic).toString(),
            nonce: BigInt(params.nonce).toString(),
            timestamp: BigInt(params.timestamp).toString(),
          },
        };

        try {
          return (await provider.request({
            method: 'eth_signTypedData_v4',
            params: [activeSignerAddress, JSON.stringify(structuredPayload)],
          })) as string;
        } catch {
          return (await provider.request({
            method: 'eth_signTypedData_v4',
            params: [activeSignerAddress, structuredPayload],
          })) as string;
        }
      } catch (privySigErr) {
        console.warn('Privy embedded wallet EIP-712 provider signing fallback to session key:', privySigErr);
      }
    }

    // Cryptographic Session Key signing fallback
    let storedPk = typeof window !== 'undefined' ? localStorage.getItem('pharos_agent_session_pk') : null;
    if (!storedPk || !storedPk.startsWith('0x')) {
      storedPk = generatePrivateKey();
      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_agent_session_pk', storedPk);
      }
    }

    const sessionAccount = privateKeyToAccount(storedPk as `0x${string}`);
    return await sessionAccount.signTypedData({
      domain: X402_EIP712_DOMAIN,
      types: X402_PAYMENT_VOUCHER_TYPES,
      primaryType: 'X402PaymentVoucher',
      message: {
        buyerAddress: sessionAccount.address,
        feedSlug: params.feedSlug,
        priceUsdcAtomic: BigInt(params.priceUsdcAtomic),
        nonce: BigInt(params.nonce),
        timestamp: BigInt(params.timestamp),
      },
    });
  };

  // Execute authentic on-chain ERC-20 transfer for claiming accumulated publisher revenue
  const sendOnChainClaim = async (
    targetPublisherAddress: string,
    amountUsdc: number
  ): Promise<{ txHash: string; blockNumber?: number }> => {
    const activeAddress = walletAddress || (typeof window !== 'undefined' ? localStorage.getItem('pharos_agent_wallet_address') : null);
    if (!activeAddress) {
      throw new Error('No active wallet account found to initiate on-chain claim.');
    }

    // Real on-chain PROS gas verification directly from Pharos Mainnet RPC
    const prosBalRaw = await pharosPublicClient.getBalance({
      address: activeAddress as `0x${string}`,
    });

    if (prosBalRaw === BigInt(0)) {
      throw new Error(
        `On-chain transaction execution rejected: Insufficient PROS gas on Pharos Mainnet (Chain ID 1672). ` +
        `Wallet ${activeAddress} has 0.0000 PROS. ` +
        `You must fund this wallet with PROS native tokens to pay network gas fees for broadcasting on-chain ERC-20 transfers.`
      );
    }

    const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000));
    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [targetPublisherAddress as `0x${string}`, amountAtomic],
    });

    const embeddedPrivyWallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
    let txHash: string;

    if (embeddedPrivyWallet) {
      const provider = await embeddedPrivyWallet.getEthereumProvider();
      txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeAddress,
            to: PHAROS_CONSTANTS.nativeUsdcAddress,
            data: transferCalldata,
            value: '0x0',
          },
        ],
      })) as string;
    } else if (typeof window !== 'undefined' && (window as any).ethereum) {
      txHash = (await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeAddress,
            to: PHAROS_CONSTANTS.nativeUsdcAddress,
            data: transferCalldata,
            value: '0x0',
          },
        ],
      })) as string;
    } else {
      throw new Error('No active Web3 or Privy embedded provider available to broadcast transaction.');
    }

    const receipt = await pharosPublicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    return {
      txHash,
      blockNumber: Number(receipt.blockNumber),
    };
  };

  useEffect(() => {
    if (walletAddress) {
      refreshBalances();
    } else {
      setWalletBalanceUsdc(0);
      setWalletBalancePros(0);
    }
  }, [walletAddress]);

  return (
    <PharosAuthContext.Provider
      value={{
        isPrivyReady: ready,
        isPrivyConfigured: true,
        privyAppId,
        setPrivyAppId,
        authenticated: !isExplicitlyDisconnected && (authenticated || !!localAgentAddress),
        walletAddress,
        walletBalanceUsdc,
        walletBalancePros,
        login: handleLogin,
        logout: handleLogout,
        setSessionWalletAddress,
        refreshBalances,
        deductBalance,
        depositBalance,
        signPaymentVoucher,
        sendOnChainClaim,
      }}
    >
      {children}
    </PharosAuthContext.Provider>
  );
}

// Fallback provider when no Privy App ID is configured yet
function UnconfiguredPrivyProvider({
  children,
  setPrivyAppId,
}: {
  children: React.ReactNode;
  setPrivyAppId: (id: string) => void;
}) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isExplicitlyDisconnected, setIsExplicitlyDisconnected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pharos_session_disconnected') === 'true';
    }
    return false;
  });
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState(0);
  const [walletBalancePros, setWalletBalancePros] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('pharos_session_disconnected') === 'true') {
        setIsExplicitlyDisconnected(true);
        setWalletAddress(null);
        return;
      }
      let storedPk = localStorage.getItem('pharos_agent_session_pk');
      let storedAddr = localStorage.getItem('pharos_agent_wallet_address');
      if (!storedPk || !storedAddr) {
        const freshPk = generatePrivateKey();
        const account = privateKeyToAccount(freshPk);
        localStorage.setItem('pharos_agent_session_pk', freshPk);
        localStorage.setItem('pharos_agent_wallet_address', account.address);
        storedAddr = account.address;
      }
      setWalletAddress(storedAddr);
    }
  }, []);

  const handleLogout = () => {
    setIsExplicitlyDisconnected(true);
    setWalletAddress(null);
    setWalletBalanceUsdc(0);
    setWalletBalancePros(0);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_session_disconnected', 'true');
      localStorage.removeItem('pharos_agent_wallet_address');
      localStorage.removeItem('pharos_agent_session_pk');
      localStorage.removeItem('pharos_agent_provider');
    }
  };

  const handleLogin = () => {
    setIsExplicitlyDisconnected(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pharos_session_disconnected');
      let storedPk = localStorage.getItem('pharos_agent_session_pk');
      let storedAddr = localStorage.getItem('pharos_agent_wallet_address');
      if (!storedPk || !storedAddr) {
        const freshPk = generatePrivateKey();
        const account = privateKeyToAccount(freshPk);
        localStorage.setItem('pharos_agent_session_pk', freshPk);
        localStorage.setItem('pharos_agent_wallet_address', account.address);
        storedAddr = account.address;
      }
      setWalletAddress(storedAddr);
    }
  };

  const setSessionWalletAddress = (addr: string | null) => {
    if (addr) {
      setIsExplicitlyDisconnected(false);
      setWalletAddress(addr);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pharos_session_disconnected');
        localStorage.setItem('pharos_agent_wallet_address', addr);
      }
    } else {
      setIsExplicitlyDisconnected(true);
      setWalletAddress(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_session_disconnected', 'true');
        localStorage.removeItem('pharos_agent_wallet_address');
        localStorage.removeItem('pharos_agent_session_pk');
      }
    }
  };

  const refreshBalances = async () => {
    if (!walletAddress) return;
    try {
      const [prosRaw, usdcRaw] = await Promise.all([
        pharosPublicClient.getBalance({ address: walletAddress as `0x${string}` }),
        pharosPublicClient.readContract({
          address: PHAROS_CONSTANTS.nativeUsdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        }).catch(() => BigInt(0)),
      ]);

      const onChainPros = parseFloat(formatEther(prosRaw));
      const onChainUsdc = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));

      const addrKey = walletAddress.toLowerCase();
      let sessionDeposit = 0;
      let sessionSpent = 0;
      if (typeof window !== 'undefined') {
        sessionDeposit = parseFloat(localStorage.getItem(`pharos_session_deposit_${addrKey}`) || '0');
        sessionSpent = parseFloat(localStorage.getItem(`pharos_session_spent_${addrKey}`) || '0');
      }

      const baselineUsdc = Math.max(onChainUsdc, 0.010);
      const effectiveUsdc = Math.max(0, Number((baselineUsdc + sessionDeposit - sessionSpent).toFixed(4)));

      setWalletBalancePros(onChainPros);
      setWalletBalanceUsdc(effectiveUsdc);
    } catch (err) {
      console.warn('Failed to query balances on Pharos Mainnet:', err);
    }
  };

  const deductBalance = (amountUsdc: number) => {
    if (!walletAddress) return;
    const addrKey = walletAddress.toLowerCase();
    const spentKey = `pharos_session_spent_${addrKey}`;
    if (typeof window !== 'undefined') {
      const prevSpent = parseFloat(localStorage.getItem(spentKey) || '0');
      const updatedSpent = Number((prevSpent + amountUsdc).toFixed(4));
      localStorage.setItem(spentKey, updatedSpent.toString());
    }
    setWalletBalanceUsdc((prev) => Math.max(0, Number((prev - amountUsdc).toFixed(4))));
  };

  const depositBalance = (amountUsdc: number) => {
    if (!walletAddress) return;
    const addrKey = walletAddress.toLowerCase();
    const depositKey = `pharos_session_deposit_${addrKey}`;
    if (typeof window !== 'undefined') {
      const prevDeposit = parseFloat(localStorage.getItem(depositKey) || '0');
      const updatedDeposit = Number((prevDeposit + amountUsdc).toFixed(4));
      localStorage.setItem(depositKey, updatedDeposit.toString());
    }
    setWalletBalanceUsdc((prev) => Number((prev + amountUsdc).toFixed(4)));
  };

  const signPaymentVoucher = async (params: X402VoucherSigningRequest): Promise<string> => {
    let storedPk = typeof window !== 'undefined' ? localStorage.getItem('pharos_agent_session_pk') : null;
    if (!storedPk || !storedPk.startsWith('0x')) {
      storedPk = generatePrivateKey();
      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_agent_session_pk', storedPk);
      }
    }

    const sessionAccount = privateKeyToAccount(storedPk as `0x${string}`);
    return await sessionAccount.signTypedData({
      domain: X402_EIP712_DOMAIN,
      types: X402_PAYMENT_VOUCHER_TYPES,
      primaryType: 'X402PaymentVoucher',
      message: {
        buyerAddress: sessionAccount.address,
        feedSlug: params.feedSlug,
        priceUsdcAtomic: BigInt(params.priceUsdcAtomic),
        nonce: BigInt(params.nonce),
        timestamp: BigInt(params.timestamp),
      },
    });
  };

  const sendOnChainClaim = async (
    targetPublisherAddress: string,
    amountUsdc: number
  ): Promise<{ txHash: string; blockNumber?: number }> => {
    if (!walletAddress) {
      throw new Error('No active wallet account found to initiate on-chain claim.');
    }

    const prosBalRaw = await pharosPublicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    if (prosBalRaw === BigInt(0)) {
      throw new Error(
        `On-chain transaction execution rejected: Insufficient PROS gas on Pharos Mainnet (Chain ID 1672). ` +
        `Wallet ${walletAddress} has 0.0000 PROS. ` +
        `You must fund this wallet with PROS native tokens to pay network gas fees for broadcasting on-chain ERC-20 transfers.`
      );
    }

    const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000));
    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [targetPublisherAddress as `0x${string}`, amountAtomic],
    });

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const txHash = (await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: walletAddress,
            to: PHAROS_CONSTANTS.nativeUsdcAddress,
            data: transferCalldata,
            value: '0x0',
          },
        ],
      })) as string;

      const receipt = await pharosPublicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      return {
        txHash,
        blockNumber: Number(receipt.blockNumber),
      };
    }

    throw new Error('No compatible browser wallet or provider available for on-chain broadcast.');
  };

  return (
    <PharosAuthContext.Provider
      value={{
        isPrivyReady: true,
        isPrivyConfigured: false,
        privyAppId: '',
        setPrivyAppId,
        authenticated: !isExplicitlyDisconnected && !!walletAddress,
        walletAddress: isExplicitlyDisconnected ? null : walletAddress,
        walletBalanceUsdc,
        walletBalancePros,
        login: handleLogin,
        logout: handleLogout,
        setSessionWalletAddress,
        refreshBalances,
        deductBalance,
        depositBalance,
        signPaymentVoucher,
        sendOnChainClaim,
      }}
    >
      {children}
    </PharosAuthContext.Provider>
  );
}

export const DEFAULT_PRIVY_APP_ID = 'cmw6zurar00910hl1rsqen5go';

export function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [appId, setAppId] = useState<string>(DEFAULT_PRIVY_APP_ID);

  useEffect(() => {
    setMounted(true);
    const envAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
    const storedAppId = typeof window !== 'undefined' ? localStorage.getItem('pharos_privy_app_id') || '' : '';
    const resolved = envAppId || storedAppId || DEFAULT_PRIVY_APP_ID;
    if (resolved && resolved.length >= 15) {
      setAppId(resolved);
    }
  }, []);

  const handleSetAppId = (newId: string) => {
    setAppId(newId.trim());
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_privy_app_id', newId.trim());
    }
  };

  if (!mounted) {
    return <>{children}</>;
  }

  if (!appId) {
    return (
      <UnconfiguredPrivyProvider setPrivyAppId={handleSetAppId}>
        {children}
      </UnconfiguredPrivyProvider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'github'],
        appearance: {
          theme: 'light',
          accentColor: '#5c41ff',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
        defaultChain: pharosMainnet,
        supportedChains: [pharosMainnet],
      }}
    >
      <ActivePrivyAuthConsumer privyAppId={appId} setPrivyAppId={handleSetAppId}>
        {children}
      </ActivePrivyAuthConsumer>
    </PrivyProvider>
  );
}
