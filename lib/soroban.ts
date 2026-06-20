'use client';

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  Keypair,
} from '@stellar/stellar-sdk';
import { CONTRACT_CONFIG, HORIZON_URL } from '@/lib/config';
import { signTransaction } from '@/lib/wallet';
import { EquipmentListing, TrackedTransaction } from '@/types';

const rpc = new SorobanRpc.Server(CONTRACT_CONFIG.rpcUrl);

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
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
  })
    .addOperation(contractOp)
    .setTimeout(30)
    .build();

  const preparedTx = await rpc.prepareTransaction(tx);
  const signedXdr = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase,
    address: sourceAddress,
  });

  const result = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, CONTRACT_CONFIG.networkPassphrase)
  );

  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${result.errorResult?.toXDR('base64')}`);
  }

  // Poll for confirmation
  const hash = result.hash;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 1500));
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
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
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' // dummy source for reads
    ),
    { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
  )
    .addOperation(contract.call('get_total_listings'))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation failed: ${result.error}`);
  }
  const parsed = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(parsed.result!.retval) as number;
}

export async function getListing(id: number): Promise<EquipmentListing | null> {
  const contract = new Contract(CONTRACT_CONFIG.contractId);
  const tx = new TransactionBuilder(
    await rpc.getAccount(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'
    ),
    { fee: BASE_FEE, networkPassphrase: CONTRACT_CONFIG.networkPassphrase }
  )
    .addOperation(
      contract.call('get_listing', nativeToScVal(id, { type: 'u32' }))
    )
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) return null;
  const parsed = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
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
  return buildAndSubmitTx(ownerAddress, op);
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
  return buildAndSubmitTx(renterAddress, op);
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
  return buildAndSubmitTx(ownerAddress, op);
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
        contractId: e.contractId,
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
