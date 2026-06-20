'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WalletState, TrackedTransaction } from '@/types';

// ─── Wallet Store ──────────────────────────────────────────────────────────

interface WalletStore extends WalletState {
  setConnected: (address: string, balance: string) => void;
  setDisconnected: () => void;
  setBalance: (balance: string) => void;
  setError: (error: string | null) => void;
  setConnecting: (isConnecting: boolean) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      isConnected: false,
      address: null,
      xlmBalance: null,
      network: 'testnet',
      isConnecting: false,
      error: null,

      setConnected: (address, balance) =>
        set({ isConnected: true, address, xlmBalance: balance, error: null, isConnecting: false }),

      setDisconnected: () =>
        set({ isConnected: false, address: null, xlmBalance: null, error: null, isConnecting: false }),

      setBalance: (balance) => set({ xlmBalance: balance }),

      setError: (error) => set({ error, isConnecting: false }),

      setConnecting: (isConnecting) => set({ isConnecting }),
    }),
    {
      name: 'stellar-wallet-store',
      partialize: (state) => ({ address: state.address, isConnected: state.isConnected }),
    }
  )
);

// ─── Transaction Store ─────────────────────────────────────────────────────

interface TransactionStore {
  transactions: TrackedTransaction[];
  addTransaction: (tx: TrackedTransaction) => void;
  updateTransaction: (id: string, updates: Partial<TrackedTransaction>) => void;
  clearTransactions: () => void;
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],

      addTransaction: (tx) =>
        set((state) => ({ transactions: [tx, ...state.transactions].slice(0, 50) })),

      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        })),

      clearTransactions: () => set({ transactions: [] }),
    }),
    { name: 'stellar-tx-store' }
  )
);
