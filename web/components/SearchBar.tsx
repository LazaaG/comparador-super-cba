'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  defaultValue?: string;
  autoFocus?: boolean;
  size?: 'md' | 'lg';
  // Si se pasa, dispara onChange con debounce. Si no, navega a /buscar?q=...
  onDebouncedChange?: (q: string) => void;
}

// Barra de búsqueda con debounce 280ms.
// - En home: navega a /buscar?q= al submit (modo "ir a la página").
// - En /buscar: actualiza la query string en tiempo real con debounce, sin recargar.
export function SearchBar({
  defaultValue = '',
  autoFocus = false,
  size = 'md',
  onDebouncedChange
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!onDebouncedChange) return;
    debounceRef.current = setTimeout(() => {
      onDebouncedChange(value.trim());
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onDebouncedChange]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('q', trimmed);
    params.delete('offset');
    router.push(`/buscar?${params.toString()}`);
  };

  const clear = () => {
    setValue('');
    inputRef.current?.focus();
    if (onDebouncedChange) onDebouncedChange('');
  };

  const sizing = {
    md: 'h-12 text-base pl-12 pr-12',
    lg: 'h-14 text-lg pl-14 pr-14'
  }[size];

  const iconSize = size === 'lg' ? 20 : 18;
  const iconLeft = size === 'lg' ? 'left-5' : 'left-4';
  const iconRight = size === 'lg' ? 'right-4' : 'right-3';

  return (
    <form onSubmit={handleSubmit} role="search" className="relative w-full">
      <Search
        size={iconSize}
        strokeWidth={1.75}
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-faint',
          iconLeft
        )}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        // El attribute "name" permite usar la barra como form clásico también
        name="q"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscá un producto, marca o EAN…"
        // Importante: type="search" sin appearance nativo
        className={cn(
          'w-full rounded-xl bg-paper border border-paper-deep',
          'text-ink placeholder:text-ink-faint',
          'focus:border-terra focus:outline-none',
          'shadow-paper-sm',
          sizing
        )}
        autoComplete="off"
        spellCheck="false"
        aria-label="Buscar producto"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpiar búsqueda"
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            'inline-flex items-center justify-center',
            'h-8 w-8 rounded-md text-ink-soft hover:text-ink hover:bg-paper-dim',
            iconRight
          )}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
