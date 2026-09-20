---
title: "Digitale Speisekammer"
description: "Multi-Tenant-Haushalt-Inventar, Bestands-Tracking, Ablauf-Alert und Barcode-Lookup-Service für Alfheim."
---

> **Kurzfassung:** Multi-Tenant-Haushalt-Inventar, Bestands-Tracking, Ablauf-Alert und Barcode-Lookup-Service für Alfheim.

Quelle: [`apps/pantry/`](https://github.com/KroegerLeif/Alfheim/tree/main/apps/pantry)

---

## 🎯 Zweck & Kernwert

| Bedarf / Problem | Lösung / Kapazität |
| :--- | :--- |
| Nicht wissen, was in der Speisekammer ist | Echtzeit-Bestands-Tracking mit Standort-bewusster Charge-Verwaltung |
| Lebensmittel verfallen unbemerkt | Ablauf-Datum-Tracking mit Dringlichkeits-Sortiertem-Alert-Feed |
| Bestandskauf ist reaktiv | Mindest-Bestands-Quoten mit automatischer Einkaufslisten-Synchronisation |
| Keine Verbrauchssichtbarkeit | Monatliche Verbrauchsanalytik (OUT/WASTE-Bewegungen) |
| Mehrere Lagerungsbereiche | Multi-Standort-Speicher-Layout (Kühlschrank, Schrank, Backlog) |

---

## 🏗️ Architektur & Tech Stack

- **Backend:** Python 3.12 / FastAPI-Microservice mit SQLModel (async SQLAlchemy), Pint-Einheitenkonvertierung und FastMCP-KI-Tools.
- **Frontend:** Next.js 16 (App Router) Microfrontend, Tailwind CSS v4, Lucide React und `@alfheim/shared`.
- **Datenbank:** Gehostet auf `postgres-core` (`alfheim_pantry`-Datenbank, Besitzer `pantry_user`).

### FDD Domain-Features (`src/features/`)
- `locations`: Physische und virtuelle Lagerplätze (Schrank, Kühlschrank, Speisekammer). System-Standard-Lagerplätze (Backlog) sind vor versehentlichem Löschen geschützt.
- `categories`: Tag-Klassifizierungs-Gruppen für Produkte.
- `products`: Master-Produkt-Blaupausen (EAN/UPC-Barcode-Lookup, Marke, Basis-Einheit). Barcode-Artikel werden zu globalen System-Vorlagen. Open Food Facts API-Integration.
- `inventory`: Bestands-Ledger-Transaktionen (IN, OUT, WASTE) und Live-Bestands-Status-Cache. Erzwingt ACID-Sicherheits-Schreib-Sperren (`SELECT FOR UPDATE`).

---

## 🌐 Ingress-Routing & Umgebungskonfiguration

### Gateway & Netzwerk-Matrix
| Service | Interner Port | Host-Mapping / Gateway-Route | Protokoll & Beschreibung |
| :--- | :--- | :--- | :--- |
| `postgres-core` | 5432 | Gemeinsame Multi-Zone-Netzwerke | PostgreSQL 16 Kern-Datenbankserver |
| `pantry-backend` | 8000 | `/pantry/api/v1` | FastAPI REST API & FastMCP-Server |
| `pantry-frontend` | 3000 | `alfheim.loegien.localhost/pantry` | Next.js Microfrontend |

### Essenzielle Umgebungsvariablen
| Variable | Standard / Beispiel | Zweck |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://pantry_user:postgres@postgres-core:5432/alfheim_pantry` | Async PostgreSQL-Verbindungszeichenkette |
| `OIDC_ISSUER_URL` | `http://auth.alfheim.loegien.localhost` | OIDC-Provider-Aussteller-URL |
| `OIDC_AUDIENCE` | `alfheim` | Ziel-OIDC-Audience-Claim |
| `HOUSEHOLD_INTERNAL_URL` | `http://household-backend:8080` | Basis-URL der Mitgliedschafts-API (`core/household`) |
| `ALFHEIM_INTERNAL_TOKEN` | *(generiertes Secret)* | Gemeinsames Secret, gesendet als `Authorization: Bearer …` bei Mitgliedschaftsprüfungen. Pflicht; ohne es startet das Backend nicht |
| `NEXT_PUBLIC_API_URL` | `${ALFHEIM_BASE_URL}/pantry/api/v1` | Browser-API-Basis-URL. Compose leitet sie aus `ALFHEIM_BASE_URL` ab (Build-Argument und Laufzeit-Umgebung) |

---

## 🔑 Domain-Modell & Schlüsselkonzepte

- **Produkt-Blaupause** (`products`): Master-Daten-Definition (Name, Marke, Barcode, Basis-Einheit, Min-Bestands-Quota).
- **Bestands-Zustand** (`inventory_states`): Live-Bestands-Cache für ein `(product, location, batch_code)`-Tupel.
- **Transaktions-Ledger** (`inventory_transactions`): Unveränderliches Audit-Log, das jede IN-, OUT- und WASTE-Bestands-Bewegung aufzeichnet.

---

## 🔌 MCP-Tools

Bereitgestellt unter `POST /mcp` (`backend_shared.mcp_middleware.mount_mcp`), authentifiziert genauso wie die REST-API. Tools nehmen keine `household_id`/`user_id`-Parameter entgegen – sie lesen `get_mcp_household_context()`.

| Feature | Tools |
| :--- | :--- |
| `products` | `list_products`, `get_product`, `get_product_by_barcode`, `create_product`, `update_product`, `delete_product`, `get_product_nutrition`, `update_product_nutrition` |
| `locations` | `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location` |
| `inventory` | `record_inventory_movement`, `get_current_inventory`, `get_low_stock_alerts`, `get_inventory_expiration_summary` |
| `categories` | `list_categories`, `get_category`, `create_category`, `update_category`, `delete_category` |

---

## 🏠 Haushalts-Scoping

Jede Route hängt von `backend_shared.household.require_household` ab (jede Mitgliedsrolle darf lesen und schreiben). Globale Produkte mit gültigem EAN/UPC-Barcode sind haushaltsübergreifend geteilt (`is_global = True`) statt haushaltsbezogen. Siehe [ADR 0006](../../explanation/decisions/0006-household-authorization-via-membership-api.md).

---

## ⚠️ Bekannte Probleme & offene Folgearbeiten

Keine bekannten offenen Probleme über die allgemeinen Punkte zur Haushalts-Autorisierung in [Bekannte Probleme](../../explanation/known-issues.md) hinaus.

---
