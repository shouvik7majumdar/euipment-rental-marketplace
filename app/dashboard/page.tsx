'use client';

import { useListings, useReturnEquipment, useDeleteEquipment, useMarkUnavailable, useMarkAvailable } from '@/hooks/useRentals';
import { useWallet } from '@/hooks/useWallet';
import { Package, ShieldAlert, Clock, AlertTriangle, ShieldCheck, Loader2, ArrowUpRight, Edit2, Trash2, PowerOff, Power } from 'lucide-react';
import { stroopsToXLM, truncateAddress, formatTimestamp } from '@/lib/config';
import { WalletModal } from '@/components/wallet/WalletModal';
import { EditListingModal } from '@/components/EditListingModal';
import { useState } from 'react';
import { EquipmentListing } from '@/types';

export default function Dashboard() {
  const { address, isConnected } = useWallet();
  const { data: listings, isLoading } = useListings();
  const returnMutation = useReturnEquipment();
  const deleteMutation = useDeleteEquipment();
  const markUnavailableMutation = useMarkUnavailable();
  const markAvailableMutation = useMarkAvailable();
  
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingListing, setEditingListing] = useState<EquipmentListing | null>(null);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="max-w-md mx-auto glass-card p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Wallet Disconnected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your Stellar wallet to view your personal dashboard, manage listings, and handle active leases.
          </p>
          <button
            onClick={() => setShowWalletModal(true)}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg hover:bg-primary/90 transition-all"
          >
            Connect Wallet
          </button>
        </div>
        <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} />
      </div>
    );
  }

  // Segment user listings
  const myListings = listings?.filter((l) => l.owner === address) ?? [];
  const myRentals = listings?.filter((l) => l.currentRenter === address) ?? [];

  const handleReturn = async (listingId: number, refundDeposit: boolean) => {
    try {
      await returnMutation.mutateAsync({
        ownerAddress: address,
        listingId,
        refundDeposit,
      });
    } catch {
      // handled by mutation
    }
  };

  const handleDelete = async (listingId: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await deleteMutation.mutateAsync({ ownerAddress: address, listingId });
    } catch { }
  };

  const handleToggleAvailability = async (listingId: number, isAvailable: boolean) => {
    try {
      if (isAvailable) {
        await markUnavailableMutation.mutateAsync({ ownerAddress: address, listingId });
      } else {
        await markAvailableMutation.mutateAsync({ ownerAddress: address, listingId });
      }
    } catch { }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Owner & Renter Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your equipment inventory, process rental returns, and view leased equipment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* ─── My Listings (Owned Equipment) ─────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            My Listings ({myListings.length})
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-32 skeleton" />
              <div className="h-32 skeleton" />
            </div>
          ) : myListings.length > 0 ? (
            <div className="space-y-4">
              {myListings.map((listing) => {
                const now = Math.floor(Date.now() / 1000);
                const expired = listing.rentalExpiresAt > 0 && now > listing.rentalExpiresAt;

                return (
                  <div key={listing.id} className="glass-card p-5 border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: #{listing.id}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          listing.isAvailable
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {listing.isAvailable ? 'Available' : 'Rented'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 my-4 text-sm border-y border-white/5 py-3">
                      <div>
                        <span className="text-muted-foreground text-xs block">Daily Price</span>
                        <span className="font-semibold text-white">{stroopsToXLM(listing.dailyPrice)} XLM</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">Held Deposit</span>
                        <span className="font-semibold text-white">{stroopsToXLM(listing.deposit)} XLM</span>
                      </div>
                    </div>

                    {!listing.isAvailable && listing.currentRenter ? (
                      <div className="rounded-lg bg-white/5 border border-white/5 p-3.5 space-y-3 mb-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Renter Address</span>
                          <span className="font-mono text-primary">{truncateAddress(listing.currentRenter ?? '')}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">Lease Expires</span>
                          <span className="flex items-center gap-1 font-semibold text-white">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(listing.rentalExpiresAt)}
                          </span>
                        </div>

                        {expired && (
                          <div className="flex items-center gap-1.5 rounded bg-yellow-500/10 border border-yellow-500/25 px-2.5 py-1.5 text-xs text-yellow-400">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Rental period has expired! You can claim safety deposit if equipment was damaged/unreturned.</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => handleReturn(listing.id, true)}
                            disabled={returnMutation.isPending}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-50"
                          >
                            {returnMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                            Refund Deposit
                          </button>
                          <button
                            onClick={() => handleReturn(listing.id, false)}
                            disabled={returnMutation.isPending}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                          >
                            {returnMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            )}
                            Claim Deposit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingListing(listing)}
                            disabled={!listing.isAvailable}
                            title={!listing.isAvailable ? "Cannot edit equipment while unavailable or rented" : undefined}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-all disabled:opacity-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleAvailability(listing.id, listing.isAvailable)}
                            disabled={markAvailableMutation.isPending || markUnavailableMutation.isPending}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                              listing.isAvailable
                                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                                : 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            }`}
                          >
                            {markAvailableMutation.isPending || markUnavailableMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : listing.isAvailable ? (
                              <>
                                <PowerOff className="h-3.5 w-3.5" />
                                Mark Unavailable
                              </>
                            ) : (
                              <>
                                <Power className="h-3.5 w-3.5" />
                                Mark Available
                              </>
                            )}
                          </button>
                        </div>
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={deleteMutation.isPending || (!listing.isAvailable && !!listing.currentRenter)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete Listing
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">You haven't listed any equipment yet.</p>
            </div>
          )}
        </div>

        {/* ─── My Rentals (Leased Equipment) ─────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-cyan-400" />
            My Rentals ({myRentals.length})
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-32 skeleton" />
            </div>
          ) : myRentals.length > 0 ? (
            <div className="space-y-4">
              {myRentals.map((listing) => {
                const now = Math.floor(Date.now() / 1000);
                const expired = now > listing.rentalExpiresAt;

                return (
                  <div key={listing.id} className="glass-card p-5 border border-white/10 hover:border-cyan-500/20 transition-all">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Owner: <span className="font-mono text-primary">{truncateAddress(listing.owner)}</span>
                        </p>
                      </div>
                      <span className="rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold">
                        Leased
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 my-4 text-sm border-y border-white/5 py-3">
                      <div>
                        <span className="text-muted-foreground text-xs block">Daily Price</span>
                        <span className="font-semibold text-white">{stroopsToXLM(listing.dailyPrice)} XLM</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">Escrowed Deposit</span>
                        <span className="font-semibold text-white">{stroopsToXLM(listing.deposit)} XLM</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/5 border border-white/5 p-3.5 space-y-2">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-muted-foreground">Expires At</span>
                        <span className="flex items-center gap-1 font-semibold text-white">
                          <Clock className="h-3.5 w-3.5 text-cyan-400" />
                          {formatTimestamp(listing.rentalExpiresAt)}
                        </span>
                      </div>
                      {expired && (
                        <div className="flex items-center gap-1 rounded bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 text-xs text-yellow-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Rental expired! Return the physical item to get deposit back.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">You are not renting any equipment currently.</p>
            </div>
          )}
        </div>
      </div>

      <EditListingModal
        open={!!editingListing}
        onClose={() => setEditingListing(null)}
        listing={editingListing}
        ownerAddress={address}
      />
    </div>
  );
}
