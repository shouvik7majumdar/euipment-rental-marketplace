'use client';

import { useQuery } from '@tanstack/react-query';
import { getContractEvents } from '@/lib/soroban';
import { Activity, Calendar, User, FileText, ArrowUpRight, Zap, RefreshCw } from 'lucide-react';
import { truncateAddress, stroopsToXLM, getExplorerTxUrl } from '@/lib/config';

export default function ActivityLog() {
  const { data: events, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['contract-events'],
    queryFn: getContractEvents,
    refetchInterval: 5000,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            On-Chain Activity Feed
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time events decoded directly from the Soroban smart contract ledger events.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-20 skeleton" />
          <div className="h-20 skeleton" />
          <div className="h-20 skeleton" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="relative border-l border-white/10 pl-6 ml-4 space-y-8 py-4">
          {events.map((event) => {
            const type = event.topic[0] || 'unknown';
            let title = 'Smart Contract Interaction';
            let details = 'A ledger state transition occurred.';
            let colorClass = 'bg-primary/20 text-primary border-primary/30';

            if (type === 'listed') {
              title = 'Equipment Listed';
              colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
              if (Array.isArray(event.value)) {
                details = `"${event.value[0]}" listed for ${stroopsToXLM(BigInt(event.value[1]))} XLM/day (Deposit: ${stroopsToXLM(BigInt(event.value[2]))} XLM) by owner ${truncateAddress(event.topic[2])}`;
              } else {
                details = `New equipment listed under ID #${event.topic[1]}`;
              }
            } else if (type === 'rented') {
              title = 'Equipment Rented';
              colorClass = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
              if (Array.isArray(event.value)) {
                details = `Listing #${event.topic[1]} rented for ${event.value[0]} days by renter ${truncateAddress(event.topic[2])}`;
              } else {
                details = `Listing #${event.topic[1]} rented by ${truncateAddress(event.topic[2])}`;
              }
            } else if (type === 'returned') {
              title = 'Equipment Returned';
              colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
              if (Array.isArray(event.value)) {
                const refunded = event.value[0] === true;
                details = `Listing #${event.topic[1]} returned. Security deposit was ${refunded ? 'fully refunded' : 'claimed by owner'} (Renter: ${truncateAddress(event.value[1])})`;
              } else {
                details = `Listing #${event.topic[1]} returned.`;
              }
            } else if (type === 'edited') {
              title = 'Listing Edited';
              colorClass = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
              if (Array.isArray(event.value)) {
                details = `Listing #${event.topic[1]} prices updated by owner: ${stroopsToXLM(BigInt(event.value[0]))} XLM/day, ${stroopsToXLM(BigInt(event.value[1]))} XLM deposit`;
              } else {
                details = `Listing #${event.topic[1]} edited by owner ${truncateAddress(event.topic[2])}`;
              }
            } else if (type === 'deleted') {
              title = 'Listing Deleted';
              colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
              details = `Listing #${event.topic[1]} was permanently deleted by owner ${truncateAddress(event.value)}`;
            } else if (type === 'unavail') {
              title = 'Listing Unavailable';
              colorClass = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
              details = `Listing #${event.topic[1]} marked unavailable for rent by owner ${truncateAddress(event.value)}`;
            } else if (type === 'avail') {
              title = 'Listing Available';
              colorClass = 'bg-green-500/20 text-green-400 border-green-500/30';
              details = `Listing #${event.topic[1]} marked available for rent by owner ${truncateAddress(event.value)}`;
            } else if (type === 'rep_up') {
              title = 'Reputation Score Gained';
              colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
              if (Array.isArray(event.value)) {
                details = `User ${truncateAddress(event.topic[1])} gained +${event.value[1]} reputation points (New balance: ${event.value[0]})`;
              } else {
                details = `User ${truncateAddress(event.topic[1])} reputation score updated.`;
              }
            } else if (type === 'rep_down') {
              title = 'Reputation Penalized';
              colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
              if (Array.isArray(event.value)) {
                details = `User ${truncateAddress(event.topic[1])} penalized -${event.value[1]} reputation points (New balance: ${event.value[0]})`;
              } else {
                details = `User ${truncateAddress(event.topic[1])} reputation penalized due to safety dispute.`;
              }
            } else if (type === 'bl_update') {
              title = 'Blacklist Registry Update';
              colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
              const state = event.value === true;
              details = `User ${truncateAddress(event.topic[1])} has been ${state ? 'restricted (blacklisted)' : 'restored (unblacklisted)'} by administrator.`;
            }

            return (
              <div key={event.id} className="relative group">
                {/* Timeline Node Point */}
                <div className={`absolute -left-[35px] top-1.5 flex h-6.5 w-6.5 items-center justify-center rounded-full border bg-background text-xs font-semibold ${colorClass}`}>
                  <Zap className="h-3 w-3 fill-current" />
                </div>

                <div className="glass-card p-5 transition-all duration-300 group-hover:border-primary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <span className="font-bold text-white text-base flex items-center gap-2">
                      {title}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {event.ledgerClosedAt ? new Date(event.ledgerClosedAt).toLocaleString() : `Ledger ${event.ledger}`}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {details}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/5 pt-3">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary/70" />
                      Contract:{' '}
                      <span className="font-mono text-primary/80">{truncateAddress(event.contractId)}</span>
                    </span>
                    <a
                      href={getExplorerTxUrl(event.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-white transition-colors text-primary font-semibold"
                    >
                      View Transaction <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40 animate-pulse" />
          <p className="text-sm">No smart contract events found in recent blocks.</p>
          <p className="text-xs mt-1 opacity-70">
            Make some listings or rentals in the marketplace to trigger ledger events.
          </p>
        </div>
      )}
    </div>
  );
}
