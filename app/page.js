'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { MENU_CATEGORIES, ALL_ITEMS } from '@/lib/menu';

/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
function generatePickupTimes() {
  const times = [];
  const now = new Date();

  // 20-minutes buffer so nobody picks "right now"
  now.setMinutes(now.getMinutes() + 20);

  // Round up to the next 15-minute mark
  const remainder = now.getMinutes() % 15;
  if (remainder !== 0) {
    now.setMinutes(now.getMinutes() + (15 - remainder));
  }
  now.setSeconds(0);
  now.setMilliseconds(0);

  // Next 4 hours of slots, 15 minutes apart
  for (let i = 0; i < 16; i++) {
    const slot = new Date(now.getTime() + i * 15 * 60 * 1000);
    times.push(slot);
  }
  return times;

}

// Shows the drink's photo, or a friendly placeholder if the file isn't in
// /public yet (or fails to load) — new menu items work right away and just
// need a real photo dropped in later, no code changes required.
function DrinkPhoto({ src, alt, position = 'center' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full aspect-[4/3] rounded-xl bg-[#F0E4D3] border border-dashed border-[#D9C3A3] flex items-center justify-center mb-4">
        <span className="text-xs text-[#8A6F55] text-center px-6">
          Photo coming soon
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-4">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 448px) 100vw, 448px"
        className="object-cover"
        style={{ objectPosition: position }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

export default function Home() {
  const [cart, setCart] = useState([]);
  const [selections, setSelections] = useState({});
  const [openCategory, setOpenCategory] = useState(null);

  // checkout form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [pickupTime, setPickupTime] = useState(null);
  const pickupTimes = generatePickupTimes();

  // Assume open until we hear otherwise, so the page doesn't flash a
  // "closed" screen for everyone while this first check is in flight.
  const [shopOpen, setShopOpen] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from('shop_status')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) setShopOpen(data.is_open);
      });

    // Realtime: Supabase pushes a message over a websocket every time a row
    // in shop_status changes, so every customer's page updates live the
    // moment staff flips the toggle — no polling, no manual refresh.
    const channel = supabase
      .channel('shop_status_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shop_status' },
        (payload) => setShopOpen(payload.new.is_open)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function getSelection(item) {
    return (
      selections[item.id] || {
        size: item.sizes[0].id,
        addOn: null,
      }
    );
  }

  // Both setters below always write a complete { size, addOn } object, using
  // prev (guaranteed up to date) rather than spreading whatever partial
  // selection may already exist — a partial spread was the bug: clicking
  // Cold Foam before ever touching a size button produced { addOn: '...' }
  // with no size field, which crashed price calculations on the next render.
  function setSelectionSize(item, sizeId) {
    setSelections((prev) => ({
      ...prev,
      [item.id]: {
        size: sizeId,
        addOn: prev[item.id]?.addOn ?? null,
      },
    }));
  }

  function setSelectionAddOn(item, addOnId) {
    setSelections((prev) => ({
      ...prev,
      [item.id]: {
        size: prev[item.id]?.size ?? item.sizes[0].id,
        addOn: addOnId,
      },
    }));
  }

  function addToCart(item) {
    const selection = getSelection(item);
    const newCup = {
      cupId: crypto.randomUUID(),
      itemId: item.id,
      size: selection.size,
      addOn: selection.addOn,
    };
    setCart((prev) => [...prev, newCup]);
  }

  function removeCup(cupId) {
    setCart((prev) => prev.filter((cup) => cup.cupId !== cupId));
  }

  function cupPrice(cup) {
    const item = ALL_ITEMS.find((m) => m.id === cup.itemId);
    const size = item.sizes.find((s) => s.id === cup.size);
    const addOn = item.addOns.find((a) => a.id === cup.addOn);
    return size.price + (addOn ? addOn.price : 0);
  }

  const total = cart.reduce((sum, cup) => sum + cupPrice(cup), 0);

  const canSubmit = customerName.trim().length > 0 && paymentMethod && pickupTime && cart.length > 0;

  async function placeOrder() {
    setIsSubmitting(true);
    setSubmitError(null);

    // Resolve each cup's cart entry into the shape order_items expects.
    // Used by both payment paths below.
    const orderItems = cart.map((cup) => {
      const item = ALL_ITEMS.find((m) => m.id === cup.itemId);
      const size = item.sizes.find((s) => s.id === cup.size);
      const addOn = item.addOns.find((a) => a.id === cup.addOn);
      return {
        item_name: item.name,
        size_label: size.label,
        addon_name: addOn ? addOn.name : null,
        price: cupPrice(cup),
      };
    });

    if (paymentMethod === 'online') {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail: customerEmail.trim() || null,
          pickupTime: pickupTime.toISOString(),
          orderItems,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        setSubmitError('Something went wrong starting checkout. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // A real page navigation to Stripe's hosted payment page, not a
      // fetch — the customer actually leaves our site to pay, then
      // Stripe sends them back to /order-confirmed afterward.
      window.location.assign(data.url);
      return;
    }

    // Pay at counter: no Stripe involved, but same server-side price
    // validation as the online path — this route re-derives every price
    // from the real menu rather than trusting what the browser sends.
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        customerEmail: customerEmail.trim() || null,
        pickupTime: pickupTime.toISOString(),
        orderItems,
      }),
    });

    if (!response.ok) {
      setSubmitError('Something went wrong placing your order. Please try again.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setOrderPlaced(true);
  }

  // Takes the page back to a fresh, empty menu — used by the "Back to Home"
  // button on the confirmation screen below.
  function resetOrder() {
    setCart([]);
    setSelections({});
    setOpenCategory(null);
    setCustomerName('');
    setCustomerEmail('');
    setPaymentMethod(null);
    setPickupTime(null);
    setOrderPlaced(false);
    setSubmitError(null);
  }

  //To show a confirmation screen instead of the new menu, once submitted

  if (orderPlaced) {
    return (
      <main className="min-h-screen bg-[#FBF3E8] flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl font-semibold text-[#4A3222] mb-2">
            Order sent! ☕
          </h1>
          <p className="text-sm text-[#8A6F55] mb-6">
            Thanks {customerName}!{' '}
            {paymentMethod === 'online' ? 'Paid online.' : 'Pay at pickup.'} Pickup
            around{' '}
            {pickupTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
          </p>
          <button
            onClick={resetOrder}
            className="px-6 py-3 rounded-lg text-sm font-medium bg-[#4A3222] text-white active:scale-95 transition"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Checked after orderPlaced on purpose: if the shop flips closed right
  // after someone finishes ordering (realtime pushes that update), they
  // should still see their confirmation, not have it replaced by this.
  if (!shopOpen) {
    return (
      <main className="min-h-screen bg-[#FBF3E8] flex items-center justify-center px-5">
        <div className="max-w-md text-center">
          <Image
            src="/LOGO.png"
            alt="Necesito Cafecito logo"
            width={100}
            height={100}
            className="mb-4 mx-auto"
          />
          <h1 className="font-serif text-3xl font-semibold text-[#4A3222] mb-2">
            We&apos;re closed right now
          </h1>
          <p className="text-sm text-[#8A6F55]">
            Check back soon — we&apos;ll be open again shortly!
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBF3E8] pb-10">
      <div className="max-w-md mx-auto px-5 pt-10 pb-6">
        <div className="flex flex-col items-center text-center mb-6">
          <Image
            src="/LOGO.png"
            alt="Necesito Cafecito logo"
            width={120}
            height={120}
            className="mb-2"
          />
          <p className="font-serif italic text-base text-[#8A6F55] mb-4">pick your drinks for pickup</p>
          <div className="flex items-center gap-3 w-full max-w-[220px]">
            <div className="flex-1 h-px bg-[#D9C3A3]" />
            <span className="text-sm">☕</span>
            <div className="flex-1 h-px bg-[#D9C3A3]" />
          </div>
        </div>

        <div className="space-y-1 mb-4">
          {MENU_CATEGORIES.map((category) => {
            const isOpen = openCategory === category.id;
            return (
              <div key={category.id} className="border-b border-[#E4D5BC]">
                <button
                  onClick={() => setOpenCategory(isOpen ? null : category.id)}
                  className="w-full flex items-center justify-between py-3"
                >
                  <span className="font-serif italic text-xl text-[#8A6F55]">
                    {category.name}
                  </span>
                  <span className="text-2xl text-[#8A6F55] leading-none" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-4 pb-4">
                    {category.items.map((item) => {
                      const selection = getSelection(item);
                      const selectedSize = item.sizes.find((s) => s.id === selection.size);
                      const selectedAddOn = item.addOns.find((a) => a.id === selection.addOn);
                      const currentPrice = selectedSize.price + (selectedAddOn ? selectedAddOn.price : 0);
                      return (
                        <div key={item.id} className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(74,50,34,0.06)] border border-[#F0E4D3]">
                          <DrinkPhoto src={item.photo} alt={item.name} position={item.photoPosition} />

                          <p className="font-serif font-semibold text-[#4A3222] text-xl mb-3">{item.name}</p>

                          {item.sizes.length > 1 ? (
                            <>
                              <p className="text-xs font-semibold tracking-wider text-[#8A6F55] mb-2">SIZE</p>
                              <div className="flex gap-2 mb-3">
                                {item.sizes.map((size) => (
                                  <button
                                    key={size.id}
                                    onClick={() => setSelectionSize(item, size.id)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                      selection.size === size.id
                                        ? "bg-[#4A3222] text-white border-[#4A3222]"
                                        : "bg-transparent text-[#4A3222] border-[#D9C3A3]"
                                    }`}
                                  >
                                    {size.label} · ${size.price.toFixed(2)}
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-[#8A6F55] mb-3">
                              {item.sizes[0].label} · ${item.sizes[0].price.toFixed(2)}
                            </p>
                          )}

                          {item.addOns.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold tracking-wider text-[#8A6F55] mb-2">COLD FOAM</p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setSelectionAddOn(item, null)}
                                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                    !selection.addOn
                                      ? "bg-[#D98A94] text-white border-[#D98A94]"
                                      : "bg-transparent text-[#8A6F55] border-[#D9C3A3]"
                                  }`}
                                >
                                  No cold foam
                                </button>
                                {item.addOns.map((addOn) => (
                                  <button
                                    key={addOn.id}
                                    onClick={() => setSelectionAddOn(item, addOn.id)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                      selection.addOn === addOn.id
                                        ? "bg-[#D98A94] text-white border-[#D98A94]"
                                        : "bg-transparent text-[#8A6F55] border-[#D9C3A3]"
                                    }`}
                                  >
                                    {addOn.name} +${addOn.price.toFixed(2)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => addToCart(item)}
                            className="w-full bg-[#4A3222] text-white px-4 py-2 rounded-lg text-sm font-medium active:scale-95 transition"
                          >
                            Add to cart — ${currentPrice.toFixed(2)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(74,50,34,0.06)] border border-[#F0E4D3]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold text-[#4A3222] flex items-center gap-2">
              <span aria-hidden="true">🛍️</span> Your Cart
            </h2>
            {cart.length > 0 && (
              <span className="text-xs font-semibold text-white bg-[#D98A94] rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-3xl mb-2" aria-hidden="true">☕</p>
              <p className="text-sm text-[#8A6F55]">
                Your cart is empty — add a drink to get started.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map((cup) => {
                  const item = ALL_ITEMS.find((m) => m.id === cup.itemId);
                  const size = item.sizes.find((s) => s.id === cup.size);
                  const addOn = item.addOns.find((a) => a.id === cup.addOn);

                  return (
                    <div
                      key={cup.cupId}
                      className="flex justify-between items-center bg-[#FBF3E8] rounded-xl p-3 border border-[#F0E4D3]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-base shrink-0"
                          aria-hidden="true"
                        >
                          ☕
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#4A3222]">
                            {item.name} ({size.label})
                          </p>
                          {addOn && (
                            <p className="text-xs text-[#8A6F55]">+ {addOn.name}</p>
                          )}
                          <p className="text-xs text-[#D98A94] font-medium mt-1">
                            ${cupPrice(cup).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeCup(cup.cupId)}
                        aria-label={`Remove ${item.name}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[#C06B76] hover:bg-[#F7E3E5] transition text-sm shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-[#D9C3A3]">
                <span className="font-semibold text-[#4A3222]">Total</span>
                <span className="font-semibold text-[#4A3222]">
                  ${total.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* NEW: checkout section */}
        {cart.length > 0 && (
          <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-serif text-xl font-semibold text-[#4A3222] mb-3">
              Checkout
            </h2>

            <input
              type="text"
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-[#D9C3A3] rounded-lg px-3 py-2 text-sm mb-3 text-[#4A3222]"
            />
            <input
              type="email"
              placeholder="you@email.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full border border-[#D9C3A3] rounded-lg px-3 py-2 text-sm mb-3 text-[#4A3222]"
            />
            <select
              value={pickupTime ? pickupTime.toISOString() : ""}
              onChange={(e) => setPickupTime(new Date(e.target.value))}
              className="w-full border border-[#D9C3A3] rounded-lg px-3 py-2 text-sm mb-3 bg-white text-[#4A3222]"
            >
              <option value="" disabled>
                Select pickup time
              </option>
              {pickupTimes.map((time) => (
                <option key={time.toISOString()} value={time.toISOString()}>
                  {time.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPaymentMethod("online")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  paymentMethod === "online"
                    ? "bg-[#D98A94] text-white border-[#D98A94]"
                    : "bg-transparent text-[#4A3222] border-[#D9C3A3]"
                }`}
              >
                Pay Online
              </button>
              <button
                onClick={() => setPaymentMethod("counter")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  paymentMethod === "counter"
                    ? "bg-[#D98A94] text-white border-[#D98A94]"
                    : "bg-transparent text-[#4A3222] border-[#D9C3A3]"
                }`}
              >
                Pay at Counter
              </button>
            </div>

            <button
              onClick={placeOrder}
              disabled={!canSubmit || isSubmitting}
              className="w-full py-3 rounded-lg text-sm font-medium bg-[#4A3222] text-white disabled:bg-[#D9C3A3] disabled:text-white transition"
            >
              {isSubmitting ? 'Placing order…' : 'Place Order'}
            </button>
            {submitError && (
              <p className="text-xs text-[#C06B76] font-medium mt-2 text-center">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
