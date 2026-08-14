# Blueprint: Theme Creation & Customization (`.ai/blueprints/theme.md`)

This blueprint outlines the standard developer guidelines for defining, registering, and testing design themes inside the `@alfheim/shared` workspace package.

---

## 📁 File & Directory Architecture

Theme token definitions reside in `packages/shared/src/styles/themes/`. Every theme must be created as a JSON/YAML file specifying **BOTH** a `dark` and a `light` variant mode pair.

```text
packages/shared/
 └── src/
      ├── styles/
      │    └── theme.css              <-- Unified CSS custom properties & @theme tokens
      └── features/
           └── theme/
                ├── types/            <-- ThemeVariant union type definition
                ├── tokens/           <-- Theme token registry & JSON definitions (nordic, obsidian, kinetic, slate, custom)
                ├── context/          <-- ThemeProvider & DOM propagation engine
                └── components/       <-- ThemeToggle & theme switcher components
```

---

## 🎨 Theme Definition Schema & Token Contract

Each theme definition file (e.g. `nordic.json`) MUST contain explicit `dark` and `light` objects matching the `ThemeTokens` interface.

### Default Platform Theme: `nordic` (Nordic Dark)
* Deep Frost Slate canvas with radiant Mint (`#10B981`) and Cyan (`#06B6D4`) aurora accents.

### Required Token Keys & WCAG Contrast Rules

| Token Key | Description | WCAG Contrast Target |
| :--- | :--- | :--- |
| `surfaceCanvas` | Root page application background | Base canvas fill |
| `surfaceCard` | Floating panels, cards, and containers | Intermediate elevation |
| `surfaceElevated` | Modals, active states, and dropdown items | Top-level elevation |
| `primaryMain` | Primary branding color, active CTA buttons | High visibility against card fill |
| `primaryHover` | Hover state for primary interactive elements | Slight hue/lightness adjustment |
| `accentMint` | Secondary accent highlight (Cyan/Mint) | Aurora secondary tint |
| `accentCyan` | Secondary accent highlight (Cyan) | Aurora highlight tint |
| `borderSubtle` | Subtle dividers, card borders | Low contrast structural lines |
| `borderAccent` | Glowing active borders, focused input borders | Primary accent tint |
| `textMain` / `textPrimary` | Primary headings, body text, high emphasis | **AA/AAA (> 4.5:1 / 7:1)** |
| `textSecondary` | Subheaders, labels, form descriptions | **AA (> 4.5:1)** |
| `textMuted` | Timestamps, secondary metadata, icons | **AA readable (> 3:1)** |
| `textFaint` | Disabled states, subtle placeholders | Soft faint contrast |
| `accentGlow` | Ambient glow shadows and translucent overlays | Translucent RGBA tint |

---

## 🛠️ Step-by-Step Guide for Adding a New Theme

1. **Create the Theme Definition**:
   Create a new file `packages/shared/src/features/theme/tokens/themes/<theme_name>.json` defining both `dark` and `light` token pairs.

2. **Register the `ThemeVariant` Type**:
   In `packages/shared/src/features/theme/types/index.ts`, update the `ThemeVariant` union type:
   ```typescript
   export type ThemeVariant = 'nordic' | 'obsidian' | 'kinetic' | 'slate' | 'custom' | '<theme_name>';
   ```

3. **Export and Map Tokens**:
   In `packages/shared/src/features/theme/tokens/index.ts`, import the new JSON definition and register it under `THEME_TOKENS`:
   ```typescript
   import newTheme from './themes/<theme_name>.json';

   export const THEME_TOKENS: Record<ThemeVariant, Record<ResolvedMode, ThemeTokens>> = {
     nordic: nordicTheme as Record<ResolvedMode, ThemeTokens>,
     obsidian: obsidianTheme as Record<ResolvedMode, ThemeTokens>,
     kinetic: kineticTheme as Record<ResolvedMode, ThemeTokens>,
     slate: slateTheme as Record<ResolvedMode, ThemeTokens>,
     custom: customTheme as Record<ResolvedMode, ThemeTokens>,
     <theme_name>: newTheme as Record<ResolvedMode, ThemeTokens>,
   };
   ```

4. **Dynamic Theme Picker in Settings**:
   The Dashboard Settings view (`core/dashboard/frontend/src/app/settings/page.tsx`) dynamically iterates over `(Object.keys(THEME_TOKENS) as ThemeVariant[])` and renders preview swatches automatically.

---

## 🧪 Verification & Testing Steps

To test a newly added theme:
1. Run typecheck across shared and app workspaces:
   ```bash
   pnpm --filter shopping-frontend exec tsc --noEmit
   ```
2. Launch dev server and select the new theme from the top-right header `ThemeToggle` dropdown.
3. Switch between **Light** and **Dark** mode variants for the theme and verify that CSS custom variables (`--surface-canvas`, `--text-primary`, `--primary-main`) update on `document.documentElement`.
