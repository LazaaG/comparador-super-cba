import { cn } from '@/lib/cn';

interface Props {
  className?: string;
}

// Skeleton primitivo que matchea el layout final, no spinner genérico.
// Usa el shimmer-warm definido en globals.css (paleta papel).
export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn('shimmer-warm rounded-md', className)}
      aria-hidden="true"
    />
  );
}

// Skeleton específico para una fila de resultado de búsqueda. Matchea ProductCard.
export function ProductCardSkeleton() {
  return (
    <div className="grid gap-4 py-5 px-2 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4 max-w-sm" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-7 w-24" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

// Lista de skeletons para /buscar
export function ProductListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-paper-deep/70">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
