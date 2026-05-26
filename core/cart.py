"""Lógica de comparación de carritos. Pura, sin DB."""
from __future__ import annotations

from core.models import (
    CartChainResult,
    CartComparison,
    CartItem,
    CartItemFound,
    CartItemMissing,
    CartMode,
    Chain,
    PriceRow,
)

# Umbral mínimo para considerar a una cadena "comparable por precio" en best_effort.
# Cadenas con cobertura debajo de este umbral se rankean al final del listado.
HIGH_COVERAGE_THRESHOLD = 0.8


def compare_cart(
    *,
    cart: list[CartItem],
    prices_by_chain: dict[str, dict[str, PriceRow]],
    chains: list[Chain],
    mode: CartMode = "best_effort",
    product_meta: dict[str, tuple[str | None, str | None]] | None = None,
) -> CartComparison:
    """Compara un carrito contra todas las cadenas.

    Args:
        cart: ítems pedidos por el usuario (con cantidad).
        prices_by_chain: dict[chain_slug → dict[ean → PriceRow]] del último precio.
        chains: cadenas a considerar.
        mode: 'best_effort' (default, rankea todas) o 'complete_only' (sólo 100%).
        product_meta: opcional, dict[ean → (name, image_url)] para enriquecer
            los ítems faltantes con info canónica del producto.
    """
    meta = product_meta or {}
    total_items = len(cart)
    if total_items == 0:
        return CartComparison(mode=mode, total_items=0, ranking=[])

    # Orden estable por chain.id como tiebreaker final.
    ordered_chains = sorted(chains, key=lambda c: c.id)
    results: list[CartChainResult] = []

    for chain in ordered_chains:
        chain_prices = prices_by_chain.get(chain.slug, {})
        found: list[CartItemFound] = []
        missing: list[CartItemMissing] = []
        total = 0.0

        for item in cart:
            price = chain_prices.get(item.ean)
            if price is None:
                m_name, m_image = meta.get(item.ean, (None, None))
                missing.append(CartItemMissing(
                    ean=item.ean, qty=item.qty,
                    name=m_name, image_url=m_image,
                ))
                continue
            subtotal = round(price.price_effective * item.qty, 2)
            total += subtotal
            m_name, m_image = meta.get(item.ean, (None, None))
            found.append(CartItemFound(
                ean=item.ean,
                qty=item.qty,
                unit_price=price.price_effective,
                subtotal=subtotal,
                is_promo=price.is_promo,
                name_in_chain=price.name_in_chain,
                name=m_name,
                image_url=m_image,
            ))

        coverage = len(found) / total_items
        results.append(CartChainResult(
            chain=chain.slug,
            chain_name=chain.display_name,
            covered_total=round(total, 2),
            items_found=found,
            items_missing=missing,
            coverage_pct=coverage,
            has_full_coverage=coverage == 1.0,
        ))

    if mode == "complete_only":
        results = [r for r in results if r.has_full_coverage]

    # Ranking:
    #  - cadenas con cobertura ≥ HIGH_COVERAGE_THRESHOLD primero, ordenadas por total ASC
    #  - el resto al final, ordenadas por coverage DESC y total ASC
    def _sort_key(r: CartChainResult) -> tuple[int, float, float, int]:
        tier = 0 if r.coverage_pct >= HIGH_COVERAGE_THRESHOLD else 1
        return (tier, r.covered_total, -r.coverage_pct,
                next(c.id for c in ordered_chains if c.slug == r.chain))

    # Para tier 1 queremos ordenar primero por coverage DESC (cubre más arriba),
    # luego total ASC. Como el sort es estable, separamos los dos tiers.
    top = sorted([r for r in results if r.coverage_pct >= HIGH_COVERAGE_THRESHOLD],
                 key=lambda r: (r.covered_total,
                                next(c.id for c in ordered_chains if c.slug == r.chain)))
    rest = sorted([r for r in results if r.coverage_pct < HIGH_COVERAGE_THRESHOLD],
                  key=lambda r: (-r.coverage_pct, r.covered_total,
                                 next(c.id for c in ordered_chains if c.slug == r.chain)))
    ranking = top + rest

    return CartComparison(mode=mode, total_items=total_items, ranking=ranking)
