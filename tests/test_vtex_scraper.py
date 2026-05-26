"""Tests del scraper VTEX usando fixtures JSON reales (offline)."""
from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
import respx

from core.models import Chain
from scrapers.base import RateLimiter
from scrapers.vtex import VTEXScraper

FIXTURES = Path(__file__).parent / "fixtures" / "vtex"

DISCO = Chain(id=1, slug="disco", display_name="Disco", engine="vtex",
              base_url="https://www.disco.com.ar")


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture()
def fast_rate():
    """RateLimiter sin sleep para que los tests sean instantáneos."""
    return RateLimiter(rps=10_000)


@pytest.mark.asyncio
async def test_discover_categories_from_real_tree(fast_rate):
    tree = _load("disco_category_tree.json")
    async with respx.mock(base_url=DISCO.base_url) as mock:
        mock.get("/api/catalog_system/pub/category/tree/5/").respond(json=tree)
        async with httpx.AsyncClient(base_url=DISCO.base_url) as client:
            scraper = VTEXScraper(DISCO, client, fast_rate)
            cats = await scraper.discover_categories()
    assert len(cats) > 5
    assert cats == sorted(set(cats))
    # Solo hojas: ningún path debería ser prefijo de otro.
    for i, a in enumerate(cats):
        for b in cats[i+1:]:
            assert not b.startswith(a + "/"), f"{a} es padre de {b}"


@pytest.mark.asyncio
async def test_scrape_category_parses_real_payload(fast_rate):
    products_payload = _load("disco_products_search.json")
    async with respx.mock(base_url=DISCO.base_url, assert_all_called=False) as mock:
        mock.get("/api/catalog_system/pub/products/search/almacen",
                 params={"_from": 0, "_to": 49}).respond(json=products_payload)
        # Segunda página vacía → fin de paginación
        mock.get("/api/catalog_system/pub/products/search/almacen",
                 params={"_from": 50, "_to": 99}).respond(json=[])

        async with httpx.AsyncClient(base_url=DISCO.base_url) as client:
            scraper = VTEXScraper(DISCO, client, fast_rate)
            products = [p async for p in scraper.scrape_category("almacen")]

    # El fixture trae 20 productos. El primero ("Milanesa Nalga") tiene EAN
    # interno (empieza con 2 → 13 dígitos) y debe ser descartado.
    assert len(products) > 0
    assert all(len(p.ean) in (8, 13) for p in products)
    assert all(not p.ean.startswith("2") or len(p.ean) == 8 for p in products)
    assert all(p.price_effective > 0 for p in products)


@pytest.mark.asyncio
async def test_corrupt_list_price_fallback(fast_rate):
    """Cencosud a veces devuelve ListPrice astronómico. Verificar fallback."""
    payload = [{
        "productName": "Test", "brand": "X", "link": "https://x",
        "items": [{
            "itemId": "1", "ean": "7790895000119",
            "sellers": [{"commertialOffer": {
                "Price": 1000.0,
                "ListPrice": 999999.0,  # corrupto
                "PriceWithoutDiscount": 1200.0,
                "IsAvailable": True, "Teasers": [], "PromotionTeasers": [],
            }}],
        }],
    }]
    async with respx.mock(base_url=DISCO.base_url, assert_all_called=False) as mock:
        mock.get("/api/catalog_system/pub/products/search/x",
                 params={"_from": 0, "_to": 49}).respond(json=payload)
        mock.get("/api/catalog_system/pub/products/search/x",
                 params={"_from": 50, "_to": 99}).respond(json=[])
        async with httpx.AsyncClient(base_url=DISCO.base_url) as client:
            scraper = VTEXScraper(DISCO, client, fast_rate)
            products = [p async for p in scraper.scrape_category("x")]
    assert len(products) == 1
    p = products[0]
    assert p.price_effective == 1000.0
    # Fallback usa PriceWithoutDiscount (1200) en vez del ListPrice corrupto.
    assert p.price_list == 1200.0
    assert p.is_promo is True  # price_eff < price_list


@pytest.mark.asyncio
async def test_unavailable_item_skipped(fast_rate):
    payload = [{
        "productName": "X", "brand": "X", "link": "x",
        "items": [{"itemId": "1", "ean": "7790895000119", "sellers": [{
            "commertialOffer": {"Price": 100, "ListPrice": 100, "IsAvailable": False}
        }]}],
    }]
    async with respx.mock(base_url=DISCO.base_url, assert_all_called=False) as mock:
        mock.get("/api/catalog_system/pub/products/search/x",
                 params={"_from": 0, "_to": 49}).respond(json=payload)
        async with httpx.AsyncClient(base_url=DISCO.base_url) as client:
            scraper = VTEXScraper(DISCO, client, fast_rate)
            products = [p async for p in scraper.scrape_category("x")]
    assert products == []


@pytest.mark.asyncio
async def test_dedupe_by_ean_across_categories(fast_rate):
    tree = [{"url": "/a", "name": "a", "children": []},
            {"url": "/b", "name": "b", "children": []}]
    same_product = [{
        "productName": "Same", "brand": "X", "link": "x",
        "items": [{"itemId": "1", "ean": "7790895000119", "sellers": [{
            "commertialOffer": {"Price": 100, "ListPrice": 100,
                                 "PriceWithoutDiscount": 100, "IsAvailable": True,
                                 "Teasers": [], "PromotionTeasers": []}
        }]}],
    }]
    async with respx.mock(base_url=DISCO.base_url, assert_all_called=False) as mock:
        mock.get("/api/catalog_system/pub/category/tree/5/").respond(json=tree)
        mock.get("/api/catalog_system/pub/products/search/a").respond(json=same_product)
        mock.get("/api/catalog_system/pub/products/search/b").respond(json=same_product)
        async with httpx.AsyncClient(base_url=DISCO.base_url) as client:
            scraper = VTEXScraper(DISCO, client, fast_rate)
            products = [p async for p in scraper.run()]
    assert len(products) == 1
    assert scraper.stats.products_seen == 1
