import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Providers from './providers';
import './globals.css';

// Fraunces: serif editorial con eje SOFT y opticalsize variable. Para H1 + precios totales.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
  preload: true
});

// Inter: utilitaria de UI.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true
});

// JetBrains Mono para EAN, timestamps y datos crudos.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false
});

export const metadata: Metadata = {
  title: 'mejor súper · Córdoba',
  description:
    'Compará precios de supermercados de Córdoba. Armá tu carrito y descubrí dónde te sale más barato comprarlo todo junto.',
  applicationName: 'mejor súper',
  authors: [{ name: 'Lazaro Gonzalez' }],
  keywords: ['supermercado', 'precios', 'Córdoba', 'comparador', 'Argentina']
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F1EA'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-AR"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-[100dvh] flex flex-col antialiased">
        <Providers>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
