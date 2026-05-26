"""Config estática de cadenas. Espejo de `storage/seed_chains.py`."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Engine = Literal["vtex", "endeca"]


@dataclass(frozen=True)
class ChainConfig:
    slug: str
    display_name: str
    engine: Engine
    base_url: str
    active: bool = True
    # Override por cadena si Endeca o VTEX necesita parámetros distintos
    notes: str | None = None


CHAINS: dict[str, ChainConfig] = {
    "disco":     ChainConfig("disco",     "Disco",       "vtex",   "https://www.disco.com.ar"),
    "jumbo":     ChainConfig("jumbo",     "Jumbo",       "vtex",   "https://www.jumbo.com.ar"),
    "vea":       ChainConfig("vea",       "Vea",         "vtex",   "https://www.vea.com.ar"),
    "changomas": ChainConfig("changomas", "ChangoMas",   "vtex",   "https://www.masonline.com.ar"),
    "dino":      ChainConfig("dino",      "Dino Online", "endeca", "https://www.dinoonline.com.ar",
                             notes="requiere fijar sucursal Córdoba en sesión"),
    "mami":      ChainConfig("mami",      "Super MAMI",  "endeca", "https://www.supermami.com.ar"),
    "carrefour": ChainConfig("carrefour", "Carrefour",   "vtex",   "https://www.carrefour.com.ar",
                             active=True, notes="WAF bypaseado con curl_cffi TLS impersonation"),
}

POSTAL_CODE_CBA = "5000"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
DEFAULT_RATE_LIMIT_RPS = 8.0  # VTEX aguanta sin problemas, Endeca también
DEFAULT_CONCURRENCY = 8       # categorías concurrentes por cadena
DEFAULT_TIMEOUT_S = 30.0
