'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PrivyProvider, usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { pharosMainnet, pharosPublicClient, PHAROS_CONSTANTS, ERC20_ABI } from '@/lib/pharos-chain';
import { formatEther, formatUnits } from 'viem';

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
  refreshBalances: () => Promise<void>;
  deductBalance: (amountUsdc: number) => void;
  depositBalance: (amountUsdc: number) => void;
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
  refreshBalances: async () => {},
  deductBalance: () => {},
  depositBalance: () => {},
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

  // Derived agent embedded wallet or primary connected wallet
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy') || wallets[0];
  const walletAddress = user?.wallet?.address || embeddedWallet?.address || null;

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
        authenticated,
        walletAddress,
        walletBalanceUsdc,
        walletBalancePros,
        login,
        logout,
        refreshBalances,
        deductBalance,
        depositBalance,
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
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState(0);
  const [walletBalancePros, setWalletBalancePros] = useState(0);

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

  return (
    <PharosAuthContext.Provider
      value={{
        isPrivyReady: true,
        isPrivyConfigured: false,
        privyAppId: '',
        setPrivyAppId,
        authenticated: !!walletAddress,
        walletAddress,
        walletBalanceUsdc,
        walletBalancePros,
        login: () => {},
        logout: () => {
          setWalletAddress(null);
          setWalletBalanceUsdc(0);
          setWalletBalancePros(0);
        },
        refreshBalances,
        deductBalance,
        depositBalance,
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
