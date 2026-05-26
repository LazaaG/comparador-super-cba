# 🛒 Comparador de Carritos — Supermercados de Córdoba

Encontrá en qué supermercado de Córdoba te sale más barato **todo tu carrito**, no solo un producto suelto.

---

## ¿Qué hace?

Esta app responde dos preguntas que cualquiera que hace las compras se hace seguido:

1. **"¿Dónde está más barato este producto?"** — Buscás un producto y ves su precio en cada supermercado.
2. **"¿Dónde me conviene hacer TODA la compra?"** — Armás tu lista (tu carrito) y la app calcula cuánto te costaría ese carrito completo en cada cadena, y te dice dónde gastás menos en total.

La segunda es la gracia del proyecto: comparar el **costo total del carrito**, no precio por precio. A veces un súper tiene la leche más barata pero te termina saliendo más caro el total; esta app te lo muestra de una.

---

## ¿Por qué existe?

Comparar precios a mano entre supermercados es tedioso y, en la práctica, nadie lo hace para una compra entera. Los precios además cambian todo el tiempo. La idea es automatizar ese trabajo: que los precios se actualicen solos y que comparar el carrito completo sea cuestión de un par de clics.

El foco es **Córdoba, Argentina**, e incluye tanto las grandes cadenas nacionales como los supermercados cordobeses locales.

---

## Supermercados incluidos

| Supermercado | Estado |
|---|---|
| Disco | ✅ |
| Jumbo | ✅ |
| Vea | ✅ |
| Hiper Libertad | ✅ |
| Carrefour | ✅ |
| Carrefour Express | ✅ |
| ChangoMas | ✅ |
| Dino Online | ✅ |
| Super MAMI | ✅ |
| Tadicor | ❌ *(no tiene tienda online; ver más abajo)* |

> **¿Por qué Tadicor no está?** No tiene una tienda online con carrito: sus precios viven en folletos y redes sociales, así que no se pueden leer de forma automática y confiable. Quedó fuera para no comprometer la calidad de los datos.

---

## ¿Cómo se mantienen los precios actualizados?

Sin que nadie toque nada. 🙌

La app lee los precios directamente de las tiendas online de cada supermercado de forma automática y programada (una vez por día). No hay que descargar archivos, copiar precios ni cargar nada a mano. Esa fue una decisión central del proyecto: **cero tareas manuales** para mantenerlo vivo.

Para identificar que un producto es "el mismo" entre dos supermercados distintos, la app se apoya en el **código de barras (EAN)** de cada producto. Así sabe que la gaseosa que viste en uno es exactamente la misma que en otro, aunque cada cadena le ponga un nombre distinto.

---

## ¿Cómo funciona por dentro? (resumen)

```
Tiendas online de los súper
        │  (lectura automática diaria)
        ▼
   Scrapers de precios
        │
        ▼
   Base de datos de precios (con código de barras como clave)
        │
        ▼
   App: buscar producto  +  comparar carrito completo
```

Los supermercados usan dos tecnologías distintas para sus tiendas online, así que la app tiene dos "lectores" de precios: uno para las siete cadenas grandes y otro para los dos supermercados cordobeses (Dino y Super MAMI, que comparten la misma plataforma).

Si te interesa el detalle técnico completo (endpoints, arquitectura, decisiones de diseño), está todo en **[`CLAUDE.md`](./CLAUDE.md)**.

---

## Estado del proyecto

🚧 **En desarrollo.** Este repositorio arranca desde una etapa de diseño con la arquitectura ya definida. El desarrollo está planificado por fases:

1. Confirmar el acceso a los datos de cada cadena.
2. Lector de precios de las cadenas grandes + base de datos.
3. Lógica de comparación de carrito + API.
4. Lector de precios de Dino y Super MAMI.
5. Automatización diaria.
6. Interfaz web.

---

## Cómo empezar (para desarrolladores)

> Requisitos previstos: Python 3.10+

```bash
# Clonar el repo
git clone <url-del-repo>
cd comparador-super-cba

# Instalar dependencias
pip install -r requirements.txt

# (instrucciones de ejecución a completar a medida que avanza el desarrollo)
```

Antes de programar los lectores de precios hay dos verificaciones rápidas que hacer (están detalladas en `CLAUDE.md`, "Fase 0"): confirmar las direcciones reales de cada tienda online y revisar cómo entrega los datos la tienda de Dino. Son los únicos pasos que requieren una mirada manual; el resto es automático.

---

## Aviso

Proyecto con fines de comparación de precios para consumidores. Los precios se leen de los catálogos públicos de cada supermercado y pueden no estar siempre actualizados al instante. No tiene relación oficial con ninguna de las cadenas mencionadas.

---

## Contribuir

Las contribuciones son bienvenidas: sumar supermercados, mejorar el matcheo de productos, reportar precios mal leídos. Abrí un *issue* o un *pull request*.
