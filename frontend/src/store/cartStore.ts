import { create } from 'zustand';

export interface CartItem {
  variant_id: string;
  sku: string;
  name: string;
  volume_ml?: number;
  quantity: number;

  // presentation only
  display_price: number;
  image_url?: string;
}

export function isLegacyPreviewVariantId(variant_id: string): boolean {
  if (!variant_id || typeof variant_id !== 'string') return true;
  const trimmed = variant_id.trim().toLowerCase();
  return (
    trimmed.startsWith('01940a00-') ||
    trimmed.startsWith('fallback-') ||
    trimmed.includes('fallback') ||
    trimmed.includes('preview')
  );
}

export interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (variant_id: string) => void;
  updateQuantity: (variant_id: string, delta: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getEstimatedTotal: () => number;
  getTotal: () => number;
  purgeLegacyPreviewItems: () => void;
  purgeUnconfirmedItems: (validVariantIds: Set<string>) => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  addItem: (item) => {
    // Phase 1.7C.20: Fabricated or preview variant IDs MUST NEVER enter transactional cart
    if (isLegacyPreviewVariantId(item.variant_id)) {
      console.warn('Blocked adding fabricated preview variant to cart:', item.variant_id);
      return;
    }
    set((state) => {
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
    });
  },
  removeItem: (variant_id) => set((state) => ({
    items: state.items.filter((i) => i.variant_id !== variant_id),
  })),
  updateQuantity: (variant_id, delta) => set((state) => {
    const updatedItems = state.items
      .map((item) => {
        if (item.variant_id === variant_id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);
    return { items: updatedItems };
  }),
  clearCart: () => set({ items: [] }),
  getEstimatedTotal: () => get().items.reduce((acc, item) => acc + (item.display_price * item.quantity), 0),
  getTotal: () => get().getEstimatedTotal(),
  purgeLegacyPreviewItems: () => set((state) => ({
    items: state.items.filter((i) => !isLegacyPreviewVariantId(i.variant_id)),
  })),
  purgeUnconfirmedItems: (validVariantIds: Set<string>) => set((state) => ({
    items: state.items.filter((i) => validVariantIds.has(i.variant_id)),
  })),
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