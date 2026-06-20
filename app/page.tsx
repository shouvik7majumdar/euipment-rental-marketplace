'use client';

import Link from 'next/link';
import { useListings } from '@/hooks/useRentals';
import { useWallet } from '@/hooks/useWallet';
import { ArrowRight, ShieldCheck, Zap, Package, RefreshCw, Layers } from 'lucide-react';
import { stroopsToXLM } from '@/lib/config';

export default function Home() {
  const { data: listings, isLoading, refetch } = useListings();
  const { isConnected } = useWallet();

  const totalListings = listings?.length ?? 0;
  const activeRentals = listings?.filter((l) => !l.isAvailable).length ?? 0;
  const availableCount = totalListings - activeRentals;

  return (
    <div className="relative min-h-screen hero-mesh overflow-hidden pb-12">
      {/* Dynamic glow blobs */}
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-20 right-1/4 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6 text-sm text-primary">
          <Zap className="h-4 w-4 fill-current" />
          <span>Soroban Smart Contract Marketplace</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
          Trustless Equipment Rental <br />
          <span className="gradient-text">Powered by Stellar</span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-muted-foreground mb-8">
          Rent high-value machinery, tools, and industrial equipment securely. 
          Smart contract escrow holds safety deposits, ensuring fair terms for both owners and renters.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/marketplace"
            className="flex items-center gap-2 w-full sm:w-auto justify-center rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            Browse Marketplace
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full sm:w-auto justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-foreground hover:bg-white/10 transition-all hover:scale-[1.02]"
          >
            Manage Rentals
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Total Listings</span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-white">
              {isLoading ? (
                <div className="h-9 w-16 skeleton" />
              ) : (
                totalListings
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Active items on-chain</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Active Rentals</span>
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
                <RefreshCw className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-white">
              {isLoading ? (
                <div className="h-9 w-16 skeleton" />
              ) : (
                activeRentals
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalListings > 0 
                ? `${Math.round((activeRentals / totalListings) * 100)}% utilization rate`
                : '0% utilization rate'}
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Available Equipment</span>
              <div className="rounded-lg bg-green-500/10 p-2 text-green-400">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-white">
              {isLoading ? (
                <div className="h-9 w-16 skeleton" />
              ) : (
                availableCount
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ready for instant hire</p>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Escrow Smart Contract</h3>
            <p className="text-sm text-muted-foreground">
              Rental fees and safety deposits are locked in a secure Soroban contract. Re-claims or deposit payouts are executed directly via on-chain state transitions.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Fast Transaction Speeds</h3>
            <p className="text-sm text-muted-foreground">
              Leverage Stellar's fast ledger times and near-zero fees. Experience instant feedback on connections, listing creations, and rentals.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-400 mb-4">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multi-Wallet Integration</h3>
            <p className="text-sm text-muted-foreground">
              Compatible with Freighter, LOBSTR, Hana, and xBull wallets. Connect and execute transactions seamless using standard web3 interfaces.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
