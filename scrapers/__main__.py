"""CLI runner. Uso:
    python -m scrapers --chain disco
    python -m scrapers --all
    python -m scrapers --chain disco --limit-categories 2 --partial-db data/partials/disco.sqlite
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from core.normalize import normalize_brand, normalize_name
from scrapers.base import RateLimiter, build_client
from scrapers.config import CHAINS, ChainConfig
from scrapers.endeca import EndecaScraper
from scrapers.protected import build_protected_client
from scrapers.vtex import VTEXScraper
from storage.db import (
    finish_run,
    get_chain_by_slug,
    get_conn,
    init_db,
    insert_price_batch,
    start_run,
    upsert_product,
)
from storage.seed_chains import seed

log = logging.getLogger("scrapers.run")


def _build_scraper(cfg: ChainConfig, db_path: Path):
    """Devuelve la clase + chain DB row."""
    seed(db_path)
    with get_conn(db_path) as conn:
        chain = get_chain_by_slug(conn, cfg.slug)
    if chain is None:
        raise SystemExit(f"Chain {cfg.slug} no seedeada en {db_path}")
    return chain


async def _run_one(cfg: ChainConfig, db_path: Path,
                   limit_categories: int | None = None) -> int:
    if not cfg.active:
        log.warning("Cadena %s marcada como inactiva. Skip.", cfg.slug)
        return 0

    chain = _build_scraper(cfg, db_path)
    rate = RateLimiter()
    products_seen = 0
    status = "ok"
    error_msg: str | None = None

    # Cadenas con WAF (Carrefour) requieren TLS impersonation via curl_cffi.
    needs_protected = cfg.slug in {"carrefour"}
    client_ctx = (build_protected_client(cfg.base_url) if needs_protected
                  else build_client(cfg.base_url))

    async with client_ctx as client:
        if cfg.engine == "vtex":
            scraper = VTEXScraper(chain, client, rate)
        elif cfg.engine == "endeca":
            scraper = EndecaScraper(chain, client, rate)
        else:
            raise SystemExit(f"Motor desconocido: {cfg.engine}")

        scraped_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        with get_conn(db_path) as conn:
            run_id = start_run(conn, chain.id)

            batch: list = []
            try:
                async for product in scraper.run(limit_categories=limit_categories):
                    # Normalización antes de persistir.
                    name_norm = normalize_name(product.name_in_chain)
                    brand_norm = normalize_brand(product.brand)
                    upsert_product(conn, product.ean, name_norm, brand_norm,
                                   product.unit_value, product.unit_kind,
                                   image_url=product.image_url,
                                   now=scraped_at)
                    batch.append(product)

                    # Flush cada 200 ítems para no perder todo si crashea.
                    if len(batch) >= 200:
                        insert_price_batch(conn, chain.id, scraped_at, batch)
                        products_seen += len(batch)
                        batch = []

                if batch:
                    insert_price_batch(conn, chain.id, scraped_at, batch)
                    products_seen += len(batch)

                if scraper.stats.errors:
                    status = "partial"
                    error_msg = " | ".join(scraper.stats.errors[:5])
            except Exception as exc:
                status = "failed"
                error_msg = str(exc)
                log.exception("Scraper %s falló: %s", cfg.slug, exc)
            finally:
                finish_run(conn, run_id, status, products_seen, error_msg)
                # Persistir region+sc cacheado (lo setea prepare() en VTEXScraper)
                if scraper.chain.sales_channel != chain.sales_channel:
                    from storage.db import upsert_chain
                    upsert_chain(conn, scraper.chain)

    log.info("Cadena %s: %d productos. Status=%s", cfg.slug, products_seen, status)
    return products_seen


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser(description="Scrape supermercados.")
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--chain", choices=list(CHAINS.keys()))
    grp.add_argument("--all", action="store_true")
    parser.add_argument("--limit-categories", type=int, default=None,
                        help="Cap de categorías a recorrer (smoke test).")
    parser.add_argument("--db", type=Path, default=None,
                        help="Path a SQLite. Default: data/precios.sqlite")
    parser.add_argument("--sequential", action="store_true",
                        help="No paralelizar cadenas (debug).")
    args = parser.parse_args(argv)

    if args.chain:
        # Una sola cadena → comportamiento simple.
        db_path = args.db or _default_db()
        init_db(db_path)
        total = asyncio.run(_run_one(CHAINS[args.chain], db_path, args.limit_categories))
        log.info("Total productos en este run: %d", total)
        return 0

    # --all: parcial por cadena en paralelo + merge final.
    targets = [c for c in CHAINS.values() if c.active]
    final_db = args.db or _default_db()
    partials_dir = final_db.parent / "partials"
    partials_dir.mkdir(parents=True, exist_ok=True)

    async def _all_parallel() -> int:
        tasks = []
        for cfg in targets:
            partial = partials_dir / f"{cfg.slug}.sqlite"
            init_db(partial)
            tasks.append(_run_one(cfg, partial, args.limit_categories))
        if args.sequential:
            results = [await t for t in tasks]
        else:
            results = await asyncio.gather(*tasks, return_exceptions=True)
        total = 0
        for cfg, r in zip(targets, results, strict=True):
            if isinstance(r, Exception):
                log.error("Cadena %s explotó: %s", cfg.slug, r)
            else:
                total += int(r)
        return total

    total = asyncio.run(_all_parallel())

    # Merge parciales → DB final.
    log.info("Mergeando %d parciales en %s", len(targets), final_db)
    from scripts.merge_partials import main as merge_main
    rc = merge_main([
        "--target", str(final_db),
        "--partials-dir", str(partials_dir),
    ])
    if rc != 0:
        log.error("Merge falló con rc=%d", rc)
        return rc

    log.info("Total productos en este run: %d", total)
    return 0


def _default_db() -> Path:
    from storage.db import DEFAULT_DB_PATH
    return DEFAULT_DB_PATH


if __name__ == "__main__":
    raise SystemExit(main())
