# Guía PostHog — comparador-super-cba

URL proyecto: **https://us.posthog.com/project/440483**

Esta guía explica cada tab del dashboard y dónde ver cada métrica de la app.

---

## 1. Verificación inicial (¿llegan eventos?)

**Sidebar → Activity → Live events**

Lista en tiempo real de cada evento custom. Si la app está activa y el SDK funciona, vas a ver filas tipo:

```
search_submitted    query: "leche"      is_ean: false      hace 2s
product_viewed      ean: "7793890261233"                   hace 5s
product_added       ean: "...", from_page: "buscar"        hace 12s
```

Si está vacío después de navegar la app durante 1 minuto → revisar:
- Vercel env vars `NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_POSTHOG_HOST` con valores reales (no vacíos).
- Browser DevTools → Network → filtrar `i.posthog.com` → debería ver `POST /i/v0/e/` por cada evento.

---

## 2. Eventos disponibles (lo que ya emite la app)

| Evento | Cuándo | Props que viajan |
|---|---|---|
| `search_submitted` | Enter en el buscador | `query`, `is_ean` |
| `product_viewed` | Mount de página `/producto/[ean]` | `ean`, `brand`, `n_chains`, `cheapest_chain` |
| `product_added` | Click "Agregar" o `+` en stepper | `ean`, `from_page` (buscar/producto/carrito) |
| `cart_compared` | Carga `/carrito` o `/comparar` con items | `n_items`, `mode`, `winner_chain`, `coverage_pct` |
| `chain_link_clicked` | Click "Ver en {super}" en detalle | `chain`, `ean`, `page` |
| `cart_cleared` | Click "Vaciar todo" | `n_items_before` |

**Sidebar → Data management → Events** lista todos con conteo total. Útil para verificar volumen.

---

## 3. Insights — cómo crear y leer

**Insights** = gráficos que armás vos combinando eventos + filtros + agrupaciones. Cada insight responde una pregunta concreta.

**Cómo crear uno desde cero:**

1. Sidebar → **Product analytics → Insights → + New insight**
2. Elegís tipo:
   - **Trends** → línea de tiempo (¿cuántos por día?)
   - **Funnels** → embudo de conversión (¿qué % avanza paso a paso?)
   - **Retention** → quiénes vuelven (no aplica con `persistence: 'memory'`)
   - **User paths** → flujos de navegación
   - **Stickiness** → DAU/WAU/MAU
3. Configurás "Series" (eventos a graficar)
4. Opcional: "Breakdown" (agrupar por prop, ej `query`)
5. Opcional: "Filter" (sólo eventos con cierta prop)
6. **Save** → queda en tu lista de insights

**Cómo crear un Dashboard:**

1. Sidebar → **Dashboards → + New dashboard**
2. Drag insights guardados al canvas
3. Reordenar / resize / set as home

---

## 4. Los 6 Insights que ya están creados

Programáticamente creé los siguientes vía API. Buscalos en **Sidebar → Insights**:

### 4.1 Búsquedas por día
- **Tipo**: Trends, line chart
- **Series**: `search_submitted`, count, daily
- **Lee así**: pico de búsquedas por día. Caída = problema en buscador o tráfico. Subida = adopción.

### 4.2 Top queries (qué buscan los usuarios)
- **Tipo**: Trends, bar chart
- **Series**: `search_submitted`, count, total
- **Breakdown**: prop `query`
- **Lee así**: ranking de qué palabras buscan más. Sirve para SEO, sugerencias autocomplete, productos a destacar.

### 4.3 Conversion funnel: search → product_viewed → product_added → cart_compared
- **Tipo**: Funnels, ordered
- **Steps**:
  1. `search_submitted`
  2. `product_viewed`
  3. `product_added`
  4. `cart_compared`
- **Window**: 30 minutes
- **Lee así**: % de usuarios que avanzan de buscar a comparar carrito. Si el step 2→3 es bajo → el detalle no convence. Si 3→4 es bajo → el carrito no engancha.

### 4.4 Cadena ganadora del ranking (pie)
- **Tipo**: Trends, pie chart
- **Series**: `cart_compared`, count, total
- **Breakdown**: prop `winner_chain`
- **Lee así**: qué cadena gana más comparaciones (= qué super es más competitivo en precio según el carrito real de tus users).

### 4.5 Click-through por cadena
- **Tipo**: Trends, bar chart
- **Series**: `chain_link_clicked`, count, total
- **Breakdown**: prop `chain`
- **Lee así**: a qué super hacen click los usuarios para finalizar compra. Distinto al ganador del ranking — acá ves la intención real.

### 4.6 EANs más vistos
- **Tipo**: Trends, bar chart
- **Series**: `product_viewed`, count, total
- **Breakdown**: prop `ean`
- **Lee así**: productos más populares. Combinar con `cheapest_chain` para ver qué cadena domina los hits.

---

## 5. Tabs del sidebar — cuándo usar cada uno

| Tab | Para qué sirve |
|---|---|
| **Activity → Live events** | Debugging en vivo. ¿Llega el evento? ¿Con qué props? |
| **Activity → Persons** | Personas individuales. **Con `persistence: 'memory'` cada visita = persona nueva**. Útil sólo para ver shape de events de 1 sesión. |
| **Product analytics → Insights** | Gráficos custom (los 6 creados + los que sumes vos). |
| **Product analytics → Dashboards** | Combina varios insights en un canvas. Buen para overview diario. |
| **Product analytics → Funnels** | Conversion paths multi-paso. |
| **Product analytics → Trends** | Atajo a crear un Trend nuevo. |
| **Data management → Events** | Catálogo de tipos de evento + conteo total. |
| **Data management → Properties** | Catálogo de props (`query`, `ean`, `winner_chain`, etc.) con valores únicos. |
| **Data management → Actions** | Eventos derivados (ej "buscaron leche" = `search_submitted` + filter `query contains leche`). |
| **Replay** | Desactivado por config privacy. No tiene datos. |
| **Experiments** | A/B tests. Fuera de scope MVP. |
| **Feature flags** | Toggles dinámicos. Fuera de scope MVP. |
| **Surveys** | Encuestas in-app. Desactivado. |

---

## 6. Cómo responder preguntas concretas

### "¿Cuántas búsquedas hoy?"
Insight 4.1 "Búsquedas por día" → última barra del trend.

### "¿Qué buscan los usuarios?"
Insight 4.2 "Top queries" → tabla ordenada por count desc.

### "¿De dónde entran a la app?"
**No está en PostHog**. Lo ves en **Vercel Analytics** → https://vercel.com/lazaags-projects/comparador-super-cba/analytics → tab **Referrers**.

### "¿Cuánto tiempo pasan en la app?"
**No está en PostHog** (con `capture_pageleave: false`). Lo ves en **Vercel Analytics** → métrica **Duration / Pages per session**.

### "¿Cuántas comparaciones de carrito terminan en click outbound?"
1. Insight 4.3 "Funnel" — última cifra = comparaciones.
2. Insight 4.5 "Click-through cadena" — suma total = clicks.
3. División te da % conversion final.

### "¿Disco vs Jumbo, quién gana más?"
Insight 4.4 "Cadena ganadora del ranking" → pie chart con % por chain.

### "¿Producto X (EAN Y) cuántas veces se vió?"
Crear un Trend ad-hoc:
- Series: `product_viewed`
- Filter: `ean equals "<EAN_Y>"`

---

## 7. Performance + Web Vitals = Vercel, no PostHog

Decisión deliberada del setup: page views, Core Web Vitals (LCP/INP/CLS), referrers, países, devices viven en **Vercel Analytics**. PostHog solo guarda eventos custom de producto.

Dos dashboards complementarios:
- **Vercel Analytics**: https://vercel.com/lazaags-projects/comparador-super-cba/analytics
- **PostHog**: https://us.posthog.com/project/440483

---

## 8. Limitaciones por privacy-first

`persistence: 'memory'` (sin cookies) implica:

- **Retention**: no se puede medir (cada tab = "persona nueva"). Insights de retention están en cero.
- **Cohorts**: misma razón, no funciona.
- **Sessions**: PostHog agrupa por `distinct_id` por tab. Una sesión = una visita.
- **User identification**: nadie está identificado. Todos los users son anónimos efímeros.

Si en algún momento querés retention real (mismo user vuelve mañana), pasar `persistence: 'localStorage+cookie'` en `web/app/posthog-provider.tsx` + agregar cookie banner.

---

## 9. Costos

Plan **Free PostHog Cloud**:
- 1M events/mes (más que suficiente con este volumen estimado)
- 5K session recordings/mes (apagado)
- 1M feature flag requests/mes (apagado vía `advanced_disable_decide`)

Si volumen sube, no se cobra automático: PostHog te avisa antes de cortar y te deja decidir.

Plan **Hobby Vercel**:
- 2.5K Web Analytics events/mes
- 10K Speed Insights data points/mes

Si saturás Vercel → upgrade Pro $20/mes o desactivar Vercel Analytics y dejar PostHog autocapture pageviews.
