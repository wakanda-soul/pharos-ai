import type { Metadata } from 'next';
import './globals.css';
import { PrivyClientProvider } from '@/components/PrivyClientProvider';

export const metadata: Metadata = {
  title: 'Pharos x402 Intelligence Mesh | Agent-Native Data Marketplace',
  description:
    'Curated on-chain data marketplace enabling autonomous AI agents to broker verified DeFi solvency, whale telemetry, and smart contract risk feeds using 0.001 USDC micro-payments settled on Pharos Mainnet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f2f4f5] text-gray-900 antialiased">
        <PrivyClientProvider>{children}</PrivyClientProvider>
      </body>
    </html>
  );
}
