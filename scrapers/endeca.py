"""Motor Endeca / Oracle Commerce (Dino + Super MAMI).

Endpoint:
    {base}/super/categoria/{slug}/_/N-{cid}?format=json&Nrpp={n}&No={offset}

Hallazgos:
    - MAMI funciona sin sesión / sin sucursal.
    - Dino requiere sucursal seleccionada en la sesión (sino totalNumRecs=0).
    - EAN puro en attributes['product.ean'][0] (13 dígitos).
    - Precio efectivo en attributes['sku.activePrice'][0] (string decimal).
    - Precio lista en attributes.get('sku.listPrice', [activePrice])[0] cuando exista.
"""
from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from typing import Any

from core.models import ScrapedProduct
from core.normalize import is_valid_ean, parse_unit
from scrapers.base import BaseScraper, retry_policy

log = logging.getLogger(__name__)

PAGE_SIZE = 60
MAX_PAGES = 100  # ~6000 productos por categoría; suficiente para MVP

# Patrón para extraer N-xxxxx del HTML del home cuando se descubren categorías.
_CATEGORY_HREF_RE = re.compile(
    r'href="(/super/categoria/[a-z0-9_-]+/_/N-[a-z0-9]+)"',
    re.IGNORECASE,
)


def _first(attrs: dict[str, list], key: str) -> str | None:
    val = attrs.get(key)
    if not val:
        return None
    v = val[0]
    return str(v).strip() if v is not None else None


def _to_float(s: str | None) -> float | None:
    if not s:
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _find_cartridge_with_records(obj: Any) -> dict | None:
    """DFS para encontrar el cartridge que contiene `records[]` con productos."""
    if isinstance(obj, dict):
        recs = obj.get("records")
        if isinstance(recs, list) and recs and "totalNumRecs" in obj:
            return obj
        for v in obj.values():
            found = _find_cartridge_with_records(v)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _find_cartridge_with_records(v)
            if found is not None:
                return found
    return None


class EndecaScraper(BaseScraper):
    """Scraper para Dino/MAMI."""

    async def discover_categories(self) -> list[str]:
        """Parsea la home y extrae las URLs `/super/categoria/{slug}/_/N-{id}`."""
        await self.rate.wait()
        async for attempt in retry_policy():
            with attempt:
                r = await self.client.get("/super/home")
                r.raise_for_status()
                html = r.text
        paths = _CATEGORY_HREF_RE.findall(html)
        return sorted(set(paths))

    async def scrape_category(self, category: str) -> AsyncIterator[ScrapedProduct]:
        """Pagina por `No` incremental hasta agotar `totalNumRecs`."""
        for page in range(MAX_PAGES):
            offset = page * PAGE_SIZE
            await self.rate.wait()

            async for attempt in retry_policy():
                with attempt:
                    r = await self.client.get(
                        category,
                        params={"format": "json", "Nrpp": PAGE_SIZE, "No": offset},
                    )
                    r.raise_for_status()
                    data = r.json()

            cartridge = _find_cartridge_with_records(data)
            if cartridge is None:
                return

            total = cartridge.get("totalNumRecs") or 0
            records = cartridge.get("records") or []
            if not records:
                return

            for rec in records:
                product = self._parse_record(rec)
                if product is not None:
                    yield product

            if offset + len(records) >= total:
                return  # última página

    def _parse_record(self, rec: dict) -> ScrapedProduct | None:
        attrs = rec.get("attributes") or {}
        ean = _first(attrs, "product.ean")
        if not ean or not is_valid_ean(ean):
            return None

        # Precio efectivo: probar sku.activePrice top-level, sino bucear en SKU anidado.
        price_eff = _to_float(_first(attrs, "sku.activePrice"))
        price_list = _to_float(_first(attrs, "sku.listPrice"))

        if price_eff is None or price_list is None:
            # Endeca a veces pone los precios en records anidados (nivel SKU).
            for child in rec.get("records") or []:
                child_attrs = child.get("attributes") or {}
                price_eff = price_eff or _to_float(_first(child_attrs, "sku.activePrice"))
                price_list = price_list or _to_float(_first(child_attrs, "sku.listPrice"))
                if price_eff is not None:
                    break

        if price_eff is None or price_eff <= 0:
            return None

        if price_list is None or price_list <= 0:
            price_list = price_eff

        name = _first(attrs, "product.displayName") or _first(attrs, "sku.displayName") or ""
        brand = _first(attrs, "product.brand")
        is_promo = (price_eff < price_list) or _first(attrs, "product.oferta") == "Si"

        unit_value, unit_kind = parse_unit(name)

        # URL del producto: el Assembler devuelve un path relativo Endeca
        # ("/aceite-…/_/A-1234-1234-s"). Lo absolutizamos al dominio de la cadena
        # y removemos el `?format=json` que sólo aplica al scrape.
        details = rec.get("detailsAction") or {}
        rec_state = details.get("recordState") or ""
        product_url = None
        if rec_state:
            path = f"/super{rec_state}".replace("?format=json", "")
            base = self.chain.base_url.rstrip("/")
            product_url = f"{base}{path}"

        repo_id = _first(attrs, "product.repositoryId") or ""

        # Imagen: medium para listings, large para detail. Las URLs vienen sin
        # protocolo ("//statics.dinoonline.com.ar/..."), prependemos https:.
        raw_img = (_first(attrs, "product.largeImage.url")
                   or _first(attrs, "product.mediumImage.url"))
        image_url = None
        if raw_img:
            image_url = f"https:{raw_img}" if raw_img.startswith("//") else raw_img

        return ScrapedProduct(
            ean=ean,
            name_in_chain=name,
            brand=brand,
            unit_value=unit_value,
            unit_kind=unit_kind,
            price_list=round(price_list, 2),
            price_effective=round(price_eff, 2),
            is_promo=is_promo,
            sku_id=repo_id,
            product_url=product_url,
            image_url=image_url,
        )
