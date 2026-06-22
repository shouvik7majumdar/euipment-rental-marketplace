import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Header } from '../layout/Header';

// Mock path and wallet hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: false,
    address: null,
    xlmBalance: '0',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe('Header Component', () => {
  it('renders the branding name and link', () => {
    render(<Header />);
    expect(screen.getByText('RentChain')).toBeInTheDocument();
  });

  it('renders navigation links properly', () => {
    render(<Header />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows Connect Wallet when not connected', () => {
    render(<Header />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });
});
