import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { ChainBadge } from '@/components/ChainBadge';
import { allChainSlugs, chainIdentity } from '@/lib/chains';
import { ArrowRight, ShoppingBasket } from 'lucide-react';

// HOME — Dos puertas paralelas, peso visual equivalente.
// Layout asimétrico (60/40) con título a la izquierda en serif y bloque utilitario
// a la derecha. Nada de hero centrado + CTA único.
export default function HomePage() {
  const chains = allChainSlugs();

  return (
    <div className="mx-auto max-w-content px-6 md:px-8">
      {/* ---------- HERO ---------- */}
      <section className="pt-16 md:pt-24 pb-12 md:pb-20">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16 items-end">
          {/* Columna izquierda: tipografía editorial */}
          <div className="md:col-span-7">
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-ink-soft mb-5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terra" aria-hidden="true" />
              Comparador de carritos · Córdoba
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] tracking-tight text-ink">
              Saber dónde te sale <em className="not-italic text-terra-deep">más barato</em>{' '}
              comprar todo,
              <br />
              <span className="text-ink-soft">sin recorrer media ciudad.</span>
            </h1>
            <p className="mt-6 max-w-prose text-base md:text-lg text-ink-soft leading-relaxed">
              Releva los precios de los principales supermercados online a diario.
              Buscá un producto puntual o armá tu lista de compras y te decimos
              en qué cadena conviene comprarla.
            </p>
          </div>

          {/* Columna derecha: identidad de cadenas relevadas */}
          <aside className="md:col-span-5 md:pl-6 md:border-l md:border-paper-deep/70">
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-faint mb-5">
              Relevamos
            </p>
            <ul className="space-y-3.5">
              {chains.map((slug) => {
                const id = chainIdentity(slug);
                return (
                  <li key={slug} className="flex items-center gap-3">
                    <ChainBadge slug={slug} size="md" />
                    <span className="text-sm text-ink">{id.name}</span>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </section>

      {/* ---------- DOS PUERTAS ---------- */}
      <section className="pb-24" aria-labelledby="acciones">
        <h2 id="acciones" className="sr-only">
          Acciones principales
        </h2>

        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {/* Puerta 1: buscar producto */}
          <article className="group relative rounded-xl bg-paper border border-paper-deep p-7 md:p-8 hover:border-terra/40 transition-colors">
            <div className="flex items-start justify-between mb-6">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-soft">
                01 · Producto puntual
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper-dim text-ink-soft">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <circle cx="5" cy="5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
                  <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <h3 className="font-serif text-2xl md:text-3xl text-ink leading-tight">
              Buscar un producto
            </h3>
            <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-prose">
              Por nombre, marca o código de barras. Te mostramos todas las cadenas
              que lo tienen y dónde es más barato hoy.
            </p>
            <div className="mt-7">
              <Suspense fallback={<div className="h-12 rounded-md bg-paper-dim animate-pulse" />}>
                <SearchBar size="md" />
              </Suspense>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>Probá con:</span>
              {['leche la serenísima', 'fideos matarazzo', 'yerba taragüi'].map((sug) => (
                <Link
                  key={sug}
                  href={`/buscar?q=${encodeURIComponent(sug)}`}
                  className="px-2.5 py-1 rounded-full bg-paper-dim text-ink-soft hover:bg-paper-deep hover:text-ink"
                >
                  {sug}
                </Link>
              ))}
            </div>
          </article>

          {/* Puerta 2: armar carrito */}
          <article className="group relative rounded-xl bg-ink text-paper p-7 md:p-8 hover:bg-ink/95 transition-colors overflow-hidden">
            {/* Detalle textural: hairline diagonal sutil, NO un patrón ruidoso */}
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, transparent 0 12px, currentColor 12px 13px)'
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-paper/60">
                  02 · Carrito comparado
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper/10 text-paper">
                  <ShoppingBasket size={14} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </div>
              <h3 className="font-serif text-2xl md:text-3xl leading-tight">
                Armar mi lista
              </h3>
              <p className="mt-3 text-sm text-paper/75 leading-relaxed max-w-prose">
                Esta es la función estrella. Agregás los productos de tu compra
                semanal y te rankeamos las cadenas por el costo total del carrito.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/buscar"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-paper text-ink px-5 py-3 text-sm font-medium hover:bg-paper-dim"
                >
                  Empezar mi lista
                  <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                </Link>
                <Link
                  href="/carrito"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-paper/0 text-paper px-5 py-3 text-sm font-medium border border-paper/20 hover:bg-paper/10"
                >
                  Ver mi carrito
                </Link>
              </div>
              <p className="mt-6 text-xs text-paper/55 leading-relaxed">
                Tu lista queda guardada en este navegador. No pedimos cuenta ni email.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* ---------- COMO FUNCIONA (breve, no inflado) ---------- */}
      <section className="pb-24" aria-labelledby="como">
        <div className="grid gap-10 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-4">
            <h2 id="como" className="font-serif text-2xl md:text-3xl text-ink leading-tight">
              Sin trucos.
            </h2>
            <p className="mt-3 text-sm text-ink-soft leading-relaxed">
              Los precios salen de los catálogos online públicos de cada cadena. Se
              relevan automáticamente todos los días.
            </p>
          </div>
          <ol className="md:col-span-8 grid gap-px bg-paper-deep/60 rounded-lg overflow-hidden">
            {[
              {
                num: '01',
                title: 'Releve diario',
                body: 'Cada noche se consultan los catálogos online de las cadenas en sus URLs públicas.'
              },
              {
                num: '02',
                title: 'Match por código de barras',
                body: 'Los productos se cruzan por EAN: aunque cada cadena los nombre distinto, sabemos que son el mismo ítem.'
              },
              {
                num: '03',
                title: 'Total real del carrito',
                body: 'Sumamos tu lista en cada cadena al precio efectivo (oferta incluida). El ranking sale derecho.'
              }
            ].map((step) => (
              <li key={step.num} className="bg-paper p-6 md:p-8">
                <div className="flex items-start gap-5">
                  <span className="font-mono text-xs text-ink-faint mt-1">{step.num}</span>
                  <div>
                    <h3 className="font-medium text-ink">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-soft leading-relaxed max-w-prose">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
