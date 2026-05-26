'use client';

import { useState } from 'react';
import { Check, Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics';

interface Props {
  ean: string;
  name: string;
  brand?: string | null;
  compact?: boolean;
  fromPage?: 'buscar' | 'producto' | 'carrito';
}

// Botón con dos modos:
// - Ítem NO en carrito: pill "Agregar" con icono +.
// - Ítem YA en carrito: stepper minus/qty/plus.
// La transición entre modos usa blur breve para no sentir el "swap" duro.
export function AddToCartButton({
  ean,
  name,
  brand,
  compact = false,
  fromPage = 'producto'
}: Props) {
  const inCart = useCartStore((s) => s.has(ean));
  const qty = useCartStore((s) => s.getQty(ean));
  const add = useCartStore((s) => s.add);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    add({ ean, name, brand: brand ?? null });
    track('product_added', { ean, from_page: fromPage });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleIncrement = () => {
    increment(ean);
    track('product_added', { ean, from_page: fromPage });
  };

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Agregar ${name} al carrito`}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium',
          'bg-ink text-paper hover:bg-terra',
          'transition-colors',
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
        )}
      >
        {justAdded ? (
          <>
            <Check size={compact ? 14 : 16} strokeWidth={2} aria-hidden="true" />
            <span>Agregado</span>
          </>
        ) : (
          <>
            <Plus size={compact ? 14 : 16} strokeWidth={2} aria-hidden="true" />
            <span>Agregar</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-stretch rounded-md border border-paper-deep bg-paper',
        compact ? 'h-8' : 'h-10'
      )}
      role="group"
      aria-label={`Cantidad de ${name}`}
    >
      <button
        type="button"
        onClick={() => decrement(ean)}
        aria-label="quitar uno"
        className={cn(
          'inline-flex items-center justify-center text-ink-soft hover:text-terra hover:bg-paper-dim',
          'rounded-l-md',
          compact ? 'w-8' : 'w-10'
        )}
      >
        <Minus size={compact ? 12 : 14} strokeWidth={2} aria-hidden="true" />
      </button>
      <span
        className={cn(
          'inline-flex items-center justify-center font-mono tabular-nums text-ink',
          compact ? 'min-w-8 text-xs' : 'min-w-10 text-sm'
        )}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        aria-label="agregar uno más"
        className={cn(
          'inline-flex items-center justify-center text-ink-soft hover:text-terra hover:bg-paper-dim',
          'rounded-r-md',
          compact ? 'w-8' : 'w-10'
        )}
      >
        <Plus size={compact ? 12 : 14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
