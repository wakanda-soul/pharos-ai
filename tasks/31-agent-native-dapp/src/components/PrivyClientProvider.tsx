'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
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
  const { ready, authenticated, user, login, logout } = usePrivy();
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

      setWalletBalancePros(parseFloat(formatEther(prosRaw)));
      setWalletBalanceUsdc(parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals)));
    } catch (err) {
      console.warn('Failed to fetch Privy wallet balances on Pharos Mainnet:', err);
    }
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

      setWalletBalancePros(parseFloat(formatEther(prosRaw)));
      setWalletBalanceUsdc(parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals)));
    } catch (err) {
      console.warn('Failed to query balances on Pharos Mainnet:', err);
    }
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
