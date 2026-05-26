import { Suspense } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SearchResults } from './SearchResults';
import { ProductListSkeleton } from '@/components/Skeleton';

interface PageProps {
  searchParams: { q?: string; ean?: string; offset?: string };
}

// Página de búsqueda. Server component que toma searchParams y prefetcha
// via /search del backend. La sub-section SearchResults es la que renderiza
// la lista; se renderiza dentro de un Suspense para mostrar skeleton mientras llega.
export default function BuscarPage({ searchParams }: PageProps) {
  const q = (searchParams.q || '').trim();
  const ean = (searchParams.ean || '').trim();
  const offset = parseInt(searchParams.offset || '0', 10) || 0;
  const hasQuery = q.length > 0 || ean.length > 0;

  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
      {/* Header de página + barra grande */}
      <header className="mb-10">
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
          Búsqueda
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-7 leading-tight">
          ¿Qué estás buscando?
        </h1>
        <Suspense fallback={<div className="h-14 rounded-md bg-paper-dim animate-pulse" />}>
          <SearchBar defaultValue={q} autoFocus={!hasQuery} size="lg" />
        </Suspense>
      </header>

      {hasQuery ? (
        <Suspense fallback={<ProductListSkeleton count={6} />} key={`${q}-${ean}-${offset}`}>
          <SearchResults q={q} ean={ean} offset={offset} />
        </Suspense>
      ) : (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-soft">
            Escribí un producto, marca o código de barras y te traemos los precios.
          </p>
        </div>
      )}
    </div>
  );
}
