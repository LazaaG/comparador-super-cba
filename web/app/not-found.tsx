import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-6 md:px-8 pt-20 pb-24">
      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-4">
        Error 404
      </p>
      <h1 className="font-serif text-4xl md:text-5xl text-ink leading-tight max-w-2xl">
        Ese producto no lo tenemos.
      </h1>
      <p className="mt-5 max-w-prose text-base text-ink-soft leading-relaxed">
        O nunca lo relevamos, o el código que buscás no existe en las cadenas
        que cubrimos por ahora. Probá con otra búsqueda.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/buscar"
          className="inline-flex items-center rounded-md bg-ink text-paper px-5 py-3 text-sm font-medium hover:bg-terra-deep transition-colors"
        >
          Volver a buscar
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-paper-deep px-5 py-3 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
