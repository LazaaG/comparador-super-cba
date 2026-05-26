# Hiper Libertad — investigación

Fecha: 2026-05-23. **Cadena FUERA DEL ALCANCE MVP.**

## Hallazgo

`https://www.hiperlibertad.com.ar/` devuelve un HTML estático servido por Apache (header `Server: Apache`, sin CDN VTEX ni cookies de e-commerce). El contenido del HTML es un landing simple con el logo "La Anónima Online" y un mensaje pidiendo contacto a `servicioalcliente@libertadsa.com.ar`.

- `/api/catalog_system/pub/category/tree/{depth}/` → 404 en todas las variantes.
- No hay marcadores de VTEX (`vteximg`, `__NEXT_DATA__`, etc.).
- No hay `__VTEX_*` global.

Contradice la tabla de `CLAUDE.md` sección 3 que listaba a Hiper Libertad como VTEX.

## Hipótesis a verificar después del MVP

1. La cadena dejó de operar online y mantiene sólo presencia institucional.
2. El e-commerce real vive en otro dominio (subdominio, app móvil).
3. Migraron a otra plataforma (TiendaNube, Mercado Shops, plataforma propia).
4. El landing "La Anónima Online" es por un cambio corporativo reciente.

## Pendiente

- Inspeccionar app móvil de Libertad si existe (Network sniffing con mitmproxy).
- Buscar otros TLDs / subdominios (`tienda.hiperlibertad.com.ar`, `online.libertad.com.ar`, etc.).
- Confirmar con folletos o comunicación oficial si tienen e-commerce activo en Córdoba.

## Decisión

**Hiper Libertad queda excluido del MVP** junto con Tadicor. Se propone actualizar `CLAUDE.md` sección 3 para reflejarlo cuando se haga la próxima revisión del documento.
