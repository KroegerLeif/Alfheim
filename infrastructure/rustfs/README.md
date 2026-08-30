# RustFS S3 Object Storage (`infrastructure/rustfs/`)

The `infrastructure/rustfs` module provides central S3-compatible object storage for the Alfheim monorepo ecosystem. It is used for storing receipts, chat attachments, image uploads, and media files.

---

## 🎯 Purpose & Integration

RustFS serves as a lightweight S3-compatible object storage server (compatible with MinIO SDKs and AWS S3 clients).

- **Chat Attachments**: Used by `apps/chat/backend` for uploading image attachments in multi-modal LLM sessions.
- **Budget Receipts**: Used by `apps/budget/backend` for receipt image uploads (`budget-receipts` bucket).
- **Ingress Routing**: Accessible via Caddy proxy under `http://api.alfheim.loegien.localhost/storage`.

---

## ⚙️ Environment Variables

Configured in `infrastructure/rustfs/.env.example` / `.env`:

- `S3_ROOT_USER`: Root access key (default: `minioadmin`).
- `S3_ROOT_PASSWORD`: Root secret key (default: `minioadmin`).
- `S3_PORT`: API service port (default: `9000`).

---

## 🌐 Network & Storage Volume

- **Container Name**: `alfheim_rustfs`
- **Internal Port**: `9000`
- **Docker Networks**: `infra-net`, `gateway-net`
- **Volume Mount**: Named volume `rustfs_data` mounted to `/data`.
- **Healthcheck**: Performs HTTP GET on `http://127.0.0.1:9000/minio/health/live`.

---

## 🚀 Execution & Management

```bash
# Start RustFS object storage container
docker compose -f infrastructure/compose.yml up -d rustfs

# Check RustFS health status
docker compose -f infrastructure/compose.yml logs -f rustfs
```
