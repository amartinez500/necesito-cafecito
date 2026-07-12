'use client';

import { useState } from 'react';
import Image from 'next/image';

const MENU = [
  //coffee 1
  {
    id: 1,
    name: 'Mazapan',
    sizes: [
      { id: 's', label: '16oz', price: 4.0 },
      { id: 'l', label: '24oz', price: 7.0 },
    ],
    addOns: [
      { id: 'vanilla', name: 'Vanilla cold foam', price: 1.0 },
      { id: 'caramel', name: 'Caramel cold foam', price: 1.0 },
    ],
  },

  //coffee 2
  {
    id: 2,
    name: 'Horchata',
    sizes: [
      { id: 's', label: '16oz', price: 4.0 },
      { id: 'l', label: '24oz', price: 7.0 },
    ],
    addOns: [
      { id: 'vanilla', name: 'Vanilla cold foam', price: 1.0 },
      { id: 'caramel', name: 'Caramel cold foam', price: 1.0 },
    ],
  },
];

/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

export default function Home() {
  const [cart, setCart] = useState([]);
  const [selections, setSelections] = useState({});

  // New: checkout form state
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  function getSelection(item) {
    return (
      selections[item.id] || {
        size: item.sizes[0].id,
        addOn: null,
      }
    );
  }

  function setSelectionSize(itemId, sizeId) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], size: sizeId },
    }));
  }

  function setSelectionAddOn(itemId, addOnId) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], addOn: addOnId },
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
    const item = MENU.find((m) => m.id === cup.itemId);
    const size = item.sizes.find((s) => s.id === cup.size);
    const addOn = item.addOns.find((a) => a.id === cup.addOn);
    return size.price + (addOn ? addOn.price : 0);
  }

  const total = cart.reduce((sum, cup) => sum + cupPrice(cup), 0);

  const canSubmit = customerName.trim().length > 0 && paymentMethod && cart.length > 0;

  function placeOrder() {
    setOrderPlaced(true);
  }

  //To show a confirmation screen instead of the new menu, once submitted

  if (orderPlaced) {
    return (
      <main>
        <h1>Order sent! </h1>
        <p>
          Thanks {customerName}!{' '}
          {paymentMethod === 'online' ? 'Paid online.' : 'Pay at pickup.'} We'll
          have it ready soon.
        </p>
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
          <p className="text-sm text-[#8A6F55]">pick your drinks for pickup</p>
        </div>

        <div className="space-y-4">
          {MENU.map((item) => {
            const selection = getSelection(item);
            return (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="font-medium text-[#4A3222] mb-2">{item.name}</p>

                <div className="flex gap-3 mb-2">
                  {item.sizes.map((size) => (
                    <label
                      key={size.id}
                      className="flex items-center gap-1 text-sm text-[#4A3222]"
                    >
                      <input
                        type="radio"
                        name={`size-${item.id}`}
                        checked={selection.size === size.id}
                        onChange={() => setSelectionSize(item.id, size.id)}
                      />
                      {size.label} (${size.price.toFixed(2)})
                    </label>
                  ))}
                </div>

                {item.addOns.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <label className="flex items-center gap-2 text-sm text-[#8A6F55]">
                      <input
                        type="radio"
                        name={`addon-${item.id}`}
                        checked={!selection.addOn}
                        onChange={() => setSelectionAddOn(item.id, null)}
                      />
                      No cold foam
                    </label>
                    {item.addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className="flex items-center gap-2 text-sm text-[#8A6F55]"
                      >
                        <input
                          type="radio"
                          name={`addon-${item.id}`}
                          checked={selection.addOn === addOn.id}
                          onChange={() => setSelectionAddOn(item.id, addOn.id)}
                        />
                        {addOn.name} (+${addOn.price.toFixed(2)})
                      </label>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => addToCart(item)}
                  className="bg-[#4A3222] text-white px-4 py-2 rounded-lg text-sm font-medium active:scale-95 transition"
                >
                  Add to cart
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#4A3222] mb-3">
            Your Cart
          </h2>

          {cart.length === 0 && (
            <p className="text-sm text-[#8A6F55]">No items yet.</p>
          )}

          <div className="space-y-2">
            {cart.map((cup) => {
              const item = MENU.find((m) => m.id === cup.itemId);
              const size = item.sizes.find((s) => s.id === cup.size);
              const addOn = item.addOns.find((a) => a.id === cup.addOn);

              return (
                <div
                  key={cup.cupId}
                  className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm"
                >
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
                  <button
                    onClick={() => removeCup(cup.cupId)}
                    className="text-xs text-[#C06B76] font-medium"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          {cart.length > 0 && (
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-[#D9C3A3]">
              <span className="font-semibold text-[#4A3222]">Total</span>
              <span className="font-semibold text-[#4A3222]">
                ${total.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* NEW: checkout section */}
        {cart.length > 0 && (
          <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[#4A3222] mb-3">
              Checkout
            </h2>

            <input
              type="text"
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-[#D9C3A3] rounded-lg px-3 py-2 text-sm mb-3"
            />

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
              disabled={!canSubmit}
              className="w-full py-3 rounded-lg text-sm font-medium bg-[#4A3222] text-white disabled:bg-[#D9C3A3] disabled:text-white transition"
            >
              Place Order
            </button>
          </div>
        )}
      </div>
    </main>
  );
}