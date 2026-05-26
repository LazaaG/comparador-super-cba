import { cn } from '@/lib/cn';

interface Props {
  found: number;
  missing: number;
  emphasis?: 'high' | 'normal'; // high = cadena ganadora, usa monte
  className?: string;
}

// Barra segmentada por ítem (no porcentaje plano).
// Cada ítem cubierto pinta un segmento; los faltantes quedan como hueco.
// Para >40 items, agrupamos para no ahogar la barra.
export function CoverageBar({ found, missing, emphasis = 'normal', className }: Props) {
  const total = found + missing;
  if (total === 0) return null;

  const segments = total <= 40 ? total : 40;
  // Si excedimos, redistribuimos manteniendo proporción visual
  const foundSegs = Math.round((found / total) * segments);
  const missingSegs = segments - foundSegs;

  const fillColor = emphasis === 'high' ? 'bg-monte' : 'bg-terra';
  const emptyColor = 'bg-paper-deep';

  return (
    <div
      className={cn('flex items-center gap-[2px] h-1.5 w-full', className)}
      role="img"
      aria-label={`${found} de ${total} productos cubiertos`}
    >
      {Array.from({ length: foundSegs }).map((_, i) => (
        <span
          key={`f-${i}`}
          className={cn('flex-1 h-full rounded-[1px]', fillColor)}
          style={{
            // Stagger suave en aparición — micro-detalle, casi imperceptible
            animation: 'fade-up 240ms cubic-bezier(0.23, 1, 0.32, 1) both',
            animationDelay: `${Math.min(i * 8, 240)}ms`
          }}
        />
      ))}
      {Array.from({ length: missingSegs }).map((_, i) => (
        <span
          key={`m-${i}`}
          className={cn('flex-1 h-full rounded-[1px]', emptyColor)}
        />
      ))}
    </div>
  );
}
