'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ShopToggle({ shopStatus }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(shopStatus?.is_open ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!shopStatus) return null;

  async function toggle() {
    setIsSaving(true);
    setError(null);
    const supabase = createClient();
    const nextValue = !isOpen;

    const { error } = await supabase
      .from('shop_status')
      .update({ is_open: nextValue })
      .eq('id', shopStatus.id);

    if (error) {
      setError(error.message);
      setIsSaving(false);
      return;
    }

    setIsOpen(nextValue);
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={isSaving}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
          isOpen ? 'bg-[#4A3222] text-white' : 'bg-[#D9C3A3] text-[#4A3222]'
        }`}
      >
        {isOpen ? 'Shop is Open' : 'Shop is Closed'}
      </button>
      {error && <p className="text-xs text-[#C06B76]">{error}</p>}
    </div>
  );
}
