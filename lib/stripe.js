import Stripe from 'stripe';

// Server-only. Never import this from a 'use client' file — STRIPE_SECRET_KEY
// would end up bundled into code sent to the browser.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
