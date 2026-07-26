'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const COLUMNS = [
  { status: 'new', label: 'New', nextLabel: 'Start Brewing', nextStatus: 'brewing' },
  { status: 'brewing', label: 'Brewing', nextLabel: 'Mark Ready', nextStatus: 'ready' },
  { status: 'ready', label: 'Ready', nextLabel: 'Complete', nextStatus: 'completed' },
];

export default function OrderBoard({ orders }) {
  const router = useRouter();

  // Live updates: any insert/update/delete on orders (a new order coming
  // in, or another staff device advancing one) re-fetches this page's
  // server data automatically, no manual refresh needed.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {COLUMNS.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.status);
        return (
          <div key={column.status}>
            <h2 className="font-serif text-xl font-semibold text-[#4A3222] mb-3">
              {column.label}{' '}
              <span className="text-sm font-sans font-normal text-[#8A6F55]">
                ({columnOrders.length})
              </span>
            </h2>
            <div className="space-y-3">
              {columnOrders.length === 0 && (
                <p className="text-sm text-[#8A6F55]">No orders.</p>
              )}
              {columnOrders.map((order) => (
                <OrderCard key={order.id} order={order} column={column} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order, column }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  async function advance() {
    setIsUpdating(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: column.nextStatus })
      .eq('id', order.id);

    if (error) {
      setError(error.message);
      setIsUpdating(false);
      return;
    }

    router.refresh();
    setIsUpdating(false);
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-[#F0E4D3]">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-[#4A3222]">{order.customer_name}</p>
          {order.customer_email && (
            <p className="text-xs text-[#8A6F55]">{order.customer_email}</p>
          )}
        </div>
        <p className="text-xs text-[#8A6F55]">
          {new Date(order.pickup_time).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Chicago',
          })}
        </p>
      </div>

      <div className="space-y-1 mb-3">
        {order.order_items.map((cup) => (
          <p key={cup.id} className="text-sm text-[#4A3222]">
            {cup.item_name} ({cup.size_label})
            {cup.addon_name && <span className="text-[#8A6F55]"> + {cup.addon_name}</span>}
          </p>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-[#8A6F55] mb-3">
        <span>{order.payment_method === 'online' ? 'Paid online' : 'Pay at counter'}</span>
        <span className="font-semibold text-[#4A3222]">
          ${Number(order.total).toFixed(2)}
        </span>
      </div>

      <button
        onClick={advance}
        disabled={isUpdating}
        className="w-full py-2 rounded-lg text-sm font-medium bg-[#4A3222] text-white disabled:bg-[#D9C3A3] transition"
      >
        {isUpdating ? 'Updating…' : column.nextLabel}
      </button>
      {error && (
        <p className="text-xs text-[#C06B76] font-medium mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
