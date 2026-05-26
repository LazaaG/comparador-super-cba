// Formateo localizado a es-AR.
// Reglas:
// - Precios sin decimales si el valor es entero o termina en .00 ($2.890).
// - Si tiene decimales reales, mostrar con coma argentina ($2.890,50).
// - Separador de miles: punto.

export function formatARS(value: number, opts?: { showCurrency?: boolean }): string {
  const showCurrency = opts?.showCurrency !== false;
  const hasCents = Math.round(value * 100) % 100 !== 0;

  const fmt = new Intl.NumberFormat('es-AR', {
    style: 'decimal',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  });

  const body = fmt.format(value);
  return showCurrency ? `$${body}` : body;
}

// Diferencia porcentual entre precios — "20% más barato que en X"
export function percentDiff(reference: number, comparand: number): number {
  if (reference <= 0) return 0;
  return Math.round(((reference - comparand) / reference) * 100);
}

// Formato corto para mostrar la unidad del producto: "1,5 L" / "500 g"
export function formatUnit(value: number | null, kind: string | null): string | null {
  if (value == null || kind == null) return null;
  const num = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2
  }).format(value);
  return `${num} ${kind}`;
}

// Tiempo relativo cordial para el "relevado hace..."
export function relativeTimeES(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} días`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 4) return `hace ${diffWk} sem`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

// Pluralización al uso argentino
export function pluralES(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

// Texto de cobertura humano: "5 de 7 productos"
export function coverageLabel(found: number, total: number): string {
  return `${found} de ${total} ${pluralES(total, 'producto', 'productos')}`;
}
