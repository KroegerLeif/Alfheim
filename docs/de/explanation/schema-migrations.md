---
title: "Schema-Migrationen"
description: "Wie die Python-Backends ihre PostgreSQL-Schemas beim Start mit Alembic anlegen und aktualisieren, für Neuinstallationen und für Datenbanken, die vor den Migrationen entstanden sind."
---

> **TL;DR:** Jedes Python-Backend (budget, chores, library, maintenance, pantry, shopping, workout) verwaltet sein Schema über Alembic-Revisionen, die beim Start automatisch unter einem PostgreSQL-Advisory-Lock laufen. `SQLModel.metadata.create_all` gehört nicht mehr zum produktiven Startpfad.

---

## 📋 Inhaltsverzeichnis
- [Warum Migrationen](#warum-migrationen)
- [Was beim Start passiert](#was-beim-start-passiert)
- [Bestehende Installationen](#bestehende-installationen)
- [Eine neue Revision schreiben](#eine-neue-revision-schreiben)
- [Alembic von Hand ausführen](#alembic-von-hand-ausführen)
- [Tests](#tests)

---

## Warum Migrationen

`create_all` legt nur fehlende Tabellen an. Eine bestehende Tabelle verändert es nie. Jede Modelländerung an einer vorhandenen Tabelle (neue Spalte, geänderter Unique-Index, Fremdschlüsselregel) blieb daher auf Installationen, die ein älteres Release ausgeführt hatten, stillschweigend wirkungslos. Alembic-Revisionen machen diese Änderungen explizit, geordnet und testbar.

## Was beim Start passiert

Jedes Backend ruft aus `init_db()` vor der Auslieferung `run_migrations(engine)` auf (in `src/core/migrations.py`, bei library in `src/db/migrations.py`):

1. Ein PostgreSQL-Advisory-Lock (`pg_advisory_xact_lock`) wird gesetzt, damit gleichzeitig startende Replikas nacheinander migrieren.
2. Hat die Datenbank Anwendungstabellen, aber keine Tabelle `alembic_version`, gilt sie als Altinstallation (siehe unten).
3. `alembic upgrade head` läuft in derselben Transaktion. PostgreSQL-DDL ist transaktional: Eine fehlschlagende Revision lässt das Schema unverändert, und das Backend startet nicht.

Revision `0001` ist die Basis und legt das vollständige Schema an, wie es bei der Einführung der Migrationen aussah. Spätere Revisionen sind klein und idempotent.

## Bestehende Installationen

Mit `create_all` angelegte Datenbanken haben keine Tabelle `alembic_version`. Beim ersten Start nach dem Update

1. legt das Backend fehlende Anwendungstabellen an (vorhandene bleiben unberührt),
2. markiert es Revision `0001` als angewendet und
3. führt die späteren Revisionen aus, die ältere Tabellenformen aktualisieren und bei bereits aktuellen Tabellen nichts tun.

Revisionen, die dafür existieren:

| App | Revision | Wirkung auf eine Altdatenbank |
| --- | --- | --- |
| budget | `0002` | Legt die Fremdschlüssel `transactions.account_id` / `pot_id` mit `ON DELETE RESTRICT` neu an |
| pantry | `0002` | Ersetzt den global eindeutigen `ix_products_barcode` durch einen normalen Index sowie die haushaltsbezogenen und katalogweiten Unique-Indizes |
| shopping | `0002` | Ergänzt `is_default`, `is_personal` und `position` in `shopping_lists`, füllt `NULL` auf und erzwingt `NOT NULL`; ersetzt die früheren `ALTER TABLE`-Anweisungen beim Start |
| maintenance | `0002` | Verschiebt die Tabellen mit ganzzahligen Haushalts-IDs samt Zeilen in das Schema `legacy_maintenance` und legt die aktuellen Tabellen an |
| library | `0002` | Legt die Erweiterung `pg_trgm` sowie die Volltext- und Trigramm-Suchindizes auf `items` an |

Die maintenance-Umstellung kann ganzzahlige Haushalts-IDs nicht auf UUID-Haushalte abbilden, daher bleiben die alten Zeilen erhalten, werden aber nicht ausgeliefert. Siehe [Fehlerbehebung](../how-to/troubleshooting.md#symptom-5-alte-maintenance-daten-fehlen-nach-dem-update).

## Eine neue Revision schreiben

1. Das Modell ändern.
2. Einen Entwurf gegen eine aktuelle, leere PostgreSQL-Datenbank erzeugen und von Hand prüfen:

   ```bash
   cd apps/<app>/backend
   DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:5432/scratch uv run alembic upgrade head
   DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:5432/scratch uv run alembic revision --autogenerate -m "Änderung beschreiben"
   ```

3. Die Revision idempotent halten, wenn sie eine Tabelle ändert, deren ältere Form ohne die Änderung existieren kann (vor dem Ändern die Datenbank inspizieren), und ein funktionierendes `downgrade` schreiben. Veröffentlichte Revisionen nicht nachträglich ändern.
4. `uv run alembic check` ausführen: Es muss `No new upgrade operations detected` melden.

## Alembic von Hand ausführen

`alembic.ini` und `alembic/env.py` liegen in `apps/<app>/backend`. Die CLI liest den Verbindungsstring aus `DATABASE_URL` (derselben Einstellung wie der Dienst), daher funktionieren `alembic upgrade head`, `alembic current` und `alembic check` gegen jede erreichbare Datenbank.

## Tests

Jedes Backend hat eine `test_migrations.py`. Die SQLite-Tests laufen immer. Die PostgreSQL-Tests (Upgrade entspricht den Modellen, Downgrade bis zur Basis, Altdatenbanken, gleichzeitige Starts) laufen, wenn `ALFHEIM_MIGRATION_TEST_DATABASE_URL` auf eine Wegwerf-Datenbank zeigt; deren Schema `public` wird gelöscht und neu angelegt:

```bash
docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=pg postgres:16-alpine
ALFHEIM_MIGRATION_TEST_DATABASE_URL='postgresql+asyncpg://postgres:pg@localhost:55432/postgres' \
  uv run --directory apps/pantry/backend pytest -q
```
