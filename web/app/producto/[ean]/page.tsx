import Link from 'next/link';
import { notFound } from 'next/navigation';
import { search } from '@/lib/api';
import { ChainBadge } from '@/components/ChainBadge';
import { AddToCartButton } from '@/components/AddToCartButton';
import { ProductThumb } from '@/components/ProductThumb';
import { formatARS, formatUnit, percentDiff, relativeTimeES } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ArrowLeft, ExternalLink, Trophy } from 'lucide-react';
import type { PriceInChain } from '@/lib/types';

interface PageProps {
  params: { ean: string };
}

// Forzamos refetch en cada request: los precios cambian con cada scrape y la DB
// se actualiza en caliente. Cache de RSC = info vieja a los usuarios.
export const revalidate = 60;
export const dynamic = 'force-dynamic';

// Detalle de producto: 1 ítem canónico + tabla de precios por cadena.
// Layout: 60/40 — info producto a la izquierda, tabla a la derecha (en md+).
export default async function ProductPage({ params }: PageProps) {
  const ean = decodeURIComponent(params.ean);

  let data;
  try {
    data = await search({ ean }, undefined, { cache: 'no-store' });
  } catch {
    notFound();
  }

  const item = data?.results?.[0];
  if (!item) notFound();

  // Ordenar precios: ganador primero, resto por price_effective asc
  const sorted = [...item.prices].sort((a, b) => a.price_effective - b.price_effective);
  const winner = sorted[0];
  const maxPrice = sorted[sorted.length - 1]?.price_effective ?? winner.price_effective;
  const unitText = formatUnit(item.unit_value, item.unit_kind);

  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-8 pb-24">
      {/* Breadcrumb minimal */}
      <Link
        href="/buscar"
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink mb-8"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Volver a la búsqueda
      </Link>

      <div className="grid gap-12 md:grid-cols-12 md:gap-16">
        {/* ---------- Info producto ---------- */}
        <section className="md:col-span-5 md:sticky md:top-8 md:self-start">
          {item.image_url && (
            <div className="mb-6 h-64 w-full rounded-lg bg-paper-dim ring-1 ring-paper-deep/60 overflow-hidden">
              <ProductThumb
                src={item.image_url}
                alt={item.name}
                className="p-6"
                iconSize={48}
              />
            </div>
          )}
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
            Producto
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
            {item.name}
          </h1>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {item.brand && (
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint mb-1">
                  Marca
                </dt>
                <dd className="text-ink">{item.brand}</dd>
              </div>
            )}
            {unitText && (
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint mb-1">
                  Presentación
                </dt>
                <dd className="text-ink">{unitText}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint mb-1">
                Código de barras
              </dt>
              <dd className="font-mono text-sm text-ink-soft tabular-nums">{item.ean}</dd>
            </div>
          </dl>

          <div className="mt-8 pt-6 border-t border-paper-deep/70">
            <AddToCartButton ean={item.ean} name={item.name} brand={item.brand} />
          </div>

          {/* Resumen de ahorro */}
          {winner && maxPrice > winner.price_effective && (
            <div className="mt-8 p-5 rounded-lg bg-monte/[0.06] border border-monte/20">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-monte-deep mb-2">
                Ahorro máximo
              </p>
              <p className="font-serif text-2xl text-monte-deep tabular-nums">
                {formatARS(maxPrice - winner.price_effective)}
              </p>
              <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                Si comprás este producto en <strong className="font-medium text-ink">{winner.chain_name}</strong>{' '}
                en vez de en el más caro, te ahorrás eso por unidad.
              </p>
            </div>
          )}
        </section>

        {/* ---------- Tabla de precios por cadena ---------- */}
        <section className="md:col-span-7">
          <header className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif text-xl text-ink">Precios por cadena</h2>
            <p className="text-xs text-ink-faint font-mono uppercase tracking-[0.18em]">
              {sorted.length} {sorted.length === 1 ? 'cadena' : 'cadenas'}
            </p>
          </header>

          <ol className="divide-y divide-paper-deep/70">
            {sorted.map((p, idx) => (
              <PriceRow
                key={p.chain}
                price={p}
                isWinner={idx === 0}
                minPrice={winner.price_effective}
              />
            ))}
          </ol>

          <p className="mt-6 text-xs text-ink-faint leading-relaxed max-w-prose">
            Los precios mostrados son los relevados online para las sucursales
            cordobesas de cada cadena. El precio en local puede variar. Las
            promociones multi-pack (2x1, 2do al 70%, llevando 3 pagás 2, etc.)
            no están incluidas — sólo mostramos descuentos directos por unidad.
          </p>
        </section>
      </div>
    </div>
  );
}

interface PriceRowProps {
  price: PriceInChain;
  isWinner: boolean;
  minPrice: number;
}

function PriceRow({ price, isWinner, minPrice }: PriceRowProps) {
  const hasDiscount = price.price_effective < price.price_list;
  const discountPct = hasDiscount
    ? Math.round(((price.price_list - price.price_effective) / price.price_list) * 100)
    : 0;
  // % más caro que el más barato. 0 = empata con el ganador.
  const overMin = minPrice > 0 && price.price_effective > minPrice
    ? Math.round(((price.price_effective - minPrice) / minPrice) * 100)
    : 0;
  const tiesWinner = !isWinner && price.price_effective === minPrice;

  return (
    <li
      className={cn(
        'group py-5 px-3 -mx-3 rounded-md transition-colors',
        isWinner && 'bg-monte/[0.04] ring-1 ring-inset ring-monte/25'
      )}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        {/* Identidad cadena */}
        <ChainBadge slug={price.chain} variant="wordmark" size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-ink truncate">{price.chain_name}</h3>
            {isWinner && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-monte-deep">
                <Trophy size={11} strokeWidth={1.75} aria-hidden="true" />
                Más barato
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            Relevado {relativeTimeES(price.scraped_at)}
            {price.name_in_chain && price.name_in_chain !== ''
              ? ` · ${price.name_in_chain}`
              : ''}
          </p>
        </div>

        {/* Precio */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-2">
            {hasDiscount && (
              <span className="text-xs text-ink-faint line-through tabular-nums">
                {formatARS(price.price_list)}
              </span>
            )}
            <span
              className={cn(
                'tabular-nums leading-none',
                isWinner ? 'font-serif text-2xl text-monte-deep' : 'text-lg text-ink'
              )}
            >
              {formatARS(price.price_effective)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasDiscount && discountPct > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-terra text-paper text-[10px] font-mono uppercase tracking-[0.14em] font-semibold">
                −{discountPct}% oferta
              </span>
            )}
            {price.is_promo && !hasDiscount && (
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-terra">
                oferta
              </span>
            )}
            {tiesWinner && (
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-monte-deep">
                empata con el más barato
              </span>
            )}
            {!isWinner && overMin > 0 && (
              <span className="text-[10px] text-ink-faint">
                +{overMin}% vs el más barato
              </span>
            )}
          </div>
        </div>
      </div>

      {price.product_url && (
        <div className="mt-3 pl-12">
          <a
            href={price.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-terra-deep"
          >
            <span>Ver en {price.chain_name}</span>
            <ExternalLink size={11} strokeWidth={1.75} aria-hidden="true" />
          </a>
        </div>
      )}
    </li>
  );
}
