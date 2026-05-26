# CLAUDE.md — Comparador de Carritos de Supermercados (Córdoba, Argentina)

> Documento de contexto para Claude Code. Contiene la visión del producto, las decisiones técnicas ya tomadas (con su justificación), la arquitectura objetivo y un plan de implementación por fases. Leelo entero antes de escribir código.

---

## 1. Qué estamos construyendo

Una aplicación que permite a un usuario de **Córdoba (Argentina)** comparar precios de supermercados con dos capacidades centrales:

1. **Precio por producto:** dado un producto, saber en qué supermercado está más barato.
2. **Carrito comparado (función estrella):** el usuario arma una lista de productos (su "carrito") y la app evalúa el **costo total de ese carrito en cada supermercado**, devolviendo dónde le sale más barato comprar todo junto.

El objetivo de mantenimiento es **cero tareas manuales**: los precios se actualizan solos mediante scrapers automatizados programados. No debe requerir que una persona descargue archivos, copie precios ni edite datos a mano.

---

## 2. Decisiones ya tomadas (NO reabrir sin motivo)

Estas decisiones son fruto de una investigación previa. Respetalas salvo que encuentres un bloqueo técnico real.

- **Fuente de datos: scraping propio**, NO la descarga manual de datasets (se descartó el dataset SEPA/Precios Claros de descarga diaria porque implica tarea manual y/o un pipeline de ingestión de ZIP; el usuario pidió explícitamente scraping automatizado).
- **Identificador de producto entre cadenas: EAN** (código de barras). Es la clave para el "matcheo" — saber que un producto en Disco es el mismo que en Carrefour. Toda la lógica de comparación se apoya en el EAN como clave canónica.
- **Automatización: GitHub Actions con cron** (gratis en repos públicos). Los scrapers corren programados (ej. diario) y persisten los resultados. No usar AWS Lambda ni servidores pagos en el MVP.
- **Dos motores de scraping** (ver sección 4), porque las cadenas objetivo usan dos plataformas e-commerce distintas.
- **Tadicor queda FUERA del alcance automatizado** (no tiene e-commerce con carrito; sus precios viven en folletos/PDF/redes; scrapearlo requeriría OCR frágil).

---

## 3. Cadenas objetivo y su plataforma

| Cadena | Plataforma | Motor de scraping | Notas |
|---|---|---|---|
| Disco | VTEX | Motor VTEX | Grupo Cencosud |
| Jumbo | VTEX | Motor VTEX | Grupo Cencosud |
| Vea | VTEX | Motor VTEX | Grupo Cencosud |
| Hiper Libertad | VTEX | Motor VTEX | Fuerte presencia en Córdoba |
| Carrefour | VTEX | Motor VTEX | |
| Carrefour Express | VTEX | Motor VTEX | Misma plataforma que Carrefour |
| ChangoMas (ex-Walmart) | VTEX | Motor VTEX | Grupo Narváez |
| Dino Online | Oracle Commerce / Endeca | Motor Endeca | Grupo Dinosaurio (local Córdoba) |
| Super MAMI | Oracle Commerce / Endeca | Motor Endeca | **Mismo backend que Dino** (un solo scraper cubre ambas) |
| ~~Tadicor~~ | Sin e-commerce | — | **Fuera de alcance** |

**Resultado:** 7 cadenas vía un motor VTEX parametrizable + 2 marcas (Dino/MAMI) vía un motor Endeca = 8 cadenas scrapeables con 2 scrapers.

> ⚠️ Las URLs base reales de cada cadena en Argentina deben confirmarse con un request real antes de codear el scraper de producción. Las plataformas están confirmadas; los paths exactos por dominio no.

---

## 4. Los dos motores de scraping (detalle técnico)

### 4.1 Motor VTEX (cubre 7 cadenas)

VTEX expone una **API de catálogo pública sin autenticación** para lectura. Usar la **Legacy Search API** (NO la Intelligent Search), porque la Legacy no requiere el hash SHA256 que expira y es más simple para scraping masivo.

Endpoints clave (relativos al dominio de cada cadena):

- **Árbol de categorías** (para saber qué recorrer):
  `/api/catalog_system/pub/category/tree/3/`
  (el número final = niveles de profundidad: 1=departamento, 2=+categoría, 3=+subcategoría)

- **Búsqueda/listado de productos por categoría** (con paginación):
  `/api/catalog_system/pub/products/search/{categoryPath}?_from=0&_to=49`
  - Paginación con `_from` / `_to`. Límite ~50 ítems por request y ~2500 por query → recorrer por categoría.
  - Devuelve JSON con producto, lista de SKUs, precios e identificadores.

- **Búsqueda por EAN** (clave para el matcheo entre cadenas):
  `/api/catalog_system/pub/products/search?fq=alternateIds_Ean:{EAN}`

- **Filtros adicionales** vía `fq`: por categoría (`fq=C:{id}`), colección (`fq=H:{id}`), rango de precio (`fq=P:[min TO max]`).

Referencia de código: **`github.com/lmeilibr/vtex`** (wrapper de la API VTEX en Python, módulo `catalog.py`). Cheatsheets de endpoints: `github.com/mroffe/vtex-urls`, `github.com/felipe-ssilva/vtex-utils`.

Como las 7 cadenas comparten esta API, **un único scraper parametrizado por `base_url` las cubre todas**.

### 4.2 Motor Endeca / Oracle Commerce (cubre Dino + MAMI)

La plataforma de Dino/MAMI es Oracle Commerce (ATG + motor de búsqueda Endeca). Se reconoce por las URLs tipo `/super/categoria/.../_/N-xxxxx` y parámetros `Nf`, `Nr`, `Ntt`, `Dy`, `No`, `Nrpp`.

El Assembler de Endeca es **una API REST agnóstica al lenguaje que puede devolver JSON**. El patrón documentado para forzar JSON es agregar `?format=json` a la URL de la página (o pedir `Accept: application/json`).

Parámetros de consulta Endeca (vocabulario confirmado):
- `N` = campo de navegación (categoría; los `N-xxxxx` ya visibles en el menú de Dino).
- `Ntt` = términos de búsqueda de texto.
- `Nf` = filtro de rango.
- `Nrpp` = records per page (tamaño de página).
- `No` = record offset (para paginar).
- `Ns` = sort key.
- Respuesta JSON: estructura `resultsList` con `records`, `totalNumRecs` y `navigationState`.
- Precios vienen como par `salePrices_listPrices` (precio de lista vs. precio de venta/oferta — guardar ambos).

**No existe repo público de scraping para Endeca** (plataforma enterprise poco común). La referencia es la doc de Oracle + ingeniería inversa:

> 🔧 **TAREA MANUAL ÚNICA REQUERIDA AL INICIO:** abrir Dino Online en el navegador con DevTools → pestaña Network, navegar una categoría, e identificar la llamada XHR/fetch real al Assembler (URL exacta, si usa `format=json`, headers). Esa llamada es la plantilla del scraper. Es lo único del proyecto que requiere inspección manual en navegador; documentá el endpoint encontrado en `docs/endeca-endpoint.md`.

---

## 5. Arquitectura del proyecto

```
comparador-super-cba/
├── CLAUDE.md                      # este archivo
├── README.md
├── pyproject.toml / requirements.txt
│
├── scrapers/
│   ├── base.py                    # interfaz común: scrape() -> List[ProductPrice]
│   ├── vtex.py                    # motor VTEX (parametrizado por base_url)
│   ├── endeca.py                  # motor Endeca (Dino + MAMI)
│   └── config.py                  # registro de cadenas: nombre, motor, base_url, sucursal/sales-channel
│
├── core/
│   ├── models.py                  # modelos de datos (Product, ProductPrice, Chain, CartItem...)
│   ├── normalize.py               # normalización: EAN como clave, limpieza de nombres/marcas/unidades
│   ├── matching.py                # matcheo entre cadenas por EAN (+ fallback por nombre/marca)
│   └── cart.py                    # LÓGICA DE CARRITO (ver sección 6) — corazón del producto
│
├── storage/
│   ├── db.py                      # acceso a datos (SQLite para MVP)
│   └── schema.sql
│
├── data/                          # salida de scrapers (versionada o en releases)
│   └── precios.sqlite             # o CSV por cadena
│
├── api/                           # backend que sirve a la UI (FastAPI sugerido)
│   └── main.py                    # endpoints: /search, /cart/compare
│
├── web/                           # frontend (buscador + armado de carrito + resultado comparado)
│
├── tests/
│   ├── test_cart.py               # tests de la lógica de carrito (alta prioridad)
│   ├── test_matching.py
│   └── fixtures/                  # JSON de respuesta real de VTEX/Endeca para tests offline
│
└── .github/workflows/
    └── scrape.yml                 # cron diario: corre scrapers y persiste precios
```

### Flujo de datos
```
[GitHub Actions cron diario]
        │
        ▼
[scrapers/vtex.py + scrapers/endeca.py]  →  productos crudos por cadena
        │
        ▼
[core/normalize.py]  →  registros normalizados (clave EAN, precio lista, precio oferta, cadena, fecha)
        │
        ▼
[storage/db.py]  →  persistencia (SQLite / CSV)
        │
        ▼
[api/main.py]  →  /search (precio por producto)  y  /cart/compare (carrito comparado)
        │
        ▼
[web/]  →  UI: buscar, armar carrito, ver mejor súper para el total
```

---

## 6. Lógica de carrito (el corazón — diseñar con cuidado)

Dado un carrito = lista de `(EAN, cantidad)`, calcular el total por cada cadena y rankear.

**Sutileza crítica a resolver:** muchas veces **ningún súper tiene TODOS los productos** del carrito. Hay que definir la estrategia (hacerla configurable):

- **Modo "solo súper completos":** solo rankear cadenas que tengan el 100% de los ítems.
- **Modo "mejor esfuerzo" (recomendado por defecto):** rankear todas las cadenas, mostrando para cada una el total de lo que SÍ tiene + lista de faltantes + cantidad de ítems cubiertos. Permite al usuario decidir.
- **(Avanzado, futuro):** optimización multi-tienda — comprar parte en un súper y parte en otro para minimizar el total.

Cada resultado de comparación debe devolver, por cadena: total cubierto, ítems encontrados con su precio, ítems faltantes, % de cobertura, y si el precio es de lista u oferta.

Distinguir **precio de lista vs. precio de oferta** (ambos disponibles en las dos plataformas). Decidir cuál usar para el ranking (sugerido: precio de oferta/venta efectivo, marcando que es promo).

> Escribir tests de esta lógica ANTES o junto con la implementación. Es donde se juega la confiabilidad del producto.

---

## 7. Modelo de datos mínimo

- **Chain:** id, nombre, motor (`vtex`|`endeca`), base_url, identificador de sucursal/sales-channel (los precios pueden variar por sucursal/región).
- **Product (canónico):** ean (PK lógica), nombre normalizado, marca, presentación/unidad.
- **ProductPrice:** ean, chain_id, precio_lista, precio_oferta, es_oferta (bool), fecha_relevamiento, nombre_en_cadena (el nombre tal cual figura en esa cadena), url_producto.
- **CartItem:** ean, cantidad.

Guardar el `nombre_en_cadena` y la `url` además del EAN, para depurar matcheos y mostrar el producto real.

---

## 8. Plan de implementación por fases

**Fase 0 — Reconocimiento (poco código):**
- Confirmar URLs base reales de las 7 cadenas VTEX (probar `/{base}/api/catalog_system/pub/category/tree/3/` con un request real).
- Inspeccionar Dino con DevTools y documentar el endpoint Endeca real (ver tarea manual en 4.2).
- Guardar respuestas JSON reales en `tests/fixtures/` para desarrollar offline.

**Fase 1 — Motor VTEX + datos:**
- Implementar `scrapers/vtex.py` parametrizado, probarlo con UNA cadena (sugerido Disco).
- Implementar `core/normalize.py` y `storage/db.py`.
- Extender a las 7 cadenas VTEX vía config.

**Fase 2 — Lógica de carrito + API:**
- Implementar `core/matching.py` (por EAN) y `core/cart.py` con sus tests.
- Exponer `/search` y `/cart/compare` en `api/main.py`.

**Fase 3 — Motor Endeca:**
- Implementar `scrapers/endeca.py` para Dino + MAMI usando el endpoint documentado en Fase 0.
- Integrarlo al mismo pipeline de normalización.

**Fase 4 — Automatización:**
- Escribir `.github/workflows/scrape.yml` (cron diario) que corre los scrapers y persiste/commitea los precios.

**Fase 5 — Frontend:**
- UI para buscar productos, armar el carrito y ver el ranking de súper por total.

---

## 9. Stack sugerido (ajustable)

- **Lenguaje:** Python 3.10+ (alineado con las referencias y el ecosistema de scraping argentino).
- **Scraping:** `httpx` o `requests` (las APIs son JSON, NO se necesita Selenium ni navegador headless). Considerar `Scrapy` solo si se quiere robustez de pipeline.
- **Datos:** `pandas` para normalización; **SQLite** para persistencia en el MVP.
- **API:** FastAPI.
- **Tests:** pytest (con los fixtures JSON reales para no depender de la red).

---

## 10. Buenas prácticas de scraping (respetar)

- Throttling: ~1 request/segundo por dominio. No abusar.
- Identificarse con un User-Agent razonable; cachear el árbol de categorías.
- Manejar reintentos y fallos por cadena de forma aislada (que una cadena caída no rompa el resto).
- Registrar fecha/hora de cada relevamiento (los precios son volátiles).
- Estos sitios son de catálogo público; aun así, mantener el uso respetuoso y con fines de comparación de precios.

---

## 11. Riesgos conocidos / cosas a verificar empíricamente

- Paths exactos de la API VTEX por cada dominio argentino (la API es estándar, pero confirmar).
- Que `?format=json` funcione en la instancia Endeca de Dino (si no, usar el endpoint XHR real visto en DevTools).
- Precios por sucursal/región: VTEX usa "sales channel" / regionalización; definir qué sucursal de Córdoba se releva por cadena para que la comparación sea justa (mismo mercado geográfico).
- Cobertura real de cada cadena en Córdoba capital (algunas son nacionales; confirmar sucursal cordobesa).
