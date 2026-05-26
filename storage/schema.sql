-- Esquema SQLite del comparador. Aplicado por storage.db.init_db().

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chains (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    engine        TEXT NOT NULL CHECK (engine IN ('vtex','endeca')),
    base_url      TEXT NOT NULL,
    sales_channel TEXT,
    active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    ean           TEXT PRIMARY KEY,
    name_norm     TEXT NOT NULL,
    brand_norm    TEXT,
    unit_value    REAL,
    unit_kind     TEXT,
    image_url     TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_name  ON products(name_norm);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_norm);

-- FTS5 para búsqueda por nombre. Tokenizer unicode61 quita tildes.
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    ean UNINDEXED,
    name_norm,
    brand_norm,
    tokenize = "unicode61 remove_diacritics 2"
);

CREATE TABLE IF NOT EXISTS product_prices (
    ean              TEXT NOT NULL,
    chain_id         INTEGER NOT NULL,
    scraped_at       TEXT NOT NULL,
    price_list       REAL NOT NULL,
    price_effective  REAL NOT NULL,
    is_promo         INTEGER NOT NULL DEFAULT 0,
    name_in_chain    TEXT,
    product_url      TEXT,
    sku_id           TEXT,
    PRIMARY KEY (ean, chain_id, scraped_at),
    FOREIGN KEY (chain_id) REFERENCES chains(id)
);
CREATE INDEX IF NOT EXISTS idx_prices_ean_chain   ON product_prices(ean, chain_id);
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at  ON product_prices(scraped_at);

-- Última observación por (ean, chain_id). Usada por la API.
CREATE VIEW IF NOT EXISTS v_latest_prices AS
SELECT pp.*
FROM product_prices pp
WHERE pp.scraped_at = (
    SELECT MAX(pp2.scraped_at)
    FROM product_prices pp2
    WHERE pp2.ean = pp.ean AND pp2.chain_id = pp.chain_id
);

CREATE TABLE IF NOT EXISTS scrape_runs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id      INTEGER NOT NULL,
    started_at    TEXT NOT NULL,
    finished_at   TEXT,
    status        TEXT NOT NULL CHECK (status IN ('running','ok','partial','failed')),
    products_seen INTEGER NOT NULL DEFAULT 0,
    error_msg     TEXT,
    FOREIGN KEY (chain_id) REFERENCES chains(id)
);
CREATE INDEX IF NOT EXISTS idx_runs_chain_started ON scrape_runs(chain_id, started_at);
