// Carrito local con persistencia en localStorage vía zustand.
// Diseño:
// - El carrito guarda EAN + cantidad + snapshot del nombre (para mostrarlo aunque
//   la API caiga).
// - Mantenemos un contador derivado para el badge del header.
// - Exponemos un "lastAddedAt" timestamp para gatillar el pulse en el contador.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LocalCartItem } from '@/lib/types';

interface CartState {
  items: LocalCartItem[];
  lastAddedAt: number | null; // timestamp del último add — usado para animar el badge
  add: (item: Omit<LocalCartItem, 'qty' | 'added_at'>, qty?: number) => void;
  remove: (ean: string) => void;
  setQty: (ean: string, qty: number) => void;
  increment: (ean: string) => void;
  decrement: (ean: string) => void;
  clear: () => void;
  has: (ean: string) => boolean;
  getQty: (ean: string) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      lastAddedAt: null,

      add: (item, qty = 1) => {
        const now = new Date().toISOString();
        set((state) => {
          const existing = state.items.find((i) => i.ean === item.ean);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.ean === item.ean ? { ...i, qty: i.qty + qty } : i
              ),
              lastAddedAt: Date.now()
            };
          }
          return {
            items: [
              ...state.items,
              {
                ean: item.ean,
                name: item.name,
                brand: item.brand,
                qty,
                added_at: now
              }
            ],
            lastAddedAt: Date.now()
          };
        });
      },

      remove: (ean) =>
        set((state) => ({
          items: state.items.filter((i) => i.ean !== ean)
        })),

      setQty: (ean, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.ean !== ean)
              : state.items.map((i) => (i.ean === ean ? { ...i, qty } : i))
        })),

      increment: (ean) =>
        set((state) => ({
          items: state.items.map((i) => (i.ean === ean ? { ...i, qty: i.qty + 1 } : i)),
          lastAddedAt: Date.now()
        })),

      decrement: (ean) =>
        set((state) => {
          const target = state.items.find((i) => i.ean === ean);
          if (!target) return state;
          if (target.qty <= 1) {
            return { items: state.items.filter((i) => i.ean !== ean) };
          }
          return {
            items: state.items.map((i) => (i.ean === ean ? { ...i, qty: i.qty - 1 } : i))
          };
        }),

      clear: () => set({ items: [], lastAddedAt: null }),

      has: (ean) => get().items.some((i) => i.ean === ean),
      getQty: (ean) => get().items.find((i) => i.ean === ean)?.qty ?? 0
    }),
    {
      name: 'super-cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ items: state.items })
    }
  )
);

// Selectors útiles
export const selectItemCount = (state: CartState): number =>
  state.items.reduce((acc, i) => acc + i.qty, 0);

export const selectUniqueCount = (state: CartState): number => state.items.length;
