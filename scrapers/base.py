"""Interfaz común de scrapers + helpers (rate limit, retry, dedupe)."""
from __future__ import annotations

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from core.models import Chain, ScrapedProduct
from scrapers.config import (
    DEFAULT_CONCURRENCY,
    DEFAULT_RATE_LIMIT_RPS,
    DEFAULT_TIMEOUT_S,
    DEFAULT_USER_AGENT,
)

log = logging.getLogger(__name__)


class RateLimiter:
    """Limitador async tipo token bucket. Permite ráfagas + sostiene `rps`.

    No usa Lock: asyncio single-thread + cálculo atómico entre awaits.
    Múltiples workers pueden esperar; cuando uno reserva slot, los demás
    ven el `_last` actualizado en la próxima entrada.
    """

    def __init__(self, rps: float = DEFAULT_RATE_LIMIT_RPS):
        self.interval = 1.0 / rps if rps > 0 else 0.0
        self._last: float = 0.0

    async def wait(self) -> None:
        now = time.monotonic()
        target = self._last + self.interval
        if now < target:
            self._last = target  # reservar slot
            await asyncio.sleep(target - now)
        else:
            self._last = now


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code == 429 or exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError | httpx.TimeoutException)


async def _async_sleep_for_429(exc: BaseException) -> None:
    """Si es 429, respetar Retry-After del server (sino backoff agresivo)."""
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
        retry_after = exc.response.headers.get("Retry-After")
        wait = float(retry_after) if retry_after and retry_after.isdigit() else 10.0
        log.warning("429 recibido, esperando %.1fs", wait)
        await asyncio.sleep(wait)


def retry_policy() -> AsyncRetrying:
    return AsyncRetrying(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception(_is_retryable),
    )


@dataclass
class ScrapeStats:
    products_seen: int = 0
    eans_unique: set[str] = field(default_factory=set)
    errors: list[str] = field(default_factory=list)


@asynccontextmanager
async def build_client(
    base_url: str,
    user_agent: str = DEFAULT_USER_AGENT,
    timeout: float = DEFAULT_TIMEOUT_S,
):
    """Crea un AsyncClient con headers razonables + HTTP/2."""
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json",
        "Accept-Language": "es-AR,es;q=0.9",
    }
    async with httpx.AsyncClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        http2=False,
    ) as client:
        yield client


class BaseScraper(ABC):
    """Interfaz que cada motor debe implementar."""

    def __init__(self, chain: Chain, client: httpx.AsyncClient,
                 rate_limiter: RateLimiter | None = None,
                 concurrency: int = DEFAULT_CONCURRENCY):
        self.chain = chain
        self.client = client
        self.rate = rate_limiter or RateLimiter()
        self.stats = ScrapeStats()
        self._sem = asyncio.Semaphore(concurrency)

    @abstractmethod
    async def discover_categories(self) -> list[str]: ...

    @abstractmethod
    async def scrape_category(self, category: str) -> AsyncIterator[ScrapedProduct]:
        ...

    async def _scrape_one(self, cat: str, out: asyncio.Queue) -> None:
        """Worker: scrape una categoría y empuja productos deduplicados.

        Sin lock: asyncio es single-threaded, `set.add` y `in` son atómicos
        entre awaits. El bloque dedupe no contiene awaits → safe.
        """
        async with self._sem:
            try:
                async for product in self.scrape_category(cat):
                    if product.ean in self.stats.eans_unique:
                        continue
                    self.stats.eans_unique.add(product.ean)
                    self.stats.products_seen += 1
                    await out.put(product)
            except Exception as exc:
                log.warning("%s cat=%s falló: %s", self.chain.slug, cat, exc)
                self.stats.errors.append(f"{cat}: {exc}")

    async def prepare(self) -> None:
        """Hook opcional para setup pre-scrape (cookies de sucursal, sesiones).

        Subclases pueden override. Default no-op.
        """
        return

    async def run(
        self, limit_categories: int | None = None,
    ) -> AsyncIterator[ScrapedProduct]:
        """Itera categorías en paralelo con semáforo. Dedupe por EAN thread-safe."""
        try:
            await self.prepare()
        except Exception as exc:
            log.warning("%s prepare() falló (continuamos sin region): %s",
                        self.chain.slug, exc)
        try:
            categories = await self.discover_categories()
        except Exception as exc:
            log.exception("%s: discover_categories falló: %s", self.chain.slug, exc)
            self.stats.errors.append(f"discover: {exc}")
            return

        if limit_categories:
            categories = categories[:limit_categories]

        log.info("%s: %d categorías hoja a recorrer", self.chain.slug, len(categories))

        queue: asyncio.Queue = asyncio.Queue(maxsize=500)
        workers = [asyncio.create_task(self._scrape_one(c, queue))
                   for c in categories]

        async def _all_done() -> None:
            await asyncio.gather(*workers, return_exceptions=True)

        done_task = asyncio.create_task(_all_done())

        try:
            while not (done_task.done() and queue.empty()):
                try:
                    product = await asyncio.wait_for(queue.get(), timeout=0.2)
                    yield product
                except TimeoutError:
                    continue
        finally:
            if not done_task.done():
                await done_task
