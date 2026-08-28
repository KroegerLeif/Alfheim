"""Database migration scripts for PostgreSQL extensions and full-text search indexes."""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("library.backend.migrations")


async def run_search_index_migrations(engine: AsyncEngine) -> None:
    """Apply PostgreSQL full-text search and trigram extension migrations if applicable."""
    async with engine.begin() as conn:
        dialect_name = conn.dialect.name
        if dialect_name != "postgresql":
            logger.info(f"Skipping PostgreSQL search migrations for dialect '{dialect_name}'")
            return

        logger.info("Executing PostgreSQL pg_trgm and full-text search index migrations...")

        # Enable pg_trgm extension for fuzzy title search
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))

        # Trigram GIN index on item titles
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_items_trgm_title ON items USING gin (title gin_trgm_ops);")
        )

        # Full-text search GIN index combining title, description, and author_creator
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_items_fts "
                "ON items USING gin ("
                "to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(author_creator, ''))"
                ");"
            )
        )

        logger.info("PostgreSQL search index migrations completed successfully.")
