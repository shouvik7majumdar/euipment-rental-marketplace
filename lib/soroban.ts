'use client';

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc as stellarRpc,
} from '@stellar/stellar-sdk';
import { CONTRACT_CONFIG, HORIZON_URL } from '@/lib/config';
import { signTransaction } from '@/lib/wallet';

const { Server, Api } = stellarRpc;
import { EquipmentListing } from '@/types';


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

async function buildAndSubmitTx(
  sourceAddress: string,
  contractOp: xdr.Operation,
  methodName?: string,
): Promise<string> {
  console.log(`[soroban] buildAndSubmitTx START — method: ${methodName}, source: ${sourceAddress}`);

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
    preparedTx = await rpc.prepareTransaction(tx);
    console.log('[soroban] Step 3: Transaction prepared successfully');
  } catch (err: any) {
    const rawMsg = err.message || String(err);
    let friendlyMsg = rawMsg;
    
    if (rawMsg.includes('UnreachableCodeReached') || rawMsg.includes('HostError') || rawMsg.includes('InvalidAction')) {
      if (methodName === 'edit_equipment') {
        friendlyMsg = 'Cannot edit equipment while it is unavailable or rented.';
      } else if (methodName === 'delete_equipment') {
        friendlyMsg = 'Cannot delete equipment while it is currently rented.';
      } else if (methodName === 'rent_equipment') {
        friendlyMsg = 'Equipment is already rented or unavailable.';
      } else if (methodName === 'return_equipment') {
        friendlyMsg = 'Equipment is not currently rented.';
      } else if (methodName === 'mark_unavailable') {
        friendlyMsg = 'Equipment is already unavailable.';
      } else if (methodName === 'mark_available') {
        friendlyMsg = 'Cannot mark available while it is rented on-chain.';
      } else {
        friendlyMsg = 'Transaction rejected by smart contract rules.';
      }
    } else {
      friendlyMsg = `Simulation failed: ${rawMsg}. Make sure you have enough XLM to pay for fees.`;
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

  const result = await rpc.simulateTransaction(tx);
  if (stellarRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation failed: ${result.error}`);
  }
  const parsed = result as stellarRpc.Api.SimulateTransactionSuccessResponse;
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

  const result = await rpc.simulateTransaction(tx);
  if (stellarRpc.Api.isSimulationError(result)) return null;
  const parsed = result as stellarRpc.Api.SimulateTransactionSuccessResponse;
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
    nativeToScVal(refundDeposit),
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
          contractIds: [CONTRACT_CONFIG.contractId],
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
