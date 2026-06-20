// Types for the Equipment Rental Marketplace

export interface EquipmentListing {
  id: number;
  owner: string;
  title: string;
  dailyPrice: bigint;
  deposit: bigint;
  isAvailable: boolean;
  currentRenter: string | null;
  rentalExpiresAt: number;
  currentRentalPayment: bigint;
}

export interface RentalActivity {
  id: string;
  type: 'listed' | 'rented' | 'returned';
  listingId: number;
  actorAddress: string;
  timestamp: number;
  details: {
    title?: string;
    dailyPrice?: bigint;
    deposit?: bigint;
    days?: number;
    refundDeposit?: boolean;
  };
  txHash: string;
}

export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface TrackedTransaction {
  id: string;
  hash: string;
  type: 'list_equipment' | 'rent_equipment' | 'return_equipment' | 'edit_equipment' | 'delete_equipment' | 'mark_unavailable' | 'mark_available';
  status: TransactionStatus;
  description: string;
  timestamp: number;
  listingId?: number;
  errorMessage?: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  xlmBalance: string | null;
  network: string;
  isConnecting: boolean;
  error: string | null;
}

export interface ContractConfig {
  contractId: string;
  tokenContractId: string;
  networkPassphrase: string;
  rpcUrl: string;
}

export type SortOrder = 'asc' | 'desc';
export type FilterAvailability = 'all' | 'available' | 'rented';
