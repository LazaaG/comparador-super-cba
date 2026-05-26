"""GET /chains — listado para el frontend."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends

from api.deps import get_db
from api.schemas import ChainInfo

router = APIRouter()


@router.get("/chains", response_model=list[ChainInfo])
def list_chains(conn: sqlite3.Connection = Depends(get_db)) -> list[ChainInfo]:
    rows = conn.execute(
        "SELECT slug, display_name, engine, active FROM chains ORDER BY id"
    ).fetchall()
    return [
        ChainInfo(slug=r["slug"], display_name=r["display_name"],
                  engine=r["engine"], active=bool(r["active"]))
        for r in rows
    ]
