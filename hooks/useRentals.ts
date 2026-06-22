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
  getReputation,
  isBlacklisted,
  setBlacklisted,
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
        const msg = e instanceof Error ? e.message : String(e);
        // Pass through the actual error message from soroban.ts — do NOT transform it
        // so users see the real reason (e.g. "equipment unavailable") not a misleading balance error
        updateTransaction(txId, { status: 'failed', errorMessage: msg });
        throw new Error(msg);
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

// ─── Reputation & Blacklist Hooks ──────────────────────────────────────────

export function useUserReputation(address: string | null) {
  return useQuery({
    queryKey: ['user-reputation', address],
    queryFn: async () => {
      if (!address) return { reputation: 100, isBlacklisted: false };
      const [rep, bl] = await Promise.all([
        getReputation(address),
        isBlacklisted(address),
      ]);
      return { reputation: rep, isBlacklisted: bl };
    },
    enabled: !!address,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useBlacklistUser() {
  const qc = useQueryClient();
  const { addTransaction, updateTransaction } = useTransactionStore();

  return useMutation({
    mutationFn: async ({
      adminAddress,
      userAddress,
      status,
    }: {
      adminAddress: string;
      userAddress: string;
      status: boolean;
    }) => {
      const txId = nanoid();
      addTransaction({
        id: txId,
        hash: '',
        type: 'set_blacklisted',
        status: 'pending',
        description: `${status ? 'Blacklisting' : 'Unblacklisting'} address ${userAddress.slice(0, 8)}...`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      try {
        const hash = await setBlacklisted(adminAddress, userAddress, status);
        updateTransaction(txId, { hash, status: 'success' });
        return hash;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateTransaction(txId, { status: 'failed', errorMessage: msg });
        throw new Error(msg);
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['user-reputation', variables.userAddress] });
      toast.success(`Successfully updated blacklist status for user!`);
    },
    onError: (err: Error) => {
      toast.error('Failed to update blacklist status', { description: err.message });
    },
  });
}
