import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseOrderRequest } from '@/lib/menu';

// A Route Handler — a file convention for building an API endpoint inside
// the App Router (app/api/checkout/route.js -> POST /api/checkout). This
// runs only on the server, so it's a safe place to use the Stripe secret key.
export async function POST(request) {
  const body = await request.json();
  const parsed = parseOrderRequest(body);

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { customerName, customerEmail, pickupTime, orderItems, total } = parsed;

  // Admin (service_role) client, bypassing RLS entirely. Nothing else can
  // insert into orders/order_items anymore (see schema.sql) — this route,
  // and /api/orders for pay-at-counter, are the only paths in, specifically
  // so every price gets validated against the real menu before anything is
  // written or charged.
  const supabase = createAdminClient();

  const orderId = crypto.randomUUID();

  // Starts as 'awaiting_payment' — invisible to the staff board — until the
  // Stripe webhook confirms the charge and flips it to 'new'.
  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    customer_name: customerName,
    customer_email: customerEmail,
    pickup_time: pickupTime,
    payment_method: 'online',
    status: 'awaiting_payment',
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

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${item.item_name} (${item.size_label})${
              item.addon_name ? ` + ${item.addon_name}` : ''
            }`,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })),
      success_url: `${origin}/order-confirmed?order_id=${orderId}`,
      cancel_url: `${origin}/?checkout=canceled`,
      metadata: { order_id: orderId },
    });

    return NextResponse.json({ url: session.url });
  } catch {
    // Stripe itself rejected the session (bad email format it didn't like,
    // an outage, etc). The order row already exists as 'awaiting_payment',
    // which is fine — it just sits there forever, same as any other
    // abandoned checkout, invisible to the staff board.
    return NextResponse.json(
      { error: 'Could not start payment. Please try again.' },
      { status: 500 }
    );
  }
}
