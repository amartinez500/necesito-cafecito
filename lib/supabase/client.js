import { createBrowserClient } from '@supabase/ssr';

// Use this in 'use client' components (like app/page.js) — it runs in the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
