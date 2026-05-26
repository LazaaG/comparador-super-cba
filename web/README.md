# mejor súper · web

Frontend Next.js 14 del comparador de carritos de supermercados (Córdoba, AR).
Consume el backend FastAPI que vive en la raíz del repo.

## Setup local

```bash
cd web
pnpm install        # o npm install / yarn

cp .env.local.example .env.local
# editá .env.local si tu backend corre en otro puerto

pnpm dev
```

El backend debe estar corriendo aparte:

```bash
# desde la raíz del repo
uvicorn api.main:app --reload --port 8000
```

Abrir http://localhost:3000.

## Estructura

```
app/
  layout.tsx                 # shell global: header, footer, providers
  page.tsx                   # home — dos puertas (buscar / armar carrito)
  buscar/                    # listado con paginación + skeleton loading
  producto/[ean]/            # detalle de un producto con precios por cadena
  carrito/                   # lista local (zustand persistido en localStorage)
  comparar/                  # POST /cart/compare + ranking visual
  api/                       # route handlers de proxy al FastAPI
components/                  # ChainBadge, PriceTag, CoverageBar, etc.
lib/                         # api client, types, format (es-AR), cn util
store/cart.ts                # zustand + persist
__tests__/                   # vitest
```

## Diseño

- Paleta: papel cálido (`#F5F1EA`), tinta cálida (`#1F1A14`), acento terracota
  (`#B5572E`) para CTAs, verde-musgo serrano (`#5C7A4F`) reservado para la cadena
  ganadora en el ranking.
- Tipografía: Fraunces serif para headers y precios totales del comparador,
  Geist sans para UI, Geist Mono para EAN y timestamps.
- Voz: español rioplatense con guiño cordobés. Sin clichés turísticos.

## Comandos

```bash
pnpm dev          # dev server
pnpm build        # build producción
pnpm test         # vitest one-shot
pnpm test:watch   # vitest en modo watch
pnpm lint         # eslint
```

