"""Acceso a SQLite. Un solo writer (scrapers), múltiples readers (API en mode=ro)."""
from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from core.models import Chain, ScrapedProduct

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "precios.sqlite"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def _utcnow_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _connect(db_path: Path, readonly: bool) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if readonly:
        uri = f"file:{db_path.as_posix()}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, timeout=10)
    else:
        conn = sqlite3.connect(db_path, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_conn(db_path: Path | None = None, readonly: bool = False):
    path = db_path or DEFAULT_DB_PATH
    conn = _connect(path, readonly)
    try:
        yield conn
    finally:
        conn.close()


def init_db(db_path: Path | None = None) -> None:
    """Aplica `schema.sql` + migraciones idempotentes."""
    path = db_path or DEFAULT_DB_PATH
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_conn(path) as conn:
        conn.executescript(sql)
        _apply_migrations(conn)


def _apply_migrations(conn: sqlite3.Connection) -> None:
    """Migraciones para DBs viejas. Cada paso idempotente."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(products)").fetchall()}
    if "image_url" not in cols:
        conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT")


def upsert_chain(conn: sqlite3.Connection, chain: Chain) -> None:
    conn.execute(
        """
        INSERT INTO chains (id, slug, display_name, engine, base_url, sales_channel, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            slug          = excluded.slug,
            display_name  = excluded.display_name,
            engine        = excluded.engine,
            base_url      = excluded.base_url,
            sales_channel = excluded.sales_channel,
            active        = excluded.active
        """,
        (
            chain.id, chain.slug, chain.display_name, chain.engine,
            chain.base_url, chain.sales_channel, int(chain.active),
        ),
    )


def get_chains(conn: sqlite3.Connection, only_active: bool = True) -> list[Chain]:
    sql = "SELECT * FROM chains"
    if only_active:
        sql += " WHERE active = 1"
    sql += " ORDER BY id"
    rows = conn.execute(sql).fetchall()
    return [Chain(**dict(r)) for r in rows]


def get_chain_by_slug(conn: sqlite3.Connection, slug: str) -> Chain | None:
    row = conn.execute("SELECT * FROM chains WHERE slug = ?", (slug,)).fetchone()
    return Chain(**dict(row)) if row else None


def upsert_product(conn: sqlite3.Connection, ean: str, name_norm: str,
                   brand_norm: str | None, unit_value: float | None,
                   unit_kind: str | None, image_url: str | None = None,
                   now: str | None = None) -> None:
    now = now or _utcnow_iso()
    conn.execute(
        """
        INSERT INTO products (ean, name_norm, brand_norm, unit_value, unit_kind,
                              image_url, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ean) DO UPDATE SET
            name_norm    = excluded.name_norm,
            brand_norm   = excluded.brand_norm,
            unit_value   = COALESCE(excluded.unit_value, products.unit_value),
            unit_kind    = COALESCE(excluded.unit_kind, products.unit_kind),
            image_url    = COALESCE(excluded.image_url, products.image_url),
            last_seen_at = excluded.last_seen_at
        """,
        (ean, name_norm, brand_norm, unit_value, unit_kind, image_url, now, now),
    )
    # FTS: replace pattern (delete + insert) para mantener sincronía.
    conn.execute("DELETE FROM products_fts WHERE ean = ?", (ean,))
    conn.execute(
        "INSERT INTO products_fts (ean, name_norm, brand_norm) VALUES (?, ?, ?)",
        (ean, name_norm, brand_norm or ""),
    )


def insert_price_batch(
    conn: sqlite3.Connection,
    chain_id: int,
    scraped_at: str,
    prices: Iterable[ScrapedProduct],
) -> int:
    """Inserta precios de un scrape. Transacción explícita."""
    rows = [
        (
            p.ean, chain_id, scraped_at,
            p.price_list, p.price_effective, int(p.is_promo),
            p.name_in_chain, p.product_url, p.sku_id,
        )
        for p in prices
    ]
    if not rows:
        return 0
    conn.execute("BEGIN")
    try:
        conn.executemany(
            """
            INSERT OR REPLACE INTO product_prices
                (ean, chain_id, scraped_at, price_list, price_effective, is_promo,
                 name_in_chain, product_url, sku_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return len(rows)


def start_run(conn: sqlite3.Connection, chain_id: int) -> int:
    cur = conn.execute(
        "INSERT INTO scrape_runs (chain_id, started_at, status) VALUES (?, ?, 'running')",
        (chain_id, _utcnow_iso()),
    )
    return cur.lastrowid


def finish_run(conn: sqlite3.Connection, run_id: int, status: str,
               products_seen: int, error_msg: str | None = None) -> None:
    conn.execute(
        """UPDATE scrape_runs
           SET finished_at = ?, status = ?, products_seen = ?, error_msg = ?
           WHERE id = ?""",
        (_utcnow_iso(), status, products_seen, error_msg, run_id),
    )


def latest_prices_for_eans(
    conn: sqlite3.Connection, eans: list[str], chain_ids: list[int] | None = None,
) -> list[dict]:
    """Devuelve last price por (ean, chain) para los EANs pedidos."""
    if not eans:
        return []
    placeholders = ",".join("?" * len(eans))
    sql = f"SELECT * FROM v_latest_prices WHERE ean IN ({placeholders})"
    params: list = list(eans)
    if chain_ids:
        sql += f" AND chain_id IN ({','.join('?' * len(chain_ids))})"
        params.extend(chain_ids)
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]
