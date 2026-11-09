// In-page execution of VUSD swaps. The USDT bridge legs use the same bridge client as Scope's USDT bridge page
// (../_lib/bridge-client.js, a verbatim copy of Scope's src/lib/bridge/client.js) against Scope's bridge API:
// server-enforced checklist, server-built txs, notarized receipts in Scope's database, and stall tracking.
import { readContract, simulateContract, switchChain, waitForTransactionReceipt, writeContract, getAccount } from 'wagmi/actions';
import { erc20Abi } from 'viem';
import { wagmiConfig } from '../../web3/wagmi';
import { BSC_CHAIN_ID, TOKENS, USDT_B_VITRUVEO, VITRUVEO_CHAIN_ID, VUSD_ADDRESS, SCOPE_API_BASE } from '../../config/vusd';
import { createBridge } from '../_lib/bridge-client';

export const BRIDGE = USDT_B_VITRUVEO;

export const BRIDGE_ABI = [
  { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256', name: '' }] },
];

// VUSD contract (subset): deposit pulls USDT.b (approve first) and mints VUSD; redeem burns VUSD and returns USDT.b.
// quote(amount) -> (amountOut, fee, total): total is what deposit pulls for `amount`.
const VUSD_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [] },
  { type: 'function', name: 'redeem', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [] },
  { type: 'function', name: 'quote', stateMutability: 'view', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [{ type: 'uint256', name: 'amountOut' }, { type: 'uint256', name: 'fee' }, { type: 'uint256', name: 'total' }] },
];

export const TX_URL = {
  [VITRUVEO_CHAIN_ID]: (h) => `https://explorer.vitruveo.ai/tx/${h}`,
  [BSC_CHAIN_ID]: (h) => `https://bscscan.com/tx/${h}`,
};

export function errText(e) {
  if (e?.code === 4001 || e?.cause?.code === 4001 || /user rejected|denied/i.test(e?.message || '')) return 'Rejected in your wallet.';
  return e?.shortMessage || e?.details || e?.message || String(e);
}

// Ordered step list for a swap. Each step: { id, label, chainId }.
export function planSteps(fromKey, toKey) {
  if (fromKey === 'USDT_B') return [{ id: 'mint', label: 'Mint VUSD', chainId: VITRUVEO_CHAIN_ID }];
  if (toKey === 'USDT_B') return [{ id: 'redeem', label: 'Redeem VUSD for USDT.b', chainId: VITRUVEO_CHAIN_ID }];
  // Cross-chain: the user signs one transaction; the bridge relayer does the rest (Scope /api/bridge/swap).
  if (fromKey === 'USDT_BSC') {
    return [
      { id: 'lock', label: 'Send USDT to the bridge on BNB Chain', chainId: BSC_CHAIN_ID },
      { id: 'relay', label: 'Bridge delivers VUSD on Vitruveo', chainId: VITRUVEO_CHAIN_ID },
    ];
  }
  return [
    { id: 'send', label: 'Send VUSD to the bridge on Vitruveo', chainId: VITRUVEO_CHAIN_ID },
    { id: 'relay', label: 'Bridge delivers USDT on BNB Chain', chainId: BSC_CHAIN_ID },
  ];
}

async function ensureChain(chainId, say) {
  if (getAccount(wagmiConfig).chainId === chainId) return;
  say(`Switch your wallet to ${chainId === BSC_CHAIN_ID ? 'BNB Chain' : 'Vitruveo'}…`);
  await switchChain(wagmiConfig, { chainId });
}

// VUSD-leg txs (approve, mint, redeem). Reported to Scope like bridge steps, so the pending panel knows them
// instead of flagging them as unknown wallet transactions.
async function send(account, chainId, req, say, label) {
  await ensureChain(chainId, say);
  say(`Confirm "${label}" in your wallet…`);
  const hash = await writeContract(wagmiConfig, { ...req, chainId });
  await usdtBridge(account).track(chainId, hash, label).catch(() => {});
  say('Waiting for confirmation…');
  const rcpt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
  if (rcpt.status !== 'success') throw new Error(`${label} reverted`);
  return hash;
}

async function approveIfNeeded({ chainId, token, spender, account, amount, say, label }) {
  const allowance = await readContract(wagmiConfig, { address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender], chainId });
  if (allowance >= amount) return null;
  return send(account, chainId, { address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] }, say, label);
}

// Scope bridge client for the connected wallet: sends through the wagmi connector's EIP-1193 provider and
// switches chains through wagmi (injected and WalletConnect wallets alike).
export const usdtBridge = (account, onStatus = () => {}) =>
  createBridge({
    token: 'USDT',
    apiBase: SCOPE_API_BASE,
    account,
    getProvider: () => getAccount(wagmiConfig).connector?.getProvider(),
    switchChain: (chainId) => switchChain(wagmiConfig, { chainId }),
    onStatus,
  });

// Whole USDT units as a decimal string (cross-chain amounts are whole; 18 decimals on both chains).
const whole = (wei) => (BigInt(wei) / 10n ** 18n).toString();

// { pass, items: [{ key, label, state: ok|fail|idle, detail }], fee, balances }
export const preflight = (account, fromChainId, amountWei = 0n) => usdtBridge(account).preflight(fromChainId, whole(amountWei), { via: 'vusd' });

export const checklistFailure = (pre) =>
  pre.items.filter((i) => i.state !== 'ok').map((i) => `${i.label}: ${i.detail}`).join(' ');

const usdtbBalance = (account) =>
  readContract(wagmiConfig, { address: USDT_B_VITRUVEO, abi: erc20Abi, functionName: 'balanceOf', args: [account], chainId: VITRUVEO_CHAIN_ID });

// The approve is only sent when the deposit would actually fail without it: the deposit is simulated first, so
// a VUSD that pulls USDT.b without an allowance skips the extra wallet confirmation.
async function mintVusd(account, amount, say) {
  const deposit = { address: VUSD_ADDRESS, abi: VUSD_ABI, functionName: 'deposit', args: [amount], account, chainId: VITRUVEO_CHAIN_ID };
  const needsApproval = await simulateContract(wagmiConfig, deposit).then(() => false, () => true);
  if (needsApproval) {
    const [, , total] = await readContract(wagmiConfig, { address: VUSD_ADDRESS, abi: VUSD_ABI, functionName: 'quote', args: [amount], chainId: VITRUVEO_CHAIN_ID });
    await approveIfNeeded({ chainId: VITRUVEO_CHAIN_ID, token: USDT_B_VITRUVEO, spender: VUSD_ADDRESS, account, amount: total, say, label: 'Approve USDT.b' });
  }
  return send(account, VITRUVEO_CHAIN_ID, { address: VUSD_ADDRESS, abi: VUSD_ABI, functionName: 'deposit', args: [amount] }, say, 'Mint VUSD');
}

// Returns { hash, received }: the USDT.b actually credited by the redeem.
async function redeemVusd(account, amount, say) {
  const before = await usdtbBalance(account);
  const hash = await send(account, VITRUVEO_CHAIN_ID, { address: VUSD_ADDRESS, abi: VUSD_ABI, functionName: 'redeem', args: [amount] }, say, 'Redeem VUSD');
  return { hash, received: (await usdtbBalance(account)) - before };
}

// Runs the plan from step index `start`. `ctx` carries values between steps (and across a retry):
// { account, amount (bigint, source units), sourceTx, swapId, received }. Callbacks: onStep(i, patch), say(text).
export async function runSwap({ fromKey, toKey, steps, start = 0, ctx, onStep, say }) {
  const { account } = ctx;
  const bridge = usdtBridge(account, say);
  const bridgeFrom = fromKey === 'USDT_BSC' ? BSC_CHAIN_ID : toKey === 'USDT_BSC' ? VITRUVEO_CHAIN_ID : null;
  // Nothing is sent unless every checklist item passes on fresh chain reads.
  if (bridgeFrom && start === 0) {
    say('Running the pre-bridge checklist…');
    const pre = await bridge.preflight(bridgeFrom, whole(ctx.amount), { via: 'vusd' });
    if (!pre.pass) throw new Error(`Checklist failed, nothing was sent. ${checklistFailure(pre)}`);
  }
  for (let i = start; i < steps.length; i++) {
    const s = steps[i];
    onStep(i, { state: 'active' });
    let hash = null;
    switch (s.id) {
      case 'lock':
      case 'send':
        hash = await bridge.start({ from: bridgeFrom, amount: whole(ctx.amount), via: 'vusd' });
        ctx.sourceTx = hash;
        break;
      case 'relay': {
        // A retry continues the same swap; the server never repeats a step that already happened.
        const sw = ctx.swapId
          ? await bridge.resumeSwap(ctx.swapId)
          : fromKey === 'USDT_BSC'
          ? await bridge.toVusd().catch((e) => { if (e.swap) ctx.swapId = e.swap.id; throw e; })
          : await bridge.fromVusd(ctx.sourceTx).catch((e) => { if (e.swap) ctx.swapId = e.swap.id; throw e; });
        ctx.swapId = sw.id;
        ctx.received = BigInt(sw.amount);
        hash = fromKey === 'USDT_BSC' ? sw.txs.deposit : sw.txs.claim;
        break;
      }
      case 'mint':
        hash = await mintVusd(account, ctx.received ?? ctx.amount, say);
        break;
      case 'redeem': {
        const r = await redeemVusd(account, ctx.amount, say);
        hash = r.hash;
        ctx.received = r.received;
        break;
      }
      default:
        throw new Error(`Unknown step ${s.id}`);
    }
    onStep(i, { state: 'done', hash });
  }
  say('');
  return { received: ctx.received ?? ctx.amount, to: TOKENS[toKey] };
}
