'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Wallet, BarChart3, Package, Activity, History, Menu, X, Zap, Settings } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { truncateAddress } from '@/lib/config';
import { WalletModal } from '@/components/wallet/WalletModal';

const navLinks = [
  { href: '/', label: 'Home', icon: Zap },
  { href: '/marketplace', label: 'Marketplace', icon: Package },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/transactions', label: 'Transactions', icon: History },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, address, xlmBalance, connect, disconnect } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40 group-hover:ring-primary/60 transition-all">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold gradient-text">RentChain</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link ${pathname === href ? 'active text-foreground' : ''}`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Wallet Button */}
            <div className="flex items-center gap-3">
              {isConnected && address ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-semibold text-primary">
                      {xlmBalance ? parseFloat(xlmBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} XLM
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="font-mono text-muted-foreground">{truncateAddress(address)}</span>
                  </div>
                  <button
                    onClick={disconnect}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </button>
              )}

              {/* Mobile menu */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden rounded-lg border border-white/10 p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl">
            <nav className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === href
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </>
  );
}
