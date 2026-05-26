"""Matcheo de productos entre cadenas.

Estrategia primaria: agrupar por EAN (clave canónica).
Estrategia fallback: fuzzy match por nombre+marca+unidad cuando una cadena
no expone EAN (no esperado en el MVP, pero queda preparado).
"""
from __future__ import annotations

from collections import defaultdict

from rapidfuzz import fuzz

from core.models import CanonicalProduct, ScrapedProduct

FUZZY_THRESHOLD = 85  # score 0..100


def group_by_ean(scraped: list[ScrapedProduct]) -> dict[str, list[ScrapedProduct]]:
    """Agrupa los productos scrapeados por EAN."""
    out: dict[str, list[ScrapedProduct]] = defaultdict(list)
    for sp in scraped:
        out[sp.ean].append(sp)
    return dict(out)


def fuzzy_match(
    unknown: ScrapedProduct, candidates: list[CanonicalProduct],
) -> CanonicalProduct | None:
    """Para una cadena sin EAN, intenta matchear por nombre+marca+unidad.

    Requisitos para considerar match:
      - score(name) ≥ FUZZY_THRESHOLD
      - misma marca normalizada (si ambas la tienen)
      - misma unidad (kind + value) si ambas la tienen
    """
    if not candidates:
        return None

    best: tuple[float, CanonicalProduct] | None = None
    for c in candidates:
        if unknown.brand and c.brand_norm and unknown.brand.lower() != c.brand_norm:
            continue
        if (unknown.unit_kind and c.unit_kind
                and (unknown.unit_kind != c.unit_kind
                     or unknown.unit_value != c.unit_value)):
            continue
        score = fuzz.WRatio(unknown.name_in_chain, c.name_norm)
        if score >= FUZZY_THRESHOLD and (best is None or score > best[0]):
            best = (score, c)

    return best[1] if best else None
