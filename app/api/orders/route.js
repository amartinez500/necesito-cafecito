import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseOrderRequest } from '@/lib/menu';

// Used for "Pay at Counter" — same server-side price validation as
// /api/checkout (see lib/menu.js), just no Stripe involved since payment
// happens in person at pickup.
export async function POST(request) {
  const body = await request.json();
  const parsed = parseOrderRequest(body);

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { customerName, customerEmail, pickupTime, orderItems, total } = parsed;

  // Admin (service_role) client — see the comment in /api/checkout for why:
  // this and /api/checkout are the only two paths allowed to create orders.
  const supabase = createAdminClient();

  const orderId = crypto.randomUUID();

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    customer_name: customerName,
    customer_email: customerEmail,
    pickup_time: pickupTime,
    payment_method: 'counter',
    total,
  });

  if (orderError) {
    return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: orderId })));

  if (itemsError) {
    return NextResponse.json({ error: 'Could not save order items.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
