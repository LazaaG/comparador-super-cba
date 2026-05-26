"""GET /search?q=...&limit=20  o  /search?ean=..."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_db
from api.schemas import PriceInChain, SearchResponse, SearchResultItem
from core.normalize import is_valid_ean, normalize_name

router = APIRouter()

# Escape de caracteres especiales FTS5 (mantiene búsqueda segura ante input raro).
_FTS_RESERVED = set('"*:()')


def _sanitize_fts(query: str) -> str:
    tokens = []
    for tok in normalize_name(query).split():
        cleaned = "".join(c for c in tok if c not in _FTS_RESERVED)
        if cleaned:
            tokens.append(cleaned + "*")
    return " ".join(tokens)


@router.get("/search", response_model=SearchResponse)
def search(
    conn: sqlite3.Connection = Depends(get_db),
    q: str | None = Query(default=None, description="Texto libre"),
    ean: str | None = Query(default=None, description="EAN exacto"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> SearchResponse:
    if not q and not ean:
        raise HTTPException(400, "Debe enviar `q` o `ean`.")

    if ean:
        if not is_valid_ean(ean):
            raise HTTPException(400, "EAN inválido.")
        prod_rows = conn.execute(
            "SELECT * FROM products WHERE ean = ?", (ean,)
        ).fetchall()
        total = len(prod_rows)
        used_query = ean
    else:
        fts_q = _sanitize_fts(q or "")
        if not fts_q:
            raise HTTPException(400, "Consulta vacía después de normalizar.")
        # FTS no soporta LIMIT con OFFSET sin sub-query eficiente; OK para MVP.
        total = conn.execute(
            "SELECT COUNT(*) FROM products_fts WHERE products_fts MATCH ?", (fts_q,)
        ).fetchone()[0]
        prod_rows = conn.execute(
            """SELECT p.* FROM products_fts f
               JOIN products p ON p.ean = f.ean
               WHERE products_fts MATCH ?
               ORDER BY rank
               LIMIT ? OFFSET ?""",
            (fts_q, limit, offset),
        ).fetchall()
        used_query = q or ""

    if not prod_rows:
        return SearchResponse(query=used_query, results=[], total=total)

    eans = [r["ean"] for r in prod_rows]
    placeholders = ",".join("?" * len(eans))
    price_rows = conn.execute(
        f"""SELECT lp.*, c.slug AS chain, c.display_name AS chain_name
            FROM v_latest_prices lp
            JOIN chains c ON c.id = lp.chain_id
            WHERE lp.ean IN ({placeholders})
            ORDER BY lp.price_effective ASC""",
        eans,
    ).fetchall()

    prices_by_ean: dict[str, list[PriceInChain]] = {ean: [] for ean in eans}
    for pr in price_rows:
        prices_by_ean[pr["ean"]].append(PriceInChain(
            chain=pr["chain"], chain_name=pr["chain_name"],
            price_list=pr["price_list"], price_effective=pr["price_effective"],
            is_promo=bool(pr["is_promo"]), name_in_chain=pr["name_in_chain"],
            product_url=pr["product_url"], scraped_at=pr["scraped_at"],
        ))

    results = []
    for r in prod_rows:
        prices = prices_by_ean.get(r["ean"], [])
        cheapest = prices[0].chain if prices else None
        results.append(SearchResultItem(
            ean=r["ean"], name=r["name_norm"], brand=r["brand_norm"],
            unit_value=r["unit_value"], unit_kind=r["unit_kind"],
            image_url=r["image_url"],  # migración garantiza la columna
            prices=prices, cheapest_chain=cheapest,
        ))

    return SearchResponse(query=used_query, results=results, total=total)
