// The menu — shared between the customer-facing page (for display) and the
// order API routes (for pricing). This is the single source of truth for
// what things cost. Anything server-side that needs a price MUST come from
// here, never from what a client claims a price is — a request can be
// tampered with client-side (browser dev tools, or a raw HTTP request),
// which is exactly how a $6 drink could otherwise be bought for a penny.

export const COLD_FOAM = [
  { id: 'vanilla', name: 'Vanilla', price: 1.0 },
  { id: 'caramel', name: 'Caramel', price: 1.0 },
  { id: 'coconut', name: 'Coconut', price: 1.0 },
  { id: 'cookie-butter', name: 'Cookie Butter', price: 1.0 },
  { id: 'toasted-marshmallow', name: 'Toasted Marshmallow', price: 1.0 },
];

export const MENU_CATEGORIES = [
  {
    id: 'iced-coffee',
    name: 'Iced Coffees',
    items: [
      {
        id: 1,
        name: 'Mazapan',
        photo: '/menu/mazapan-iced-coffee.jpg',
        // Which part of the photo stays visible when it's cropped to fit the
        // frame. 'center' by default — try 'top', 'bottom', 'left', 'right',
        // or a percentage like '50% 20%' (the second number is vertical:
        // lower % shows more of the top of the photo).
        photoPosition: 'top',
        sizes: [
          { id: 's', label: '16oz', price: 4.0 },
          { id: 'l', label: '24oz', price: 7.0 },
        ],
        addOns: COLD_FOAM,
      },
      {
        id: 2,
        name: 'Horchata',
        photo: '/menu/horchata-iced-coffee.jpg',
        photoPosition: 'center',
        sizes: [
          { id: 's', label: '16oz', price: 4.0 },
          { id: 'l', label: '24oz', price: 7.0 },
        ],
        addOns: COLD_FOAM,
      },
    ],
  },

  //new category
  {
    id: 'iced-lattes',
    name: 'Iced Lattes',
    items: [
      {
        id: 3,
        name: 'Cinnamon Roll Shaken Espresso',
        photo: '/menu/cinnamon-roll-shaken-espresso.jpg',
        photoPosition: 'center',
        sizes: [{ id: 's', label: '16oz', price: 6.0 }],
        addOns: COLD_FOAM,
      },
      {
        id: 4,
        name: 'Snickers Latte',
        photo: '/menu/snickers-latte.jpg',
        photoPosition: '60% 20%',
        sizes: [{ id: 's', label: '16oz', price: 6.0 }],
        addOns: COLD_FOAM,
      },
      {
        id: 5,
        name: 'Mazapan Latte',
        photo: '/menu/mazapan-latte.jpg',
        photoPosition: 'center',
        sizes: [{ id: 's', label: '16oz', price: 6.0 }],
        addOns: COLD_FOAM,
      },
      {
        id: 6,
        name: 'Horchata Latte',
        photo: '/menu/horchata-latte.jpg',
        photoPosition: 'center',
        sizes: [{ id: 's', label: '16oz', price: 6.0 }],
        addOns: COLD_FOAM,
      },
    ],
  },
];

// Flattened view of every item across every category, for quick lookups by
// id (cart entries only store an itemId, not which category it's in) or by
// name (order requests only carry names, not ids).
export const ALL_ITEMS = MENU_CATEGORIES.flatMap((category) => category.items);

// Takes the raw { item_name, size_label, addon_name } cart lines a client
// sent us and re-derives every price from the real menu above, ignoring
// whatever price the client claimed. Returns null if anything doesn't match
// a real menu item/size/add-on — that's either a bug or tampering, and
// either way the order should be rejected rather than guessed at.
export function priceOrderItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  const orderItems = [];

  for (const raw of rawItems) {
    const menuItem = ALL_ITEMS.find((item) => item.name === raw?.item_name);
    if (!menuItem) return null;

    const size = menuItem.sizes.find((s) => s.label === raw.size_label);
    if (!size) return null;

    let addonName = null;
    let addOnPrice = 0;
    if (raw.addon_name) {
      const addOn = menuItem.addOns.find((a) => a.name === raw.addon_name);
      if (!addOn) return null;
      addonName = addOn.name;
      addOnPrice = addOn.price;
    }

    orderItems.push({
      item_name: menuItem.name,
      size_label: size.label,
      addon_name: addonName,
      price: size.price + addOnPrice,
    });
  }

  const total = orderItems.reduce((sum, item) => sum + item.price, 0);
  return { orderItems, total };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared validation for both order-creation routes (/api/checkout and
// /api/orders) — everything a request needs to be a legitimate order,
// checked once so both routes stay in sync.
export function parseOrderRequest(body) {
  const { customerName, customerEmail, pickupTime, orderItems: rawItems } = body || {};

  if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
    return { error: 'Missing order details.' };
  }

  const pickup = new Date(pickupTime);
  if (Number.isNaN(pickup.getTime())) {
    return { error: 'Invalid pickup time.' };
  }

  if (customerEmail && !EMAIL_RE.test(customerEmail)) {
    return { error: 'Invalid email address.' };
  }

  const priced = priceOrderItems(rawItems);
  if (!priced) {
    return { error: 'Invalid order items.' };
  }

  return {
    customerName: customerName.trim(),
    customerEmail: customerEmail || null,
    pickupTime: pickup.toISOString(),
    orderItems: priced.orderItems,
    total: priced.total,
  };
}
