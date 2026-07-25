// A plain Server Component (no 'use client') — this page has no
// interactivity, so it doesn't need to ship any JS to the browser at all.
//
// Note: this page can't look up and display the actual order, since
// customers aren't allowed to read orders back (staff-only, for privacy —
// same reason as everywhere else in the app). It's just a friendly landing
// spot after Stripe sends the customer back; the payment itself was already
// confirmed server-to-server by the webhook before this page ever loads.
export default function OrderConfirmedPage() {
  return (
    <main className="min-h-screen bg-[#FBF3E8] flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#4A3222] mb-2">
          Payment received! ☕
        </h1>
        <p className="text-sm text-[#8A6F55]">
          Thanks for your order — we&apos;ll have it ready for pickup at your selected time.
        </p>
      </div>
    </main>
  );
}
