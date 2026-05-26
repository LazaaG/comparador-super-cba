"""Cliente HTTP con TLS-impersonation para cadenas con WAF (Carrefour).

Adapta `curl_cffi.requests.AsyncSession` a la interfaz mínima que usa el
scraper VTEX: `.get(path, params=...)` que devuelve algo con `.status_code`,
`.raise_for_status()`, `.json()`, `.text`, `.headers`, `.cookies`.

Es un wrapper fino, no una reimplementación. Mantenemos httpx para el resto
de cadenas que no lo necesitan (más liviano + soporte HTTP/2 mejor).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

import httpx
from curl_cffi.requests import AsyncSession

from scrapers.config import DEFAULT_TIMEOUT_S, DEFAULT_USER_AGENT

log = logging.getLogger(__name__)


class _CurlCffiResponse:
    """Adapter de curl_cffi.Response → algo similar a httpx.Response."""

    def __init__(self, raw):
        self._raw = raw

    @property
    def status_code(self) -> int:
        return self._raw.status_code

    @property
    def text(self) -> str:
        return self._raw.text

    @property
    def content(self) -> bytes:
        return self._raw.content

    @property
    def headers(self):
        return self._raw.headers

    def json(self) -> Any:
        return self._raw.json()

    def raise_for_status(self) -> None:
        if self._raw.status_code >= 400:
            # Imitamos httpx.HTTPStatusError para que retry_policy funcione.
            req = httpx.Request("GET", self._raw.url)
            resp = httpx.Response(
                self._raw.status_code,
                request=req,
                content=self._raw.content,
                headers=dict(self._raw.headers),
            )
            raise httpx.HTTPStatusError(
                f"{self._raw.status_code} for {self._raw.url}",
                request=req, response=resp,
            )


class CurlCffiClient:
    """Wrapper async de curl_cffi.AsyncSession con interfaz httpx-like.

    Soporta los métodos que el scraper VTEX usa: `get`, `cookies.set`, ctx async.
    """

    def __init__(self, base_url: str, session: AsyncSession):
        self.base_url = base_url.rstrip("/")
        self._session = session
        self._cookie_jar: dict[str, str] = {}

    class _CookieJar:
        def __init__(self, parent: CurlCffiClient):
            self._parent = parent

        def set(self, name: str, value: str) -> None:
            self._parent._cookie_jar[name] = value

    @property
    def cookies(self) -> CurlCffiClient._CookieJar:
        return CurlCffiClient._CookieJar(self)

    async def get(self, path: str, params: dict | None = None,
                  headers: dict | None = None) -> _CurlCffiResponse:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        merged_headers = headers or {}
        if self._cookie_jar:
            cookie_str = "; ".join(f"{k}={v}" for k, v in self._cookie_jar.items())
            merged_headers["Cookie"] = cookie_str
        raw = await self._session.get(url, params=params, headers=merged_headers,
                                      timeout=DEFAULT_TIMEOUT_S)
        return _CurlCffiResponse(raw)


@asynccontextmanager
async def build_protected_client(
    base_url: str,
    user_agent: str = DEFAULT_USER_AGENT,
    impersonate: str = "chrome120",
):
    """Crea un cliente curl_cffi (con TLS fingerprint) compatible con VTEXScraper."""
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json",
        "Accept-Language": "es-AR,es;q=0.9",
    }
    async with AsyncSession(impersonate=impersonate, headers=headers) as session:
        yield CurlCffiClient(base_url, session)
