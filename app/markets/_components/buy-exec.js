// Buying units and claiming payouts on PretrendMarkets. A buy signs an EIP-2612 VUSD permit for amount + fee and
// sends buyWithPermit in one transaction; wallets that cannot sign typed data fall back to approve + buy.
import { getAccount, readContract, signTypedData, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { erc20Abi, parseSignature } from 'viem';
import { wagmiConfig } from '../../web3/wagmi';
import { VITRUVEO_CHAIN_ID, VUSD_ADDRESS } from '../../config/vusd';
import { PRETREND_MARKETS_ABI, PRETREND_MARKETS_ADDRESS } from '../../config/pretrend-markets';

const NONCES_ABI = [{ type: 'function', name: 'nonces', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }], outputs: [{ type: 'uint256', name: '' }] }];
const chainId = VITRUVEO_CHAIN_ID;
const M = { address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId };

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
    let sig = null;
    try {
      const nonce = await readContract(wagmiConfig, { address: VUSD_ADDRESS, abi: NONCES_ABI, functionName: 'nonces', args: [account], chainId });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      say('Sign the VUSD permit in your wallet…');
      const signature = await signTypedData(wagmiConfig, {
        account,
        domain: { name: 'Vitruveo Stablecoin', version: '1', chainId, verifyingContract: VUSD_ADDRESS },
        types: { Permit: [
          { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
        ] },
        primaryType: 'Permit',
        message: { owner: account, spender: PRETREND_MARKETS_ADDRESS, value: total, nonce, deadline },
      });
      const { v, r, s, yParity } = parseSignature(signature);
      sig = { deadline, v: Number(v ?? BigInt(27 + yParity)), r, s };
    } catch (e) {
      if (/rejected|denied/i.test(e?.message || '') || e?.code === 4001) throw e;
      sig = null; // wallet cannot sign typed data: approve instead
    }
    if (sig) {
      say('Confirm the buy in your wallet…');
      const hash = await writeContract(wagmiConfig, { ...M, functionName: 'buyWithPermit', args: [BigInt(typeId), bucket, amount, minUnits, sig.deadline, sig.v, sig.r, sig.s] });
      return confirm(hash, say, 'Buy');
    }
    say('Approve VUSD in your wallet…');
    const ah = await writeContract(wagmiConfig, { address: VUSD_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [PRETREND_MARKETS_ADDRESS, total], chainId });
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
