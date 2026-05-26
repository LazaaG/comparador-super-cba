"""Semilla idempotente de la tabla `chains`."""
from __future__ import annotations

from pathlib import Path

from core.models import Chain
from storage.db import get_conn, init_db, upsert_chain

SEED: list[Chain] = [
    Chain(id=1, slug="disco",     display_name="Disco",
          engine="vtex",   base_url="https://www.disco.com.ar",     active=True),
    Chain(id=2, slug="jumbo",     display_name="Jumbo",
          engine="vtex",   base_url="https://www.jumbo.com.ar",     active=True),
    Chain(id=3, slug="vea",       display_name="Vea",
          engine="vtex",   base_url="https://www.vea.com.ar",       active=True),
    Chain(id=4, slug="changomas", display_name="ChangoMas",
          engine="vtex",   base_url="https://www.masonline.com.ar", active=True),
    Chain(id=5, slug="dino",      display_name="Dino Online",
          engine="endeca", base_url="https://www.dinoonline.com.ar", active=True),
    Chain(id=6, slug="mami",      display_name="Super MAMI",
          engine="endeca", base_url="https://www.supermami.com.ar", active=True),
    # Carrefour requiere TLS impersonation (curl_cffi). Activado con cliente protegido.
    Chain(id=7, slug="carrefour", display_name="Carrefour",
          engine="vtex",   base_url="https://www.carrefour.com.ar", active=True),
]


def seed(db_path: Path | None = None) -> int:
    init_db(db_path)
    with get_conn(db_path) as conn:
        for ch in SEED:
            upsert_chain(conn, ch)
    return len(SEED)


if __name__ == "__main__":
    n = seed()
    print(f"Seeded {n} chains.")
