'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/cart';
import { EmptyState } from '@/components/EmptyState';
import { AddToCartButton } from '@/components/AddToCartButton';
import { ProductThumb } from '@/components/ProductThumb';
import { ChainBadge } from '@/components/ChainBadge';
import {
  ShoppingBasket,
  Trash2,
  ArrowRight,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEffect, useMemo, useState } from 'react';
import { compareCart } from '@/lib/api';
import { formatARS } from '@/lib/format';
import type { CartCompareResponse } from '@/lib/types';

export default function CarritoPage() {
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const [mounted, setMounted] = useState(false);

  // Comparación en vivo: arma meta de imágenes + winner para el card.
  const [comparison, setComparison] = useState<CartCompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Refetch cada vez que cambia el set de items o sus cantidades.
  const cartKey = useMemo(
    () => items.map((i) => `${i.ean}:${i.qty}`).join('|'),
    [items]
  );

  useEffect(() => {
    if (!mounted || items.length === 0) {
      setComparison(null);
      return;
    }
    const ctrl = new AbortController();
    setComparing(true);
    compareCart(
      { items: items.map((i) => ({ ean: i.ean, qty: i.qty })), mode: 'best_effort' },
      ctrl.signal
    )
      .then((r) => setComparison(r))
      .catch((err) => {
        if (err?.name !== 'AbortError') setComparison(null);
      })
      .finally(() => setComparing(false));
    return () => ctrl.abort();
  }, [mounted, cartKey, items]);

  // Mapa EAN → image_url canónica desde la respuesta de compare.
  // CartItemFound y CartItemMissing ambas traen image_url enriquecido.
  const imageByEan = useMemo(() => {
    const m = new Map<string, string | null>();
    if (!comparison) return m;
    for (const row of comparison.ranking) {
      for (const f of row.items_found) {
        if (f.image_url && !m.has(f.ean)) m.set(f.ean, f.image_url);
      }
      for (const ms of row.items_missing) {
        if (ms.image_url && !m.has(ms.ean)) m.set(ms.ean, ms.image_url);
      }
    }
    return m;
  }, [comparison]);

  // Ganador para el card "Mejor precio total"
  const winner = comparison?.ranking?.[0] ?? null;

  // Subtotales por EAN tomando precios de la cadena ganadora.
  // Si el ganador no tiene el ítem (missing), lo marcamos como null.
  const winnerSubtotalByEan = useMemo(() => {
    const m = new Map<string, { unit: number; subtotal: number; isPromo: boolean } | null>();
    if (!winner) return m;
    for (const f of winner.items_found) {
      m.set(f.ean, { unit: f.unit_price, subtotal: f.subtotal, isPromo: f.is_promo });
    }
    for (const ms of winner.items_missing) {
      m.set(ms.ean, null);
    }
    return m;
  }, [winner]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
        <div className="h-8 w-32 shimmer-warm rounded-md mb-6" />
        <div className="h-12 w-80 max-w-full shimmer-warm rounded-md" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
          Mi carrito
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-12 leading-tight">
          Tu lista está vacía
        </h1>
        <EmptyState
          icon={ShoppingBasket}
          title="Dale, agregá algo"
          description="Buscá los productos que solés comprar y sumalos a tu lista. Después comparamos cuánto te sale el total en cada súper."
          action={
            <Link
              href="/buscar"
              className="inline-flex items-center gap-2 rounded-md bg-ink text-paper px-5 py-3 text-sm font-medium hover:bg-terra-deep transition-colors"
            >
              Buscar productos
              <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          }
        />
      </div>
    );
  }

  const totalQty = items.reduce((acc, i) => acc + i.qty, 0);

  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
            Mi carrito
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
            <span className="text-ink-faint"> · </span>
            <span className="text-ink-soft font-sans text-2xl">
              {totalQty} {totalQty === 1 ? 'unidad' : 'unidades'}
            </span>
          </h1>
        </div>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-alerta"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
          Vaciar todo
        </button>
      </div>

      <div className="grid gap-12 md:grid-cols-12 md:gap-16">
        <section className="md:col-span-8">
          {winner && (
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint mb-3">
              Precios mostrados en{' '}
              <span className="text-monte-deep">{winner.chain_name}</span>{' '}
              (mejor opción)
            </p>
          )}
          <ol className="divide-y divide-paper-deep/70 border-y border-paper-deep/70">
            {items.map((item) => {
              const img = imageByEan.get(item.ean) ?? null;
              const winnerEntry = winnerSubtotalByEan.get(item.ean);
              return (
                <li
                  key={item.ean}
                  className={cn(
                    'grid gap-4 py-5 px-2 -mx-2 rounded-lg items-center',
                    'md:grid-cols-[64px_minmax(0,1fr)_auto_auto_auto] md:gap-6',
                    'hover:bg-paper-dim/40'
                  )}
                >
                  {/* Thumb */}
                  <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-paper-dim ring-1 ring-paper-deep/60">
                    <ProductThumb src={img} alt={item.name} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <Link
                      href={`/producto/${item.ean}`}
                      className="text-base font-medium text-ink hover:text-terra-deep leading-snug"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-xs text-ink-soft">
                      {item.brand && <span>{item.brand} · </span>}
                      <span className="font-mono text-[11px] text-ink-faint">{item.ean}</span>
                    </p>
                  </div>

                  <AddToCartButton ean={item.ean} name={item.name} brand={item.brand} compact />

                  {/* Subtotal en la cadena ganadora */}
                  <div className="text-right min-w-[88px]">
                    {winnerEntry === undefined ? (
                      <span className="text-[11px] text-ink-faint italic">…</span>
                    ) : winnerEntry === null ? (
                      <span className="text-[11px] text-ink-faint italic">
                        no disponible
                      </span>
                    ) : (
                      <>
                        <div className={cn(
                          'tabular-nums font-medium text-monte-deep',
                          'text-lg leading-none'
                        )}>
                          {formatARS(winnerEntry.subtotal)}
                        </div>
                        {item.qty > 1 && (
                          <div className="mt-1 text-[10px] text-ink-faint tabular-nums">
                            {formatARS(winnerEntry.unit)} c/u
                          </div>
                        )}
                        {winnerEntry.isPromo && (
                          <div className="mt-1 inline-block text-[9px] font-mono uppercase tracking-[0.14em] text-terra-deep">
                            oferta
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(item.ean)}
                    aria-label={`Quitar ${item.name}`}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md text-ink-faint hover:text-alerta hover:bg-paper-dim"
                  >
                    <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-6">
            <Link
              href="/buscar"
              className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
            >
              + Agregar otro producto
            </Link>
          </div>
        </section>

        {/* Panel lateral: card del mejor precio + CTA comparar */}
        <aside className="md:col-span-4">
          <div className="sticky top-8 space-y-5">
            {/* Card mejor precio (preview live de la comparación) */}
            <div
              className={cn(
                'rounded-xl bg-paper-dim ring-1 ring-monte/30 p-5',
                comparing && 'opacity-70'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} strokeWidth={1.75} className="text-monte-deep" aria-hidden="true" />
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-monte-deep">
                  Mejor precio total
                </p>
              </div>
              {winner ? (
                <>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-serif text-3xl text-monte-deep tabular-nums leading-none">
                      {formatARS(winner.covered_total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <ChainBadge slug={winner.chain} variant="wordmark" size="sm" />
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    {winner.has_full_coverage ? (
                      <>Tiene tu lista completa ({winner.items_found.length} {winner.items_found.length === 1 ? 'producto' : 'productos'}).</>
                    ) : (
                      <>
                        Cubre {winner.items_found.length} de {comparison?.total_items} productos.{' '}
                        {winner.items_missing.length > 0 && (
                          <span className="text-ink-faint">
                            Faltan {winner.items_missing.length}.
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-soft">
                  {comparing ? 'Calculando…' : 'Ninguna cadena tiene estos productos relevados.'}
                </p>
              )}
            </div>

            {/* CTA comparar completo */}
            <div className="rounded-xl bg-ink text-paper p-6">
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-paper/60 mb-3">
                Comparación completa
              </p>
              <h2 className="font-serif text-lg leading-tight mb-3">
                Ver ranking de todas las cadenas
              </h2>
              <p className="text-sm text-paper/70 leading-relaxed mb-5">
                Detalle por ítem, precios alternativos y productos faltantes.
              </p>
              <Link
                href="/comparar"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-paper text-ink px-5 py-3 text-sm font-medium hover:bg-paper-dim transition-colors"
              >
                Comparar carritos
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>

            <p className="text-xs text-ink-faint leading-relaxed">
              Tu lista se guarda en este navegador. No hace falta crear cuenta.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
