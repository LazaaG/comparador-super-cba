# Diseño — Escaneo de ticket de compra

Feature futuro. NO implementado aún. Documento de diseño técnico.

## Objetivo

Usuario sube/foto un ticket de compra. La app extrae productos + precios pagados, los matchea contra la DB de precios, y muestra **cuánto hubiera salido la misma compra en cada cadena**. Cierra el loop: del "comparar antes de comprar" al "verificar después de comprar".

## Decisiones tomadas

- **Extracción**: AFIP QR + WSCT primero, OCR vision como fallback (decisión: arrancar con QR fiscal).
- **Matcheo**: fuzzy por nombre + cantidad (los tickets rara vez traen EAN).
- **Scope**: este doc es el plan; implementación en sesión dedicada.

---

## Parte 1 — Extracción de datos del ticket

### 1.1 Camino A: QR fiscal AFIP (preferido)

Tickets fiscales argentinos (factura electrónica / ticket controlador fiscal) traen un **QR estándar AFIP** (RG 4892/2020). El QR codifica una URL:

```
https://www.afip.gob.ar/fe/qr/?p=<base64-json>
```

El payload base64 decodifica a JSON:
```json
{
  "ver": 1,
  "fecha": "2026-05-26",
  "cuit": 30xxxxxxxx,
  "ptoVta": 1,
  "tipoCmp": 83,
  "nroCmp": 12345,
  "importe": 15234.50,
  "moneda": "PES",
  "ctz": 1,
  "tipoDocRec": 96,
  "nroDocRec": 0,
  "tipoCodAut": "E",
  "codAut": 70xxxxxxxxxxxxx
}
```

**Limitación crítica**: el QR AFIP **NO trae el detalle de ítems**, solo el total + datos fiscales. Para el detalle de productos hay que:
- Consultar el **WSCT** (Web Service Comprobantes con Detalle) — requiere certificado fiscal del comercio, NO accesible para terceros.
- O sea: **el QR solo da total + fecha + comercio (CUIT)**, no la lista de productos.

**Veredicto QR**: útil para validar autenticidad + total + identificar la cadena (CUIT → mapeo a Disco/Jumbo/etc), pero **insuficiente para extraer ítems**. Necesitamos OCR igual.

### 1.2 Camino B: OCR vision con Ollama LOCAL (necesario para ítems)

**Decisión**: NO usar API de Claude/GPT. Usar modelo vision **local vía Ollama** (`http://127.0.0.1:11434`). Cero costo por request, datos no salen de la máquina (mejor privacy del ticket), sin dependencia de API externa.

Foto del ticket → modelo vision local con prompt estructurado que devuelve JSON:

```json
{
  "cadena": "changomas",
  "fecha": "2026-05-26",
  "total": 15234.50,
  "items": [
    { "nombre_ticket": "COCA COLA 2.25", "cantidad": 1, "precio_unit": 2890, "precio_total": 2890 },
    { "nombre_ticket": "LECHE LSANC ENT 1L", "cantidad": 2, "precio_unit": 1500, "precio_total": 3000 }
  ]
}
```

#### Modelo Ollama a usar

Estado actual (`ollama list`): hay `llama3.1:8b`, `qwen3.5:9b`, `nomic-embed-text` — **ninguno con vision**. Hay que bajar uno vision.

Opciones (ordenadas por fit para OCR de ticket térmico AR):

| Modelo | `ollama pull` | Tamaño | OCR docs | Notas |
|---|---|---|---|---|
| **qwen2.5vl:7b** (recomendado) | `ollama pull qwen2.5vl:7b` | ~6 GB | Excelente | Mejor OCR/structured extraction de la familia open. Maneja tablas + texto chico. |
| minicpm-v:8b | `ollama pull minicpm-v` | ~5.5 GB | Muy bueno | Liviano, fuerte en OCR. Alternativa si qwen no entra en RAM. |
| llama3.2-vision:11b | `ollama pull llama3.2-vision` | ~7.8 GB | Bueno | Más pesado, OCR algo inferior a qwen para texto chico. |

**Recomendación**: `qwen2.5vl:7b`. Si la máquina tiene <8GB VRAM, `minicpm-v`.

#### Llamada desde Python (sin SDK externo, solo httpx)

```python
import base64, httpx, json

async def ocr_ticket(image_bytes: bytes) -> dict:
    b64 = base64.b64encode(image_bytes).decode()
    prompt = (
        "Sos un parser de tickets de supermercado argentinos. "
        "Extraé del ticket: cadena (disco/jumbo/vea/changomas/carrefour/dino/mami), "
        "fecha (YYYY-MM-DD), total, y lista de items con nombre_ticket, cantidad, "
        "precio_unit, precio_total. Expandí abreviaturas conocidas (LSANC=La Serenísima, "
        "COCA=Coca Cola). Devolvé SOLO JSON válido, sin texto extra."
    )
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post("http://127.0.0.1:11434/api/generate", json={
            "model": "qwen2.5vl:7b",
            "prompt": prompt,
            "images": [b64],
            "format": "json",     # fuerza salida JSON
            "stream": False,
            "options": {"temperature": 0.1}  # determinista para extracción
        })
        r.raise_for_status()
        return json.loads(r.json()["response"])
```

**Ventajas Ollama local**:
- Cero costo por ticket (vs ~$0.01 API).
- El ticket (con CUIT, posible dato comprador) **nunca sale de la máquina** → privacy total.
- Sin rate limits, sin API key.

**Trade-offs**:
- Latencia: ~5-15s por ticket en CPU, ~2-5s con GPU. (vs ~2s API cloud).
- Requiere que el server backend tenga Ollama corriendo + modelo bajado (~6GB).
- **Deploy**: Fly.io free tier (256-512MB, sin GPU) **NO corre un modelo vision de 6GB**. Para producción con Ollama hay que: (a) correr OCR en una máquina con GPU/RAM aparte, o (b) feature solo disponible en modo self-hosted/local, no en el deploy Fly actual.

#### Implicancia de deploy

El backend FastAPI en Fly.io (512MB, sin GPU) **no puede hostear Ollama+vision**. Caminos:

1. **Local-only feature**: ticket scan corre solo cuando el usuario tiene la app + Ollama local (uso dev/personal). No para usuarios públicos web.
2. **Worker GPU separado**: VM con GPU (Fly GPU machines, o VPS con GPU, o la PC del dev) corre Ollama. El backend Fly proxea la imagen a ese worker. Costo: GPU machine.
3. **Ollama en la PC del usuario** (avanzado): la app web detecta `localhost:11434` y usa la Ollama del propio usuario. Solo funciona para users técnicos con Ollama instalado.

**Recomendación MVP**: implementar como **feature local-only** primero (camino 1). Validar precisión con tickets reales en tu PC. Si funciona bien y querés exponerlo público, evaluar worker GPU (camino 2).

**Por qué vision sobre Tesseract**: tickets AR tienen formatos dispares (fuente térmica desgastada, abreviaturas no estándar "LSANC"=La Serenísima, layout variable). Vision LLM maneja esto mucho mejor que OCR+regex.

**Precisión esperada**: 85-95% según calidad de foto. Errores típicos: precio mal leído por tinta corrida, nombre cortado.

### 1.3 Combo recomendado

1. Leer QR → obtener total + CUIT (→ cadena) + fecha. Validación.
2. OCR vision → extraer ítems.
3. Cross-check: suma de ítems OCR ≈ total del QR (±tolerancia). Si difiere mucho, flag "lectura incompleta, revisá".

---

## Parte 2 — Matcheo contra DB

Tickets traen nombres abreviados sin EAN. Reusar `core/matching.py` (ya existe `fuzzy_match` con rapidfuzz).

### Flujo

Por cada `item.nombre_ticket`:
1. Normalizar con `core/normalize.py` (`normalize_name`).
2. Buscar candidatos en `products` via FTS5 (`products_fts MATCH`).
3. Fuzzy rank con `rapidfuzz.WRatio` sobre top-20 candidatos FTS.
4. Si mejor score ≥ umbral (sugerido 80) → match. Sino → "no encontrado", el usuario corrige manual.

**Desafío**: abreviaturas. "LSANC" no matchea "la serenisima" por fuzzy directo. Mitigación:
- Diccionario de abreviaturas comunes AR (`LSANC→la serenisima`, `COCA→coca cola`, etc.) aplicado pre-fuzzy.
- O: pasar el nombre del ticket al vision LLM pidiéndole que expanda abreviaturas conocidas.

### Cantidad

El ticket trae cantidad. Se usa directo para el cálculo del carrito (qty × precio_cadena).

---

## Parte 3 — Cálculo y presentación

Una vez matcheados los ítems a EANs canónicos:

1. Armar un carrito sintético `[{ean, qty}]` (reusa `core/cart.py` `compare_cart`).
2. Llamar la lógica de comparación existente → ranking por cadena.
3. Mostrar:
   - **Lo que pagaste**: total del ticket (cadena X).
   - **Comparación**: "En Jumbo hubiera salido $Y (−$Z, −W%)". "En Disco $..." etc.
   - **Ítems no matcheados**: lista para corrección manual.
   - **Disclaimer**: precios de cada cadena son los relevados online, pueden diferir del local físico.

---

## Parte 4 — Arquitectura propuesta

### Backend (FastAPI)

Nuevo endpoint:
```
POST /ticket/parse
  body: multipart con imagen (jpg/png/pdf)
  resp: { cadena, fecha, total, items_matched[], items_unmatched[], comparison }
```

Archivos nuevos:
- `api/routes/ticket.py` — endpoint upload + orquestación
- `core/ticket.py` — parse QR (lib `qrcode`/`pyzbar`) + decode payload AFIP
- `core/ocr.py` — wrapper vision local vía Ollama (`http://127.0.0.1:11434/api/generate`, modelo `qwen2.5vl:7b`), prompt estructurado
- `core/ticket_match.py` — matcheo ítems ticket → EANs (reusa matching.py + normalize.py + diccionario abreviaturas)

Dependencias nuevas:
- `pyzbar` + `pillow` (leer QR de imagen)
- `httpx` (ya está) para llamar Ollama local — sin SDK extra de AI cloud

### Frontend (Next.js)

- `web/app/ticket/page.tsx` — upload (file input / cámara mobile `capture="environment"`)
- `web/components/TicketUploader.tsx` — drag&drop + preview + estado loading
- `web/components/TicketResult.tsx` — comparación + lista ítems + correcciones
- Nuevo evento analytics: `ticket_scanned` (cadena, n_items, matched_pct, total)

### Flujo UX

```
/ticket
  → subir foto / sacar con cámara
  → loading "leyendo tu ticket..."
  → resultado:
      "Compraste en ChangoMas: $15.234"
      "En Carrefour: $14.100 (−7%)"  ← winner
      "En Jumbo: $15.800 (+4%)"
      [tabla ítems matcheados + no matcheados editables]
      [botón: agregar estos productos a mi carrito]
```

---

## Parte 5 — Costos y riesgos

| Item | Detalle |
|---|---|
| **Vision (Ollama local)** | $0 por ticket — modelo corre local. Costo = RAM/GPU de la máquina que hostea Ollama (~6GB modelo). Latencia 5-15s CPU / 2-5s GPU. Sin rate limit ni API key. |
| **Privacy** | El ticket tiene CUIT del comercio (público) pero también potencialmente datos del comprador si es factura A/B. **Descartar/no persistir** datos personales. Procesar imagen en memoria, no guardar. |
| **Matcheo impreciso** | Nombres abreviados → falsos matches. Mitigación: umbral alto + corrección manual + mostrar confidence. |
| **Cobertura productos** | Si el producto del ticket no está en nuestra DB (no scrapeado), no se puede comparar. Mostrar "no tenemos este producto relevado". |
| **OCR fallido** | Foto borrosa/cortada → extracción parcial. Cross-check con total QR detecta esto. |
| **Formato ticket variable** | Cada cadena imprime distinto. Vision LLM es robusto pero no infalible. |

---

## Parte 6 — Estimación de esfuerzo

| Fase | Esfuerzo |
|---|---|
| QR parse + AFIP decode | 0.5 sesión |
| OCR vision wrapper + prompt tuning | 1 sesión |
| Matcheo ticket → EAN + diccionario abreviaturas | 1 sesión |
| Endpoint + orquestación backend | 0.5 sesión |
| Frontend upload + resultado + cámara mobile | 1 sesión |
| Testing con tickets reales de las 7 cadenas | 0.5 sesión |
| **Total** | **~4-5 sesiones** |

## Recomendación de arranque

Cuando se implemente, **PoC mínimo primero**:
1. Solo OCR vision (skip QR inicialmente).
2. 1 foto → JSON ítems → fuzzy match → comparación.
3. Probar con 5-10 tickets reales de distintas cadenas.
4. Medir matched_pct real. Si <70%, invertir en diccionario abreviaturas + tuning prompt antes de pulir UI.

Si el PoC da matched_pct ≥80%, vale la pena el feature completo. Sino, reconsiderar (quizás pedir al usuario que confirme/edite cada ítem es demasiada friction).
