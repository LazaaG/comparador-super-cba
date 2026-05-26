# Reconocimiento VTEX — hallazgos empíricos

Fecha: 2026-05-23. Requests hechos con `Invoke-WebRequest` PowerShell, sin auth, User-Agent estándar.

## Endpoints verificados

Base path estándar VTEX (mismo en las 4 cadenas activas del MVP):

- Árbol de categorías: `{base_url}/api/catalog_system/pub/category/tree/{depth}/`
- Búsqueda/listado: `{base_url}/api/catalog_system/pub/products/search/[{path}]?_from={a}&_to={b}`
- Búsqueda por EAN: `{base_url}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:{EAN}`
- Resolución de sales channel por CP: `{base_url}/api/checkout/pub/regions?country=ARG&postalCode={cp}`

Paginación: `_from`/`_to` (50 ítems máx por request, 2500 ítems máx por path).

## Tabla de dominios

| Cadena | Dominio confirmado | Status `/category/tree/1/` |
|---|---|---|
| Disco | `https://www.disco.com.ar` | 200, JSON 59426 bytes |
| Jumbo | `https://www.jumbo.com.ar` | 200, JSON 59426 bytes (mismo backend Cencosud) |
| Vea | `https://www.vea.com.ar` | 200, JSON 59426 bytes (mismo backend Cencosud) |
| ChangoMas | `https://www.masonline.com.ar` | 200, JSON 583826 bytes |
| Carrefour | `https://www.carrefour.com.ar` | **403 Forbidden** (WAF) |
| Hiper Libertad | `https://www.hiperlibertad.com.ar` | **404** — el dominio NO sirve VTEX, sirve landing Apache de "La Anónima". Excluido del MVP. |

## Estructura de respuesta `/products/search/`

Verificado con Disco (`?_from=0&_to=2`):

```json
[
  {
    "productId": "...",
    "productName": "Milanesa Nalga",
    "brand": "...",
    "link": "...",
    "items": [
      {
        "itemId": "...",
        "ean": "2532035000000",
        "sellers": [
          {
            "commertialOffer": {
              "Price": 1234.5,        // precio efectivo (con oferta si aplica)
              "ListPrice": 1500.0,    // precio de lista
              "PriceWithoutDiscount": 1500.0,
              "AvailableQuantity": 99,
              "Teasers": [...]        // promociones aplicadas
            }
          }
        ],
        "images": [{ "imageUrl": "..." }]
      }
    ]
  }
]
```

EAN siempre en `items[0].ean`. Algunos productos a granel pueden tener EAN interno truchos (empiezan con `20...`); validar con checksum en `core/normalize.py`.

## Sales channel (sc) y regionalización

VTEX permite `?sc={N}` en las URLs de búsqueda. Diferentes SCs pueden devolver precios distintos por región.

Para resolver el SC de Córdoba (CP 5000) por cadena, consultar `/api/checkout/pub/regions?country=ARG&postalCode=5000` antes del primer scrape y guardarlo en `chains.sales_channel`. Esto es decisión macro del plan: comparación geográficamente justa desde MVP.

## Carrefour

Bloqueado por WAF (Cloudflare/equivalente). Workarounds documentados para Fase 6:
1. `curl_cffi` con `impersonate="chrome120"` (TLS fingerprint).
2. Playwright + stealth si lo anterior no alcanza.
3. Residential proxy (descartado por costo).

## Hiper Libertad

`www.hiperlibertad.com.ar` sirve un HTML estático Apache con el logo "La Anónima Online" y un mensaje de contacto. No hay e-commerce VTEX en ese dominio.

Investigación pendiente: ¿app móvil? ¿otro subdominio? ¿la cadena migró a otra plataforma? Por ahora **fuera de alcance**. Ver `docs/hiper-libertad-investigation.md`.
