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
| `NEXT_PUBLIC_PANTRY_API_URL` | `http://api.alfheim.loegien.localhost/pantry/api/v1` | Browser-API-Gateway-Endpunkt |

---

## 🔑 Domain-Modell & Schlüsselkonzepte

- **Produkt-Blaupause** (`products`): Master-Daten-Definition (Name, Marke, Barcode, Basis-Einheit, Min-Bestands-Quota).
- **Bestands-Zustand** (`inventory_states`): Live-Bestands-Cache für ein `(product, location, batch_code)`-Tupel.
- **Transaktions-Ledger** (`inventory_transactions`): Unveränderliches Audit-Log, das jede IN-, OUT- und WASTE-Bestands-Bewegung aufzeichnet.

---
