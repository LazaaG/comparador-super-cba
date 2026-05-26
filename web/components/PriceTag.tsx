import { cn } from '@/lib/cn';
import { formatARS } from '@/lib/format';

interface Props {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'cheapest' | 'muted';
  isPromo?: boolean;
  strikethrough?: boolean;
  className?: string;
}

// Numerales del comparador. La cadena ganadora usa color monte (verde serrano),
// el resto va en tinta principal. Promo se marca con un pequeño glyph, no con un
// pill amarillo de cupón.
export function PriceTag({
  value,
  size = 'md',
  variant = 'default',
  isPromo = false,
  strikethrough = false,
  className
}: Props) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl md:text-5xl font-serif'
  }[size];

  const variantClass = {
    default: 'text-ink',
    cheapest: 'text-monte-deep',
    muted: 'text-ink-faint'
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 tabular-nums',
        sizes,
        variantClass,
        strikethrough && 'line-through opacity-60',
        className
      )}
    >
      <span>{formatARS(value)}</span>
      {isPromo && !strikethrough && (
        <span
          className="text-[10px] font-mono uppercase tracking-[0.18em] text-terra"
          aria-label="precio en oferta"
        >
          oferta
        </span>
      )}
    </span>
  );
}
