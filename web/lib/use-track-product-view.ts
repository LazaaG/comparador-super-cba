'use client';

import { useEffect } from 'react';
import { track } from './analytics';

interface Args {
  ean: string;
  brand: string | null;
  n_chains: number;
  cheapest_chain: string | null;
}

/**
 * Dispara `product_viewed` una sola vez por mount. Re-dispara si cambia el EAN
 * (navegación entre productos).
 */
export function useTrackProductView({ ean, brand, n_chains, cheapest_chain }: Args) {
  useEffect(() => {
    track('product_viewed', { ean, brand, n_chains, cheapest_chain });
    // intencional: solo el ean dispara re-emisión. brand/n_chains/cheapest se
    // estabilizan con el ean del mismo producto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ean]);
}
