import { createClient } from '@supabase/supabase-js';

// Server-only, and only for the Stripe webhook handler. This uses the
// service_role key, which bypasses every RLS policy — unlike the other
// Supabase clients, it isn't tied to a logged-in user or a browser cookie,
// which is exactly what a server-to-server webhook needs.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
