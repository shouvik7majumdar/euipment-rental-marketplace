'use client';

import { useState, useEffect } from 'react';
import { X, Wallet, CheckCircle, Loader2 } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { ISupportedWallet } from '@creit.tech/stellar-wallets-kit';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

const WALLET_ICONS: Record<string, string> = {
  freighter: '🔓',
  lobstr: '🦞',
  xbull: '🐂',
  hana: '🌸',
};

export function WalletModal({ open, onClose }: WalletModalProps) {
  const { connect, isConnecting, isConnected, getAvailableWallets } = useWallet();
  const [wallets, setWallets] = useState<ISupportedWallet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getAvailableWallets()
        .then(setWallets)
        .catch(() => setWallets([]))
        .finally(() => setLoading(false));
    }
  }, [open, getAvailableWallets]);

  useEffect(() => {
    if (isConnected) onClose();
  }, [isConnected, onClose]);

  if (!open) return null;

  const handleConnect = async (walletId: string) => {
    await connect(walletId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card w-full max-w-md p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Connect Wallet</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select a wallet to connect to RentChain
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Network Badge */}
        <div className="flex items-center gap-2 mb-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          <span className="text-xs text-yellow-300 font-medium">Stellar Testnet</span>
          <span className="text-xs text-muted-foreground ml-auto">
            Make sure your wallet is on Testnet
          </span>
        </div>

        {/* Wallet List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No wallets found</p>
                <p className="text-xs mt-1 opacity-70">
                  Install Freighter, LOBSTR, xBull, or Hana extension
                </p>
              </div>
            ) : (
              wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="text-2xl w-10 text-center">
                    {WALLET_ICONS[wallet.id.toLowerCase()] ?? '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {wallet.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {wallet.isAvailable ? '✓ Installed' : '⚠ Not installed'}
                    </p>
                  </div>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              ))
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          By connecting, you agree to interact with Stellar Testnet smart contracts.
        </p>
      </div>
    </div>
  );
}
