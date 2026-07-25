import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

// A Route Handler — a file convention for building an API endpoint inside
// the App Router (app/api/checkout/route.js -> POST /api/checkout). This
// runs only on the server, so it's a safe place to use the Stripe secret key.
export async function POST(request) {
  const body = await request.json();
  const { customerName, customerEmail, pickupTime, orderItems, total } = body;

  if (!customerName || !pickupTime || !Array.isArray(orderItems) || orderItems.length === 0) {
    return NextResponse.json({ error: 'Missing order details.' }, { status: 400 });
  }

  // Plain anon-key client — same permissions a customer's own browser has.
  // Creating the order here (rather than before calling this route) keeps
  // order + order_items + the Stripe session all in one request.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const orderId = crypto.randomUUID();

  // Starts as 'awaiting_payment' — invisible to the staff board — until the
  // Stripe webhook confirms the charge and flips it to 'new'.
  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    customer_name: customerName,
    customer_email: customerEmail || null,
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
}
