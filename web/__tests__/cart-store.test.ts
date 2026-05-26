import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, selectItemCount, selectUniqueCount } from '@/store/cart';

// Limpiar el store entre tests
function reset() {
  useCartStore.setState({ items: [], lastAddedAt: null });
}

describe('cart store', () => {
  beforeEach(() => {
    reset();
  });

  it('arranca vacío', () => {
    const state = useCartStore.getState();
    expect(state.items).toEqual([]);
    expect(selectItemCount(state)).toBe(0);
    expect(selectUniqueCount(state)).toBe(0);
  });

  it('agrega un ítem nuevo con cantidad 1 por defecto', () => {
    useCartStore.getState().add({ ean: '7790001000026', name: 'Leche', brand: 'La Serenísima' });
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      ean: '7790001000026',
      name: 'Leche',
      brand: 'La Serenísima',
      qty: 1
    });
    expect(state.items[0].added_at).toBeTruthy();
    expect(state.lastAddedAt).toBeTypeOf('number');
  });

  it('agregar un ítem ya existente acumula la cantidad', () => {
    const ean = '7790001000026';
    useCartStore.getState().add({ ean, name: 'Leche', brand: null });
    useCartStore.getState().add({ ean, name: 'Leche', brand: null }, 2);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].qty).toBe(3);
    expect(selectItemCount(state)).toBe(3);
    expect(selectUniqueCount(state)).toBe(1);
  });

  it('incrementar y decrementar funciona', () => {
    const ean = '7790001000026';
    useCartStore.getState().add({ ean, name: 'Leche', brand: null });
    useCartStore.getState().increment(ean);
    useCartStore.getState().increment(ean);
    expect(useCartStore.getState().getQty(ean)).toBe(3);

    useCartStore.getState().decrement(ean);
    expect(useCartStore.getState().getQty(ean)).toBe(2);
  });

  it('decrementar a 0 remueve el ítem', () => {
    const ean = '7790001000026';
    useCartStore.getState().add({ ean, name: 'Leche', brand: null });
    useCartStore.getState().decrement(ean);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.has(ean)).toBe(false);
  });

  it('setQty con valor <= 0 elimina el ítem', () => {
    const ean = '7790001000026';
    useCartStore.getState().add({ ean, name: 'Leche', brand: null });
    useCartStore.getState().setQty(ean, 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('setQty actualiza cantidad cuando es > 0', () => {
    const ean = '7790001000026';
    useCartStore.getState().add({ ean, name: 'Leche', brand: null });
    useCartStore.getState().setQty(ean, 7);
    expect(useCartStore.getState().getQty(ean)).toBe(7);
  });

  it('remove saca el ítem específico', () => {
    useCartStore.getState().add({ ean: 'A', name: 'a', brand: null });
    useCartStore.getState().add({ ean: 'B', name: 'b', brand: null });
    useCartStore.getState().remove('A');
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].ean).toBe('B');
  });

  it('clear vacía todo', () => {
    useCartStore.getState().add({ ean: 'A', name: 'a', brand: null });
    useCartStore.getState().add({ ean: 'B', name: 'b', brand: null });
    useCartStore.getState().clear();
    const state = useCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.lastAddedAt).toBeNull();
  });

  it('selectItemCount suma cantidades, no ítems únicos', () => {
    useCartStore.getState().add({ ean: 'A', name: 'a', brand: null }, 3);
    useCartStore.getState().add({ ean: 'B', name: 'b', brand: null }, 2);
    const state = useCartStore.getState();
    expect(selectUniqueCount(state)).toBe(2);
    expect(selectItemCount(state)).toBe(5);
  });

  it('lastAddedAt cambia con cada add/increment', async () => {
    useCartStore.getState().add({ ean: 'A', name: 'a', brand: null });
    const t1 = useCartStore.getState().lastAddedAt!;
    expect(t1).toBeTypeOf('number');

    // Esperar al menos 1ms para garantizar timestamp distinto
    await new Promise((r) => setTimeout(r, 2));

    useCartStore.getState().increment('A');
    const t2 = useCartStore.getState().lastAddedAt!;
    expect(t2).toBeGreaterThan(t1);
  });
});
