"""Schemas request/response de la API. Pydantic v2."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from core.models import CartChainResult, CartItem, CartMode


class ChainInfo(BaseModel):
    slug: str
    display_name: str
    engine: str
    active: bool


class PriceInChain(BaseModel):
    chain: str
    chain_name: str
    price_list: float
    price_effective: float
    is_promo: bool
    name_in_chain: str | None = None
    product_url: str | None = None
    scraped_at: datetime


class SearchResultItem(BaseModel):
    ean: str
    name: str
    brand: str | None = None
    unit_value: float | None = None
    unit_kind: str | None = None
    image_url: str | None = None
    prices: list[PriceInChain]
    cheapest_chain: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int


class CartCompareRequest(BaseModel):
    items: list[CartItem] = Field(default_factory=list)
    mode: CartMode = "best_effort"


class CartCompareResponse(BaseModel):
    mode: CartMode
    total_items: int
    ranking: list[CartChainResult]


class HealthChainStatus(BaseModel):
    chain: str
    last_run_at: datetime | None
    status: str | None
    products_seen: int | None


class HealthResponse(BaseModel):
    ok: bool
    db_path: str
    chains: list[HealthChainStatus]
