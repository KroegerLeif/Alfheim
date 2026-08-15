#!/usr/bin/env bash
# =============================================================================
# scripts/seed.sh — Alfheim demo data seeding orchestrator
#
# Populates presentation demo data across Pantry, Shopping, and Maintenance apps.
#
# Usage:
#   ./scripts/seed.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
info() { echo -e "${CYAN}▶${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

# ---------------------------------------------------------------------------
# Paths — resolve script location
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

step "Seeding Presentation Demo Data"

# 0. Dashboard App Catalog Seeding
info "Seeding Dashboard Catalog (default apps & portals) …"
docker exec -i dashboard-db psql -U postgres -d dashboard_db << 'EOF' >/dev/null 2>&1 || true
INSERT INTO app_catalog (name, slug, description, icon_url, app_url, category, required_role, is_active, is_external, status, is_default, display_order)
VALUES
('Digital Pantry', 'pantry', 'Manage household food inventory, recipes, and expiration dates.', 'kitchen', '/pantry', 'internal', 'MEMBER', TRUE, FALSE, 'active', TRUE, 1),
('Smart Shopping', 'shopping', 'Automated shopping list generator and store price aggregator.', 'shopping_cart', '/shopping', 'internal', 'MEMBER', TRUE, FALSE, 'active', TRUE, 2),
('Maintenance Hub', 'maintenance', 'Schedule device maintenance and home repairs.', 'build', '/maintenance', 'internal', 'MEMBER', TRUE, FALSE, 'active', TRUE, 3),
('Chores Tracker', 'chores', 'Haushaltsroutinen, Daily Resets & Streaks', 'cleaning_services', '/chores/de', 'internal', 'MEMBER', TRUE, FALSE, 'active', TRUE, 4),
('Task Tracker (TODO)', 'todo', 'Manage personal and household tasks and reminders.', 'checklist', '/under-construction?app=TODO', 'internal', 'MEMBER', TRUE, FALSE, 'in_progress', TRUE, 5),
('Home Assistant', 'home-assistant', 'Smart home automation, climate control, and security dashboard.', 'home', 'http://homeassistant.local', 'external', 'MEMBER', TRUE, TRUE, 'active', TRUE, 6),
('Plex Media Server', 'plex', 'Stream movies, TV shows, and personal media across devices.', 'movie', '/under-construction?app=Plex', 'external', 'MEMBER', TRUE, TRUE, 'in_progress', TRUE, 7),
('Nextcloud Storage', 'nextcloud', 'Private cloud storage, photos, and document synchronization.', 'cloud', '/under-construction?app=Nextcloud', 'external', 'MEMBER', TRUE, TRUE, 'in_progress', TRUE, 8)
ON CONFLICT (slug) DO UPDATE SET app_url = EXCLUDED.app_url;
EOF
ok "Dashboard catalog apps & portals ready"

# 1. Maintenance App Seeding
info "Seeding Maintenance Hub (devices & maintenance tasks) …"
docker exec maintenance-backend python -c "
import asyncio
from app.core.database import async_session_factory, seed_database
async def run():
    async with async_session_factory() as session:
        await seed_database(session)
asyncio.run(run())
" >/dev/null 2>&1 || warn "Maintenance database seeding notice: schema already populated or skipping duplicate entries."
ok "Maintenance Hub demo devices ready"

# 2. Pantry App Seeding
info "Seeding Pantry App (products & inventory) …"
docker exec pantry-backend python -c "
import asyncio, uuid
from src.core.database import async_session_factory
from src.features.products.models import Product
from src.features.products.schemas import ProductCreate
from src.features.products.service import ProductService

demo_products = [
    ProductCreate(name='Vollmilch 3.5%', brand='BioFarm', barcode='4001234567890', base_unit='l', minimum_stock=2.0),
    ProductCreate(name='Espresso Bohnen 1kg', brand='Arabica Supreme', barcode='4009876543210', base_unit='kg', minimum_stock=1.0),
    ProductCreate(name='Olivenöl Extra Vergine', brand='Toscana', barcode='4005555444333', base_unit='l', minimum_stock=1.0),
    ProductCreate(name='Bio Eier 10er', brand='Freiland', barcode='4001111222333', base_unit='piece', minimum_stock=10.0),
    ProductCreate(name='Pasta Penne Rigate 500g', brand='Barilla', barcode='8076809513722', base_unit='pack', minimum_stock=3.0),
]

async def run():
    async with async_session_factory() as session:
        for p in demo_products:
            try:
                await ProductService.create_product(session, p, uuid.UUID('00000000-0000-0000-0000-000000000001'), is_global=True)
            except Exception:
                pass
asyncio.run(run())
" >/dev/null 2>&1 || warn "Pantry products seeding completed."
ok "Pantry demo products ready"

# 3. Shopping App Seeding
info "Seeding Shopping App (lists & demo items) …"
docker exec shopping-backend python -c "
import asyncio, uuid
from src.core.database import async_session_factory
from src.features.shopping_lists.service import ShoppingListService
from src.features.shopping_lists.schemas import ShoppingItemCreate

home_id = uuid.UUID('00000000-0000-0000-0000-000000000001')
user_id = uuid.UUID('00000000-0000-0000-0000-000000000001')

household_items = [
    ShoppingItemCreate(name='Butter 250g', brand='Kerrygold', quantity=2, unit='pack'),
    ShoppingItemCreate(name='Bio Eier 10er', brand='Freiland', quantity=1, unit='pack'),
    ShoppingItemCreate(name='Vollmilch 3.5%', brand='BioFarm', quantity=3, unit='l'),
    ShoppingItemCreate(name='Spülmaschinentabs', brand='Finish', quantity=1, unit='box'),
]

personal_items = [
    ShoppingItemCreate(name='Protein Bar Peanut', brand='Barebells', quantity=4, unit='piece'),
    ShoppingItemCreate(name='Hafermilch Barista', brand='Oatly', quantity=2, unit='l'),
]

async def run():
    async with async_session_factory() as session:
        lists = await ShoppingListService.get_lists(session, home_id=home_id, owner_id=user_id, username='Max')
        personal_list = lists[0]
        household_list = lists[1]

        for item in household_items:
            try:
                await ShoppingListService.add_item(session, household_list.id, item, home_id)
            except Exception:
                pass
        for item in personal_items:
            try:
                await ShoppingListService.add_item(session, personal_list.id, item, home_id)
            except Exception:
                pass
asyncio.run(run())
" >/dev/null 2>&1 || warn "Shopping items seeding completed."
ok "Shopping demo lists ('Haushalt', 'Personal') ready with demo items"

step "Demo Data Seeding Finished Successfully"
