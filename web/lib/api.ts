// Cliente HTTP del frontend hacia los route handlers de Next.
// Los route handlers proxean al backend FastAPI (evita CORS y unifica el origen).

import type {
  SearchResponse,
  CartCompareRequest,
  CartCompareResponse,
  Chain
} from './types';

const isServer = typeof window === 'undefined';

function clientBase() {
  // En el browser usamos URLs relativas — Next sirve /api/* desde el mismo origen.
  return '';
}

function serverBase() {
  // En server components / SSR queremos pegarle directo al backend.
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

interface FetchOpts {
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

// Mapeo de rutas del proxy de Next → endpoints reales del backend FastAPI.
// Usado solo cuando se invoca el cliente desde el server (RSC). En el browser
// vamos al route handler y este último ya tiene el path correcto del backend.
const SERVER_PATH_MAP: Record<string, string> = {
  '/api/search': '/search',
  '/api/cart-compare': '/cart/compare',
  '/api/chains': '/chains'
};

function toBackendPath(path: string): string {
  // path puede traer query string. Separamos para hacer el match exacto.
  const [bare, qs] = path.split('?');
  const mapped = SERVER_PATH_MAP[bare] ?? bare.replace(/^\/api/, '');
  return qs ? `${mapped}?${qs}` : mapped;
}

async function jsonFetch<T>(path: string, init?: RequestInit & FetchOpts): Promise<T> {
  const base = isServer ? serverBase() : clientBase();
  // En server: traducimos /api/* al endpoint real del backend.
  // En client: vamos al route handler, que ya hace el proxy correcto.
  const url = isServer ? `${base}${toBackendPath(path)}` : `${base}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ---------- Endpoints ----------

export interface SearchParams {
  q?: string;
  ean?: string;
  limit?: number;
  offset?: number;
}

export async function search(
  params: SearchParams,
  signal?: AbortSignal,
  opts?: FetchOpts
): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.ean) qs.set('ean', params.ean);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  return jsonFetch<SearchResponse>(`/api/search?${qs.toString()}`, { signal, ...opts });
}

export async function compareCart(req: CartCompareRequest, signal?: AbortSignal): Promise<CartCompareResponse> {
  return jsonFetch<CartCompareResponse>('/api/cart-compare', {
    method: 'POST',
    body: JSON.stringify(req),
    signal
  });
}

export async function listChains(): Promise<Chain[]> {
  return jsonFetch<Chain[]>('/api/chains');
}
