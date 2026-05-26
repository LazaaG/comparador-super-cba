// Espejo de los Pydantic v2 del backend. NO modificar sin sincronizar /api.

export type UnitKind = 'L' | 'ml' | 'g' | 'kg' | 'un' | 'cc';

export interface PriceInChain {
  chain: string;
  chain_name: string;
  price_list: number;
  price_effective: number;
  is_promo: boolean;
  name_in_chain: string | null;
  product_url: string | null;
  scraped_at: string; // ISO 8601
}

export interface SearchResultItem {
  ean: string;
  name: string;
  brand: string | null;
  unit_value: number | null;
  unit_kind: UnitKind | null;
  image_url: string | null;
  prices: PriceInChain[];
  cheapest_chain: string | null;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

export type CartCompareMode = 'best_effort' | 'complete_only';

export interface CartCompareRequest {
  items: { ean: string; qty: number }[];
  mode: CartCompareMode;
}

export interface CartItemFound {
  ean: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  is_promo: boolean;
  name_in_chain: string | null;
  name: string | null;
  image_url: string | null;
}

export interface CartItemMissing {
  ean: string;
  qty: number;
  name: string | null;
  image_url: string | null;
}

export interface CartChainResult {
  chain: string;
  chain_name: string;
  covered_total: number;
  items_found: CartItemFound[];
  items_missing: CartItemMissing[];
  coverage_pct: number; // 0..1
  has_full_coverage: boolean;
}

export interface CartCompareResponse {
  mode: CartCompareMode;
  total_items: number;
  ranking: CartChainResult[];
}

export interface Chain {
  slug: string;
  name: string;
  active: boolean;
}

// Cliente: representación del producto guardado en el carrito local
export interface LocalCartItem {
  ean: string;
  qty: number;
  name: string; // snapshot del nombre canónico al momento de agregar
  brand: string | null;
  added_at: string; // ISO
}
