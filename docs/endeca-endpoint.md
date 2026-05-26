# Endpoint Endeca — Dino + MAMI

Fecha: 2026-05-23. Plataforma: Oracle Commerce (ATG + Endeca Assembler). Reconocida por URLs `/categoria/.../_/N-xxxxx` y parámetros `Nrpp`, `No`, `Ntt`, `Nf`.

## URL base por cadena

| Cadena | Base URL |
|---|---|
| Dino | `https://www.dinoonline.com.ar` |
| Super MAMI | `https://www.supermami.com.ar` |

Mismo backend Oracle Commerce. Páginas redirigen a `/super/home`.

## Endpoint de listado por categoría

Patrón:

```
{base}/super/categoria/{slug}/_/N-{categoryId}?format=json&Nrpp={pageSize}&No={offset}
```

- `format=json` → fuerza respuesta JSON del Assembler (verificado: devuelve `application/json; charset=UTF-8`).
- `Nrpp` → records per page (default ~20, máximo a confirmar).
- `No` → offset, paginar incrementando.
- `Ntt` → término de búsqueda libre (cuando aplica).

Ejemplo probado:
```
https://www.dinoonline.com.ar/super/categoria/almacen/_/N-1z141ay?format=json&Nrpp=5
```

## ⚠️ Sucursal obligatoria (parcial)

**Hallazgo refinado (2026-05-23):**
- Categorías "pure Dino" (slugs sin prefijo `supermami-`) devuelven `totalNumRecs:0` sin sucursal seleccionada.
- Categorías "MAMI" (slugs con prefijo `supermami-*`, ej `supermami-almacen-aceites-vinagres-y-acetos-aceites`) devuelven productos **sin necesidad de sucursal** (37 productos en mi probe).

Hipótesis: el catálogo MAMI es accesible público; el catálogo Dino requiere sucursal porque opera por delivery zonal. Para el MVP, **MAMI se scrapea sin sesión** y **Dino requiere flow de sucursal**.

Para Dino:

Cookies de sesión observadas en homepage:
- `JSESSIONID=...` (sesión ATG)
- `weblogic2e=weblogic2c` (sticky session balanceador)

Para scrapear hay que:
1. Visitar homepage para obtener cookies de sesión.
2. Hacer un POST/GET al endpoint de selección de sucursal con la sucursal Córdoba.
3. Recién después llamar al endpoint de categoría con la misma `WebRequestSession`.

**TODO en spike (script `scripts/spike_endeca.py`):** identificar el endpoint exacto de selección de sucursal (probablemente `/super/seleccionar-sucursal` o XHR similar). Ver Network DevTools.

## Estructura de respuesta JSON

Top-level:
```json
{
  "contents": [
    {
      "MainLeftN": [...],
      "MainContent": [
        {
          "@type": "...",
          "records": [ /* aquí van los productos */ ],
          "totalNumRecs": 1234,
          "navigationState": "...",
          "sortOptions": [...]
        }
      ]
    }
  ]
}
```

Filtros aplicados por el Assembler (visibles en `navigationState`):
- `product.disponible:Disponible`
- `product.language:español`
- `product.priceListPair:salePrices_listPrices` → confirma que vienen ambos precios (lista + venta)
- `product.siteId:superSite`

## Campos confirmados por record (spike 2026-05-23)

Fixture: `tests/fixtures/endeca/mami_aceites.json` (37 productos, MAMI categoría aceites de oliva).

Estructura: cada `Record` top-level es un **product**, con un `records[]` anidado que son sus **SKUs**.

Atributos clave (Product nivel):
- `product.ean` → **EAN puro 13 dígitos** (ej `7798096010012`) ✅
- `product.brand`
- `product.displayName`
- `product.category`
- `product.repositoryId` (id interno, ej `prod2320128`)
- `product.mediumImage.url`, `product.largeImage.url`
- `product.fraccionVta`, `product.pesable`, `product.unidMedReff` (unidad)
- `product.oferta`, `product.oferta_super` (flags promo)
- `product.priceListPair` = `"salePrices_listPrices"` (constante)

Atributos clave (SKU nivel, en `records[0].attributes`):
- `sku.activePrice` → **precio efectivo** (string decimal, ej `"14580.000000"`)
- `sku.activePriceRange` (para productos con rango)
- `sku.displayName`, `sku.description`
- `sku.creationDate`, `sku.endDate`
- `sku.siteId` = `"superSite"`

Falta confirmar empíricamente:
- Campo exacto de **precio de lista** (`sku.listPrice`?). El campo `product.priceListPair=salePrices_listPrices` sugiere que existe pero no apareció en el record probe; tal vez sólo aparece cuando hay diferencia entre lista y venta. Capturar ambos `salePrices` y `listPrices` cuando estén.

URL del producto: `record.detailsAction.recordState` → relative path `/aceite-de-oliva-pannocchia-extra-virgen-x-500-ml-/_/A-2320128-2320128-s`. Prepend `{base_url}/super` para URL absoluta.

**Decisión:** matcheo entre Endeca y VTEX se hace por **EAN puro**. Fuzzy fallback queda como nice-to-have, no es bloqueante para el MVP.
