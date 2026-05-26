import { ChainBadge } from './ChainBadge';
import { CoverageBar } from './CoverageBar';
import { ProductThumb } from './ProductThumb';
import { cn } from '@/lib/cn';
import { formatARS, percentDiff, coverageLabel } from '@/lib/format';
import type { CartChainResult } from '@/lib/types';
import { Trophy } from 'lucide-react';

interface Props {
  result: CartChainResult;
  isWinner: boolean;
  // Total de la cadena ganadora — para calcular cuánto te "perdés" eligiendo otra
  winnerTotal: number;
  totalItems: number;
  belowThreshold: boolean; // cobertura < 80%
}

// Fila del ranking de cadenas. Layout horizontal denso pero respirable.
// La ganadora tiene un tratamiento sutil: hairline izquierdo monte + glifo + serif en el total.
// NO usa border-left grueso ni un confetti — es una calidad de tinta + tipografía.
export function RankingRow({ result, isWinner, winnerTotal, totalItems, belowThreshold }: Props) {
  const foundCount = result.items_found.length;
  const missingCount = result.items_missing.length;
  const diffFromWinner = !isWinner && winnerTotal > 0
    ? Math.round(result.covered_total - winnerTotal)
    : 0;
  const diffPct = !isWinner && winnerTotal > 0
    ? percentDiff(winnerTotal, result.covered_total) * -1
    : 0;

  return (
    <article
      className={cn(
        'group relative py-6 px-4 md:px-6 transition-colors rounded-lg',
        // Tratamiento ganadora: hairline ring tintado monte + bg cálido apenas teñido.
        // Nada de side-stripe gruesa: la jerarquía la lleva la tipografía serif del total.
        isWinner && [
          'bg-monte/[0.04]',
          'ring-1 ring-inset ring-monte/30'
        ]
      )}
    >
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8">
        {/* Identidad cadena */}
        <div className="flex items-center gap-3.5">
          <ChainBadge slug={result.chain} variant="wordmark" size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-ink truncate">
                {result.chain_name}
              </h3>
              {isWinner && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-monte-deep"
                  aria-label="mejor opción"
                >
                  <Trophy size={11} strokeWidth={1.75} aria-hidden="true" />
                  Mejor
                </span>
              )}
              {belowThreshold && !isWinner && (
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint"
                  title="Cobertura baja"
                >
                  Cobertura baja
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              {coverageLabel(foundCount, totalItems)}
              {missingCount > 0 && (
                <span className="text-ink-faint"> · faltan {missingCount}</span>
              )}
            </p>
          </div>
        </div>

        {/* Barra de cobertura */}
        <div className="min-w-0 md:px-4">
          <CoverageBar
            found={foundCount}
            missing={missingCount}
            emphasis={isWinner ? 'high' : 'normal'}
          />
        </div>

        {/* Total */}
        <div className="flex flex-col items-start md:items-end">
          <span
            className={cn(
              'tabular-nums',
              isWinner
                ? 'font-serif text-3xl md:text-4xl text-monte-deep'
                : 'text-2xl text-ink',
              'leading-none'
            )}
          >
            {formatARS(result.covered_total)}
          </span>
          {!isWinner && diffFromWinner > 0 && (
            <span className="mt-1.5 text-xs text-ink-soft">
              <span className="font-mono">+{formatARS(diffFromWinner)}</span>
              {diffPct !== 0 && (
                <span className="text-ink-faint"> · {diffPct > 0 ? '+' : ''}{diffPct}%</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Detalle expandible de faltantes (visible al hover/focus, simple) */}
      {missingCount > 0 && (
        <details className="mt-3 group/det">
          <summary
            className={cn(
              'inline-flex items-center gap-1.5 cursor-pointer select-none',
              'text-xs text-ink-soft hover:text-ink',
              'list-none [&::-webkit-details-marker]:hidden'
            )}
          >
            <span className="font-mono uppercase tracking-[0.16em] text-[10px]">
              Ver faltantes
            </span>
            <span aria-hidden="true" className="transition-transform group-open/det:rotate-90">
              ›
            </span>
          </summary>
          <ul className="mt-3 grid gap-2.5 text-sm">
            {result.items_missing.map((m) => (
              <li key={m.ean} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-paper-dim ring-1 ring-paper-deep/60">
                  <ProductThumb src={m.image_url} alt={m.name || m.ean} iconSize={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{m.name || 'Producto sin nombre'}</p>
                  <p className="text-[11px] text-ink-faint font-mono">
                    {m.ean} · ×{m.qty}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
