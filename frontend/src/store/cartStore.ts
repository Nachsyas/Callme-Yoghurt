import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  volume_ml: number;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => {
    const existingItem = state.items.find((i) => i.id === item.id);
    if (existingItem) {
      return {
        items: state.items.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i)
      };
    }
    return { items: [...state.items, item] };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id)
  })),
  clearCart: () => set({ items: [] }),
  getTotal: () => get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
}));