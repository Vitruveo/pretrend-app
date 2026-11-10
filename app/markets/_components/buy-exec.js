// Buying units and claiming payouts on PretrendMarkets. The first buy approves a standing VUSD allowance of
// 1,000,000 VUSD for the market contract; every buy after that is one transaction.
import { getAccount, readContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { erc20Abi, parseUnits } from 'viem';
import { wagmiConfig } from '../../web3/wagmi';
import { VITRUVEO_CHAIN_ID, VUSD_ADDRESS } from '../../config/vusd';
import { PRETREND_MARKETS_ABI, PRETREND_MARKETS_ADDRESS } from '../../config/pretrend-markets';

const chainId = VITRUVEO_CHAIN_ID;
const M = { address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId };
const STANDING_ALLOWANCE = parseUnits('1000000', 18);

export function errText(e) {
  if (e?.code === 4001 || e?.cause?.code === 4001 || /user rejected|denied/i.test(e?.message || '')) return 'Rejected in your wallet.';
  const reason = e?.cause?.reason || e?.reason;
  if (reason) return reason;
  return e?.shortMessage || e?.details || e?.message || String(e);
}

async function ensureChain(say) {
  if (getAccount(wagmiConfig).chainId === chainId) return;
  say('Switch your wallet to Vitruveo…');
  await switchChain(wagmiConfig, { chainId });
}

async function confirm(hash, say, label) {
  say('Waiting for confirmation…');
  const rcpt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
  if (rcpt.status !== 'success') throw new Error(`${label} reverted`);
  return hash;
}

// amount and minUnits in wei; returns the buy transaction hash.
export async function buyUnits({ account, typeId, bucket, amount, minUnits, say }) {
  await ensureChain(say);
  const fee = await readContract(wagmiConfig, { ...M, functionName: 'feeFor', args: [amount] });
  const total = amount + fee;
  const allowance = await readContract(wagmiConfig, { address: VUSD_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [account, PRETREND_MARKETS_ADDRESS], chainId });

  if (allowance < total) {
    // one standing approval, so later buys are a single transaction
    say('Approve VUSD for Pretrend markets in your wallet (one time)…');
    const ah = await writeContract(wagmiConfig, { address: VUSD_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [PRETREND_MARKETS_ADDRESS, STANDING_ALLOWANCE], chainId });
    await confirm(ah, say, 'Approve');
  }
  say('Confirm the buy in your wallet…');
  const hash = await writeContract(wagmiConfig, { ...M, functionName: 'buy', args: [BigInt(typeId), bucket, amount, minUnits] });
  return confirm(hash, say, 'Buy');
}

export async function claimAll({ typeId, starts, say }) {
  await ensureChain(say);
  say('Confirm the claim in your wallet…');
  const hash = await writeContract(wagmiConfig, { ...M, functionName: 'claim', args: [BigInt(typeId), starts.map(BigInt)] });
  return confirm(hash, say, 'Claim');
}
