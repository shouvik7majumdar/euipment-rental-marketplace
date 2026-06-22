import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock hooks
vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    address: 'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3',
    isConnected: true,
    xlmBalance: '1000',
    network: 'testnet',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/hooks/useRentals', () => ({
  useListings: vi.fn(() => ({
    data: [
      {
        id: 1,
        owner: 'GBPM3ERJPONOYNS3H4N4VJDA7TGQT6TLBJCUPQ3YZ5IAMHIDFUPTCIW3',
        title: 'Industrial Drill',
        dailyPrice: BigInt("100000000"), // 10 XLM
        deposit: BigInt("500000000"),    // 50 XLM
        isAvailable: true,
        currentRenter: null,
        rentalExpiresAt: 0,
        currentRentalPayment: BigInt(0),
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  })),
  useListEquipment: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useRentEquipment: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import Marketplace from '../page';

describe('Marketplace Page', () => {
  it('renders marketplace items correctly', () => {
    render(<Marketplace />);
    
    // Check page title
    expect(screen.getByText('Equipment Catalog')).toBeInTheDocument();
    
    // Check item title is rendered
    expect(screen.getByText('Industrial Drill')).toBeInTheDocument();
    
    // Check pricing matches (10 XLM and 50 XLM)
    expect(screen.getByText('10.0000000')).toBeInTheDocument();
    expect(screen.getByText('50.0000000')).toBeInTheDocument();
  });

  it('shows listing modal when clicking List Equipment', async () => {
    render(<Marketplace />);
    
    const listBtn = screen.getByText('List Equipment');
    expect(listBtn).toBeInTheDocument();
    
    fireEvent.click(listBtn);
    
    // Verify modal is open and has input field for title
    expect(screen.getByText('List New Equipment')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Concrete Mixer')).toBeInTheDocument();
  });

  it('guards list inputs correctly', async () => {
    render(<Marketplace />);
    
    fireEvent.click(screen.getByText('List Equipment'));
    
    const titleInput = screen.getByPlaceholderText('e.g. Concrete Mixer');
    const priceInput = screen.getByPlaceholderText('e.g. 5');
    const depositInput = screen.getByPlaceholderText('e.g. 100');
    
    // Set values
    fireEvent.change(titleInput, { target: { value: 'Excavator' } });
    fireEvent.change(priceInput, { target: { value: '25' } });
    fireEvent.change(depositInput, { target: { value: '500' } });
    
    expect(titleInput).toHaveValue('Excavator');
    expect(priceInput).toHaveValue(25);
    expect(depositInput).toHaveValue(500);
  });
});
