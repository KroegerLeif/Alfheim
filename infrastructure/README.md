# Infrastructure - Identity and Access Management (IAM)

This directory contains the foundational infrastructure for the IAM of `alfheim`, following a Feature-Driven Design (FDD) approach. 

We utilize a "Database per Service" architecture. Keycloak is isolated with its own dedicated PostgreSQL instance to minimize blast radius and ensure loose coupling.

## Services
* **PostgreSQL (`postgres-iam`)**: Persistent relational database for Keycloak. Data is stored locally via a Docker volume bind mount (`./postgres-iam/data`).
* **Keycloak (`keycloak`)**: The central IAM provider managing realms, clients, and users.

## Prerequisites
* Docker and Docker Compose installed.

## Setup & Local Development (Mac)

1. **Environment Variables**: 
   Navigate to both service directories (`keycloak/` and `postgres-iam/`) and copy the example files to create your local configurations:
   ```bash
   cp postgres-iam/.env.example postgres-iam/.env
   cp keycloak/.env.example keycloak/.env