"""Tests de storage: schema, upserts idempotentes, batch insert."""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from core.models import ScrapedProduct
from storage.db import (
    get_chain_by_slug,
    get_chains,
    get_conn,
    init_db,
    insert_price_batch,
    latest_prices_for_eans,
    upsert_chain,
    upsert_product,
)
from storage.seed_chains import seed


@pytest.fixture()
def db(tmp_path: Path) -> Path:
    path = tmp_path / "test.sqlite"
    init_db(path)
    return path


def test_init_creates_tables(db: Path):
    with get_conn(db) as conn:
        tables = {r["name"] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert {"chains", "products", "product_prices", "scrape_runs"} <= tables


def test_seed_idempotent(tmp_path: Path):
    db = tmp_path / "seed.sqlite"
    n1 = seed(db)
    n2 = seed(db)
    assert n1 == n2 == 7
    with get_conn(db) as conn:
        chains = get_chains(conn, only_active=False)
    assert len(chains) == 7
    assert {c.slug for c in chains} == {
        "disco", "jumbo", "vea", "changomas", "dino", "mami", "carrefour"
    }
    assert next(c for c in chains if c.slug == "carrefour").active is True


def test_chain_by_slug(db: Path):
    seed(db)
    with get_conn(db) as conn:
        ch = get_chain_by_slug(conn, "disco")
    assert ch is not None and ch.engine == "vtex"


def test_only_active(db: Path):
    seed(db)
    with get_conn(db) as conn:
        active = get_chains(conn, only_active=True)
    assert all(c.active for c in active)
    assert "carrefour" in {c.slug for c in active}


def test_upsert_chain_updates(db: Path):
    seed(db)
    with get_conn(db) as conn:
        ch = get_chain_by_slug(conn, "disco")
        assert ch is not None
        updated = ch.model_copy(update={"sales_channel": "5"})
        upsert_chain(conn, updated)
        again = get_chain_by_slug(conn, "disco")
        assert again is not None and again.sales_channel == "5"


def test_upsert_product_idempotent(db: Path):
    seed(db)
    with get_conn(db) as conn:
        upsert_product(conn, "7790895000119", "coca cola 2.25l", "coca cola",
                       2.25, "L", now="2026-05-23T00:00:00Z")
        upsert_product(conn, "7790895000119", "coca cola 2.25l", "coca cola",
                       2.25, "L", now="2026-05-24T00:00:00Z")
        row = conn.execute("SELECT * FROM products WHERE ean=?",
                           ("7790895000119",)).fetchone()
    assert row["first_seen_at"] == "2026-05-23T00:00:00Z"
    assert row["last_seen_at"] == "2026-05-24T00:00:00Z"


def test_fts_search_diacritics(db: Path):
    seed(db)
    with get_conn(db) as conn:
        upsert_product(conn, "7790000000001", "leche entera la serenísima 1l",
                       "la serenisima", 1.0, "L")
        rows = conn.execute(
            "SELECT ean FROM products_fts WHERE products_fts MATCH ?",
            ("serenisima",)).fetchall()
    assert [r["ean"] for r in rows] == ["7790000000001"]


def test_insert_price_batch_and_latest(db: Path):
    seed(db)
    now1 = "2026-05-23T03:00:00Z"
    now2 = "2026-05-24T03:00:00Z"
    p1 = ScrapedProduct(ean="7790000000002", name_in_chain="x", price_list=100.0,
                        price_effective=90.0, is_promo=True)
    p2 = ScrapedProduct(ean="7790000000002", name_in_chain="x", price_list=110.0,
                        price_effective=110.0, is_promo=False)
    with get_conn(db) as conn:
        upsert_product(conn, p1.ean, "x", None, None, None)
        n1 = insert_price_batch(conn, chain_id=1, scraped_at=now1, prices=[p1])
        n2 = insert_price_batch(conn, chain_id=1, scraped_at=now2, prices=[p2])
        latest = latest_prices_for_eans(conn, ["7790000000002"], chain_ids=[1])
    assert n1 == 1 and n2 == 1
    assert len(latest) == 1
    assert latest[0]["scraped_at"] == now2
    assert latest[0]["price_effective"] == 110.0


def test_insert_empty_batch(db: Path):
    with get_conn(db) as conn:
        n = insert_price_batch(conn, chain_id=1,
                               scraped_at=datetime.now(UTC).isoformat(),
                               prices=[])
    assert n == 0
