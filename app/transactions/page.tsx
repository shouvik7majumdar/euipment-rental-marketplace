'use client';

import { useTransactionStore } from '@/lib/store';
import { History, ExternalLink, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { getExplorerTxUrl, formatTimestamp } from '@/lib/config';

export default function Transactions() {
  const { transactions, clearTransactions } = useTransactionStore();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <History className="h-7 w-7 text-primary" />
            Transaction History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track real-time transaction lifecycle, errors, and explorer links for actions performed in this session.
          </p>
        </div>

        {transactions.length > 0 && (
          <button
            onClick={clearTransactions}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Clear Log
          </button>
        )}
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="glass-card p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 hover:border-white/20"
            >
              <div className="flex items-start gap-4">
                {/* Status Indicator */}
                <div className="mt-1">
                  {tx.status === 'success' && (
                    <div className="rounded-full bg-green-500/10 p-1.5 text-green-400 border border-green-500/20">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  )}
                  {tx.status === 'failed' && (
                    <div className="rounded-full bg-red-500/10 p-1.5 text-red-400 border border-red-500/20">
                      <XCircle className="h-5 w-5" />
                    </div>
                  )}
                  {tx.status === 'pending' && (
                    <div className="rounded-full bg-primary/10 p-1.5 text-primary border border-primary/20 animate-pulse">
                      <Clock className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-white text-base">
                    {tx.type === 'list_equipment' && 'List Equipment'}
                    {tx.type === 'rent_equipment' && 'Rent Equipment'}
                    {tx.type === 'return_equipment' && 'Return Equipment'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{tx.description}</p>
                  
                  {tx.errorMessage && (
                    <p className="text-xs text-red-400 mt-2 bg-red-500/10 rounded border border-red-500/20 px-2.5 py-1.5 font-semibold">
                      Error: {tx.errorMessage}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-xs text-muted-foreground">{formatTimestamp(tx.timestamp)}</span>
                
                {tx.hash ? (
                  <a
                    href={getExplorerTxUrl(tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                  >
                    View in Explorer
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No transaction hash</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Transaction log is empty.</p>
          <p className="text-xs mt-1 opacity-70">
            Submit a transaction on the marketplace page to track it here.
          </p>
        </div>
      )}
    </div>
  );
}
