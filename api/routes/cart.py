"""POST /cart/compare."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from api.deps import get_db
from api.schemas import CartCompareRequest, CartCompareResponse
from core.cart import compare_cart
from core.models import Chain, PriceRow
from storage.db import get_chains, latest_prices_for_eans

router = APIRouter()


@router.post("/cart/compare", response_model=CartCompareResponse)
def cart_compare(
    req: CartCompareRequest,
    conn: sqlite3.Connection = Depends(get_db),
) -> CartCompareResponse:
    chains: list[Chain] = get_chains(conn, only_active=True)
    chain_by_id = {c.id: c for c in chains}

    eans = [item.ean for item in req.items]
    price_rows = latest_prices_for_eans(conn, eans) if eans else []

    prices_by_chain: dict[str, dict[str, PriceRow]] = {c.slug: {} for c in chains}
    for r in price_rows:
        chain = chain_by_id.get(r["chain_id"])
        if chain is None:
            continue
        prices_by_chain[chain.slug][r["ean"]] = PriceRow(
            ean=r["ean"], chain_id=r["chain_id"], chain_slug=chain.slug,
            scraped_at=r["scraped_at"],
            price_list=r["price_list"], price_effective=r["price_effective"],
            is_promo=bool(r["is_promo"]),
            name_in_chain=r["name_in_chain"], product_url=r["product_url"],
            sku_id=r["sku_id"],
        )

    # Catálogo canónico para enriquecer items faltantes con nombre + imagen.
    product_meta: dict[str, tuple[str | None, str | None]] = {}
    if eans:
        placeholders = ",".join("?" * len(eans))
        for r in conn.execute(
            f"SELECT ean, name_norm, image_url FROM products WHERE ean IN ({placeholders})",
            eans,
        ).fetchall():
            product_meta[r["ean"]] = (r["name_norm"], r["image_url"])

    cmp = compare_cart(cart=req.items, prices_by_chain=prices_by_chain,
                       chains=chains, mode=req.mode, product_meta=product_meta)
    return CartCompareResponse(mode=cmp.mode, total_items=cmp.total_items,
                               ranking=cmp.ranking)
