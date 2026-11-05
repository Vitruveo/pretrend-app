import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { defineChain } from 'viem';

// Vitruveo mainnet. RainbowKit has no built-in icon for it; the mark is public/vitruveo.svg.
export const vitruveo = defineChain({
  id: 1490,
  name: 'Vitruveo',
  nativeCurrency: { name: 'Vitruveo', symbol: 'VTRU', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.vitruveo.ai'] } },
  blockExplorers: { default: { name: 'Vitruveo Explorer', url: 'https://explorer.vitruveo.ai' } },
  iconUrl: '/vitruveo.svg',
  iconBackground: '#0a0f0a',
});

// WalletConnect Cloud project id. This is a public client identifier (it ships in the browser
// bundle); access is restricted by allowed domains in the WalletConnect Cloud dashboard. Override
// per-environment via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID if needed.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c86913c1e4403a33af0a51d8d3e39334';

// Vitruveo first: it is the default network; BNB Smart Chain is the second.
export const wagmiConfig = getDefaultConfig({
  appName: 'Pretrend',
  projectId,
  chains: [vitruveo, bsc],
  ssr: true,
});
