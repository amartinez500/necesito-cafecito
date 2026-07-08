'use client';

import { useState } from 'react';

const MENU = [
  //coffee 1
  {
    id: 1,
    name: 'Cafecito',
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
    name: 'Coffee',
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

  // What's currently being selected for each menu item, before "Add" is clicked
  const [selections, setSelections] = useState({});

  function getSelection(item) {
    return (
      selections[item.id] || {
        size: item.sizes[0].id,
        addOns: {},
      }
    );
  }

  function setSelectionSize(itemId, sizeId) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], size: sizeId, addOns: prev[itemId]?.addOns || {} },
    }));
  }

  function toggleSelectionAddOn(itemId, addOnId) {
    setSelections((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        addOns: {
          ...prev[itemId]?.addOns,
          [addOnId]: !prev[itemId]?.addOns?.[addOnId],
        },
      },
    }));
  }

  function addToCart(item) {
    const selection = getSelection(item);
    const newCup = {
      cupId: crypto.randomUUID(),
      itemId: item.id,
      size: selection.size,
      addOns: selection.addOns,
    };
    setCart((prev) => [...prev, newCup]);
  }

  function removeCup(cupId) {
    setCart((prev) => prev.filter((cup) => cup.cupId !== cupId));
  }

  function cupPrice(cup) {
    const item = MENU.find((m) => m.id === cup.itemId);
    const size = item.sizes.find((s) => s.id === cup.size);
    const addOnTotal = item.addOns.reduce((sum, addOn) => {
      return cup.addOns[addOn.id] ? sum + addOn.price : sum;
    }, 0);
    return size.price + addOnTotal;
  }

  const total = cart.reduce((sum, cup) => sum + cupPrice(cup), 0);

  return (
    <main>
      <h1>necesito cafecito</h1>

      {MENU.map((item) => {
        const selection = getSelection(item);
        return (
          <div key={item.id}>
            <p>{item.name}</p>

            {item.sizes.map((size) => (
              <label key={size.id} style={{ marginRight: '10px' }}>
                <input
                  type="radio"
                  name={`size-${item.id}`}
                  checked={selection.size === size.id}
                  onChange={() => setSelectionSize(item.id, size.id)}
                />
                {size.label} (${size.price.toFixed(2)})
              </label>
            ))}

            {item.addOns.map((addOn) => (
              <div key={addOn.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selection.addOns[addOn.id] || false}
                    onChange={() => toggleSelectionAddOn(item.id, addOn.id)}
                  />
                  {addOn.name} (+${addOn.price.toFixed(2)})
                </label>
              </div>
            ))}

            <button onClick={() => addToCart(item)}>Add to cart</button>
          </div>
        );
      })}

      <h2>Cart</h2>
      {cart.length === 0 && <p>No items yet.</p>}
      {cart.map((cup) => {
        const item = MENU.find((m) => m.id === cup.itemId);
        const size = item.sizes.find((s) => s.id === cup.size);
        const addOnNames = item.addOns
          .filter((a) => cup.addOns[a.id])
          .map((a) => a.name);

        return (
          <div key={cup.cupId}>
            <p>
              {item.name} ({size.label}) - ${cupPrice(cup).toFixed(2)}
              {addOnNames.length > 0 && ` + ${addOnNames.join(', ')}`}
            </p>
            <button onClick={() => removeCup(cup.cupId)}>Remove</button>
          </div>
        );
      })}

      <h2>Total: ${total.toFixed(2)}</h2>
    </main>
  );
}