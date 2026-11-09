// VTRU / USDT bridge client. Dependency-free: works with any EIP-1193 wallet provider (wagmi v1/v2 connectors,
// viem wallet clients, window.ethereum). All chain reads, checklist, fee, receipts and transaction building
// run on the Scope bridge API; this module only switches chains, sends the prepared transactions, and
// sequences the steps.
//
// Shared by Scope (src/lib/bridge/client.js, the source) and Pretrend (app/swap/_lib/bridge-client.js, a
// verbatim copy). Edit it in Scope, then copy it over unchanged so both apps bridge identically.
//
//   import { createBridge, VITRUVEO_CHAIN_ID, BSC_CHAIN_ID } from "./client";
//   const bridge = createBridge({
//     token: "VTRU",                              // or "USDT" (USDT on BSC <-> USDT.b on Vitruveo)
//     apiBase: "https://scope.vitruveo.ai",       // "" when running inside Scope
//     account,                                    // connected address
//     getProvider: () => connector.getProvider(), // EIP-1193 provider (or pass `provider`)
//     switchChain: (id) => switchChainAsync({ chainId: id }), // optional; defaults to wallet_switchEthereumChain
//     onStatus: (msg) => setStatus(msg),          // optional progress text
//   });
//   await bridge.preflight(VITRUVEO_CHAIN_ID, "100"); // { pass, items, fee, balances }
//   await bridge.bridge({ from: VITRUVEO_CHAIN_ID, amount: "100" }); // start + notarize + finish
//   await bridge.status();                           // { escrow, receipt, receiptFee, items }
//
// Callers that show each leg separately use start(), notarize() and finish() in that order instead of bridge().
//
// VUSD swaps (token "USDT"), relayed by the bridge so the user signs only the first transaction:
//   USDT (BSC) -> VUSD:  await bridge.start({ from: BSC_CHAIN_ID, amount, via: "vusd" }); await bridge.toVusd();
//   VUSD -> USDT (BSC):  const tx = await bridge.start({ from: VITRUVEO_CHAIN_ID, amount, via: "vusd" });
//                        await bridge.fromVusd(tx);
//   preflight(from, amount, { via: "vusd" }) runs the matching checklist.
//
// Amounts are whole token units as a decimal string or number. Bigint fields in responses are decimal strings (wei).

export const VITRUVEO_CHAIN_ID = 1490;
export const BSC_CHAIN_ID = 56;
export const CHAIN_NAME = { [VITRUVEO_CHAIN_ID]: "Vitruveo", [BSC_CHAIN_ID]: "BSC" };

const ADD_CHAIN = {
  [VITRUVEO_CHAIN_ID]: {
    chainId: "0x5d2",
    chainName: "Vitruveo",
    nativeCurrency: { name: "VTRU", symbol: "VTRU", decimals: 18 },
    rpcUrls: ["https://rpc.vitruveo.ai"],
    blockExplorerUrls: ["https://explorer.vitruveo.ai"],
  },
  [BSC_CHAIN_ID]: {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

const POLL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function walletErrorMessage(e) {
  if (e?.code === 4001 || e?.cause?.code === 4001) return "Rejected in your wallet";
  return e?.shortMessage || e?.reason || e?.details || e?.message || String(e);
}

export function createBridge({ token = "VTRU", apiBase = "", account, provider, getProvider, switchChain, onStatus = () => {}, storage } = {}) {
  if (!account) throw new Error("account is required");
  if (token !== "VTRU" && token !== "USDT") throw new Error("token must be VTRU or USDT");
  const store =
    storage ??
    (() => {
      try {
        return globalThis.localStorage ?? null;
      } catch {
        return null;
      }
    })();
  const acctKey = account.toLowerCase();
  const lastErrorKey = `${token.toLowerCase()}-bridge-lasterror-${acctKey}`;
  const legacyReceiptKey = `${token.toLowerCase()}-bridge-receipt-${acctKey}`;

  const safe = (fn, dflt = null) => {
    try {
      return fn();
    } catch {
      return dflt;
    }
  };
  const saveLastError = (message) => safe(() => store?.setItem(lastErrorKey, JSON.stringify({ message, at: Date.now() })));
  const clearLastError = () => safe(() => store?.removeItem(lastErrorKey));
  const readLastError = () => safe(() => JSON.parse(store?.getItem(lastErrorKey) || "null"));

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(`${apiBase}/api/bridge${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.detail ? `${data.error}: ${data.detail}` : data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  const wallet = async () => {
    const p = provider ?? (getProvider ? await getProvider() : globalThis.ethereum);
    if (!p?.request) throw new Error("Wallet not connected");
    return p;
  };

  async function ensureChain(chainId) {
    const p = await wallet();
    if (Number(await p.request({ method: "eth_chainId" })) === chainId) return;
    onStatus(`Switching your wallet to ${CHAIN_NAME[chainId]}…`);
    if (switchChain) {
      await switchChain(chainId);
    } else {
      try {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ADD_CHAIN[chainId].chainId }] });
      } catch (e) {
        if (e?.code !== 4902) throw e;
        await p.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN[chainId]] });
      }
    }
    const now = Number(await (await wallet()).request({ method: "eth_chainId" }));
    if (now !== chainId) throw new Error(`Wallet is on chain ${now}, expected ${CHAIN_NAME[chainId]}`);
  }

  // Waits like a wallet does: on the receipt from the wallet's own provider, which sees its tx immediately.
  // Scope's view (public RPC) is a fallback for success and the source of the stall reason; its "dropped"
  // verdict is never fatal, because a tx sent through a private relay can be invisible there until mined.
  async function waitForTx(chainId, hash, label) {
    const start = Date.now();
    for (;;) {
      const rc = await (await wallet()).request({ method: "eth_getTransactionReceipt", params: [hash] }).catch(() => null);
      if (rc && rc.blockNumber) {
        if (Number(rc.status) === 1) return;
        const s = await api(`/txs?chainId=${chainId}&hash=${hash}`).catch(() => ({}));
        throw new Error(s.reason || `"${label}" reverted on ${CHAIN_NAME[chainId]}`);
      }
      const s = await api(`/txs?chainId=${chainId}&hash=${hash}`).catch(() => ({ state: "pending" }));
      if (s.state === "success") return;
      if (s.state === "reverted" || s.state === "replaced") throw new Error(s.reason);
      const waited = Date.now() - start;
      if (waited > MAX_WAIT_MS) throw new Error(s.reason || `"${label}" still pending after ${Math.round(waited / 60000)} minutes`);
      if (waited > 30000 && s.reason) onStatus(`Waiting for "${label}" on ${CHAIN_NAME[chainId]}: ${s.reason}`);
      await sleep(POLL_MS);
    }
  }

  // Sends each prepared tx and waits for it; returns the last tx hash.
  async function runSteps(steps) {
    let hash = null;
    for (const step of steps) {
      await ensureChain(step.chainId);
      onStatus(`Confirm "${step.label}" in your wallet…`);
      hash = await (await wallet()).request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: step.tx.to, data: step.tx.data, value: step.tx.value }],
      });
      // Tracked server-side so a stalled tx shows in status() with its exact reason, from any device.
      await api("/txs", { method: "POST", body: { account, token, chainId: step.chainId, hash, label: step.label } }).catch(() => {});
      onStatus(`Waiting for "${step.label}" to confirm on ${CHAIN_NAME[step.chainId]}…`);
      await waitForTx(step.chainId, hash, step.label);
    }
    return hash;
  }

  // Receipts saved by the old browser-only flow are moved to the server once.
  async function migrateLegacyReceipt() {
    const raw = safe(() => store?.getItem(legacyReceiptKey));
    if (!raw) return;
    try {
      const r = JSON.parse(raw);
      await api("/receipts", { method: "POST", body: { ...r, token } });
      safe(() => store?.removeItem(legacyReceiptKey));
    } catch (e) {
      if (e.status >= 400 && e.status < 500) safe(() => store?.removeItem(legacyReceiptKey)); // invalid: drop it
    }
  }

  async function notarize(sourceChainId) {
    onStatus("Notarizing…");
    return api("/notarize", { method: "POST", body: { account, sourceChainId, token } });
  }

  // Wrap a user action: record the failure (shown in status()) and rethrow it.
  const action = (fn) => async (...args) => {
    try {
      const out = await fn(...args);
      clearLastError();
      onStatus("");
      return out;
    } catch (e) {
      const msg = walletErrorMessage(e);
      saveLastError(msg);
      onStatus("");
      throw new Error(msg);
    }
  };

  async function finishReceipt(receipt) {
    const { steps } = await api("/steps", { method: "POST", body: { action: "finish", account, receiptId: receipt.id } });
    return runSteps(steps);
  }

  // Lock / burn on the source chain. The server re-runs the checklist and refuses unless every item passes.
  async function startTransfer(from, amount, via) {
    onStatus("Running pre-bridge checklist…");
    const { steps } = await api("/steps", { method: "POST", body: { action: "start", token, account, from, amount: String(amount), via } });
    return runSteps(steps);
  }

  // Runs a relayed VUSD swap on the server. A swap another request is already running is polled until it settles.
  async function relay(body, label) {
    onStatus(label);
    let sw = await api("/swap", { method: "POST", body: { account, ...body } });
    const start = Date.now();
    while (!sw.done && !sw.error && sw.state !== "void" && Date.now() - start < MAX_WAIT_MS) {
      await sleep(POLL_MS);
      sw = await api(`/swap?id=${sw.id}`);
    }
    if (sw.done) return sw;
    throw Object.assign(new Error(sw.error || "The bridge has not finished the swap yet. Continue it from the pending list."), { swap: sw });
  }

  return {
    account,

    token,

    // { pass, items: [{ key, label, state: ok|fail|idle, detail }], fee, balances: { vtruCoin, vtruToken, usdt, usdtb, bnb } }
    preflight: (from, amount = 0, { via } = {}) =>
      api(`/preflight?token=${token}&account=${account}&from=${from}&amount=${encodeURIComponent(String(amount || 0))}${via ? `&via=${via}` : ""}`),

    // { escrow, receipt, receiptFee, items: [{ key, kind, severity, title, reasons, links, dismissHash? }] }
    async status() {
      await migrateLegacyReceipt();
      const s = await api(`/status?token=${token}&account=${account}`);
      const last = readLastError();
      if (last) {
        for (const it of s.items) {
          if (it.kind === "escrow" || it.kind === "receipt") it.reasons.push(`Last attempt failed: ${last.message}`);
        }
      }
      return s;
    },

    // Full transfer: server-enforced checklist, lock/burn, notarize, then receive on the destination chain.
    // Returns the hash of the last destination tx.
    bridge: action(async ({ from, amount }) => {
      clearLastError();
      await startTransfer(from, amount);
      const receipt = await notarize(from);
      return finishReceipt(receipt);
    }),

    // Individual legs of bridge(), for callers with their own progress UI.
    // start -> last source tx hash; notarize -> issued receipt { id, amount (net of any fee), destChainId, ... }
    start: action(({ from, amount, via }) => startTransfer(from, amount, via)),
    notarize: action((from) => notarize(from)),

    // Receive an issued receipt (only `id` is needed; defaults to the one status() reports). Returns the tx hash.
    finish: action(async (receipt) => {
      const r = receipt ?? (await api(`/status?token=${token}&account=${account}`)).receipt;
      if (!r) throw new Error("No receipt to finish");
      return finishReceipt(r);
    }),

    // Continue an interrupted transfer: notarize the open escrow, then receive it.
    resume: action(async () => {
      const { escrow } = await api(`/status?token=${token}&account=${account}`);
      if (!escrow) throw new Error("No open escrow");
      return finishReceipt(await notarize(escrow.sourceChainId));
    }),

    // Relayed VUSD swaps. Each returns the finished swap { id, kind, amount, txs: { deposit | claim, ... } }.
    toVusd: action(() => relay({ action: "to_vusd" }, "The bridge is delivering your VUSD on Vitruveo…")),
    fromVusd: action((redeemTx) => relay({ action: "from_vusd", redeemTx }, "The bridge is delivering your USDT on BSC…")),
    resumeSwap: action((id) => relay({ action: "resume", id }, "The bridge is finishing your swap…")),

    // Refund the open escrow on its source chain.
    cancel: action(async () => {
      const { steps } = await api("/steps", { method: "POST", body: { action: "cancel", token, account } });
      return runSteps(steps);
    }),

    // Report a tx the caller sent itself (e.g. a step outside the bridge) so status() tracks it like a bridge step.
    track: (chainId, hash, label) => api("/txs", { method: "POST", body: { account, token, chainId, hash, label } }),

    // Stop showing a reverted / dropped / replaced tracked tx.
    dismissTx: (hash) => api(`/txs?account=${account}&hash=${hash}`, { method: "DELETE" }),

    receipts: (q = {}) => api(`/receipts?${new URLSearchParams({ account, token, ...q })}`),
  };
}

export const createVtruBridge = (opts) => createBridge({ ...opts, token: "VTRU" });
