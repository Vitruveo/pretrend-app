// VUSD: the Vitruveo dollar used across Pretrend markets. A 1:1 wrapper over USDT.b on Vitruveo
// (deposit pulls USDT.b and mints VUSD; redeem burns VUSD and returns USDT.b), so it also swaps 1:1
// with USDT on BNB Smart Chain through the USDT bridge. Address from Scope's vtru-contracts.json (mainnet.VUSD).
export const VUSD_ADDRESS = '0xA173E3B4e3cDEBa92C789F1E764A05f0Be4a6652';

// Bridged USDT on Vitruveo (USDT.b) and USDT on BNB Smart Chain.
export const USDT_B_VITRUVEO = '0xB5D7314F2042A922A6EFe9a646a216cfD59dE6AE';
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';

export const VITRUVEO_CHAIN_ID = 1490;
export const BSC_CHAIN_ID = 56;

export const TOKENS = {
  VUSD: { key: 'VUSD', symbol: 'VUSD', name: 'Vitruveo USD', chainId: VITRUVEO_CHAIN_ID, chain: 'Vitruveo', address: VUSD_ADDRESS, slug: 'vusd' },
  USDT_B: { key: 'USDT_B', symbol: 'USDT.b', name: 'Bridged USDT', chainId: VITRUVEO_CHAIN_ID, chain: 'Vitruveo', address: USDT_B_VITRUVEO, slug: 'usdt-b' },
  USDT_BSC: { key: 'USDT_BSC', symbol: 'USDT', name: 'Tether USD', chainId: BSC_CHAIN_ID, chain: 'BNB Chain', address: USDT_BSC, slug: 'usdt-bsc' },
};

// Hop sequence for each direction. USDT (BSC) always passes through USDT.b on Vitruveo.
export function routeOf(fromKey, toKey) {
  if (fromKey === 'USDT_BSC') return ['USDT_BSC', 'USDT_B', 'VUSD'];
  if (toKey === 'USDT_BSC') return ['VUSD', 'USDT_B', 'USDT_BSC'];
  return [fromKey, toKey];
}

// Scope's bridge API notarizes the USDT bridge legs (CORS: Scope's BRIDGE_ALLOWED_ORIGINS must list this site).
export const SCOPE_API_BASE = process.env.NEXT_PUBLIC_SCOPE_API_BASE || 'https://scope.vitruveo.ai';
