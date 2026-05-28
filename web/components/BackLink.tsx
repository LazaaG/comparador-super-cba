'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Props {
  /** Fallback si no hay historial (entrada directa por URL). */
  fallbackHref?: string;
  label?: string;
}

/**
 * "Volver" que usa el historial del browser (router.back) para devolver a la
 * búsqueda exacta donde estaba el usuario, con su query y scroll. Si no hay
 * historial (entró directo por URL compartida), cae al fallbackHref.
 */
export function BackLink({ fallbackHref = '/buscar', label = 'Volver a la búsqueda' }: Props) {
  const router = useRouter();

  const handleBack = () => {
    // Si hay historial previo dentro del sitio, volver; sino ir al fallback.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink mb-8"
    >
      <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );
}
