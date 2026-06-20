'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/lib/store';
import {
  connectWallet,
  disconnectWallet,
  getAvailableWallets,
} from '@/lib/wallet';
import { getXLMBalance } from '@/lib/soroban';

export function useWallet() {
  const store = useWalletStore();

  const connect = useCallback(async (walletId?: string) => {
    store.setConnecting(true);
    store.setError(null);
    try {
      const address = await connectWallet(walletId);
      const balance = await getXLMBalance(address);
      store.setConnected(address, balance);
      toast.success('Wallet connected!', {
        description: `${address.slice(0, 8)}...${address.slice(-4)}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('rejected') || message.toLowerCase().includes('cancel')) {
        store.setError('Transaction rejected by user.');
        toast.error('Connection cancelled');
      } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('not installed')) {
        store.setError('Wallet not found. Please install the wallet extension.');
        toast.error('Wallet not installed', {
          description: 'Please install the wallet browser extension.',
        });
      } else {
        store.setError(message);
        toast.error('Failed to connect wallet', { description: message });
      }
    }
  }, [store]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    store.setDisconnected();
    toast.info('Wallet disconnected');
  }, [store]);

  const refreshBalance = useCallback(async () => {
    if (!store.address) return;
    try {
      const balance = await getXLMBalance(store.address);
      store.setBalance(balance);
    } catch {
      // silently fail balance refresh
    }
  }, [store]);

  return {
    ...store,
    connect,
    disconnect,
    refreshBalance,
    getAvailableWallets,
  };
}
