import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SettingsPage from '../page';

// Mock wallet hooks
const mockUseWallet = vi.fn();
vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock('@/hooks/useRentals', () => ({
  useUserReputation: vi.fn(() => ({
    data: { reputation: 115, isBlacklisted: false },
    isLoading: false,
  })),
  useBlacklistUser: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe('Settings Page', () => {
  it('renders disconnected message when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      xlmBalance: '0',
      network: 'testnet',
    });

    render(<SettingsPage />);
    expect(screen.getByText('Wallet Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Please connect your Stellar wallet to view settings and manage your profile.')).toBeInTheDocument();
  });

  it('renders reputation standing and connection details when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: 'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3',
      xlmBalance: '150.55',
      network: 'testnet',
    });

    render(<SettingsPage />);
    
    // Check wallet connection card info
    expect(screen.getByText('Wallet Connection Details')).toBeInTheDocument();
    expect(screen.getByText('150.55 XLM')).toBeInTheDocument();
    expect(screen.getByText('testnet')).toBeInTheDocument();

    // Check reputation data rendering
    expect(screen.getByText('115 pts')).toBeInTheDocument();
    expect(screen.getByText('Elite Renter')).toBeInTheDocument();
    expect(screen.getByText('Your account is in good standing.')).toBeInTheDocument();
  });
});
