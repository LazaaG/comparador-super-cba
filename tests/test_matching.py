"""Tests de matching."""
from __future__ import annotations

from datetime import UTC, datetime

from core.matching import fuzzy_match, group_by_ean
from core.models import CanonicalProduct, ScrapedProduct


def _sp(ean: str, name: str, brand: str | None = None,
        unit_value: float | None = None, unit_kind: str | None = None) -> ScrapedProduct:
    return ScrapedProduct(ean=ean, name_in_chain=name, brand=brand,
                          unit_value=unit_value, unit_kind=unit_kind,
                          price_list=1.0, price_effective=1.0)


def _cp(ean: str, name_norm: str, brand_norm: str | None = None,
        unit_value: float | None = None, unit_kind: str | None = None) -> CanonicalProduct:
    now = datetime.now(UTC)
    return CanonicalProduct(ean=ean, name_norm=name_norm, brand_norm=brand_norm,
                            unit_value=unit_value, unit_kind=unit_kind,
                            first_seen_at=now, last_seen_at=now)


def test_group_by_ean_groups():
    a = _sp("7790895000119", "Coca Cola 2.25L")
    b = _sp("7790895000119", "Coca Cola Botella 2.25 L")
    c = _sp("7790070410016", "Leche La Serenísima 1L")
    out = group_by_ean([a, b, c])
    assert set(out.keys()) == {"7790895000119", "7790070410016"}
    assert len(out["7790895000119"]) == 2
    assert len(out["7790070410016"]) == 1


def test_fuzzy_match_finds_similar_name_same_brand_unit():
    unknown = _sp("X", "coca cola 2.25 lt", brand="coca cola",
                  unit_value=2.25, unit_kind="L")
    candidates = [
        _cp("7790895000119", "coca cola sabor original 2.25l",
            brand_norm="coca cola", unit_value=2.25, unit_kind="L"),
        _cp("7790070410016", "leche entera 1l",
            brand_norm="la serenisima", unit_value=1.0, unit_kind="L"),
    ]
    m = fuzzy_match(unknown, candidates)
    assert m is not None and m.ean == "7790895000119"


def test_fuzzy_match_returns_none_below_threshold():
    unknown = _sp("X", "producto totalmente distinto")
    candidates = [_cp("Y", "otra cosa")]
    assert fuzzy_match(unknown, candidates) is None


def test_fuzzy_match_brand_mismatch_blocks():
    unknown = _sp("X", "leche 1l", brand="la serenisima",
                  unit_value=1.0, unit_kind="L")
    candidates = [_cp("Y", "leche 1l", brand_norm="sancor",
                      unit_value=1.0, unit_kind="L")]
    assert fuzzy_match(unknown, candidates) is None


def test_fuzzy_match_unit_mismatch_blocks():
    unknown = _sp("X", "leche entera", brand="la serenisima",
                  unit_value=1.0, unit_kind="L")
    candidates = [_cp("Y", "leche entera", brand_norm="la serenisima",
                      unit_value=900.0, unit_kind="ml")]
    assert fuzzy_match(unknown, candidates) is None


def test_fuzzy_match_empty_candidates():
    unknown = _sp("X", "cualquier cosa")
    assert fuzzy_match(unknown, []) is None
