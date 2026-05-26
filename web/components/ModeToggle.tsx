'use client';

import type { CartCompareMode } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Props {
  value: CartCompareMode;
  onChange: (mode: CartCompareMode) => void;
}

// Toggle de modo de comparación: "mejor esfuerzo" vs "solo cadenas completas".
// Segmented control que matchea el resto del UI (no checkboxes sueltos).
export function ModeToggle({ value, onChange }: Props) {
  const options: { value: CartCompareMode; label: string; hint: string }[] = [
    {
      value: 'best_effort',
      label: 'Mejor esfuerzo',
      hint: 'Rankea todas las cadenas, marcando faltantes'
    },
    {
      value: 'complete_only',
      label: 'Solo completas',
      hint: 'Solo cadenas con el 100% del carrito'
    }
  ];

  return (
    <div className="inline-flex flex-col gap-2">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
        Modo de comparación
      </span>
      <div
        role="radiogroup"
        aria-label="Modo de comparación del carrito"
        className="inline-flex p-1 rounded-md bg-paper-dim border border-paper-deep/70"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              type="button"
              onClick={() => onChange(opt.value)}
              title={opt.hint}
              className={cn(
                'px-3.5 py-1.5 rounded text-sm font-medium transition-colors',
                active
                  ? 'bg-paper text-ink shadow-paper-sm'
                  : 'text-ink-soft hover:text-ink'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
