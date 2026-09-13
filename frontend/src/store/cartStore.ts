import { create } from 'zustand';

export interface CartItem {
  variant_id: string;
  sku: string;
  name: string;
  volume_ml?: number;
  quantity: number;

  // presentation only
  display_price: number;
}

export interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variant_id: string) => void;
  clearCart: () => void;
  getEstimatedTotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => {
    const existingIndex = state.items.findIndex((i) => i.variant_id === item.variant_id);
    if (existingIndex >= 0) {
      const updatedItems = [...state.items];
      const existing = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...existing,
        quantity: existing.quantity + item.quantity,
      };
      return { items: updatedItems };
    }
    return { items: [...state.items, item] };
  }),
  removeItem: (variant_id) => set((state) => ({
    items: state.items.filter((i) => i.variant_id !== variant_id),
  })),
  clearCart: () => set({ items: [] }),
  getEstimatedTotal: () => get().items.reduce((acc, item) => acc + (item.display_price * item.quantity), 0),
  getTotal: () => get().getEstimatedTotal(),
}));

/**
 * Pure transaction projection from cart items.
 *
 * Invariants (Gate 0E.2A):
 * - Contains ONLY variant_id and quantity.
 * - Must NOT contain display_price, price, subtotal, total, SKU, name, volume, etc.
 */
export function toTransactionProjection(items: CartItem[]): Array<{ variant_id: string; quantity: number }> {
  return items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }));
}