# Sales Channels VTEX — Córdoba (CP 5000)

## Por qué importa

VTEX permite múltiples "sales channels" (`sc`) por tienda. Cada SC puede tener precios distintos según región/canal. Si scrapeamos con un SC de Buenos Aires en una cadena que opera en Córdoba con otro SC, los precios no son justos para nuestro usuario cordobés.

**Decisión del plan:** resolver el SC de Córdoba para cada cadena VTEX antes del primer scrape, persistir en `chains.sales_channel`, y usarlo en cada request.

## Hallazgo empírico (2026-05-23)

Probé en Disco:
- `GET /api/checkout/pub/regions?country=ARG&postalCode=5000` → **500** (endpoint estándar VTEX no funciona en cadenas Cencosud).
- `GET /api/checkout/pub/postal-code/ARG/5000` → **200**, devuelve `{city:"Córdoba", state:"Córdoba", geoCoordinates:[...]}` pero NO sales channel.
- `GET /api/catalog_system/pub/saleschannel/list` → **404**.
- `GET /api/catalog_system/pub/products/search?sc=1` → **400** (el parámetro `sc` es rechazado por la API legacy).

Conclusión: Cencosud **no expone la API estándar de resolución de SC**. La regionalización en Disco/Jumbo/Vea probablemente se hace por:
1. Cookie `VtexRCMacIdv7` + segmento en checkout.
2. Header `X-VTEX-Segment` con SC codificado.
3. La sucursal se fija desde el flujo de checkout, no desde la URL de catálogo.

## Estrategia aplicada (resuelto 2026-05-23)

Probé `?sc={N}` como query param → 400 Bad Request en Cencosud. Pero descubrí que **sí funciona vía `vtex_segment` cookie**:

1. **Resolver regionId** llamando `GET /api/checkout/pub/regions?country=ARG&postalCode=5000&sc={SC}` (sc=32 para Cencosud, sc=1 para masonline).
2. **Construir cookie `vtex_segment`** = base64(JSON con `channel`, `regionId`, `countryCode=ARG`, `cultureInfo=es-AR`).
3. **Enviar cookie en cada request** del scraper.

Resultado verificado: producto Pan Bimbo 400g en Jumbo:
- Sin cookie: $5.700 (precio nacional)
- Con cookie regionId Córdoba: $5.400 (precio región)

La diferencia con la web Jumbo ($6.200 mostrado en screenshot del usuario) puede deberse a:
- Sucursal específica (Nuevocentro) aplica precio adicional sobre la región
- Web embebe costo "preparación + delivery" en el sticker price
- Cambio temporal del precio entre relevamiento y screenshot

Implementación: `scrapers/vtex.py` → `resolve_region_id()` + `build_vtex_segment()` + hook `prepare()` en `VTEXScraper`. RegionId se cachea en `chains.sales_channel` con formato `"{sc}:{regionId}"` para no resolver en cada corrida.

## SC discovered

| Cadena | sc | postalCode | regionId observado |
|---|---|---|---|
| Disco | 32 | 5000 | `U1cj...` (base64) — sellers Cencosud Jumbo |
| Jumbo | 32 | 5000 | `v2.B3482BA2475924900558B9CFE5C38E3F` |
| Vea | 32 | 5000 | `U1cj...` (mismo cluster Cencosud) |
| ChangoMas | 1 | 5000 | `v2.C147DDF21E1C945891828CF19D15D3EF` |

## Implementación (Bloque D)

Función helper en `scrapers/vtex.py`:

```python
async def resolve_sales_channel(base_url: str, postal_code: str, client: httpx.AsyncClient) -> str | None:
    r = await client.get(f"{base_url}/api/checkout/pub/regions",
                         params={"country": "ARG", "postalCode": postal_code})
    r.raise_for_status()
    data = r.json()
    # navegar shape, devolver salesChannel del primer seller
    ...
```

Se llama una vez por cadena al inicio de `BaseScraper.run()` si `chain.sales_channel` está vacío en DB; el resultado se persiste con `upsert_chain()`.

## CP por defecto

`5000` = Córdoba Capital. Si en el futuro se quiere comparar otra ciudad, este valor se vuelve parámetro de la corrida.

## Cadenas no-VTEX (Dino, MAMI)

Endeca no tiene `sales channel`. La equivalencia es "sucursal seleccionada en la sesión". El scraper Endeca debe fijar la sucursal Córdoba antes de cada corrida (ver `docs/endeca-endpoint.md`).
