import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ShopToggle from './shop-toggle';
import OrderBoard from './order-board';
import LogoutButton from './logout-button';

// This is a Server Component (no 'use client' at the top) — it runs only on
// the server, never ships its code to the browser, and can safely check who's
// logged in before deciding what to send down. proxy.js already redirects
// logged-out visitors away from /staff, but we check again here too: proxy
// only reads the session cookie (an "optimistic" check), so re-verifying
// right before touching real data is what actually keeps this page secure.
export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: shopStatus } = await supabase
    .from('shop_status')
    .select('*')
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('status', ['new', 'brewing', 'ready'])
    .order('created_at', { ascending: true });

  return (
    <main className="min-h-screen bg-[#FBF3E8] pb-10">
      <div className="max-w-5xl mx-auto px-5 pt-10 pb-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#4A3222]">
              Staff Dashboard
            </h1>
            <p className="text-sm text-[#8A6F55]">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <ShopToggle shopStatus={shopStatus} />
            <LogoutButton />
          </div>
        </div>

        <OrderBoard orders={orders || []} />
      </div>
    </main>
  );
}
