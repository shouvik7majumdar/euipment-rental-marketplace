'use client';

import { useListings } from '@/hooks/useRentals';
import { getReputation } from '@/lib/soroban';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, Package, ShieldCheck, ArrowDownLeft, 
  TrendingUp, Users, Loader2, Coins, Calendar 
} from 'lucide-react';
import { truncateAddress, stroopsToXLM } from '@/lib/config';

export default function AnalyticsPage() {
  const { data: listings, isLoading: listingsLoading } = useListings();

  // Aggregate stats
  const totalListings = listings?.length ?? 0;
  const activeRentals = listings?.filter((l) => !l.isAvailable && l.currentRenter).length ?? 0;
  const utilizationRate = totalListings > 0 ? Math.round((activeRentals / totalListings) * 100) : 0;

  // Calculate total locked value in escrow (deposit + rental fee of active listings)
  const totalLockedStroops = listings
    ?.filter((l) => !l.isAvailable)
    ?.reduce((sum, item) => sum + item.deposit + item.currentRentalPayment, BigInt(0)) ?? BigInt(0);

  // Extract unique active addresses in the marketplace to build leaderboard
  const uniqueAddresses = Array.from(
    new Set([
      ...(listings?.map((l) => l.owner) ?? []),
      ...(listings?.map((l) => l.currentRenter).filter((r): r is string => r !== null) ?? []),
    ])
  );

  // Fetch reputation for all unique addresses in parallel
  const { data: leaderboard, isLoading: boardLoading } = useQuery({
    queryKey: ['reputation-leaderboard', uniqueAddresses],
    queryFn: async () => {
      if (uniqueAddresses.length === 0) return [];
      const board = await Promise.all(
        uniqueAddresses.map(async (addr) => {
          const score = await getReputation(addr);
          return { address: addr, score };
        })
      );
      return board.sort((a, b) => b.score - a.score);
    },
    enabled: uniqueAddresses.length > 0,
    staleTime: 10_000,
  });

  const isLoading = listingsLoading || boardLoading;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Marketplace Analytics & Metrics
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time analysis of equipment listings, active leases, utilization rates, and reputability standing.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 glass-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {/* Total Listings Card */}
          <div className="glass-card p-5 hover:border-primary/30 transition-all hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Total Listings</span>
                <div className="text-2xl font-bold text-white mt-1">{totalListings}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Unique items listed on-chain</p>
          </div>

          {/* Active Rentals Card */}
          <div className="glass-card p-5 hover:border-cyan-500/30 transition-all hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Active Leases</span>
                <div className="text-2xl font-bold text-white mt-1">{activeRentals}</div>
              </div>
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Items currently checked out</p>
          </div>

          {/* Utilization Rate Card */}
          <div className="glass-card p-5 hover:border-green-500/30 transition-all hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Utilization Rate</span>
                <div className="text-2xl font-bold text-white mt-1">{utilizationRate}%</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-2 text-green-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-3">
              <div 
                className="bg-green-400 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${utilizationRate}%` }}
              />
            </div>
          </div>

          {/* Escrow locked value Card */}
          <div className="glass-card p-5 hover:border-yellow-500/30 transition-all hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Locked Escrow</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {stroopsToXLM(totalLockedStroops)} <span className="text-xs text-primary">XLM</span>
                </div>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-400">
                <Coins className="h-5 w-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Held rental fees & safety deposits</p>
          </div>
        </div>
      )}

      {/* Leaderboard and breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reputation Board */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Top Reputable Users Leaderboard
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-10 skeleton" />
              <div className="h-10 skeleton" />
              <div className="h-10 skeleton" />
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-muted-foreground uppercase font-semibold">
                    <th className="pb-3">Rank</th>
                    <th className="pb-3">Wallet Address</th>
                    <th className="pb-3 text-right">Reputation Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-white">
                  {leaderboard.map((user, index) => {
                    const isGold = index === 0;
                    const isSilver = index === 1;
                    const isBronze = index === 2;
                    let rankClass = 'text-muted-foreground';
                    if (isGold) rankClass = 'text-yellow-400 font-bold';
                    else if (isSilver) rankClass = 'text-gray-300 font-bold';
                    else if (isBronze) rankClass = 'text-amber-600 font-bold';

                    return (
                      <tr key={user.address} className="hover:bg-white/2">
                        <td className={`py-4 font-mono ${rankClass}`}>
                          {index + 1}
                          {isGold && ' 🏆'}
                        </td>
                        <td className="py-4 font-mono text-primary/80">
                          {user.address}
                        </td>
                        <td className="py-4 text-right font-bold font-mono">
                          {user.score} <span className="text-xs text-muted-foreground font-normal">pts</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No reputable addresses resolved yet. Perform rentals to construct the leaderboard metrics.
            </div>
          )}
        </div>

        {/* Contract escrow guide / Info panel */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              Soroban Escrow Design
            </h2>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Escrows securely hold safety deposits and pre-arranged daily payments inside the contract's local account balance. 
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              When an item is returned, the owner initiates a state transition that releases the deposit back to the renter, or captures it. The contract ensures that no funds can be released except by these strict on-chain conditions.
            </p>
          </div>

          <div className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by Soroban</span>
            <span className="font-semibold text-primary">v22.0.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
