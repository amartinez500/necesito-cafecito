import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

// Stripe calls this directly, server-to-server — there's no browser, no
// cookie, no logged-in user. That's why this is the one place in the app
// that uses the service_role admin client instead of the normal ones.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature check failed — this request didn't actually come from
    // Stripe (or the webhook secret is wrong). Reject it.
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      const supabase = createAdminClient();
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', status: 'new' })
        .eq('id', orderId);
    }
  }

  return NextResponse.json({ received: true });
}
