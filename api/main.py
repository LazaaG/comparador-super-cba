"""FastAPI app entry point.

Levantar local: `.venv/Scripts/uvicorn api.main:app --reload --port 8000`
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import cart, chains, health, search

app = FastAPI(
    title="Comparador Carritos Córdoba",
    version="0.1.0",
    description="Compará precios de supermercados de Córdoba por producto o por carrito.",
)

# CORS configurable por env. En prod seteamos ALLOWED_ORIGINS con el dominio
# de Vercel; en dev default a localhost para el `npm run dev` típico.
_DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
_allowed = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["meta"])
app.include_router(chains.router, tags=["meta"])
app.include_router(search.router, tags=["catalog"])
app.include_router(cart.router, tags=["cart"])


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": "comparador-super-cba", "docs": "/docs", "health": "/health"}
