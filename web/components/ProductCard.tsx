import Link from 'next/link';
import type { SearchResultItem } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatARS, formatUnit, percentDiff } from '@/lib/format';
import { ChainBadge } from './ChainBadge';
import { AddToCartButton } from './AddToCartButton';
import { ProductThumb } from './ProductThumb';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  item: SearchResultItem;
}

// Fila de resultado de búsqueda. Layout horizontal:
// [thumb] [info producto] ........ [precio mín + cadena ganadora] [resto cadenas pill] [agregar]
export function ProductCard({ item }: Props) {
  const cheapest = item.prices.find((p) => p.chain === item.cheapest_chain) || item.prices[0];
  const others = item.prices.filter((p) => p.chain !== cheapest?.chain).slice(0, 4);
  const maxPrice = item.prices.reduce((m, p) => Math.max(m, p.price_effective), 0);
  const savingsPct = cheapest && maxPrice > cheapest.price_effective
    ? percentDiff(maxPrice, cheapest.price_effective)
    : 0;
  const unitText = formatUnit(item.unit_value, item.unit_kind);

  // ¿La cadena más barata tiene además descuento directo (price_eff < price_list)?
  const cheapestHasDiscount = cheapest
    ? cheapest.price_effective < cheapest.price_list
    : false;
  const cheapestDiscountPct = cheapestHasDiscount && cheapest
    ? Math.round(((cheapest.price_list - cheapest.price_effective) / cheapest.price_list) * 100)
    : 0;

  return (
    <article
      className={cn(
        'group relative grid gap-4 py-5 px-2 items-center',
        'md:grid-cols-[64px_minmax(0,1fr)_auto_auto] md:gap-6',
        'hover:bg-paper-dim/60 rounded-lg -mx-2 transition-colors'
      )}
    >
      {/* Thumb (con badge de oferta arriba si aplica) */}
      <div className="relative h-16 w-16 shrink-0">
        <div className="h-full w-full rounded-md overflow-hidden bg-paper-dim ring-1 ring-paper-deep/60">
          <ProductThumb src={item.image_url} alt={item.name} />
        </div>
        {cheapestHasDiscount && cheapestDiscountPct > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-terra text-paper text-[9px] font-mono font-bold tabular-nums shadow-sm"
            title="Oferta en la cadena más barata"
          >
            −{cheapestDiscountPct}%
          </span>
        )}
      </div>

      {/* Info producto */}
      <div className="min-w-0">
        <Link
          href={`/producto/${item.ean}`}
          className="group/link inline-flex items-baseline gap-2 max-w-full"
        >
          <h3 className="text-base font-medium text-ink leading-snug truncate group-hover/link:text-terra-deep">
            {item.name}
          </h3>
          <ArrowUpRight
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-ink-faint opacity-0 group-hover/link:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {item.brand && <span className="font-medium">{item.brand}</span>}
          {unitText && (
            <>
              <span aria-hidden="true" className="text-paper-deep">·</span>
              <span>{unitText}</span>
            </>
          )}
          <span aria-hidden="true" className="text-paper-deep">·</span>
          <span className="font-mono text-[11px] text-ink-faint">{item.ean}</span>
        </div>
      </div>

      {/* Precio mínimo + cadenas comparadas */}
      <div className="flex flex-col items-start md:items-end gap-1.5">
        {cheapest ? (
          <>
            <div className="flex items-center gap-2.5">
              <ChainBadge slug={cheapest.chain} variant="wordmark" size="sm" />
              <div className="flex items-baseline gap-2">
                {cheapestHasDiscount && (
                  <span className="text-xs text-ink-faint line-through tabular-nums">
                    {formatARS(cheapest.price_list)}
                  </span>
                )}
                <span className="text-xl font-medium text-monte-deep tabular-nums">
                  {formatARS(cheapest.price_effective)}
                </span>
              </div>
            </div>
            {savingsPct >= 5 && (
              <span className="text-[11px] text-ink-soft">
                {savingsPct}% más barato que {formatARS(maxPrice)}
              </span>
            )}
            {others.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
                {others.map((p) => (
                  <ChainBadge key={p.chain} slug={p.chain} variant="square" size="sm" />
                ))}
                {item.prices.length > others.length + 1 && (
                  <span className="text-[11px] text-ink-faint ml-0.5">
                    +{item.prices.length - others.length - 1}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm text-ink-faint italic">Sin precio reciente</span>
        )}
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <AddToCartButton
          ean={item.ean}
          name={item.name}
          brand={item.brand}
          compact={false}
          fromPage="buscar"
        />
      </div>
    </article>
  );
}
