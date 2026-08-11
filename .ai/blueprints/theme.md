# Blueprint: Theme Creation & Customization (`.ai/blueprints/theme.md`)

This blueprint outlines the standard developer guidelines for defining, registering, and testing design themes inside the `@alfheim/shared` workspace package.

---

## 📁 File & Directory Architecture

Theme token definitions reside in `packages/shared/src/styles/themes/`. Every theme must be created as a JSON/YAML file specifying **BOTH** a `dark` and a `light` variant mode pair.

```text
packages/shared/
 └── src/
      ├── styles/
      │    └── themes/
      │         ├── obsidian.json
      │         ├── kinetic.json
      │         ├── slate.json
      │         └── <new-theme>.json   <-- New theme definitions
      └── theme/
           ├── types.ts                <-- ThemeVariant union type definition
           ├── tokens.ts               <-- Theme loader & CSS custom variable mappings
           └── ThemeContext.tsx        <-- Provider & DOM propagation engine
```

---

## 🎨 Theme Definition Schema & Token Contract

Each theme definition file (e.g. `emerald.json`) MUST contain explicit `dark` and `light` objects matching the `ThemeTokens` interface.

### Required Token Keys & WCAG Contrast Rules

| Token Key | Description | WCAG Contrast Target |
| :--- | :--- | :--- |
| `surfaceCanvas` | Root page application background | Base canvas fill |
| `surfaceCard` | Floating panels, cards, and containers | Intermediate elevation |
| `surfaceElevated` | Modals, active states, and dropdown items | Top-level elevation |
| `primaryMain` | Primary branding color, active CTA buttons | High visibility against card fill |
| `primaryHover` | Hover state for primary interactive elements | Slight hue/lightness adjustment |
| `borderSubtle` | Subtle dividers, card borders | Low contrast structural lines |
| `borderAccent` | Glowing active borders, focused input borders | Primary accent tint |
| `textMain` / `textPrimary` | Primary headings, body text, high emphasis | **AA/AAA (> 4.5:1 / 7:1)** |
| `textSecondary` | Subheaders, labels, form descriptions | **AA (> 4.5:1)** |
| `textMuted` | Timestamps, secondary metadata, icons | **AA readable (> 3:1)** |
| `textFaint` | Disabled states, subtle placeholders | Soft faint contrast |
| `accentGlow` | Ambient glow shadows and translucent overlays | Translucent RGBA tint |

### Example Theme Definition (`packages/shared/src/styles/themes/emerald.json`)

```json
{
  "dark": {
    "surfaceCanvas": "#061512",
    "surfaceCard": "#0b221d",
    "surfaceElevated": "#12332c",
    "primaryMain": "#10b981",
    "primaryHover": "#34d399",
    "borderSubtle": "#1b3e36",
    "borderAccent": "rgba(16, 185, 129, 0.4)",
    "textMain": "#ecfdf5",
    "textPrimary": "#ecfdf5",
    "textSecondary": "#a7f3d0",
    "textMuted": "#6ee7b7",
    "textFaint": "#047857",
    "accentGlow": "rgba(16, 185, 129, 0.2)"
  },
  "light": {
    "surfaceCanvas": "#f0fdf4",
    "surfaceCard": "#ffffff",
    "surfaceElevated": "#e6f4ea",
    "primaryMain": "#059669",
    "primaryHover": "#047857",
    "borderSubtle": "#d1fae5",
    "borderAccent": "rgba(5, 150, 105, 0.3)",
    "textMain": "#064e3b",
    "textPrimary": "#064e3b",
    "textSecondary": "#047857",
    "textMuted": "#10b981",
    "textFaint": "#6ee7b7",
    "accentGlow": "rgba(5, 150, 105, 0.15)"
  }
}
```

---

## 🛠️ Step-by-Step Guide for Adding a New Theme

1. **Create the Theme Definition**:
   Create a new file `packages/shared/src/styles/themes/<theme_name>.json` defining both `dark` and `light` token pairs.

2. **Register the `ThemeVariant` Type**:
   In `packages/shared/src/theme/types.ts`, update the `ThemeVariant` union type:
   ```typescript
   export type ThemeVariant = 'obsidian' | 'kinetic' | 'slate' | '<theme_name>';
   ```

3. **Export and Map Tokens**:
   In `packages/shared/src/theme/tokens.ts`, import the new JSON definition and register it under `THEME_TOKENS`:
   ```typescript
   import newTheme from '../styles/themes/<theme_name>.json';

   export const THEME_TOKENS: Record<ThemeVariant, Record<ResolvedMode, ThemeTokens>> = {
     obsidian: obsidianTheme as Record<ResolvedMode, ThemeTokens>,
     kinetic: kineticTheme as Record<ResolvedMode, ThemeTokens>,
     slate: slateTheme as Record<ResolvedMode, ThemeTokens>,
     <theme_name>: newTheme as Record<ResolvedMode, ThemeTokens>,
   };
   ```

4. **Update Theme Context Storage Validation**:
   In `packages/shared/src/theme/ThemeContext.tsx`, add the new theme name to the allowed list in `localStorage` checks:
   ```typescript
   if (parsed.variant && ['obsidian', 'kinetic', 'slate', '<theme_name>'].includes(parsed.variant)) { ... }
   ```

5. **Register in Shared `ThemeToggle` Dropdown**:
   In `packages/shared/src/components/ThemeToggle.tsx` (or `packages/shared/src/features/theme/components/ThemeToggle.tsx`), add the theme option to the UI menu array.

---

## 🧪 Verification & Testing Steps

To test a newly added theme:
1. Run typecheck across shared and app workspaces:
   ```bash
   pnpm --filter shopping-frontend exec tsc --noEmit
   ```
2. Launch dev server and select the new theme from the top-right header `ThemeToggle` dropdown.
3. Switch between **Light** and **Dark** mode variants for the theme and verify that CSS custom variables (`--surface-canvas`, `--text-primary`, `--primary-main`) update on `document.documentElement`.
