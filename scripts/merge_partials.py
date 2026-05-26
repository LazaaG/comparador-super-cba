"""Consolida múltiples SQLite parciales (uno por cadena) en data/precios.sqlite.

Cada job de GitHub Actions sube su parcial como artifact. El job final descarga
todos y corre este script para mergear en la DB canónica.
"""
from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
from pathlib import Path

from storage.db import get_conn, init_db
from storage.seed_chains import seed

log = logging.getLogger("merge")


def merge_partial(target: sqlite3.Connection, partial_path: Path) -> tuple[int, int]:
    """Mergea un parcial al target. Devuelve (n_products, n_prices) copiados."""
    log.info("Merging %s", partial_path)
    # Forzar checkpoint del WAL del parcial: si quedan WAL+SHM abiertos
    # el ATTACH posterior pega "database partial is locked".
    pconn = sqlite3.connect(partial_path)
    try:
        pconn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        pconn.execute("PRAGMA journal_mode = DELETE")
    finally:
        pconn.close()
    target.execute("ATTACH DATABASE ? AS partial", (str(partial_path),))
    try:
        # 1) Productos: upsert por EAN.
        cur = target.execute("""
            INSERT INTO products (ean, name_norm, brand_norm, unit_value, unit_kind,
                                  image_url, first_seen_at, last_seen_at)
            SELECT ean, name_norm, brand_norm, unit_value, unit_kind,
                   image_url, first_seen_at, last_seen_at
            FROM partial.products
            WHERE TRUE
            ON CONFLICT(ean) DO UPDATE SET
                name_norm    = excluded.name_norm,
                brand_norm   = excluded.brand_norm,
                unit_value   = COALESCE(excluded.unit_value, products.unit_value),
                unit_kind    = COALESCE(excluded.unit_kind, products.unit_kind),
                image_url    = COALESCE(excluded.image_url, products.image_url),
                last_seen_at = excluded.last_seen_at
        """)
        n_products = cur.rowcount

        # 2) FTS: rebuild para los EANs nuevos.
        target.execute("""
            DELETE FROM products_fts
            WHERE ean IN (SELECT ean FROM partial.products)
        """)
        target.execute("""
            INSERT INTO products_fts (ean, name_norm, brand_norm)
            SELECT ean, name_norm, COALESCE(brand_norm, '')
            FROM partial.products
        """)

        # 3) Precios: INSERT OR REPLACE.
        cur = target.execute("""
            INSERT OR REPLACE INTO product_prices
                (ean, chain_id, scraped_at, price_list, price_effective, is_promo,
                 name_in_chain, product_url, sku_id)
            SELECT ean, chain_id, scraped_at, price_list, price_effective, is_promo,
                   name_in_chain, product_url, sku_id
            FROM partial.product_prices
        """)
        n_prices = cur.rowcount

        # 4) Scrape runs: copy as-is.
        target.execute("""
            INSERT INTO scrape_runs (chain_id, started_at, finished_at, status,
                                     products_seen, error_msg)
            SELECT chain_id, started_at, finished_at, status,
                   products_seen, error_msg
            FROM partial.scrape_runs
        """)
    finally:
        target.execute("DETACH DATABASE partial")
    return n_products, n_prices


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr,
                        format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=Path, required=True,
                        help="DB canónica destino (data/precios.sqlite)")
    parser.add_argument("--partials-dir", type=Path, required=True,
                        help="Directorio con los .sqlite parciales")
    args = parser.parse_args(argv)

    init_db(args.target)
    seed(args.target)

    partials = sorted(args.partials_dir.glob("*.sqlite"))
    if not partials:
        log.error("No se encontraron parciales en %s", args.partials_dir)
        return 2

    total_p = total_pr = 0
    # Cada parcial = una transacción independiente. ATTACH no convive bien
    # con BEGIN explícito sobre target (mantiene lock en el partial al DETACH).
    for p in partials:
        with get_conn(args.target) as conn:
            np_, npr = merge_partial(conn, p)
            total_p += np_
            total_pr += npr

    log.info("Merge OK: %d productos | %d precios", total_p, total_pr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
