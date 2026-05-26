// Footer breve, no corporativo. Tono local pero serio.
export function Footer() {
  return (
    <footer className="mt-30 border-t border-paper-deep/70">
      <div className="mx-auto max-w-content px-6 md:px-8 py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="max-w-prose">
          <p className="font-serif text-base text-ink leading-snug">
            Datos de catálogos públicos de cada cadena, relevados a diario.
          </p>
          <p className="mt-2 text-sm text-ink-soft leading-relaxed">
            Los precios pueden variar entre sucursales. Mostramos los relevados online
            para la región de Córdoba capital.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono uppercase tracking-[0.18em] text-ink-faint">
          <span>v0.1 · MVP</span>
          <span aria-hidden="true">·</span>
          <span>hecho en Córdoba</span>
        </div>
      </div>
    </footer>
  );
}
