'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart';
import { compareCart } from '@/lib/api';
import { track } from '@/lib/analytics';
import { ModeToggle } from '@/components/ModeToggle';
import { RankingRow } from '@/components/RankingRow';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { ShoppingBasket, Repeat, AlertTriangle } from 'lucide-react';
import type { CartCompareMode, CartCompareResponse } from '@/lib/types';

// Página comparar: dispara POST /cart/compare con los EAN del store + modo.
// Render del ranking: cobertura >=80% arriba, resto al final con separator.
// La cadena ganadora tiene tratamiento monte sin chillar.
export default function CompararPage() {
  const items = useCartStore((s) => s.items);
  const [mode, setMode] = useState<CartCompareMode>('best_effort');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const payload = useMemo(
    () => ({
      mode,
      items: items.map((i) => ({ ean: i.ean, qty: i.qty }))
    }),
    [mode, items]
  );

  const mutation = useMutation<CartCompareResponse, Error, void>({
    mutationFn: () => compareCart(payload)
  });

  // Auto-disparar al montar si hay items, una sola vez
  useEffect(() => {
    if (mounted && items.length > 0 && !mutation.data && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Emit cart_compared cuando llega data nueva
  useEffect(() => {
    if (!mutation.data) return;
    const w = mutation.data.ranking[0];
    if (!w) return;
    track('cart_compared', {
      n_items: items.length,
      mode,
      winner_chain: w.chain,
      coverage_pct: w.coverage_pct
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.data]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-12 w-80 max-w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
          Comparar
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-12 leading-tight">
          Todavía no hay nada para comparar
        </h1>
        <EmptyState
          icon={ShoppingBasket}
          title="Armá una lista primero"
          description="Buscá productos y agregalos al carrito. Cuando tengas dos o tres, volvemos acá y te decimos en qué cadena conviene comprarlos."
          action={
            <Link
              href="/buscar"
              className="inline-flex items-center gap-2 rounded-md bg-ink text-paper px-5 py-3 text-sm font-medium hover:bg-terra-deep transition-colors"
            >
              Ir a buscar
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
      <header className="mb-10">
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
          Comparar
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
          Tu carrito en cada cadena
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-prose">
          {items.length} {items.length === 1 ? 'producto' : 'productos'} en la lista.
          Cambiá el modo si querés ver solo cadenas que tengan todo.
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <ModeToggle
          value={mode}
          onChange={(m) => {
            setMode(m);
            // Re-disparar con el nuevo modo
            setTimeout(() => mutation.mutate(), 0);
          }}
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-paper-deep bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim disabled:opacity-50"
        >
          <Repeat
            size={14}
            strokeWidth={1.75}
            className={mutation.isPending ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          {mutation.isPending ? 'Comparando…' : 'Re-comparar'}
        </button>
      </div>

      {/* Estado: cargando */}
      {mutation.isPending && <RankingSkeleton />}

      {/* Estado: error */}
      {mutation.isError && (
        <EmptyState
          icon={AlertTriangle}
          title="El servicio nos colgó"
          description="No pudimos calcular el ranking. Probá apretar de nuevo en un ratito."
          action={
            <button
              type="button"
              onClick={() => mutation.mutate()}
              className="btn-primary"
            >
              Reintentar
            </button>
          }
        />
      )}

      {/* Estado: éxito */}
      {mutation.data && !mutation.isPending && (
        <Ranking data={mutation.data} mode={mode} />
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

function Ranking({ data, mode }: { data: CartCompareResponse; mode: CartCompareMode }) {
  const { ranking, total_items } = data;

  if (ranking.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title={mode === 'complete_only' ? 'Ninguna cadena tiene todo' : 'Sin resultados'}
        description={
          mode === 'complete_only'
            ? 'Probá con el modo «mejor esfuerzo» — vas a ver cuál cadena cubre más productos.'
            : 'No encontramos ninguna cadena con precios para los productos de tu lista. Algo raro pasa.'
        }
      />
    );
  }

  // Split visual: cobertura alta arriba, cobertura baja al final
  const HIGH_THRESHOLD = 0.8;
  const high = ranking.filter((r) => r.coverage_pct >= HIGH_THRESHOLD);
  const low = ranking.filter((r) => r.coverage_pct < HIGH_THRESHOLD);

  const winner = ranking[0];
  const winnerTotal = winner.covered_total;

  return (
    <div className="space-y-12">
      {/* Bloque alto */}
      {high.length > 0 && (
        <section>
          <ol className="divide-y divide-paper-deep/70 border-y border-paper-deep/70">
            {high.map((result) => (
              <li key={result.chain}>
                <RankingRow
                  result={result}
                  isWinner={result.chain === winner.chain}
                  winnerTotal={winnerTotal}
                  totalItems={total_items}
                  belowThreshold={false}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Separador + bloque bajo */}
      {low.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1 bg-paper-deep/70" />
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint">
              Cobertura parcial
            </span>
            <div className="h-px flex-1 bg-paper-deep/70" />
          </div>
          <ol className="divide-y divide-paper-deep/70 border-y border-paper-deep/70">
            {low.map((result) => (
              <li key={result.chain}>
                <RankingRow
                  result={result}
                  isWinner={false}
                  winnerTotal={winnerTotal}
                  totalItems={total_items}
                  belowThreshold
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-xs text-ink-faint leading-relaxed max-w-prose">
        Los totales se calculan con el precio efectivo (oferta incluida) relevado
        de cada cadena. Si una cadena no tiene un producto, no se suma al total
        y queda como faltante.
      </p>
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="border-y border-paper-deep/70 divide-y divide-paper-deep/70">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="py-6 px-4 md:px-6">
          <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8">
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
