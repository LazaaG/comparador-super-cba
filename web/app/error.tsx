'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // En dev: console. En prod ya enchufarías Sentry o similar.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-20 pb-24">
      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-alerta mb-4">
        Algo se rompió
      </p>
      <h1 className="font-serif text-4xl text-ink leading-tight max-w-2xl">
        Se nos colgó la consulta.
      </h1>
      <p className="mt-5 max-w-prose text-base text-ink-soft leading-relaxed">
        Pasa: o el backend está caído, o algo nuestro falló. Apretá reintentar.
        Si insiste, dejá pasar un par de minutos.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md bg-ink text-paper px-5 py-3 text-sm font-medium hover:bg-terra-deep"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-paper-deep px-5 py-3 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          Ir al inicio
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-[11px] text-ink-faint">id: {error.digest}</p>
      )}
    </div>
  );
}
