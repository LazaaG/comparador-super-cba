"""Dependencias FastAPI: conexión read-only a SQLite."""
from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

from fastapi import HTTPException

from storage.db import DEFAULT_DB_PATH, get_conn


def db_path() -> Path:
    """Path a la DB. Override vía env `SUPER_DB_PATH` para tests."""
    env = os.getenv("SUPER_DB_PATH")
    return Path(env) if env else DEFAULT_DB_PATH


def get_db() -> Iterator[sqlite3.Connection]:
    path = db_path()
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"DB no inicializada en {path}. Correr scrapers o `storage.seed_chains`.",
        )
    with get_conn(path, readonly=True) as conn:
        yield conn
