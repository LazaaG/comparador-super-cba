# Scraping — cómo correr

## Comando principal

Desde la raíz del repo:

```bash
# Todas las cadenas activas en paralelo (recomendado, ~30-50 min)
.venv/Scripts/python.exe -m scrapers --all

# Una cadena específica
.venv/Scripts/python.exe -m scrapers --chain disco

# Smoke (limitar categorías, prueba rápida)
.venv/Scripts/python.exe -m scrapers --all --limit-categories 3
.venv/Scripts/python.exe -m scrapers --chain mami --limit-categories 5

# Flags adicionales:
#   --db PATH         Override de path SQLite (default: data/precios.sqlite)
#   --sequential      Desactiva paralelismo entre cadenas (debug)
```

## Cómo funciona el live-update con app corriendo

**Arquitectura clave:**
- API FastAPI abre SQLite en **modo `mode=ro`** (read-only).
- Scrapers escriben a **DBs parciales** en `data/partials/{slug}.sqlite`, una por cadena.
- Al final, `scripts/merge_partials.py` mergea todo a `data/precios.sqlite`.

**Resultado:** podés tener `uvicorn` + `npm run dev` corriendo todo el día. Cuando lanzás `--all`:

1. Mientras corre, la API sigue sirviendo la data de la corrida anterior. Cero downtime, cero locks.
2. Al terminar `--all`, el merge actualiza `data/precios.sqlite` con un único swap atómico (SQLite usa WAL → readers ven la snapshot vieja hasta que terminás el commit).
3. La próxima query a la API ya devuelve precios nuevos. Sin reiniciar nada.

**Cómo se actualizan productos / precios:**

| Caso | Qué pasa en DB |
|---|---|
| Producto **nuevo** (EAN no estaba) | INSERT a `products` + INSERT a `product_prices` |
| Producto **ya existía**, cambió precio | INSERT nuevo `product_prices` con `scraped_at` actual (histórico se mantiene). La view `v_latest_prices` ya apunta al más nuevo. |
| Producto **ya existía**, cambió nombre/marca/imagen | UPDATE de `products` con el nombre/marca nuevo. `image_url` se updatea solo si la cadena trae uno (no se borra). |
| Producto **desaparece** de la cadena | Su precio viejo queda como último observado. NO se borra. Útil para "última vez visto: X". |

## Ejecución típica day-to-day

Terminal A (siempre arriba):
```bash
.venv/Scripts/python.exe -m uvicorn api.main:app --reload --port 8000
```

Terminal B (siempre arriba):
```bash
cd web && npm run dev
```

Terminal C (cuando querés refrescar precios):
```bash
.venv/Scripts/python.exe -m scrapers --all
```

Mientras C corre, A y B siguen sirviendo data vieja. Cuando C termina, A automáticamente lee la DB nueva.

## Monitorear progreso

Mientras corre `--all`, los logs muestran cada cadena terminando:

```
INFO scrapers.run: Cadena disco: 5800 productos. Status=ok
INFO scrapers.run: Cadena jumbo: 7200 productos. Status=ok
...
INFO merge: Merge OK: 22663 productos | 47540 precios
INFO scrapers.run: Total productos en este run: 22663
```

Para inspeccionar parciales en vivo (otra terminal):

```bash
# Cuántos productos lleva cada cadena
for f in data/partials/*.sqlite; do
  slug=$(basename $f .sqlite)
  n=$(.venv/Scripts/python.exe -c "import sqlite3; print(sqlite3.connect('$f').execute('SELECT COUNT(*) FROM product_prices').fetchone()[0])")
  echo "$slug: $n"
done
```

## GitHub Actions (cuando esté en un repo remoto)

El workflow `.github/workflows/scrape.yml` ya está configurado:

- Corre `--all` programado a las 03:00 ART (06:00 UTC) diario.
- Matrix: 6 jobs paralelos en runners free.
- Tras finalizar, hace `git commit data/precios.sqlite` y push.

Disparar manualmente desde GitHub UI: **Actions → Scrape diario → Run workflow**.

## Performance

Con las optimizaciones aplicadas:
- 6 cadenas paralelas
- 8 req/s por dominio
- 8 categorías concurrentes intra-cadena
- Filtro hojas (skip categorías padre redundantes)

**Estimado full scrape:** 30-50 min para ~50000 productos totales (vs. 2h+ versión anterior).

## Si algo falla

- Una cadena 429 → automático: backoff exponencial respeta `Retry-After`.
- Una cadena se cae (timeout, red) → no aborta a las otras (`return_exceptions=True`).
- Merge falla a mitad → DB final intacta (cada parcial mergea en transacción propia).
- Volver a correr `--chain X` sobreescribe parcial sin tocar resto.
