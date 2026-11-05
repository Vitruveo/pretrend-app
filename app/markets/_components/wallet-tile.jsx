'use client';

import { useAccount, useReadContracts, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { erc20Abi, formatUnits } from 'viem';
import { vitruveo } from '../../web3/wagmi';
import { useGeo } from './geo';

// Bridged USDT on Vitruveo (USDT.b) and USDT on BNB Smart Chain.
export const USDT_B_VITRUVEO = '0xB5D7314F2042A922A6EFe9a646a216cfD59dE6AE';
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
export const BRIDGE_URL = 'https://scope.vitruveo.ai/bridge/usdt';

const PURPLE = '#8b5cf6';
const YELLOW = '#f0b90b';

function fmt(raw, decimals) {
  if (raw === undefined || raw === null || decimals === undefined) return null;
  return Number(formatUnits(raw, Number(decimals))).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Purple tile after the sub-head of every market page: the wallet's USDT.b on Vitruveo, large; its
// USDT on BNB Chain as a smaller yellow button that switches the wallet there; and the bridge CTA.
export function WalletTile() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();
  const geo = useGeo();

  const reads = useReadContracts({
    contracts: [
      { address: USDT_B_VITRUVEO, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: vitruveo.id },
      { address: USDT_B_VITRUVEO, abi: erc20Abi, functionName: 'decimals', chainId: vitruveo.id },
      { address: USDT_BSC, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: bsc.id },
      { address: USDT_BSC, abi: erc20Abi, functionName: 'decimals', chainId: bsc.id },
    ],
    query: { enabled: !!address, refetchInterval: 20000 },
  });
  const d = reads.data;
  const vtruUsdt = fmt(d?.[0]?.result, d?.[1]?.result);
  const bscUsdt = fmt(d?.[2]?.result, d?.[3]?.result);
  const actions = geo.allowed;

  return (
    <div
      className="p-4 mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(139,92,246,0.12))',
        border: `1px solid rgba(139,92,246,0.6)`,
        borderRadius: '14px',
        boxShadow: '0 0 40px rgba(139,92,246,0.25)',
      }}
    >
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-4">
        <div className="d-flex align-items-center gap-3">
          <img src="/vitruveo.svg" alt="" aria-hidden="true" width={44} height={44} style={{ width: '44px', height: '44px' }} />
          <div>
            <div className="text-uppercase" style={{ color: '#c4b5fd', letterSpacing: '0.16em', fontSize: '0.75rem', fontWeight: 600 }}>
              USDT.b on Vitruveo
            </div>
            <div className="fw-bold text-white" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
              {!isConnected ? '—' : vtruUsdt === null ? '…' : vtruUsdt}
              <span style={{ fontSize: '1rem', color: '#c4b5fd', marginLeft: '0.5rem', fontWeight: 600 }}>USDT.b</span>
            </div>
            {!isConnected && <div className="text-white-50 small mt-1">Connect a wallet to see your balance.</div>}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {!isConnected ? (
            <button type="button" className="btn btn-sm px-3" style={{ borderColor: PURPLE, color: '#c4b5fd', background: 'rgba(139,92,246,0.15)' }} onClick={() => openConnectModal?.()} disabled={!actions}>
              Connect
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm d-inline-flex align-items-center gap-2 px-3"
              style={{ borderColor: YELLOW, color: '#f5d26b', background: 'rgba(240,185,11,0.12)', fontVariantNumeric: 'tabular-nums' }}
              onClick={() => switchChain({ chainId: bsc.id })}
              disabled={!actions || switching}
              title="Switch wallet to BNB Smart Chain"
            >
              <span aria-hidden="true" style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: YELLOW, boxShadow: '0 0 8px rgba(240,185,11,0.7)' }} />
              {bscUsdt === null ? '…' : bscUsdt} USDT on BNB Chain
            </button>
          )}
          <a
            href={BRIDGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-signal btn-sm px-4${actions ? '' : ' disabled'}`}
            aria-disabled={!actions}
            tabIndex={actions ? undefined : -1}
          >
            Bridge USDT from BSC
          </a>
        </div>
      </div>
    </div>
  );
}
