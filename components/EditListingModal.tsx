'use client';

import { useState, useEffect } from 'react';
import { useEditEquipment } from '@/hooks/useRentals';
import { EquipmentListing } from '@/types';
import { Loader2, X } from 'lucide-react';
import { stroopsToXLM, xlmToStroops } from '@/lib/config';

interface EditListingModalProps {
  open: boolean;
  onClose: () => void;
  listing: EquipmentListing | null;
  ownerAddress: string;
}

export function EditListingModal({ open, onClose, listing, ownerAddress }: EditListingModalProps) {
  const editMutation = useEditEquipment();

  const [title, setTitle] = useState('');
  const [dailyPriceXlm, setDailyPriceXlm] = useState('');
  const [depositXlm, setDepositXlm] = useState('');

  useEffect(() => {
    if (listing) {
      setTitle(listing.title);
      setDailyPriceXlm(stroopsToXLM(listing.dailyPrice).toString());
      setDepositXlm(stroopsToXLM(listing.deposit).toString());
    }
  }, [listing]);

  if (!open || !listing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dailyPriceXlm || !depositXlm) return;

    try {
      await editMutation.mutateAsync({
        ownerAddress,
        listingId: listing.id,
        title,
        dailyPriceStroops: xlmToStroops(Number(dailyPriceXlm)),
        depositStroops: xlmToStroops(Number(depositXlm)),
      });
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Edit Equipment</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Heavy Duty Drill"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Daily Price (XLM)
              </label>
              <input
                type="number"
                required
                min="0.1"
                step="0.1"
                value={dailyPriceXlm}
                onChange={(e) => setDailyPriceXlm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Deposit (XLM)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.1"
                value={depositXlm}
                onChange={(e) => setDepositXlm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={editMutation.isPending}
            className="w-full mt-6 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl shadow-lg flex items-center justify-center transition-all disabled:opacity-50"
          >
            {editMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
