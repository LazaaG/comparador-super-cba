"""Tests de normalización: EAN checksum, unidades, nombres, marcas."""
from __future__ import annotations

import pytest

from core.normalize import (
    is_valid_ean,
    normalize_brand,
    normalize_name,
    parse_unit,
)

# ---------- EAN checksum ----------

VALID_EANS = [
    "7790895000119",   # 13 dígitos
    "7798096010012",   # Pannocchia (verificado en Endeca)
    "0012345678905",   # ejemplo público
    "5901234123457",   # ejemplo wiki EAN-13
    "73513537",        # EAN-8 válido
]

INVALID_EANS = [
    "",
    "abc",
    "1234567890123",   # 13 dígitos, checksum incorrecto
    "00000000",        # todos ceros (rechazo de basura)
    "20012345678901",  # 14 dígitos, no es EAN estándar
    "2532035000000",   # EAN interno VTEX (empieza con 2, balance pesable) → rechazar
]


@pytest.mark.parametrize("ean", VALID_EANS)
def test_valid_ean_passes(ean: str):
    assert is_valid_ean(ean) is True


@pytest.mark.parametrize("ean", INVALID_EANS)
def test_invalid_ean_fails(ean: str):
    assert is_valid_ean(ean) is False


# ---------- parse_unit ----------

@pytest.mark.parametrize("name,expected", [
    ("Coca Cola 2.25 L", (2.25, "L")),
    ("Coca Cola 2,25L", (2.25, "L")),
    ("Leche La Serenísima 1L", (1.0, "L")),
    ("Yogur Yogurísimo 900 ml", (900.0, "ml")),
    ("Yogur 900ml", (900.0, "ml")),
    ("Harina 000 1kg", (1.0, "kg")),
    ("Galletitas Surtido 400 g", (400.0, "g")),
    ("Galletitas 400gr", (400.0, "g")),
    ("Pack Cerveza x6", (6.0, "un")),
    ("Producto sin unidad", (None, None)),
    ("Aceite oliva 500cc", (500.0, "cc")),
])
def test_parse_unit(name: str, expected: tuple):
    assert parse_unit(name) == expected


# ---------- normalize_name ----------

def test_normalize_name_lowercases():
    assert normalize_name("COCA COLA") == "coca cola"


def test_normalize_name_strips_diacritics():
    assert normalize_name("La Serenísima") == "la serenisima"


def test_normalize_name_collapses_spaces():
    assert normalize_name("  Coca   Cola  2.25L  ") == "coca cola 2.25l"


def test_normalize_name_drops_parens():
    assert "(" not in normalize_name("Pack Cerveza Quilmes (x6 latas)")


# ---------- normalize_brand ----------

def test_normalize_brand_titlecases_and_strips():
    assert normalize_brand("  COCA COLA  ") == "coca cola"


def test_normalize_brand_none_passthrough():
    assert normalize_brand(None) is None
    assert normalize_brand("") is None
