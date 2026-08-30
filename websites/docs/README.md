# Alfheim Documentation & Landing Page (`websites/docs`)

This is the public-facing static documentation portal and landing site for **Alfheim Sovereign OS**, built with React 19, Vite, and Tailwind CSS v4.

---

## 1. Overview

The documentation site provides a clean, responsive, and localized introduction to the Alfheim ecosystem, its containerized microservice modules, zero-trust security architecture, and the ambient AI companion **ALFI**.

### Key Highlights
* **Tech Stack**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React.
* **Shared Localization**: Native multi-language support (English, German, Polish) backed by `@alfheim/shared` locales (`packages/shared/src/features/i18n/locales/{de,en,pl}/docs.json`).
* **Design Aesthetic**: Obsidian / Nordic Dark theme (`#0b1326` canvas, `#111b33` frosted glass cards, `#3eb1ff` ice-cyan accents).
* **Automated CI/CD**: Seamless GitHub Pages continuous deployment via `.github/workflows/deploy-docs.yml`.

---

## 2. Project Structure & Shared Assets

```text
websites/docs/
├── public/                 # Static assets
├── src/
│   ├── components/
│   │   ├── icons/          # Vector SVG brand assets (AlfheimLogo, AlfiMascot)
│   │   ├── layout/         # Navbar, Footer
│   │   └── sections/       # Hero, VpnNoticeBanner, AppsGrid, AlfiSection, ArchitectureSection, TechStackSection
│   ├── i18n/               # React i18n hook consuming @alfheim/shared
│   ├── App.tsx             # Main application layout
│   ├── index.css           # Tailwind CSS v4 & custom theme variables
│   └── main.tsx            # React root DOM entry
├── index.html              # HTML entry template
├── package.json            # Dependencies & workspace script definitions
├── tsconfig.json           # Strict TypeScript configuration
└── vite.config.ts          # Vite build config with relative asset base & shared aliases
```

### Shared Asset Pipeline (`@alfheim/shared/assets`)
Vector emblems and mascot states are centralized in `packages/shared/src/assets/`:
- **Brand Emblems** (`packages/shared/src/assets/brand/`):
  - `logo-mark.svg`: Primary hexagonal shield brand mark (gold/cyan gradient).
  - `logo-mark-white.svg`: Monochrome white logo mark variant for high-contrast / dark backgrounds.
- **Favicon Bundle** (`packages/shared/src/assets/favicon_io/`):
  - Multi-resolution favicons (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `site.webmanifest`).
- **ALFI Mascot States** (`packages/shared/src/assets/alfi/`):
  - `alfi-idle.svg`: Ambient idle state with floating orbit.
  - `alfi-thinking.svg`: Violet analytical state with rotated orbit.
  - `alfi-speaking.svg`: Active conversational / voice assistant state.
  - `alfi-listening.svg`: Inquisitive listening / audio sensor state.
  - `alfi-eating.svg`: Pantry & recipe culinary state.
  - `alfi-fixing.svg`: Maintenance & repair mechanic state with wrench.
  - `alfi-chasing.svg`: Household chores & gamified streaks state.
  - `alfi-sleeping.svg`: Low-power standby state with sleep indicators.
- **Local Fonts** (`packages/shared/src/assets/fonts/`):
  - Directory placeholder for self-hosted typography assets.

---

## 3. Local Development

To run the documentation portal locally in development mode:

```bash
# From workspace root
pnpm --filter docs dev

# Or from within websites/docs directory
cd websites/docs
pnpm dev
```

The dev server will start at `http://localhost:5173`.

---

## 4. Production Build

To build the static distribution bundle:

```bash
# From workspace root
pnpm --filter docs build
```

Compiled static assets will be output to `websites/docs/dist/`.

---

## 5. Deployment (GitHub Pages)

The documentation site is deployed automatically to GitHub Pages via `.github/workflows/deploy-docs.yml` whenever changes to `websites/docs/**` or `packages/shared/**` are pushed to the `main` branch.

* **Base Path**: Assets are configured with relative pathing (`base: './'`) to support both custom domain routing and repository subpaths without 404 errors.
* **Artifact Upload**: GitHub Actions packages and uploads `websites/docs/dist/` directly without committing compiled build chunks to source control.
