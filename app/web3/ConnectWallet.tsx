'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

// Custom-rendered connect button so it matches the nav styling instead of RainbowKit's default bold
// pill. Modals are still RainbowKit's. The chain chip carries the network's icon (Vitruveo's mark
// from public/vitruveo.svg, BNB Chain's from RainbowKit).
export default function ConnectWallet() {
  const style = { fontSize: '0.85rem', fontWeight: 400, whiteSpace: 'nowrap' } as const;

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div
            {...(!mounted && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } as const,
            })}
          >
            {!connected ? (
              <button type="button" className="btn btn-outline-light btn-sm px-3" style={style} onClick={openConnectModal}>
                Connect
              </button>
            ) : chain.unsupported ? (
              <button type="button" className="btn btn-outline-danger btn-sm" style={style} onClick={openChainModal}>
                Wrong network
              </button>
            ) : (
              <div className="d-inline-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm d-inline-flex align-items-center gap-2"
                  style={{
                    ...style,
                    borderColor: chain.id === 1490 ? '#8b5cf6' : chain.id === 56 ? '#f0b90b' : 'rgba(255,255,255,0.6)',
                    color: chain.id === 1490 ? '#c4b5fd' : chain.id === 56 ? '#f5d26b' : '#ffffff',
                    background: chain.id === 1490 ? 'rgba(139,92,246,0.15)' : chain.id === 56 ? 'rgba(240,185,11,0.12)' : 'transparent',
                  }}
                  onClick={openChainModal}
                  title="Switch network"
                >
                  {chain.iconUrl ? (
                    <img src={chain.iconUrl} alt="" aria-hidden="true" width={16} height={16} style={{ width: '16px', height: '16px', borderRadius: '50%', background: chain.iconBackground }} />
                  ) : (
                    <span aria-hidden="true" style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#8fa0ba' }} />
                  )}
                  {chain.id === 56 ? 'BNB Chain' : chain.name}
                </button>
                <button type="button" className="btn btn-outline-light btn-sm" style={style} onClick={openAccountModal}>
                  {account.displayName}
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
