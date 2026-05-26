'use client';

import { useTrackProductView } from '@/lib/use-track-product-view';

interface Props {
  ean: string;
  brand: string | null;
  n_chains: number;
  cheapest_chain: string | null;
}

/**
 * Marker invisible: monta el hook que emite `product_viewed`. Permite que
 * `producto/[ean]/page.tsx` siga siendo server component.
 */
export function TrackProductView(props: Props) {
  useTrackProductView(props);
  return null;
}
