"""Tests de la lógica de carrito. Corazón del producto, alta prioridad."""
from __future__ import annotations

from core.cart import compare_cart
from core.models import CartItem, Chain, PriceRow


def _chain(id: int, slug: str, name: str = "X") -> Chain:
    return Chain(id=id, slug=slug, display_name=name, engine="vtex",
                 base_url=f"https://{slug}")


def _price(ean: str, chain_id: int, chain_slug: str,
           price_eff: float, price_list: float | None = None,
           is_promo: bool = False, name: str = "prod") -> PriceRow:
    return PriceRow(
        ean=ean, chain_id=chain_id, chain_slug=chain_slug,
        scraped_at="2026-05-23T00:00:00Z",
        price_list=price_list if price_list is not None else price_eff,
        price_effective=price_eff,
        is_promo=is_promo,
        name_in_chain=name,
    )


DISCO = _chain(1, "disco", "Disco")
JUMBO = _chain(2, "jumbo", "Jumbo")
VEA = _chain(3, "vea", "Vea")


# ---------- carrito vacío ----------

def test_empty_cart_returns_empty_ranking():
    result = compare_cart(cart=[], prices_by_chain={}, chains=[DISCO, JUMBO])
    assert result.total_items == 0
    assert result.ranking == []


# ---------- una cadena cubre 100%, otra 50% ----------

def test_best_effort_orders_by_coverage_then_total():
    cart = [CartItem(ean="A", qty=1), CartItem(ean="B", qty=2)]
    prices = {
        "disco": {"A": _price("A", 1, "disco", 100), "B": _price("B", 1, "disco", 50)},
        "jumbo": {"A": _price("A", 2, "jumbo", 80)},  # falta B
    }
    result = compare_cart(cart=cart, prices_by_chain=prices,
                          chains=[DISCO, JUMBO], mode="best_effort")
    assert len(result.ranking) == 2
    # Disco cubre 100% (200) → primero. Jumbo cubre 50% (80) → segundo.
    assert result.ranking[0].chain == "disco"
    assert result.ranking[0].coverage_pct == 1.0
    assert result.ranking[0].covered_total == 100 + 50 * 2
    assert result.ranking[0].has_full_coverage is True
    assert len(result.ranking[0].items_missing) == 0
    assert result.ranking[1].chain == "jumbo"
    assert result.ranking[1].coverage_pct == 0.5
    assert result.ranking[1].covered_total == 80
    assert result.ranking[1].items_missing[0].ean == "B"
    assert result.ranking[1].items_missing[0].qty == 2


def test_complete_only_filters_partial_chains():
    cart = [CartItem(ean="A", qty=1), CartItem(ean="B", qty=1)]
    prices = {
        "disco": {"A": _price("A", 1, "disco", 100), "B": _price("B", 1, "disco", 50)},
        "jumbo": {"A": _price("A", 2, "jumbo", 80)},
    }
    result = compare_cart(cart=cart, prices_by_chain=prices,
                          chains=[DISCO, JUMBO], mode="complete_only")
    assert len(result.ranking) == 1
    assert result.ranking[0].chain == "disco"


def test_quantity_multiplies_subtotal():
    cart = [CartItem(ean="A", qty=5)]
    prices = {"disco": {"A": _price("A", 1, "disco", 10)}}
    result = compare_cart(cart=cart, prices_by_chain=prices, chains=[DISCO])
    found = result.ranking[0].items_found[0]
    assert found.qty == 5
    assert found.unit_price == 10
    assert found.subtotal == 50
    assert result.ranking[0].covered_total == 50


def test_promo_price_used():
    cart = [CartItem(ean="A", qty=1)]
    prices = {"disco": {"A": _price("A", 1, "disco", price_eff=80,
                                     price_list=100, is_promo=True)}}
    result = compare_cart(cart=cart, prices_by_chain=prices, chains=[DISCO])
    found = result.ranking[0].items_found[0]
    assert found.unit_price == 80
    assert found.is_promo is True
    assert result.ranking[0].covered_total == 80


def test_chain_with_zero_items_does_not_crash():
    cart = [CartItem(ean="A", qty=1)]
    prices = {
        "disco": {"A": _price("A", 1, "disco", 100)},
        "jumbo": {},  # cadena sin nada del carrito
    }
    result = compare_cart(cart=cart, prices_by_chain=prices,
                          chains=[DISCO, JUMBO], mode="best_effort")
    chains_by_slug = {r.chain: r for r in result.ranking}
    assert chains_by_slug["jumbo"].covered_total == 0
    assert chains_by_slug["jumbo"].coverage_pct == 0
    assert chains_by_slug["jumbo"].items_missing[0].ean == "A"
    # En best_effort la cadena vacía no debería liderar (regla: cobertura ≥80% primero).
    assert result.ranking[0].chain == "disco"


def test_tie_break_stable():
    cart = [CartItem(ean="A", qty=1)]
    prices = {
        "disco": {"A": _price("A", 1, "disco", 100)},
        "jumbo": {"A": _price("A", 2, "jumbo", 100)},
    }
    result = compare_cart(cart=cart, prices_by_chain=prices, chains=[DISCO, JUMBO])
    # Mismo precio, misma cobertura: orden estable por chain.id (disco antes que jumbo).
    assert result.ranking[0].chain == "disco"
    assert result.ranking[1].chain == "jumbo"


def test_low_coverage_chain_pushed_to_bottom_even_if_cheaper():
    """Una cadena con 2 ítems no debería ganar sobre una que cubre 5/5."""
    cart = [CartItem(ean=str(i), qty=1) for i in range(1, 6)]  # 5 ítems
    full = {str(i): _price(str(i), 1, "disco", 100) for i in range(1, 6)}
    minimal = {"1": _price("1", 2, "jumbo", 1), "2": _price("2", 2, "jumbo", 1)}
    prices = {"disco": full, "jumbo": minimal}
    result = compare_cart(cart=cart, prices_by_chain=prices,
                          chains=[DISCO, JUMBO], mode="best_effort")
    # Disco cubre 100% ($500), Jumbo cubre 40% ($2). Disco primero.
    assert result.ranking[0].chain == "disco"
    assert result.ranking[1].chain == "jumbo"


def test_two_high_coverage_chains_compared_by_total():
    cart = [CartItem(ean="A", qty=1), CartItem(ean="B", qty=1)]
    prices = {
        "disco": {"A": _price("A", 1, "disco", 100), "B": _price("B", 1, "disco", 100)},  # 200
        "jumbo": {"A": _price("A", 2, "jumbo", 80),  "B": _price("B", 2, "jumbo", 80)},   # 160 ← más barato
        "vea":   {"A": _price("A", 3, "vea",   90)},  # cobertura 50%, ignorar para top
    }
    result = compare_cart(cart=cart, prices_by_chain=prices,
                          chains=[DISCO, JUMBO, VEA], mode="best_effort")
    # Jumbo gana (mismo coverage que Disco, total menor).
    assert result.ranking[0].chain == "jumbo"
    assert result.ranking[1].chain == "disco"
    assert result.ranking[2].chain == "vea"


def test_total_items_reflects_cart_size():
    cart = [CartItem(ean="A", qty=2), CartItem(ean="B", qty=3)]
    result = compare_cart(cart=cart, prices_by_chain={}, chains=[DISCO])
    # total_items cuenta líneas distintas, no unidades.
    assert result.total_items == 2
