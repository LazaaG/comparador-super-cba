import { chainIdentity } from '@/lib/chains';
import { cn } from '@/lib/cn';

interface Props {
  slug: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  // mini → círculo con inicial (legacy, sólo si se pide explícito);
  // wordmark → logo en su forma original (rectangular, SVG/JPG según cadena);
  // square → logo recortado/encajado en un cuadradito uniforme con fondo neutro
  variant?: 'mini' | 'wordmark' | 'square';
  showName?: boolean;
  className?: string;
}

// Extensión de cada logo en /public/logos/. Cencosud + Carrefour son SVG vectorial;
// Dino, MAMI y ChangoMas vienen de fuentes JPG.
const LOGO_EXT: Record<string, string> = {
  disco: 'svg',
  jumbo: 'svg',
  vea: 'svg',
  carrefour: 'svg',
  dino: 'jpg',
  mami: 'jpg',
  changomas: 'jpg'
};

function logoPath(slug: string): string {
  return `/logos/${slug}.${LOGO_EXT[slug] ?? 'svg'}`;
}

export function ChainBadge({
  slug,
  name,
  size = 'md',
  variant = 'square',
  showName = false,
  className
}: Props) {
  const id = chainIdentity(slug);
  const label = name || id.name;

  // SQUARE = chip uniforme para listas densas. Cubre todos los logos sin sesgo
  // de aspect ratio. Reemplaza al "mini" circular en la mayoría de los sitios.
  if (variant === 'square') {
    const dims = {
      sm: 'h-7 w-7',
      md: 'h-9 w-9',
      lg: 'h-12 w-12'
    }[size];
    return (
      <span className={cn('inline-flex items-center gap-2', className)} title={label}>
        <span
          className={cn(
            dims,
            'inline-flex shrink-0 items-center justify-center rounded-md',
            'bg-white ring-1 ring-paper-deep/70 overflow-hidden'
          )}
          aria-label={label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoPath(slug)}
            alt={label}
            className="h-[78%] w-[78%] object-contain select-none"
            draggable={false}
          />
        </span>
        {showName && (
          <span className="text-sm font-medium text-ink">{label}</span>
        )}
      </span>
    );
  }

  // WORDMARK = el logo extendido (mantiene aspect ratio original).
  if (variant === 'wordmark') {
    const heights = { sm: 'h-6', md: 'h-8', lg: 'h-12' }[size];
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoPath(slug)}
          alt={label}
          className={cn(heights, 'w-auto max-w-[140px] object-contain select-none')}
          draggable={false}
        />
        {showName && (
          <span className="text-sm font-medium text-ink">{label}</span>
        )}
      </span>
    );
  }

  // MINI = circle con inicial (legacy). Sólo para casos muy densos.
  const dimensions = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-11 w-11 text-base'
  }[size];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-mono font-semibold',
          'ring-1 ring-inset',
          dimensions
        )}
        style={{
          backgroundColor: id.bg,
          color: id.fg,
          boxShadow: `inset 0 0 0 1px ${id.ring}`
        }}
        aria-hidden="true"
      >
        {id.initial}
      </span>
      {showName && (
        <span className="text-sm font-medium text-ink">{label}</span>
      )}
    </span>
  );
}
