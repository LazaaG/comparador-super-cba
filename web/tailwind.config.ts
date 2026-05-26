import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies — papel cálido, sesgado a terracota
        paper: {
          DEFAULT: '#F5F1EA',
          dim: '#EDE6DA',
          deep: '#E3DACA'
        },
        // Tinta — gris cálido casi negro
        ink: {
          DEFAULT: '#1F1A14',
          soft: '#5C544A',
          faint: '#8A8278'
        },
        // Acento principal — terracota cordobesa
        terra: {
          DEFAULT: '#B5572E',
          deep: '#8E3E1F',
          soft: '#D08560'
        },
        // Acento ganador — verde-musgo serrano. SOLO en cadena ganadora.
        monte: {
          DEFAULT: '#5C7A4F',
          deep: '#3F5536',
          soft: '#8AA17F'
        },
        // Estado de alerta
        alerta: '#A8421F'
      },
      fontFamily: {
        // Serif editorial — Fraunces, no Inter-clone
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        // Sans utilitaria — Geist
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        // Mono para EAN, timestamps, código
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        // Escala fija, ratio ~1.2 para UI densa
        'xs': ['0.75rem', { lineHeight: '1.1rem', letterSpacing: '0.01em' }],
        'sm': ['0.875rem', { lineHeight: '1.3rem' }],
        'base': ['1rem', { lineHeight: '1.55rem' }],
        'lg': ['1.125rem', { lineHeight: '1.65rem' }],
        'xl': ['1.375rem', { lineHeight: '1.85rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem', letterSpacing: '-0.01em' }],
        '3xl': ['2.25rem', { lineHeight: '2.55rem', letterSpacing: '-0.015em' }],
        '4xl': ['3rem', { lineHeight: '3.15rem', letterSpacing: '-0.02em' }],
        '5xl': ['4rem', { lineHeight: '4.1rem', letterSpacing: '-0.025em' }]
      },
      spacing: {
        // Rítmica de spacing, no 4px-grid plano
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem'
      },
      maxWidth: {
        prose: '65ch',
        content: '90rem'  // 1440px — aprovecha viewports modernos sin estirar líneas de texto
      },
      borderRadius: {
        // Squircles más suaves, no rounded-lg por defecto
        'sm': '0.25rem',
        DEFAULT: '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem'
      },
      boxShadow: {
        // Sombras tintadas al hue del papel, no negro puro
        'paper-sm': '0 1px 2px rgba(58, 42, 26, 0.04)',
        'paper': '0 2px 8px rgba(58, 42, 26, 0.06), 0 1px 2px rgba(58, 42, 26, 0.04)',
        'paper-lg': '0 8px 24px rgba(58, 42, 26, 0.08), 0 2px 6px rgba(58, 42, 26, 0.05)',
        'inset-hairline': 'inset 0 0 0 1px rgba(31, 26, 20, 0.06)'
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)'
      },
      keyframes: {
        'count-pulse': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.22)' },
          '100%': { transform: 'scale(1)' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'shimmer-warm': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        'count-pulse': 'count-pulse 360ms cubic-bezier(0.23, 1, 0.32, 1)',
        'fade-up': 'fade-up 280ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'shimmer-warm': 'shimmer-warm 1.6s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
