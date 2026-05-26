# 🛒 Comparador de Carritos — Supermercados de Córdoba

Encontrá en qué supermercado de Córdoba te sale más barato **todo tu carrito**, no solo un producto suelto.

---

## ¿Qué hace?

Esta app responde dos preguntas que cualquiera que hace las compras se hace seguido:

1. **"¿Dónde está más barato este producto?"** — Buscás un producto y ves su precio en cada supermercado.
2. **"¿Dónde me conviene hacer TODA la compra?"** — Armás tu lista (tu carrito) y la app calcula cuánto te costaría ese carrito completo en cada cadena, y te dice dónde gastás menos en total.

La segunda es la gracia del proyecto: comparar el **costo total del carrito**, no precio por precio. A veces un súper tiene la leche más barata pero te termina saliendo más caro el total; esta app te lo muestra de una.

---

## ¿Por qué existe?

Comparar precios a mano entre supermercados es tedioso y, en la práctica, nadie lo hace para una compra entera. Los precios además cambian todo el tiempo. La idea es automatizar ese trabajo: que los precios se actualicen solos y que comparar el carrito completo sea cuestión de un par de clics.

El foco es **Córdoba, Argentina**, e incluye tanto las grandes cadenas nacionales como los supermercados cordobeses locales.

---

## Supermercados incluidos

| Supermercado | Estado | Plataforma |
|---|---|---|
| Disco | ✅ | VTEX |
| Jumbo | ✅ | VTEX |
| Vea | ✅ | VTEX |
| ChangoMas | ✅ | VTEX (`masonline.com.ar`) |
| Carrefour | ✅ | VTEX (vía TLS impersonation `curl_cffi`) |
| Dino Online | ✅ | Oracle Commerce / Endeca |
| Super MAMI | ✅ | Oracle Commerce / Endeca |
| Hiper Libertad | ❌ | Sin e-commerce funcional en el dominio (ver `docs/hiper-libertad-investigation.md`) |
| Tadicor | ❌ | Sin tienda online (precios en folletos / redes) |

> **¿Por qué Hiper Libertad y Tadicor no están?** Ninguno tiene tienda online con carrito accesible. Sus precios viven en folletos / redes / landings estáticos. Quedaron fuera para no comprometer la calidad de los datos.

---

## ¿Cómo se mantienen los precios actualizados?

Sin que nadie toque nada. 🙌

La app lee los precios directamente de las tiendas online de cada supermercado de forma automática y programada (una vez por día). No hay que descargar archivos, copiar precios ni cargar nada a mano. Esa fue una decisión central del proyecto: **cero tareas manuales** para mantenerlo vivo.

Para identificar que un producto es "el mismo" entre dos supermercados distintos, la app se apoya en el **código de barras (EAN)** de cada producto. Así sabe que la gaseosa que viste en uno es exactamente la misma que en otro, aunque cada cadena le ponga un nombre distinto.

---

## ¿Cómo funciona por dentro? (resumen)

```
Tiendas online de los súper
        │  (lectura automática diaria)
        ▼
   Scrapers de precios
        │
        ▼
   Base de datos de precios (con código de barras como clave)
        │
        ▼
   App: buscar producto  +  comparar carrito completo
```

Los supermercados usan dos tecnologías distintas para sus tiendas online, así que la app tiene dos "lectores" de precios: uno para las siete cadenas grandes y otro para los dos supermercados cordobeses (Dino y Super MAMI, que comparten la misma plataforma).

Si te interesa el detalle técnico completo (endpoints, arquitectura, decisiones de diseño), está todo en **[`CLAUDE.md`](./CLAUDE.md)**.

---

## Live en producción

- 🌐 **App**: https://comparador-super-cba.vercel.app
- 🔧 **API**: https://comparador-super-cba.fly.dev
- 📦 **Repo**: https://github.com/LazaaG/comparador-super-cba

Los precios se relevan automáticamente todos los días a las **7 AM hora Argentina** (10:00 UTC) vía GitHub Actions. Sin intervención manual.

---

## Estado del proyecto

✅ **MVP en producción.** 7 cadenas relevadas, cron diario activo:

- Disco, Jumbo, Vea, ChangoMas, Carrefour (VTEX)
- Dino Online, Super MAMI (Oracle Commerce / Endeca)

---

## Stack técnico

| Capa | Tecnología | Hosting |
|---|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind + zustand | Vercel |
| Backend API | FastAPI + Python 3.13 | Fly.io (region `gru`) |
| Base de datos | SQLite read-only en volumen persistente | Fly.io volume `data` |
| Scrapers | Python async + `httpx` / `curl_cffi` (TLS impersonation Carrefour) | GitHub Actions runners |
| Cron diario | GitHub Actions `0 10 * * *` UTC | matrix de 7 jobs paralelos |

---

## Cómo correr localmente

Requisitos: Python 3.11+, Node 20+, `npm`.

```bash
# Backend
git clone https://github.com/LazaaG/comparador-super-cba.git
cd comparador-super-cba
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"

# Seedear catálogo de cadenas + scrape de prueba
.venv/Scripts/python.exe -m storage.seed_chains
.venv/Scripts/python.exe -m scrapers --chain disco --limit-categories 2

# API
.venv/Scripts/python.exe -m uvicorn api.main:app --reload --port 8000
```

```bash
# Frontend (otra terminal)
cd web
npm install
cp .env.local.example .env.local
npm run dev    # http://localhost:3000
```

Más detalles del flujo de scraping: [`docs/scraping.md`](./docs/scraping.md).

---

## Aviso

Proyecto con fines de comparación de precios para consumidores. Los precios se leen de los catálogos públicos de cada supermercado y pueden no estar siempre actualizados al instante. No tiene relación oficial con ninguna de las cadenas mencionadas.

---

## Contribuir

Las contribuciones son bienvenidas: sumar supermercados, mejorar el matcheo de productos, reportar precios mal leídos. Abrí un *issue* o un *pull request*.
