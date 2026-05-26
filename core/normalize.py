"""Normalización: EAN checksum, unidades, nombres, marcas."""
from __future__ import annotations

import re
import unicodedata

# Decimal AR: punto o coma. Unidad: kg, g, gr, l, ml, cc, un.
_UNIT_RE = re.compile(
    r"(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|gr|g|ml|cc|l)\b",
    re.IGNORECASE,
)
_PACK_RE = re.compile(r"\bx\s*(?P<count>\d+)\b", re.IGNORECASE)

_PAREN_RE = re.compile(r"\([^)]*\)")
_WS_RE = re.compile(r"\s+")


def is_valid_ean(ean: str) -> bool:
    """Valida EAN-8 o EAN-13 con checksum.

    Rechaza también EANs internos VTEX que empiezan con `2` y son productos
    pesables a granel — esos no son intercambiables entre cadenas y no sirven
    como clave canónica.
    """
    if not ean or not ean.isdigit():
        return False
    if len(ean) not in (8, 13):
        return False
    if set(ean) == {"0"}:
        return False
    # EANs internos pesables: prefijo "2" para EAN-13 → rechazar.
    if len(ean) == 13 and ean.startswith("2"):
        return False

    digits = [int(d) for d in ean]
    body, check = digits[:-1], digits[-1]
    # EAN-13: pesos 1,3,1,3,... empezando por la izquierda.
    # EAN-8:  pesos 3,1,3,1,...
    if len(ean) == 13:
        weights = [1 if i % 2 == 0 else 3 for i in range(12)]
    else:
        weights = [3 if i % 2 == 0 else 1 for i in range(7)]
    total = sum(d * w for d, w in zip(body, weights, strict=True))
    return (10 - total % 10) % 10 == check


def _strip_diacritics(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def normalize_name(raw: str) -> str:
    """Lower + sin tildes + sin paréntesis + espacios colapsados."""
    if not raw:
        return ""
    s = _strip_diacritics(raw).lower()
    s = _PAREN_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def normalize_brand(raw: str | None) -> str | None:
    """Marca: lower + sin tildes + trim. Cadena vacía → None."""
    if not raw:
        return None
    s = _strip_diacritics(raw).lower().strip()
    return s or None


def parse_unit(name: str) -> tuple[float | None, str | None]:
    """Extrae (valor, unidad) del nombre. Devuelve (None, None) si no encuentra."""
    if not name:
        return None, None

    m = _UNIT_RE.search(name)
    if m:
        value = float(m.group("value").replace(",", "."))
        unit = m.group("unit").lower()
        # Normalizar variantes: gr → g, L → L, ml → ml, cc → cc, kg → kg.
        unit = {"gr": "g", "l": "L"}.get(unit, unit)
        return value, unit

    m = _PACK_RE.search(name)
    if m:
        return float(m.group("count")), "un"

    return None, None
