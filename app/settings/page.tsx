'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useUserReputation, useBlacklistUser } from '@/hooks/useRentals';
import { 
  Settings as SettingsIcon, Wallet, ShieldAlert, ShieldCheck, 
  HelpCircle, UserCheck, UserX, Loader2, AlertTriangle 
} from 'lucide-react';
import { truncateAddress } from '@/lib/config';

export default function SettingsPage() {
  const { address, isConnected, xlmBalance, network } = useWallet();
  const { data: repData, isLoading: repLoading } = useUserReputation(address);
  const blacklistMutation = useBlacklistUser();

  // Admin states
  const [targetAddress, setTargetAddress] = useState('');
  const [blacklistStatus, setBlacklistStatus] = useState(true);

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="max-w-md mx-auto glass-card p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Wallet Disconnected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your Stellar wallet to view settings and manage your profile.
          </p>
        </div>
      </div>
    );
  }

  const reputation = repData?.reputation ?? 100;
  const isUserBlacklisted = repData?.isBlacklisted ?? false;

  // Simple hardcoded admin check for convenience: in Soroban the deployer/admin is the contract admin.
  // In the real world, the contract admin can execute the set_blacklisted call.
  // We can let the user invoke the set_blacklisted function and let Soroban reject it if they are not the admin.
  const handleBlacklistToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAddress) return;
    try {
      await blacklistMutation.mutateAsync({
        adminAddress: address,
        userAddress: targetAddress,
        status: blacklistStatus,
      });
      setTargetAddress('');
    } catch {}
  };

  // Determine reputation tier
  let tierName = 'Standard';
  let tierColor = 'text-white border-white/20 bg-white/5';
  if (reputation >= 120) {
    tierName = 'Diamond Renter';
    tierColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
  } else if (reputation >= 110) {
    tierName = 'Elite Renter';
    tierColor = 'text-green-400 border-green-500/30 bg-green-500/10';
  } else if (reputation < 70) {
    tierName = 'Restricted';
    tierColor = 'text-red-400 border-red-500/30 bg-red-500/10';
  } else if (reputation < 90) {
    tierName = 'At Risk';
    tierColor = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary animate-spin-slow" />
          Account Settings & Preferences
        </h1>
        <p className="text-muted-foreground mt-1">
          Review your account reputation standing and configure workspace options.
        </p>
      </div>

      <div className="space-y-8">
        {/* ─── Profile Overview Card ─────────────────────────────────────── */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Wallet Connection Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground block font-semibold">Account Address</span>
                <span className="font-mono text-sm text-white break-all">{address}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block font-semibold">Balance</span>
                  <span className="text-lg font-bold text-white">
                    {parseFloat(xlmBalance ?? '0').toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-semibold">Network</span>
                  <span className="text-sm font-semibold text-primary capitalize">{network}</span>
                </div>
              </div>
            </div>

            {/* Reputation Section */}
            <div className="rounded-xl border border-white/5 bg-white/5 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground font-semibold">Reputation Level</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${tierColor}`}>
                    {tierName}
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {repLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  ) : (
                    `${reputation} pts`
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                {isUserBlacklisted ? (
                  <div className="flex items-center gap-2 text-xs text-red-400 font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Your account is blacklisted from renting.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-green-400 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Your account is in good standing.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Admin Registry Panel ──────────────────────────────────────── */}
        <div className="glass-card p-6 border-red-500/10">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Registry Administration Panel
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Configure blacklist status for bad actors or low-reputation addresses. Note: This action will fail unless your wallet is the contract administrator.
          </p>

          <form onSubmit={handleBlacklistToggle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Target Account Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="G..."
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Blacklist Status
                </label>
                <select
                  value={blacklistStatus ? 'true' : 'false'}
                  onChange={(e) => setBlacklistStatus(e.target.value === 'true')}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-primary/50 focus:outline-none"
                >
                  <option value="true">Blacklist Renter (Disable renting)</option>
                  <option value="false">Unblacklist Renter (Restore renting)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={blacklistMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600/20 border border-red-600/30 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-all disabled:opacity-50"
            >
              {blacklistMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating Registry...
                </>
              ) : blacklistStatus ? (
                <>
                  <UserX className="h-4 w-4" />
                  Restrict Renter
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Restore Renter
                </>
              )}
            </button>
          </form>
        </div>

        {/* ─── FAQ Info ──────────────────────────────────────────────────── */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-white mb-1">How is my reputation score calculated?</h4>
              <p>
                Every user starts with a default score of 100. Returning rented items successfully on-time rewards both the renter and owner with +10 points. If an owner claims your deposit (e.g. for damage or late return), your score is penalized by -20 points.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">What happens if my score falls below 70?</h4>
              <p>
                Your account ranking drops to 'Restricted' and you might be blacklisted from committing new lease agreements on-chain. Keep a high reputation score by complying with lease agreement guidelines.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
