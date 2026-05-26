import Link from 'next/link';
import { search } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState } from '@/components/EmptyState';
import { SearchX, AlertTriangle } from 'lucide-react';

interface Props {
  q: string;
  ean: string;
  offset: number;
}

const PAGE_SIZE = 20;

// Server component que pega al backend y renderiza la lista.
export async function SearchResults({ q, ean, offset }: Props) {
  let data;
  try {
    data = await search(
      { q: q || undefined, ean: ean || undefined, limit: PAGE_SIZE, offset },
      undefined,
      { cache: 'no-store' }
    );
  } catch (err) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No pudimos traer los resultados"
        description="El servicio de precios está fallando ahora. Probá de nuevo en un ratito."
      />
    );
  }

  const { total, results } = data;

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos nada con eso"
        description={`Probá con otras palabras, una marca distinta o el código de barras del envase. ${
          q ? `Buscamos: «${q}»` : ''
        }`}
        action={
          <Link
            href="/buscar"
            className="inline-flex items-center gap-2 text-sm text-terra-deep hover:text-terra font-medium"
          >
            Limpiar y empezar de nuevo
          </Link>
        }
      />
    );
  }

  const showingFrom = offset + 1;
  const showingTo = Math.min(offset + results.length, total);
  const hasMore = offset + results.length < total;
  const hasPrev = offset > 0;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-paper-deep/70">
        <p className="text-sm text-ink-soft">
          <span className="font-mono tabular-nums text-ink">{showingFrom}</span>
          <span className="text-ink-faint"> – </span>
          <span className="font-mono tabular-nums text-ink">{showingTo}</span>
          <span className="text-ink-faint"> de </span>
          <span className="font-mono tabular-nums text-ink">{total.toLocaleString('es-AR')}</span>
          <span className="text-ink-faint"> {total === 1 ? 'producto' : 'productos'}</span>
        </p>
      </div>

      <ol className="divide-y divide-paper-deep/70">
        {results.map((item) => (
          <li key={item.ean}>
            <ProductCard item={item} />
          </li>
        ))}
      </ol>

      {(hasPrev || hasMore) && (
        <nav
          className="mt-10 flex items-center justify-between"
          aria-label="Paginación de resultados"
        >
          {hasPrev ? (
            <Link
              href={buildHref(q, ean, Math.max(0, offset - PAGE_SIZE))}
              className="btn-ghost"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link
              href={buildHref(q, ean, offset + PAGE_SIZE)}
              className="btn-ghost"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="text-xs text-ink-faint">No hay más resultados.</span>
          )}
        </nav>
      )}
    </section>
  );
}

function buildHref(q: string, ean: string, offset: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (ean) params.set('ean', ean);
  if (offset > 0) params.set('offset', String(offset));
  return `/buscar?${params.toString()}`;
}
