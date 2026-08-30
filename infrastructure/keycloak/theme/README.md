# Keycloakify Theme & Realm Setup for Alfheim

This directory contains the custom **Alfheim Keycloakify Theme** (React + Vite + Tailwind CSS) and configuration for Keycloak IAM.

---

## 🎨 Theme Overview & Features

- **Modern Minimalist UI**: Clean card-based design with soft borders, crisp focus states, and typography matching the Alfheim design language.
- **Light & Dark Mode**: Automatic system preference detection and manual toggle with `localStorage` persistence.
- **Brand Identity**: Includes Alfheim logo mark and ALFI mascot header.
- **Authentication Pages**:
  - `login.ftl`: Standard login with prepared Passkey and Social provider slots (Google, Apple, GitHub).
  - `register.ftl`: Declarative user profile registration (`firstName`, `lastName`, `username`, `email`, `password` with live confirmation check).
  - `login-reset-password.ftl`: Password reset flow.
  - `login-verify-email.ftl`: Email verification notification screen.
  - `login-error.ftl` / `login-page-expired.ftl`: Styled error and session timeout states.
  - `account`: Keycloak Account Console for profile, email, and password updates.
- **Passkeys (WebAuthn)**: Prepared "Sign in with Passkey" button with toggleable ready/disabled state and HTTPS requirement notice.

---

## 🚀 Quick Setup & Development Guide

### 1. Installation
Install dependencies from the monorepo root or theme folder:

```bash
pnpm install
```

### 2. Hot-Reloading / Local Preview
Run the Vite development server to preview and hot-reload theme components locally with mock Keycloak context:

```bash
cd infrastructure/keycloak/theme
pnpm dev
```

### 3. Run Unit & Component Tests
Execute the Vitest component test suite:

```bash
pnpm test
```

### 4. Build & Package Theme into `.jar`
Build the Keycloakify theme resources and compile the JAR package:

```bash
pnpm build
```

This generates the JAR package at `dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar`.

---

## 🐳 Docker Integration & Mailpit Local Testing

Keycloak is configured in `infrastructure/compose.yml` to automatically mount the compiled theme JAR into Keycloak's `/opt/keycloak/providers/` directory.

### Local SMTP & Mailpit
A `mailpit` container service is included in `infrastructure/compose.yml` to capture emails during local development:
- **Mailpit Web UI**: [http://localhost:8025](http://localhost:8025)
- **SMTP Server**: `mailpit:1025`

### Environment Variables for Production SMTP
Configure production SMTP relay using environment variables:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=your_api_key
SMTP_FROM=noreply@yourdomain.com
```

---

## 🏡 Household Invitation Flow (App-Handled Architecture)

The household invitation flow is designed as an application-handled registration flow:

1. **Invitation Link Generation**: An existing household member generates an invitation link in the Alfheim application (e.g., `https://<domain>/invite?token=XYZ`).
2. **Keycloak OIDC Redirect**: The recipient accesses the invite link on the Alfheim frontend. The app initiates the Keycloak OIDC authentication/registration flow.
3. **Self-Registration**: The user registers or signs in on Keycloak using the Alfheim theme.
4. **Token & Household Association**: Keycloak redirects the user back to the Alfheim frontend with an authorization code. Upon exchanging the code for JWT tokens, the Alfheim backend extracts the user's Keycloak `sub` (User ID) and associates it with the respective household.
