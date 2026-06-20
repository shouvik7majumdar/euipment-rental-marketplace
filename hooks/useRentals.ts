'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCallback } from 'react';
import {
  getAllListings,
  getListing,
  listEquipment,
  rentEquipment,
  returnEquipment,
  editEquipment,
  deleteEquipment,
  markUnavailable,
  markAvailable,
} from '@/lib/soroban';
import { useTransactionStore } from '@/lib/store';
import { EquipmentListing, RentalActivity } from '@/types';
import { POLL_INTERVAL_MS } from '@/lib/config';
import { nanoid } from 'nanoid';

// ─── Listings Queries ──────────────────────────────────────────────────────

export function useListings() {
  return useQuery<EquipmentListing[]>({
    queryKey: ['listings'],
    queryFn: getAllListings,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 3_000,
  });
}

export function useListing(id: number) {
  return useQuery<EquipmentListing | null>({
    queryKey: ['listing', id],
    queryFn: () => getListing(id),
    refetchInterval: POLL_INTERVAL_MS,
    enabled: id > 0,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export function useListEquipment() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      title,
      dailyPriceStroops,
      depositStroops,
    }: {
      ownerAddress: string;
      title: string;
      dailyPriceStroops: bigint;
      depositStroops: bigint;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'list_equipment',
        status: 'pending',
        description: `Listing "${title}"`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      try {
        const hash = await listEquipment(ownerAddress, title, dailyPriceStroops, depositStroops);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      toast.success('Equipment listed successfully!');
    },
    onError: (err: Error) => {
      toast.error('Failed to list equipment', { description: err.message });
    },
  });
}

export function useRentEquipment() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      renterAddress,
      listingId,
      days,
    }: {
      renterAddress: string;
      listingId: number;
      days: number;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'rent_equipment',
        status: 'pending',
        description: `Renting listing #${listingId} for ${days} days`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await rentEquipment(renterAddress, listingId, days);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        const msg = String(e);
        let errorMessage = msg;
        if (msg.includes('insufficient')) errorMessage = 'Insufficient XLM balance';
        if (msg.includes('rejected')) errorMessage = 'Transaction rejected by user';
        updateTransaction(txId, { status: 'failed', errorMessage });
        throw new Error(errorMessage);
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment rented successfully!');
    },
    onError: (err: Error) => {
      toast.error('Failed to rent equipment', { description: err.message });
    },
  });
}

export function useReturnEquipment() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      listingId,
      refundDeposit,
    }: {
      ownerAddress: string;
      listingId: number;
      refundDeposit: boolean;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'return_equipment',
        status: 'pending',
        description: `Returning equipment #${listingId}`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await returnEquipment(ownerAddress, listingId, refundDeposit);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment returned successfully!');
    },
    onError: (err: Error) => {
      toast.error('Failed to return equipment', { description: err.message });
    },
  });
}

export function useEditEquipment() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      listingId,
      title,
      dailyPriceStroops,
      depositStroops,
    }: {
      ownerAddress: string;
      listingId: number;
      title: string;
      dailyPriceStroops: bigint;
      depositStroops: bigint;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'edit_equipment',
        status: 'pending',
        description: `Editing listing #${listingId}`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await editEquipment(
          ownerAddress,
          listingId,
          title,
          dailyPriceStroops,
          depositStroops
        );
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment updated successfully!');
    },
    onError: (err: Error) => {
      toast.error('Failed to edit equipment', { description: err.message });
    },
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      listingId,
    }: {
      ownerAddress: string;
      listingId: number;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'delete_equipment',
        status: 'pending',
        description: `Deleting listing #${listingId}`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await deleteEquipment(ownerAddress, listingId);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment deleted successfully!');
    },
    onError: (err: Error) => {
      toast.error('Failed to delete equipment', { description: err.message });
    },
  });
}

export function useMarkUnavailable() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      listingId,
    }: {
      ownerAddress: string;
      listingId: number;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'mark_unavailable',
        status: 'pending',
        description: `Marking listing #${listingId} as unavailable`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await markUnavailable(ownerAddress, listingId);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment marked as unavailable!');
    },
    onError: (err: Error) => {
      toast.error('Failed to update availability', { description: err.message });
    },
  });
}

export function useMarkAvailable() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      ownerAddress,
      listingId,
    }: {
      ownerAddress: string;
      listingId: number;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'mark_available',
        status: 'pending',
        description: `Marking listing #${listingId} as available`,
        timestamp: Math.floor(Date.now() / 1000),
        listingId,
      });

      try {
        const hash = await markAvailable(ownerAddress, listingId);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        updateTransaction(txId, { status: 'failed', errorMessage: String(e) });
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', variables.listingId] });
      toast.success('Equipment marked as available!');
    },
    onError: (err: Error) => {
      toast.error('Failed to update availability', { description: err.message });
    },
  });
}
