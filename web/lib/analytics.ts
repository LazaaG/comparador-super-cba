/**
 * Wrapper tipado de PostHog. SSR-safe.
 *
 * Eventos custom de la app, con sus props. Union discriminada para que el
 * compilador valide cada `track(name, props)` y nadie meta props raros.
 *
 * No exponer PII acá. Si en algún momento agregás un evento que potencialmente
 * lleve email/nombre/IP → revisar config en `posthog-provider.tsx`.
 */
import posthog from 'posthog-js';

// ---------- Definiciones de eventos ----------

type SearchSubmittedProps = {
  query: string;
  is_ean: boolean;
};

type ProductViewedProps = {
  ean: string;
  brand: string | null;
  n_chains: number;
  cheapest_chain: string | null;
};

type ProductAddedProps = {
  ean: string;
  from_page: 'buscar' | 'producto' | 'carrito';
};

type CartComparedProps = {
  n_items: number;
  mode: 'best_effort' | 'complete_only';
  winner_chain: string | null;
  coverage_pct: number;
};

type ChainLinkClickedProps = {
  chain: string;
  ean: string;
  page: 'producto' | 'comparar';
};

type CartClearedProps = {
  n_items_before: number;
};

export type EventMap = {
  search_submitted: SearchSubmittedProps;
  product_viewed: ProductViewedProps;
  product_added: ProductAddedProps;
  cart_compared: CartComparedProps;
  chain_link_clicked: ChainLinkClickedProps;
  cart_cleared: CartClearedProps;
};

export type EventName = keyof EventMap;

// ---------- API pública ----------

/**
 * Captura un evento custom. No-op en SSR.
 * `track('search_submitted', { query: 'leche', is_ean: false })`.
 */
export function track<E extends EventName>(event: E, props: EventMap[E]): void {
  if (typeof window === 'undefined') return;
  try {
    posthog.capture(event, props);
  } catch {
    // Falla silenciosa: analytics nunca rompe la app.
  }
}
