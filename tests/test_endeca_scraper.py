"""Tests del scraper Endeca usando fixture real de MAMI."""
from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
import respx

from core.models import Chain
from scrapers.base import RateLimiter
from scrapers.endeca import EndecaScraper

FIXTURES = Path(__file__).parent / "fixtures" / "endeca"
MAMI = Chain(id=6, slug="mami", display_name="Super MAMI", engine="endeca",
             base_url="https://www.supermami.com.ar")


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture()
def fast_rate():
    return RateLimiter(rps=10_000)


@pytest.mark.asyncio
async def test_scrape_category_parses_real_endeca(fast_rate):
    payload = _load("mami_aceites.json")
    cat_path = "/super/categoria/aceites/_/N-5j2xvv"
    empty = {"contents": [{"records": [], "totalNumRecs": 37}]}
    async with respx.mock(base_url=MAMI.base_url, assert_all_called=False) as mock:
        mock.get(cat_path,
                 params={"format": "json", "Nrpp": 60, "No": 0}).respond(json=payload)
        mock.get(cat_path,
                 params={"format": "json", "Nrpp": 60, "No": 60}).respond(json=empty)

        async with httpx.AsyncClient(base_url=MAMI.base_url) as client:
            scraper = EndecaScraper(MAMI, client, fast_rate)
            products = [p async for p in scraper.scrape_category(cat_path)]

    # 20 records en el fixture, todos con EAN válido y precio > 0
    assert len(products) >= 15
    p = products[0]
    assert p.ean == "7798096010012"
    assert p.brand == "PANNOCCHIA"
    assert "ACEITE" in p.name_in_chain.upper()
    assert p.price_effective == 14580.0
    assert p.price_list == 14580.0  # no hay sku.listPrice → fallback al efectivo
    assert p.is_promo is False
    assert p.sku_id == "prod2320128"


@pytest.mark.asyncio
async def test_discover_categories_from_html(fast_rate):
    html = """
    <html><body>
      <a href="/super/categoria/almacen/_/N-1z141ay">Almacén</a>
      <a href="/super/categoria/lacteos/_/N-abc123">Lácteos</a>
      <a href="/super/categoria/almacen/_/N-1z141ay">Duplicado</a>
    </body></html>
    """
    async with respx.mock(base_url=MAMI.base_url) as mock:
        mock.get("/super/home").respond(text=html)
        async with httpx.AsyncClient(base_url=MAMI.base_url) as client:
            scraper = EndecaScraper(MAMI, client, fast_rate)
            cats = await scraper.discover_categories()
    assert cats == [
        "/super/categoria/almacen/_/N-1z141ay",
        "/super/categoria/lacteos/_/N-abc123",
    ]


@pytest.mark.asyncio
async def test_empty_records_stops_pagination(fast_rate):
    """Cuando el cartridge devuelve records vacíos, parar."""
    empty = {"contents": [{"records": [], "totalNumRecs": 0}]}
    async with respx.mock(base_url=MAMI.base_url, assert_all_called=False) as mock:
        mock.get("/super/categoria/x/_/N-empty",
                 params={"format": "json", "Nrpp": 60, "No": 0}).respond(json=empty)
        async with httpx.AsyncClient(base_url=MAMI.base_url) as client:
            scraper = EndecaScraper(MAMI, client, fast_rate)
            products = [p async for p in scraper.scrape_category("/super/categoria/x/_/N-empty")]
    assert products == []


@pytest.mark.asyncio
async def test_invalid_ean_is_skipped(fast_rate):
    payload = {"contents": [{"records": [
        {"attributes": {
            "product.ean": ["2532035000000"],  # interno pesable, debe rechazarse
            "product.displayName": ["X"],
            "sku.activePrice": ["1000"],
        }},
        {"attributes": {
            "product.ean": ["7790895000119"],
            "product.displayName": ["Coca"],
            "sku.activePrice": ["2890"],
            "sku.listPrice": ["3200"],
        }},
    ], "totalNumRecs": 2}]}
    async with respx.mock(base_url=MAMI.base_url, assert_all_called=False) as mock:
        mock.get("/super/categoria/x/_/N-test",
                 params={"format": "json", "Nrpp": 60, "No": 0}).respond(json=payload)
        async with httpx.AsyncClient(base_url=MAMI.base_url) as client:
            scraper = EndecaScraper(MAMI, client, fast_rate)
            products = [p async for p in scraper.scrape_category("/super/categoria/x/_/N-test")]
    assert len(products) == 1
    assert products[0].ean == "7790895000119"
    assert products[0].is_promo is True  # 2890 < 3200
