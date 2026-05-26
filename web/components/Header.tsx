import Link from 'next/link';
import { CartIndicator } from './CartIndicator';

// Header de toda la app. No es sticky pegado al borde — flota con un breath top.
// Tipografía del wordmark: serif, peso semi, optical-sizing del Fraunces.
export function Header() {
  return (
    <header className="w-full border-b border-paper-deep/70">
      <div className="mx-auto max-w-content px-6 md:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-baseline gap-2.5"
            aria-label="Mejor súper — inicio"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-[2px] bg-terra rotate-12 group-hover:rotate-45 transition-transform duration-300 ease-out-quart"
            />
            <span className="font-serif text-xl font-medium tracking-tight text-ink">
              mejor súper
            </span>
            <span className="hidden sm:inline text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
              Córdoba
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/buscar"
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink rounded-md hover:bg-paper-dim"
            >
              Buscar
            </Link>
            <Link
              href="/comparar"
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink rounded-md hover:bg-paper-dim"
            >
              Comparar
            </Link>
            <CartIndicator />
          </nav>
        </div>
      </div>
    </header>
  );
}
