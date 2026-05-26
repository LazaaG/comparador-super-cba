"""GET /health — última corrida exitosa por cadena."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from api.deps import db_path, get_db
from api.schemas import HealthChainStatus, HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(conn: sqlite3.Connection = Depends(get_db)) -> HealthResponse:
    rows = conn.execute("""
        SELECT c.slug AS chain,
               (SELECT MAX(r.started_at) FROM scrape_runs r
                WHERE r.chain_id = c.id) AS last_run_at,
               (SELECT r.status FROM scrape_runs r
                WHERE r.chain_id = c.id
                ORDER BY r.started_at DESC LIMIT 1) AS status,
               (SELECT r.products_seen FROM scrape_runs r
                WHERE r.chain_id = c.id
                ORDER BY r.started_at DESC LIMIT 1) AS products_seen
        FROM chains c WHERE c.active = 1
        ORDER BY c.id
    """).fetchall()

    chains = [HealthChainStatus(**dict(r)) for r in rows]
    ok = any(c.status == "ok" for c in chains)
    return HealthResponse(ok=ok, db_path=str(db_path()), chains=chains)
