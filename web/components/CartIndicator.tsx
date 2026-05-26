'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingBasket } from 'lucide-react';
import { useCartStore, selectItemCount } from '@/store/cart';
import { cn } from '@/lib/cn';

// Indicador del carrito en el header.
// El badge contador hace un pulse (scale 1 → 1.22 → 1) cada vez que cambia lastAddedAt.
// No es loop perpetuo: dispara una sola vez por evento.
export function CartIndicator() {
  const count = useCartStore(selectItemCount);
  const lastAddedAt = useCartStore((s) => s.lastAddedAt);
  const [pulseKey, setPulseKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (lastAddedAt) setPulseKey((k) => k + 1);
  }, [lastAddedAt]);

  // Evitamos render del count antes de hidratar (zustand persist puede divergir)
  const displayCount = mounted ? count : 0;

  return (
    <Link
      href="/carrito"
      className={cn(
        'group relative inline-flex items-center gap-2.5 rounded-md',
        'px-3 py-2 text-sm font-medium text-ink',
        'hover:bg-paper-dim'
      )}
      aria-label={`Carrito, ${displayCount} ${displayCount === 1 ? 'producto' : 'productos'}`}
    >
      <ShoppingBasket
        size={18}
        strokeWidth={1.75}
        className="text-ink-soft group-hover:text-terra transition-colors"
        aria-hidden="true"
      />
      <span className="hidden sm:inline">Mi carrito</span>
      {displayCount > 0 && (
        <span
          key={pulseKey}
          className={cn(
            'inline-flex items-center justify-center',
            'min-w-[1.25rem] h-5 px-1.5 rounded-full',
            'bg-terra text-paper text-[10px] font-mono font-semibold tabular-nums',
            'animate-count-pulse'
          )}
          style={{ transformOrigin: 'center' }}
        >
          {displayCount}
        </span>
      )}
    </Link>
  );
}
