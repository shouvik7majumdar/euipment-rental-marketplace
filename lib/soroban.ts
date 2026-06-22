'use client';

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  Transaction,
  MuxedAccount,
  Account,
  StrKey,
} from '@stellar/stellar-sdk';
import { Server, Api } from '@stellar/stellar-sdk/rpc';
import { TransactionBuilder as BaseTransactionBuilder } from '@stellar/stellar-base';
import { CONTRACT_CONFIG, HORIZON_URL } from '@/lib/config';
import { signTransaction } from '@/lib/wallet';
import { EquipmentListing } from '@/types';

// ─── Monkey-patch TransactionBuilder.cloneFrom to bypass ESM/CJS instanceof check mismatch in Next.js bundles ───
const patchCloneFrom = (builderClass: any) => {
  if (!builderClass || typeof builderClass.cloneFrom !== 'function') return;
  const originalCloneFrom = builderClass.cloneFrom;
  builderClass.cloneFrom = function (tx: any, opts?: any) {
    try {
      const sequenceNum = (BigInt(tx.sequence) - BigInt(1)).toString();
      let source;
      if (StrKey.isValidMed25519PublicKey(tx.source)) {
        source = MuxedAccount.fromAddress(tx.source, sequenceNum);
      } else if (StrKey.isValidEd25519PublicKey(tx.source)) {
        source = new Account(tx.source, sequenceNum);
      } else {
        throw new TypeError(`unsupported tx source account: ${tx.source}`);
      }

      const unscaledFee = parseInt(tx.fee, 10) / tx.operations.length;
      const builder = new builderClass(source, {
        fee: (unscaledFee || BASE_FEE).toString(),
        memo: tx.memo,
        networkPassphrase: tx.networkPassphrase,
        timebounds: tx.timeBounds,
        ledgerbounds: tx.ledgerBounds,
        minAccountSequence: tx.minAccountSequence,
        minAccountSequenceAge: tx.minAccountSequenceAge,
        minAccountSequenceLedgerGap: tx.minAccountSequenceLedgerGap,
        extraSigners: tx.extraSigners,
        ...opts
      });

      const rawTx = tx.tx || tx._tx;
      if (rawTx && typeof rawTx.operations === 'function') {
        rawTx.operations().forEach((op: any) => {
          builder.addOperation(op);
        });
      } else {
        tx.operations.forEach((op: any) => {
          builder.addOperation(op);
        });
      }
      return builder;
    } catch (err) {
      console.warn('[soroban] Custom cloneFrom failed, falling back to original:', err);
      return originalCloneFrom.call(builderClass, tx, opts);
    }
  };
};

// Patch the imported TransactionBuilder classes
patchCloneFrom(TransactionBuilder);
patchCloneFrom(BaseTransactionBuilder);

// Try to patch the required/CJS versions of TransactionBuilder if they exist separately
if (typeof require !== 'undefined') {
  try {
    const sdkCJS = require('@stellar/stellar-sdk');
    if (sdkCJS && sdkCJS.TransactionBuilder) {
      patchCloneFrom(sdkCJS.TransactionBuilder);
    }
  } catch (e) {
    // Ignore require error
  }
  try {
    const baseCJS = require('@stellar/stellar-base');
    if (baseCJS && baseCJS.TransactionBuilder) {
      patchCloneFrom(baseCJS.TransactionBuilder);
    }
  } catch (e) {
    // Ignore require error
  }
}


import { toast } from 'sonner';

const rpc = new Server(CONTRACT_CONFIG.rpcUrl);

// ─── helpers ───────────────────────────────────────────────────────────────

function scValToListing(val: xdr.ScVal): EquipmentListing {
  const map = scValToNative(val) as Record<string, unknown>;
  return {
    id: Number(map.id),
    owner: (map.owner as { toString: () => string }).toString(),
    title: String(map.title),
    dailyPrice: BigInt(String(map.daily_price)),
    deposit: BigInt(String(map.deposit)),
    isAvailable: Boolean(map.is_available),
    currentRenter: map.current_renter ? String(map.current_renter) : null,
    rentalExpiresAt: Number(map.rental_expires_at),
    currentRentalPayment: BigInt(String(map.current_rental_payment)),
  };
}

// ─── transaction mutex ────────────────────────────────────────────────────
// Prevents multiple concurrent buildAndSubmitTx calls from using the same
// account sequence number, which causes prepareTransaction to hang forever.
let txInFlight = false;

// Wraps a promise with a timeout so RPC calls never hang the UI indefinitely.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

async function buildAndSubmitTx(
  sourceAddress: string,
  contractOp: xdr.Operation,
  methodName?: string,
): Promise<string> {
  if (txInFlight) {
    throw new Error('A transaction is already in progress. Please wait for it to complete.');
  }
  txInFlight = true;
  console.log(`[soroban] buildAndSubmitTx START — method: ${methodName}, source: ${sourceAddress}`);
  try {
    return await _buildAndSubmitTx(sourceAddress, contractOp, methodName);
  } finally {
    txInFlight = false;
  }
}

async function _buildAndSubmitTx(
  sourceAddress: string,
  contractOp: xdr.Operation,
  methodName?: string,
): Promise<string> {
  console.log(`[soroban] _buildAndSubmitTx — method: ${methodName}, source: ${sourceAddress}`);

  let account;
  try {
    console.log('[soroban] Step 1: Fetching account from RPC...');
    account = await rpc.getAccount(sourceAddress);
    console.log('[soroban] Step 1: Account fetched successfully');
  } catch (err: any) {
    const isNotFound = err && (
      err.message?.includes('not found') || 
      err.message?.includes('404') || 
      String(err).includes('not found')
    );
    if (isNotFound) {
      toast.info('Account not found on-chain. Funding via Friendbot...');
      try {
        const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${sourceAddress}`);
        if (!friendbotRes.ok) {
          throw new Error(`Friendbot responded with status ${friendbotRes.status}`);
        }
        // Wait for ledger close
        await new Promise((resolve) => setTimeout(resolve, 4000));
        account = await rpc.getAccount(sourceAddress);
        toast.success('Account successfully funded and created on-chain!');
        console.log('[soroban] Step 1: Account funded via Friendbot');
      } catch (fundErr: any) {
        const msg = fundErr instanceof Error ? fundErr.message : String(fundErr);
        throw new Error(`Account is not funded. Auto-funding via Friendbot failed: ${msg}. Please fund your wallet manually.`);
      }
    } else {
      throw new Error(`Failed to fetch account info: ${err.message || err}`);
    }
  }

  let tx;
  try {
    console.log('[soroban] Step 2: Building transaction...');
    tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
    })
      .addOperation(contractOp)
      .setTimeout(30)
      .build();
    console.log('[soroban] Step 2: Transaction built successfully');
  } catch (err: any) {
    throw new Error(`Failed to build transaction: ${err.message || err}`);
  }

  let preparedTx;
  try {
    console.log('[soroban] Step 3: Simulating/preparing transaction...');
    // Round-trip through XDR to avoid ESM/CJS class identity mismatch in Next.js
    // where the Transaction from one bundle isn't recognized by the RPC module
    preparedTx = await withTimeout(
      rpc.prepareTransaction(roundTripTx(tx) as Parameters<typeof rpc.prepareTransaction>[0]),
      30_000,
      'prepareTransaction'
    );
    console.log('[soroban] Step 3: Transaction prepared successfully');
  } catch (err: any) {
    const rawMsg = err.message || String(err);
    let friendlyMsg = rawMsg;

    // Check for smart contract logic panics (UnreachableCodeReached = soroban panic!())
    const isContractPanic = rawMsg.includes('UnreachableCodeReached') || rawMsg.includes('HostError') || rawMsg.includes('InvalidAction') || rawMsg.includes('WasmVm');

    if (isContractPanic) {
      // Map contract panics to user-friendly messages based on which method failed
      switch (methodName) {
        case 'edit_equipment':
          friendlyMsg = 'Cannot edit equipment while it is unavailable or rented.';
          break;
        case 'delete_equipment':
          friendlyMsg = 'Cannot delete equipment while it is currently rented.';
          break;
        case 'rent_equipment':
          friendlyMsg = 'Renting failed. The equipment might be rented, or your account might be blacklisted due to low reputation.';
          break;
        case 'return_equipment':
          friendlyMsg = 'Equipment is not currently rented, so it cannot be returned.';
          break;
        case 'mark_unavailable':
          friendlyMsg = 'Equipment is already marked as unavailable.';
          break;
        case 'mark_available':
          friendlyMsg = 'Cannot mark available while equipment is actively rented on-chain.';
          break;
        case 'set_blacklisted':
          friendlyMsg = 'Failed to update blacklist. Only the administrator can modify blacklist statuses.';
          break;
        default:
          friendlyMsg = 'Transaction rejected by smart contract rules.';
      }
    } else {
      // Non-contract error: show the raw simulation error clearly without a misleading balance check
      friendlyMsg = `Transaction simulation failed: ${rawMsg}.`;
    }

    throw new Error(friendlyMsg);
  }

  let signedXdr;
  try {
    console.log('[soroban] Step 4: Requesting wallet signature (Freighter popup should appear NOW)...');
    toast.info('Please approve the transaction in your wallet...');
    signedXdr = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
      address: sourceAddress,
    });
    console.log('[soroban] Step 4: Transaction signed by wallet');
  } catch (err: any) {
    console.error('[soroban] Step 4 FAILED: Signing error:', err);
    throw new Error(`Signing failed or cancelled: ${err.message || err}`);
  }

  let signedTx;
  try {
    signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      CONTRACT_CONFIG.networkPassphrase
    );
  } catch (err: any) {
    throw new Error(`Failed to parse signed transaction XDR: ${err.message || err}`);
  }

  let result;
  try {
    result = await rpc.sendTransaction(signedTx as Parameters<typeof rpc.sendTransaction>[0]);
  } catch (err: any) {
    throw new Error(`Failed to send transaction: ${err.message || err}`);
  }

  if (result.status === 'ERROR') {
    const errDetail = result.errorResult
      ? result.errorResult.toXDR('base64')
      : 'unknown error';
    throw new Error(`Transaction submission failed: ${errDetail}`);
  }

  // Poll for confirmation
  const hash = result.hash;
  let attempts = 0;
  while (attempts < 25) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc.getTransaction(hash);
    if (status.status === Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (status.status === Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction ${hash} failed on-chain`);
    }
    attempts++;
  }
  throw new Error(`Transaction ${hash} timed out waiting for confirmation`);
}

// ─── helpers ───────────────────────────────────────────────────────────────
// Round-trip a Transaction through XDR serialization to resolve ESM/CJS class
// identity mismatches that cause "expected a Transaction, got [object Object]"
// in Next.js browser bundles.
function roundTripTx(tx: ReturnType<TransactionBuilder['build']>) {
  return TransactionBuilder.fromXDR(
    tx.toXDR(),
    CONTRACT_CONFIG.networkPassphrase
  ) as Parameters<typeof rpc.simulateTransaction>[0];
}

// ─── read functions ────────────────────────────────────────────────────────

export async function getTotalListings(): Promise<number> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const tx = new TransactionBuilder(
    await rpc.getAccount(
      'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3' // dummy source for reads
    ),
    { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
  )
    .addOperation(contract.call('get_total_listings'))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(roundTripTx(tx));
  if (Api.isSimulationError(result)) {
    throw new Error(`Simulation failed: ${result.error}`);
  }
  const parsed = result as Api.SimulateTransactionSuccessResponse;
  return scValToNative(parsed.result!.retval) as number;
}

export async function getListing(id: number): Promise<EquipmentListing | null> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const tx = new TransactionBuilder(
    await rpc.getAccount(
      'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3'
    ),
    { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
  )
    .addOperation(
      contract.call('get_listing', nativeToScVal(id, { type: 'u32' }))
    )
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(roundTripTx(tx));
  if (Api.isSimulationError(result)) return null;
  const parsed = result as Api.SimulateTransactionSuccessResponse;
  const native = scValToNative(parsed.result!.retval);
  if (native === null || native === undefined) return null;
  return scValToListing(parsed.result!.retval);
}


export async function getAllListings(): Promise<EquipmentListing[]> {
  const total = await getTotalListings();
  const listings: EquipmentListing[] = [];
  for (let i = 1; i <= total; i++) {
    const listing = await getListing(i);
    if (listing) listings.push(listing);
  }
  return listings;
}

// ─── write functions ───────────────────────────────────────────────────────

export async function listEquipment(
  ownerAddress: string,
  title: string,
  dailyPriceStroops: bigint,
  depositStroops: bigint,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'list_equipment',
    new Address(ownerAddress).toScVal(),
    nativeToScVal(title, { type: 'string' }),
    nativeToScVal(dailyPriceStroops, { type: 'i128' }),
    nativeToScVal(depositStroops, { type: 'i128' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'list_equipment');
}

export async function rentEquipment(
  renterAddress: string,
  listingId: number,
  days: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'rent_equipment',
    new Address(renterAddress).toScVal(),
    nativeToScVal(listingId, { type: 'u32' }),
    nativeToScVal(days, { type: 'u32' }),
  );
  return buildAndSubmitTx(renterAddress, op, 'rent_equipment');
}

export async function returnEquipment(
  ownerAddress: string,
  listingId: number,
  refundDeposit: boolean,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'return_equipment',
    nativeToScVal(listingId, { type: 'u32' }),
    nativeToScVal(refundDeposit, { type: 'bool' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'return_equipment');
}

export async function editEquipment(
  ownerAddress: string,
  listingId: number,
  title: string,
  dailyPriceStroops: bigint,
  depositStroops: bigint,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'edit_equipment',
    new Address(ownerAddress).toScVal(),
    nativeToScVal(listingId, { type: 'u32' }),
    nativeToScVal(title, { type: 'string' }),
    nativeToScVal(dailyPriceStroops, { type: 'i128' }),
    nativeToScVal(depositStroops, { type: 'i128' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'edit_equipment');
}

export async function deleteEquipment(
  ownerAddress: string,
  listingId: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'delete_equipment',
    new Address(ownerAddress).toScVal(),
    nativeToScVal(listingId, { type: 'u32' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'delete_equipment');
}

export async function markUnavailable(
  ownerAddress: string,
  listingId: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'mark_unavailable',
    new Address(ownerAddress).toScVal(),
    nativeToScVal(listingId, { type: 'u32' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'mark_unavailable');
}

export async function markAvailable(
  ownerAddress: string,
  listingId: number,
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const op = contract.call(
    'mark_available',
    new Address(ownerAddress).toScVal(),
    nativeToScVal(listingId, { type: 'u32' }),
  );
  return buildAndSubmitTx(ownerAddress, op, 'mark_available');
}

// ─── balance query ─────────────────────────────────────────────────────────

export async function getXLMBalance(address: string): Promise<string> {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
    if (!res.ok) return '0';
    const data = await res.json();
    const native = data.balances?.find(
      (b: { asset_type: string; balance: string }) => b.asset_type === 'native'
    );
    return native?.balance ?? '0';
  } catch {
    return '0';
  }
}

// ─── event query ───────────────────────────────────────────────────────────

export interface SorobanContractEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  topic: string[];
  value: any;
  txHash: string;
}

export async function getContractEvents(): Promise<SorobanContractEvent[]> {
  try {
    // Get latest ledger first to look back a reasonable range, e.g. 5000 ledgers, or just start from 0 if RPC allows.
    // Soroban RPC getEvents usually requires startLedger. We can query current ledger first.
    const networkInfo = await rpc.getLatestLedger();
    const currentLedger = networkInfo.sequence;
    const startLedger = Math.max(1, currentLedger - 10000);

    const response = await rpc.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [
            CONTRACT_CONFIG.contractId,
            ...(CONTRACT_CONFIG.reputationContractId && CONTRACT_CONFIG.reputationContractId !== 'REPUTATION_CONTRACT_HERE'
              ? [CONTRACT_CONFIG.reputationContractId]
              : [])
          ],
        },
      ],
      limit: 50,
    });

    return response.events.map((e) => {
      const topics = e.topic.map((t) => {
        try {
          return String(scValToNative(t));
        } catch {
          return 'unknown';
        }
      });

      let parsedValue: any = null;
      try {
        parsedValue = scValToNative(e.value);
      } catch {
        parsedValue = 'unparseable';
      }

      return {
        id: e.id,
        ledger: e.ledger,
        ledgerClosedAt: e.ledgerClosedAt,
        contractId: e.contractId ? e.contractId.toString() : '',
        topic: topics,
        value: parsedValue,
        txHash: e.txHash,
      };
    });
  } catch (error) {
    console.error('Error fetching Soroban events:', error);
    return [];
  }
}

// ─── reputation query & write functions ────────────────────────────────────

export async function getReputation(address: string): Promise<number> {
  if (!CONTRACT_CONFIG.reputationContractId || CONTRACT_CONFIG.reputationContractId === 'REPUTATION_CONTRACT_HERE') {
    return 100;
  }
  try {
    const contract = new Contract(CONTRACT_CONFIG.reputationContractId);
    const tx = new TransactionBuilder(
      await rpc.getAccount('GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3'),
      { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
    )
      .addOperation(contract.call('get_reputation', new Address(address).toScVal()))
      .setTimeout(30)
      .build();

    const result = await rpc.simulateTransaction(roundTripTx(tx));
    if (Api.isSimulationError(result)) return 100;
    const parsed = result as Api.SimulateTransactionSuccessResponse;
    const val = scValToNative(parsed.result!.retval);
    return typeof val === 'number' ? val : 100;
  } catch (e) {
    console.error('Error fetching reputation:', e);
    return 100;
  }
}

export async function isBlacklisted(address: string): Promise<boolean> {
  if (!CONTRACT_CONFIG.reputationContractId || CONTRACT_CONFIG.reputationContractId === 'REPUTATION_CONTRACT_HERE') {
    return false;
  }
  try {
    const contract = new Contract(CONTRACT_CONFIG.reputationContractId);
    const tx = new TransactionBuilder(
      await rpc.getAccount('GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3'),
      { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
    )
      .addOperation(contract.call('is_blacklisted', new Address(address).toScVal()))
      .setTimeout(30)
      .build();

    const result = await rpc.simulateTransaction(roundTripTx(tx));
    if (Api.isSimulationError(result)) return false;
    const parsed = result as Api.SimulateTransactionSuccessResponse;
    return Boolean(scValToNative(parsed.result!.retval));
  } catch (e) {
    console.error('Error checking blacklist:', e);
    return false;
  }
}

export async function setBlacklisted(
  adminAddress: string,
  userAddress: string,
  status: boolean
): Promise<string> {
  const contract = new Contract(CONTRACT_CONFIG.reputationContractId);
  const op = contract.call(
    'set_blacklisted',
    new Address(adminAddress).toScVal(),
    new Address(userAddress).toScVal(),
    nativeToScVal(status, { type: 'bool' })
  );
  return buildAndSubmitTx(adminAddress, op, 'set_blacklisted');
}
