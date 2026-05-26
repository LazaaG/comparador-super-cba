"""Tests de la API. Levantan una DB temporal poblada con productos sintéticos."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.models import ScrapedProduct
from storage.db import (
    finish_run,
    get_conn,
    init_db,
    insert_price_batch,
    start_run,
    upsert_product,
)
from storage.seed_chains import seed


def _make_db(path: Path) -> None:
    """DB poblada con 3 productos en 3 cadenas."""
    init_db(path)
    seed(path)
    products = [
        ("7790895000119", "coca cola 2.25l",     "coca cola",     2.25, "L"),
        ("7790070410016", "leche entera 1l",     "la serenisima", 1.0,  "L"),
        ("7790000000003", "azucar molida 1kg",   "ledesma",       1.0,  "kg"),
    ]
    now = "2026-05-23T03:00:00Z"
    with get_conn(path) as conn:
        for ean, n, b, uv, uk in products:
            upsert_product(conn, ean, n, b, uv, uk, now=now)
        # Precios disco: tiene los 3
        prices_disco = [
            ScrapedProduct(ean="7790895000119", name_in_chain="Coca Cola 2.25L",
                           price_list=3200, price_effective=2890, is_promo=True),
            ScrapedProduct(ean="7790070410016", name_in_chain="Leche Serenísima 1L",
                           price_list=1500, price_effective=1500),
            ScrapedProduct(ean="7790000000003", name_in_chain="Azúcar 1kg",
                           price_list=1565, price_effective=1565),
        ]
        # Precios jumbo: 2 de 3 (le falta azúcar)
        prices_jumbo = [
            ScrapedProduct(ean="7790895000119", name_in_chain="Coca 2.25",
                           price_list=3000, price_effective=3000),
            ScrapedProduct(ean="7790070410016", name_in_chain="Leche 1L",
                           price_list=1480, price_effective=1480),
        ]
        insert_price_batch(conn, chain_id=1, scraped_at=now, prices=prices_disco)
        insert_price_batch(conn, chain_id=2, scraped_at=now, prices=prices_jumbo)
        # Una corrida exitosa de Disco para que /health diga ok
        rid = start_run(conn, 1)
        finish_run(conn, rid, "ok", 3)


@pytest.fixture()
def client(tmp_path: Path):
    db = tmp_path / "api.sqlite"
    _make_db(db)
    os.environ["SUPER_DB_PATH"] = str(db)
    from api.main import app  # import diferido para que pille la env
    with TestClient(app) as c:
        yield c
    os.environ.pop("SUPER_DB_PATH", None)


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "comparador-super-cba"


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    slugs = [c["chain"] for c in body["chains"]]
    assert "disco" in slugs


def test_chains_list(client):
    r = client.get("/chains")
    assert r.status_code == 200
    slugs = [c["slug"] for c in r.json()]
    assert slugs[:6] == ["disco", "jumbo", "vea", "changomas", "dino", "mami"]


def test_search_by_ean(client):
    r = client.get("/search", params={"ean": "7790895000119"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    item = body["results"][0]
    assert item["ean"] == "7790895000119"
    assert item["cheapest_chain"] == "disco"  # 2890 < 3000
    assert len(item["prices"]) == 2  # Disco + Jumbo


def test_search_invalid_ean(client):
    r = client.get("/search", params={"ean": "0000"})
    assert r.status_code == 400


def test_search_no_params(client):
    r = client.get("/search")
    assert r.status_code == 400


def test_search_text(client):
    r = client.get("/search", params={"q": "coca cola"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(r["ean"] == "7790895000119" for r in body["results"])


def test_search_text_diacritic_insensitive(client):
    """Buscar 'serenisima' (sin tilde) debe encontrar 'leche serenísima'."""
    r = client.get("/search", params={"q": "serenisima"})
    assert r.status_code == 200
    eans = [x["ean"] for x in r.json()["results"]]
    assert "7790070410016" in eans


def test_cart_compare_ranks_jumbo_first_on_partial(client):
    """Carrito: coca + leche. Ambas cadenas cubren 100%, Jumbo más barato."""
    r = client.post("/cart/compare", json={
        "items": [
            {"ean": "7790895000119", "qty": 1},
            {"ean": "7790070410016", "qty": 1},
        ],
        "mode": "best_effort",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["total_items"] == 2
    # Jumbo: 3000+1480=4480 vs Disco: 2890+1500=4390 — Disco gana.
    assert body["ranking"][0]["chain"] == "disco"
    assert body["ranking"][0]["coverage_pct"] == 1.0


def test_cart_compare_partial_coverage(client):
    """Pido azúcar, que solo Disco tiene."""
    r = client.post("/cart/compare", json={
        "items": [
            {"ean": "7790895000119", "qty": 1},
            {"ean": "7790000000003", "qty": 2},  # solo Disco
        ],
        "mode": "best_effort",
    })
    body = r.json()
    assert body["total_items"] == 2
    disco = next(x for x in body["ranking"] if x["chain"] == "disco")
    jumbo = next(x for x in body["ranking"] if x["chain"] == "jumbo")
    assert disco["coverage_pct"] == 1.0
    assert jumbo["coverage_pct"] == 0.5
    assert {m["ean"] for m in jumbo["items_missing"]} == {"7790000000003"}


def test_cart_compare_complete_only_filters(client):
    r = client.post("/cart/compare", json={
        "items": [
            {"ean": "7790895000119", "qty": 1},
            {"ean": "7790000000003", "qty": 1},
        ],
        "mode": "complete_only",
    })
    body = r.json()
    slugs = [x["chain"] for x in body["ranking"]]
    assert "disco" in slugs
    assert "jumbo" not in slugs
