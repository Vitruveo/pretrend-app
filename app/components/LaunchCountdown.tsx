'use client';

import { useSyncExternalStore } from 'react';

// Countdown to the first Pretrend market: 00:00 UTC, Nov 11 2026.
const LAUNCH_MS = Date.UTC(2026, 10, 11, 0, 0, 0);

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const nowSec = () => Math.floor(Date.now() / 1000);
const serverSec = () => null;

const pad = (n: number) => String(n).padStart(2, '0');

export default function LaunchCountdown() {
  const now = useSyncExternalStore(subscribe, nowSec, serverSec);
  const left = now === null ? null : Math.max(0, Math.floor(LAUNCH_MS / 1000) - now);

  if (left === 0) {
    return (
      <p className="fw-bold mt-3 mb-0" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
        <span className="text-gradient">Markets are live</span>
      </p>
    );
  }

  const h = left === null ? '--' : pad(Math.floor(left / 3600));
  const m = left === null ? '--' : pad(Math.floor((left % 3600) / 60));
  const s = left === null ? '--' : pad(left % 60);
  const unit = (v: string, label: string) => (
    <div className="text-center" style={{ minWidth: '4.5ch' }}>
      <div className="fw-bold text-white" style={{ fontSize: 'clamp(2.25rem, 7vw, 4.5rem)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div className="text-muted-custom small text-uppercase mt-2" style={{ letterSpacing: '0.15em' }}>{label}</div>
    </div>
  );
  const sep = <div className="fw-bold text-muted-custom" style={{ fontSize: 'clamp(2.25rem, 7vw, 4.5rem)', lineHeight: 1 }}>:</div>;

  return (
    <div className="mt-4" role="timer" aria-label="Time until the first market opens at 00:00 UTC, November 11">
      <div className="d-flex justify-content-center align-items-start gap-2 gap-md-3">
        {unit(h, 'hours')}
        {sep}
        {unit(m, 'minutes')}
        {sep}
        {unit(s, 'seconds')}
      </div>
      <p className="text-muted-custom small mt-3 mb-0">First market opens 00:00 UTC, November 11</p>
    </div>
  );
}
