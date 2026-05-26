// Mapeo cadena → identidad visual (color + inicial + nombre legible).
// No reproduce logos; usa una letra inicial sobre fondo tintado.
// Paleta sobria, tintada a la cosmovisión cordobesa (tierras, oliva, ladrillo).

export interface ChainIdentity {
  slug: string;
  name: string;
  initial: string;
  // bg y fg en hex; calculados para contraste AA con su fg
  bg: string;
  fg: string;
  // borde de hairline cuando se renderiza badge sobre superficie clara
  ring: string;
}

const REGISTRY: Record<string, ChainIdentity> = {
  disco: {
    slug: 'disco',
    name: 'Disco',
    initial: 'D',
    bg: '#8B3A2E',
    fg: '#F5F1EA',
    ring: 'rgba(139, 58, 46, 0.18)'
  },
  jumbo: {
    slug: 'jumbo',
    name: 'Jumbo',
    initial: 'J',
    bg: '#3F5536',
    fg: '#F5F1EA',
    ring: 'rgba(63, 85, 54, 0.18)'
  },
  vea: {
    slug: 'vea',
    name: 'Vea',
    initial: 'V',
    bg: '#C2762E',
    fg: '#1F1A14',
    ring: 'rgba(194, 118, 46, 0.18)'
  },
  changomas: {
    slug: 'changomas',
    name: 'ChangoMas',
    initial: 'C',
    bg: '#7A5E3A',
    fg: '#F5F1EA',
    ring: 'rgba(122, 94, 58, 0.18)'
  },
  dino: {
    slug: 'dino',
    name: 'Dino',
    initial: 'D',
    bg: '#465B4A',
    fg: '#F5F1EA',
    ring: 'rgba(70, 91, 74, 0.2)'
  },
  mami: {
    slug: 'mami',
    name: 'Super MAMI',
    initial: 'M',
    bg: '#9E4A47',
    fg: '#F5F1EA',
    ring: 'rgba(158, 74, 71, 0.18)'
  },
  carrefour: {
    slug: 'carrefour',
    name: 'Carrefour',
    initial: 'C',
    bg: '#1F4F8B',
    fg: '#F5F1EA',
    ring: 'rgba(31, 79, 139, 0.2)'
  }
};

const FALLBACK: ChainIdentity = {
  slug: 'unknown',
  name: 'Cadena',
  initial: '?',
  bg: '#8A8278',
  fg: '#F5F1EA',
  ring: 'rgba(138, 130, 120, 0.2)'
};

export function chainIdentity(slug: string): ChainIdentity {
  return REGISTRY[slug.toLowerCase()] || { ...FALLBACK, slug, name: slug };
}

export function allChainSlugs(): string[] {
  return Object.keys(REGISTRY);
}
