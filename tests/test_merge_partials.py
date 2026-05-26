"""Test del merge de DBs parciales."""
from __future__ import annotations

from pathlib import Path

from core.models import ScrapedProduct
from scripts.merge_partials import merge_partial
from storage.db import get_conn, init_db, insert_price_batch, upsert_product
from storage.seed_chains import seed


def _partial(path: Path, chain_id: int, ean: str, name: str, price: float, now: str):
    init_db(path)
    seed(path)
    with get_conn(path) as conn:
        upsert_product(conn, ean, name, "x", 1.0, "L", now=now)
        insert_price_batch(conn, chain_id, now, [ScrapedProduct(
            ean=ean, name_in_chain=name, price_list=price, price_effective=price)])


def test_merge_two_partials(tmp_path: Path):
    target = tmp_path / "target.sqlite"
    init_db(target)
    seed(target)

    p1 = tmp_path / "p1.sqlite"
    p2 = tmp_path / "p2.sqlite"
    _partial(p1, chain_id=1, ean="7790895000119", name="coca 2.25",
             price=2890, now="2026-05-23T03:00:00Z")
    _partial(p2, chain_id=2, ean="7790895000119", name="coca",
             price=3000, now="2026-05-23T03:05:00Z")

    with get_conn(target) as conn:
        merge_partial(conn, p1)
        merge_partial(conn, p2)
        prices = conn.execute(
            "SELECT chain_id, price_effective FROM product_prices ORDER BY chain_id"
        ).fetchall()
        prod = conn.execute(
            "SELECT * FROM products WHERE ean=?", ("7790895000119",)
        ).fetchone()
        fts_count = conn.execute(
            "SELECT COUNT(*) FROM products_fts WHERE ean=?", ("7790895000119",)
        ).fetchone()[0]

    assert len(prices) == 2
    assert {p["chain_id"] for p in prices} == {1, 2}
    assert prod["last_seen_at"] == "2026-05-23T03:05:00Z"  # p2 más reciente
    assert fts_count == 1  # FTS no duplica
