"""Motor de scraping VTEX (cubre Disco, Jumbo, Vea, ChangoMas).

Endpoints:
    /api/catalog_system/pub/category/tree/{depth}/
    /api/catalog_system/pub/products/search/{path}?_from={a}&_to={b}
    /api/checkout/pub/regions?country=ARG&postalCode={cp}&sc={sc}

Sucursal Córdoba: Cencosud (Disco/Jumbo/Vea) acepta sc=32 + CP 5000 y devuelve
un regionId que, enviado como vtex_segment cookie, ajusta precios a la región.
ChangoMas (masonline) usa sc=1 con su propio regionId v2.*.
"""
from __future__ import annotations

import base64
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from core.models import ScrapedProduct
from core.normalize import is_valid_ean, parse_unit
from scrapers.base import BaseScraper, retry_policy

log = logging.getLogger(__name__)

PAGE_SIZE = 50
MAX_ITEMS_PER_PATH = 2500  # límite duro de la API legacy
CATEGORY_DEPTH = 5  # bajamos al fondo del árbol para descubrir hojas reales

# SC por slug. Descubierto empíricamente: Cencosud expone catálogo regionalizado
# sólo en sc=32, ChangoMas en sc=1. Resto deshabilitado.
DEFAULT_SC: dict[str, str] = {
    "disco": "32",
    "jumbo": "32",
    "vea": "32",
    "changomas": "1",
    "carrefour": "1",  # sc=1 = Carrefour Online; sc=3 = Express
}

POSTAL_CODE_CBA = "5000"


def build_vtex_segment(channel: str, region_id: str) -> str:
    """Construye el valor de la cookie vtex_segment (base64 JSON)."""
    payload = {
        "channel": channel,
        "regionId": region_id,
        "currencyCode": "ARS",
        "currencySymbol": "$",
        "countryCode": "ARG",
        "cultureInfo": "es-AR",
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


async def resolve_region_id(
    client: httpx.AsyncClient, sc: str, postal_code: str = POSTAL_CODE_CBA
) -> str | None:
    """Llama /api/checkout/pub/regions y devuelve regionId si hay sellers."""
    try:
        r = await client.get(
            "/api/checkout/pub/regions",
            params={"country": "ARG", "postalCode": postal_code, "sc": sc},
        )
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception as exc:
        log.warning("resolve_region_id falló: %s", exc)
        return None
    if not data or not isinstance(data, list):
        return None
    region = data[0]
    if not region.get("sellers"):
        return None
    return region.get("id")


class VTEXScraper(BaseScraper):
    """Scraper parametrizado por `base_url`. Una instancia por cadena."""

    async def prepare(self) -> None:
        """Resuelve regionId Córdoba y setea vtex_segment cookie en el client.

        Llamado por BaseScraper.run() antes de empezar. Idempotente.
        """
        sc = DEFAULT_SC.get(self.chain.slug, "1")
        # Si la chain ya tiene region+sc persistido, reusamos.
        cached_region = self.chain.sales_channel  # usamos este campo como container
        region_id = None
        if cached_region and cached_region.startswith(f"{sc}:"):
            region_id = cached_region.split(":", 1)[1]
        if not region_id:
            region_id = await resolve_region_id(self.client, sc=sc)
            if region_id:
                log.info("%s: regionId Córdoba resuelto = %s", self.chain.slug, region_id[:24])
        if region_id:
            segment = build_vtex_segment(channel=sc, region_id=region_id)
            self.client.cookies.set("vtex_segment", segment)
            # Persistir para próximas corridas (ahorra 1 request)
            self.chain.sales_channel = f"{sc}:{region_id}"

    async def discover_categories(self) -> list[str]:
        """Devuelve solo path-slugs de **categorías hoja** (sin children).

        Razón: padres como `almacen` paginan 2500 ítems que pisan a los hijos.
        Recorriendo solo hojas evitamos ~50% de requests redundantes y la API
        no nos truca con el cap de 2500.
        """
        await self.rate.wait()
        async for attempt in retry_policy():
            with attempt:
                r = await self.client.get(
                    f"/api/catalog_system/pub/category/tree/{CATEGORY_DEPTH}/"
                )
                r.raise_for_status()
                tree = r.json()

        leaves: list[str] = []
        for top in tree:
            self._collect_leaves(top, leaves)
        return sorted(set(leaves))

    @staticmethod
    def _collect_leaves(
        node: dict[str, Any], acc: list[str], parent: str = "",
    ) -> None:
        """Recorre el árbol y acumula sólo nodos sin children (hojas)."""
        url: str = node.get("url") or ""
        slug = url.rsplit("/", 1)[-1] if url else node.get("name", "").lower()
        path = f"{parent}/{slug}" if parent else slug

        children = node.get("children") or []
        if not children:
            if path:
                acc.append(path)
            return
        for child in children:
            VTEXScraper._collect_leaves(child, acc, path)

    async def scrape_category(self, category: str) -> AsyncIterator[ScrapedProduct]:
        """Pagina sobre una categoría VTEX por `_from`/`_to`."""
        for offset in range(0, MAX_ITEMS_PER_PATH, PAGE_SIZE):
            await self.rate.wait()
            params = {"_from": offset, "_to": offset + PAGE_SIZE - 1}
            try:
                async for attempt in retry_policy():
                    with attempt:
                        r = await self.client.get(
                            f"/api/catalog_system/pub/products/search/{category}",
                            params=params,
                        )
                        r.raise_for_status()
                        data = r.json()
            except httpx.HTTPStatusError as exc:
                # 206 Partial Content devuelve menos ítems; pero 400+ es error real.
                if exc.response.status_code == 416:  # Range Not Satisfiable: pasamos el final
                    return
                raise

            if not data:
                return

            for raw in data:
                product = self._parse_product(raw)
                if product is not None:
                    yield product

            if len(data) < PAGE_SIZE:
                return  # última página

    def _parse_product(self, raw: dict[str, Any]) -> ScrapedProduct | None:
        items = raw.get("items") or []
        if not items:
            return None
        item = items[0]
        ean = (item.get("ean") or "").strip()
        if not is_valid_ean(ean):
            return None

        sellers = item.get("sellers") or []
        if not sellers:
            return None
        offer = sellers[0].get("commertialOffer") or {}
        if not offer.get("IsAvailable", True):
            return None

        price_eff = float(offer.get("Price") or 0)
        if price_eff <= 0:
            return None

        # `ListPrice` puede venir corrupto en Cencosud (ej 1538371 vs precio real 16999).
        # Heurística: si ListPrice/Price > 5, descartamos ListPrice y usamos Price.
        price_list_raw = float(offer.get("ListPrice") or price_eff)
        price_without_disc = float(offer.get("PriceWithoutDiscount") or price_eff)
        # Tomamos el mínimo entre PriceWithoutDiscount y ListPrice cuando son razonables.
        price_list = price_list_raw if 0 < price_list_raw / price_eff <= 5 else price_without_disc
        if price_list <= 0:
            price_list = price_eff

        teasers = offer.get("Teasers") or []
        promo_teasers = offer.get("PromotionTeasers") or []
        is_promo = bool(teasers or promo_teasers) or price_eff < price_list

        name = (raw.get("productName") or "").strip()
        unit_value, unit_kind = parse_unit(name)

        images = item.get("images") or []
        image_url = images[0].get("imageUrl") if images else None

        return ScrapedProduct(
            ean=ean,
            name_in_chain=name,
            brand=raw.get("brand"),
            unit_value=unit_value,
            unit_kind=unit_kind,
            price_list=round(price_list, 2),
            price_effective=round(price_eff, 2),
            is_promo=is_promo,
            sku_id=str(item.get("itemId") or ""),
            product_url=raw.get("link"),
            image_url=image_url,
        )
