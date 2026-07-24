'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 rounded-full text-sm font-medium border border-[#D9C3A3] text-[#4A3222]"
    >
      Log Out
    </button>
  );
}
