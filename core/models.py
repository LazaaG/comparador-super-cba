"""Modelos de dominio. Pydantic v2."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Engine = Literal["vtex", "endeca"]
UnitKind = Literal["L", "ml", "g", "kg", "un", "cc"]
CartMode = Literal["best_effort", "complete_only"]


class Chain(BaseModel):
    """Cadena de supermercado configurada."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    display_name: str
    engine: Engine
    base_url: str
    sales_channel: str | None = None
    active: bool = True


class ScrapedProduct(BaseModel):
    """Producto crudo emitido por un scraper, pre-normalización."""
    ean: str
    name_in_chain: str
    brand: str | None = None
    unit_value: float | None = None
    unit_kind: UnitKind | None = None
    price_list: float
    price_effective: float
    is_promo: bool = False
    sku_id: str | None = None
    product_url: str | None = None
    image_url: str | None = None

    @field_validator("ean")
    @classmethod
    def _strip_ean(cls, v: str) -> str:
        return v.strip()


class CanonicalProduct(BaseModel):
    """Producto canónico (clave EAN)."""
    ean: str
    name_norm: str
    brand_norm: str | None = None
    unit_value: float | None = None
    unit_kind: UnitKind | None = None
    image_url: str | None = None
    first_seen_at: datetime
    last_seen_at: datetime


class PriceRow(BaseModel):
    """Precio observado en una cadena."""
    ean: str
    chain_id: int
    chain_slug: str
    scraped_at: datetime
    price_list: float
    price_effective: float
    is_promo: bool
    name_in_chain: str | None = None
    product_url: str | None = None
    sku_id: str | None = None


class CartItem(BaseModel):
    """Ítem del carrito (input del usuario)."""
    ean: str
    qty: int = Field(ge=1)


class CartItemFound(BaseModel):
    """Ítem cubierto por una cadena."""
    ean: str
    qty: int
    unit_price: float
    subtotal: float
    is_promo: bool
    name_in_chain: str | None = None
    name: str | None = None       # nombre canónico (para front, opcional)
    image_url: str | None = None  # imagen canónica (para front, opcional)


class CartItemMissing(BaseModel):
    """Ítem que la cadena NO tiene."""
    ean: str
    qty: int
    name: str | None = None
    image_url: str | None = None


class CartChainResult(BaseModel):
    """Resultado por cadena para un carrito."""
    chain: str  # slug
    chain_name: str  # display
    covered_total: float
    items_found: list[CartItemFound]
    items_missing: list[CartItemMissing]
    coverage_pct: float = Field(ge=0.0, le=1.0)
    has_full_coverage: bool


class CartComparison(BaseModel):
    """Respuesta de /cart/compare."""
    mode: CartMode
    total_items: int
    ranking: list[CartChainResult]
