import { ProductListSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-10 pb-24">
      <header className="mb-10">
        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-3">
          Búsqueda
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-7 leading-tight">
          Bancá un toque…
        </h1>
        <div className="h-14 w-full shimmer-warm rounded-xl" />
      </header>
      <ProductListSkeleton count={8} />
    </div>
  );
}
