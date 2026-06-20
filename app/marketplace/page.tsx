'use client';

import { useState } from 'react';
import { useListings, useListEquipment, useRentEquipment } from '@/hooks/useRentals';
import { useWallet } from '@/hooks/useWallet';
import { Package, Search, SlidersHorizontal, Plus, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { stroopsToXLM, xlmToStroops, truncateAddress } from '@/lib/config';
import { EquipmentListing } from '@/types';

export default function Marketplace() {
  const { address, isConnected } = useWallet();
  const { data: listings, isLoading, refetch } = useListings();
  const listMutation = useListEquipment();
  const rentMutation = useRentEquipment();

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [availability, setAvailability] = useState<'all' | 'available' | 'rented'>('all');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'id-desc'>('id-desc');

  // List Modal state
  const [showListModal, setShowListModal] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [listDeposit, setListDeposit] = useState('');

  // Rent Modal state
  const [rentingItem, setRentingItem] = useState<EquipmentListing | null>(null);
  const [rentDays, setRentDays] = useState(1);

  // Handlers
  const handleListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    try {
      const priceStroops = xlmToStroops(listPrice);
      const depositStroops = xlmToStroops(listDeposit);
      
      await listMutation.mutateAsync({
        ownerAddress: address,
        title: listTitle,
        dailyPriceStroops: priceStroops,
        depositStroops: depositStroops,
      });

      setShowListModal(false);
      setListTitle('');
      setListPrice('');
      setListDeposit('');
    } catch {
      // toast shown by mutation
    }
  };

  const handleRentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !rentingItem) return;
    try {
      await rentMutation.mutateAsync({
        renterAddress: address,
        listingId: rentingItem.id,
        days: rentDays,
      });
      setRentingItem(null);
      setRentDays(1);
    } catch {
      // error toast handled by mutation
    }
  };

  // Filter listings
  const filteredListings = listings
    ?.filter((l) => {
      const matchesSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAvailability =
        availability === 'all' ||
        (availability === 'available' && l.isAvailable) ||
        (availability === 'rented' && !l.isAvailable);
      return matchesSearch && matchesAvailability;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return Number(a.dailyPrice - b.dailyPrice);
      if (sortBy === 'price-desc') return Number(b.dailyPrice - a.dailyPrice);
      return b.id - a.id;
    });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Equipment Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Browse and lease tools on the Stellar testnet with secure smart-contract escrows.
          </p>
        </div>

        {isConnected ? (
          <button
            onClick={() => setShowListModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            List Equipment
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>Connect wallet to list and rent equipment.</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search equipment by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 pl-11 pr-4 py-2.5 text-sm text-white placeholder-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Availability */}
          <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/5">
            <button
              onClick={() => setAvailability('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                availability === 'all'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAvailability('available')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                availability === 'available'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setAvailability('rented')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                availability === 'rented'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Rented
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white px-3 py-2 focus:border-primary/50 focus:outline-none"
            >
              <option value="id-desc">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card p-6 h-64 skeleton" />
          ))}
        </div>
      ) : filteredListings && filteredListings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredListings.map((listing) => {
            const isOwner = listing.owner === address;
            return (
              <div key={listing.id} className="glass-card p-6 flex flex-col justify-between group transition-all hover:border-primary/30 hover:glow-blue">
                <div>
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-muted-foreground">Listing #{listing.id}</span>
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

                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                    {listing.title}
                  </h3>

                  {/* Owner Address */}
                  <p className="text-xs text-muted-foreground mb-4">
                    Owner: <span className="font-mono text-primary/80">{truncateAddress(listing.owner)}</span>
                    {isOwner && <span className="text-xs text-green-400 ml-1.5 font-semibold">(You)</span>}
                  </p>

                  <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Price</p>
                      <p className="text-lg font-bold text-white mt-0.5">
                        {stroopsToXLM(listing.dailyPrice)} <span className="text-xs text-primary font-semibold">XLM</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Safety Deposit</p>
                      <p className="text-lg font-bold text-white mt-0.5">
                        {stroopsToXLM(listing.deposit)} <span className="text-xs text-primary font-semibold">XLM</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {listing.isAvailable ? (
                  isOwner ? (
                    <button
                      disabled
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-muted-foreground cursor-not-allowed"
                    >
                      Your Listing
                    </button>
                  ) : (
                    <button
                      disabled={!isConnected}
                      onClick={() => setRentingItem(listing)}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rent Equipment
                    </button>
                  )
                ) : (
                  <div className="text-xs rounded-lg bg-white/5 p-3 border border-white/5 text-center text-muted-foreground">
                    Rented by:{' '}
                    <span className="font-mono text-primary/80">
                      {listing.currentRenter === address ? 'You' : truncateAddress(listing.currentRenter ?? '')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground opacity-45 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No Listings Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {searchTerm
              ? 'No listings matched your search query. Try another keyword or clear the filters.'
              : 'The equipment catalog is currently empty. Be the first to list equipment!'}
          </p>
        </div>
      )}

      {/* ─── List Modal ─────────────────────────────────────────────────── */}
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowListModal(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4">List New Equipment</h2>
            <form onSubmit={handleListSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Equipment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Concrete Mixer"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Daily Price (XLM)</label>
                  <input
                    type="number"
                    step="0.0000001"
                    min="0"
                    required
                    placeholder="e.g. 5"
                    value={listPrice}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setListPrice(e.target.value.replace(/-/g, ''))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Safety Deposit (XLM)</label>
                  <input
                    type="number"
                    step="0.0000001"
                    min="0"
                    required
                    placeholder="e.g. 100"
                    value={listDeposit}
                    onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                    onChange={(e) => setListDeposit(e.target.value.replace(/-/g, ''))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={listMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {listMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sign in Wallet...
                  </>
                ) : (
                  'Submit Listing'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Rent Modal ─────────────────────────────────────────────────── */}
      {rentingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setRentingItem(null)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">Rent Equipment</h2>
            <p className="text-sm text-muted-foreground mb-5">{rentingItem.title}</p>

            <form onSubmit={handleRentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Rental Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={rentDays}
                  onChange={(e) => setRentDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily rate</span>
                  <span className="text-white font-mono">{stroopsToXLM(rentingItem.dailyPrice)} XLM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="text-white">{rentDays} day(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Safety deposit (held)</span>
                  <span className="text-white font-mono">{stroopsToXLM(rentingItem.deposit)} XLM</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-base font-bold">
                  <span className="text-white">Total escrow payment</span>
                  <span className="text-primary font-mono">
                    {stroopsToXLM(rentingItem.dailyPrice * BigInt(rentDays) + rentingItem.deposit)} XLM
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={rentMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {rentMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sign in Wallet...
                  </>
                ) : (
                  'Authorize Escrow Payment'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
