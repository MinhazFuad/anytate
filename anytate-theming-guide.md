# Anytate — Visual Design & Theming Guide

Handoff document for build. Companion to `anytate-implementation-plan.md`. This file is the single source of truth for every color, font, spacing value, component style, and motion rule in the app — the building agent should derive all CSS/Tailwind tokens from here rather than inventing its own defaults.

## Design philosophy

Anytate is a tool for people doing precise, repetitive, technical work — drawing boxes, picking classes, writing structured reasoning. The interface should read like an IDE or terminal-adjacent developer tool, not a consumer app: information-dense without feeling cluttered, fast and responsive-feeling rather than decorative, and calm enough to stare at for a multi-hour annotation session without fatigue.

**Signature element**: the annotation canvas itself — bounding boxes rendered as clean 1.5px strokes in per-class accent colors, with a monospace coordinate readout that updates live as you draw, styled like a code editor's cursor-position indicator. Everything else in the UI (buttons, panels, nav) stays quiet and gets out of its way.

Two moods, one system: dark mode is the primary/default experience (most annotation work happens in low-light, extended sessions — this is also just where a developer-tool aesthetic reads most naturally). Light mode is a first-class equal, not an afterthought, tuned for daytime/bright-room use.

---

## 1. Color Palette

All colors as CSS custom properties, swapped by a `.dark` class on `<html>` (via `next-themes`, see §10). Never hardcode a hex value in a component — always reference the variable.

### Dark mode (default)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0A0C10` | App background — cool near-black, not pure black |
| `--surface` | `#12151C` | Panels, cards, sidebar |
| `--surface-2` | `#171B24` | Nested/elevated surfaces (modals, dropdowns, popovers) |
| `--surface-hover` | `#1C212C` | Hover state on interactive surfaces |
| `--border` | `#262B38` | Default hairline borders |
| `--border-strong` | `#363C4D` | Emphasized borders (focused inputs, active tabs) |
| `--text-primary` | `#E6E8F0` | Primary text, headings |
| `--text-secondary` | `#9AA3C4` | Secondary text, labels, muted body copy |
| `--text-tertiary` | `#5B6178` | Placeholder text, disabled text, timestamps |
| `--accent-cyan` | `#00E5FF` | Primary interactive color — links, primary buttons, active states, focus rings |
| `--accent-cyan-hover` | `#33ECFF` | Hover state for cyan elements |
| `--accent-cyan-muted` | `rgba(0,229,255,0.12)` | Cyan background tint (selected rows, active nav item bg) |
| `--accent-magenta` | `#FF4081` | Secondary accent — flagged status, destructive-adjacent emphasis, "other/custom" class marker |
| `--accent-amber` | `#FFB020` | Caution/pending status, unsaved-draft indicator |
| `--accent-green` | `#2EE6A8` | Success/approved status, "saved" confirmation |
| `--accent-red` | `#FF5470` | Errors, destructive actions (delete, discard) |
| `--focus-ring` | `rgba(0,229,255,0.35)` | Keyboard focus ring color (see §14) |
| `--shadow-color` | `rgba(0,0,0,0.5)` | Base for the sparing shadow use in §8 |

### Light mode

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F6F7FB` | App background |
| `--surface` | `#FFFFFF` | Panels, cards, sidebar |
| `--surface-2` | `#EEF0F6` | Nested/elevated surfaces |
| `--surface-hover` | `#E4E7F0` | Hover state on interactive surfaces |
| `--border` | `#DDE1EA` | Default hairline borders |
| `--border-strong` | `#C3C9D9` | Emphasized borders |
| `--text-primary` | `#12141C` | Primary text, headings |
| `--text-secondary` | `#565D75` | Secondary text, labels |
| `--text-tertiary` | `#8C93AB` | Placeholder, disabled, timestamps |
| `--accent-cyan` | `#0097A7` | Primary interactive color (darkened from dark-mode cyan for AA contrast on white) |
| `--accent-cyan-hover` | `#007C8A` | Hover state |
| `--accent-cyan-muted` | `rgba(0,151,167,0.10)` | Cyan background tint |
| `--accent-magenta` | `#D81B60` | Secondary accent |
| `--accent-amber` | `#C47F00` | Caution/pending |
| `--accent-green` | `#0F9D68` | Success/approved |
| `--accent-red` | `#D92D4C` | Errors, destructive |
| `--focus-ring` | `rgba(0,151,167,0.35)` | Keyboard focus ring color |
| `--shadow-color` | `rgba(30,34,50,0.12)` | Base for shadows |



---

## 2. Typography

Three type roles, deliberately not more — restraint matters here since this is a data-dense interface.

| Role | Typeface | Where it's used |
|---|---|---|
| **Display / Chrome** | `JetBrains Mono` (weights 500, 600, 700) | Page titles, section headers, button labels, nav items, badges, class names, keyboard-shortcut hints. This is the personality face — it's what makes the app *look* like a developer tool. |
| **Body** | `Inter` (weights 400, 500) | Paragraph text, form field descriptions, FCOT text content (Primary Cue, Observation, etc. — this is prose the user reads/writes, not chrome), tooltips |
| **Data / Utility** | `IBM Plex Mono` (weight 400) | Coordinates, timestamps, IDs, counters, the live bbox readout on canvas, JSON preview, anything numeric or machine-generated |

Load all three via `next/font/google` (self-hosted, no external request, no layout shift).

### Type scale
```
--text-xs:    12px / 16px line-height   — timestamps, hints, badge text
--text-sm:    13px / 18px               — secondary labels, form helper text
--text-base:  14px / 20px               — body copy, form inputs, default UI text
--text-md:    16px / 24px               — card titles, FCOT field values
--text-lg:    20px / 28px               — section headers
--text-xl:    26px / 32px               — page titles
--text-2xl:   34px / 40px               — dashboard hero numbers only
```
Base UI size is intentionally 14px, not 16px — this is a dense professional tool, not a marketing page; err toward information density over generous whitespace, but never below 12px anywhere (accessibility floor).

---

## 3. Spacing & Layout

8px base unit, standard scale: `4, 8, 12, 16, 24, 32, 48, 64px`. Canvas/annotation workspace gets a slightly tighter internal scale (`4, 8, 12px`) since screen real estate for the image matters more there than breathing room.

- **Border radius**: `4px` default (inputs, buttons, badges use pill/`9999px`), `8px` for cards/panels, `12px` for modals. Deliberately restrained — sharp-ish corners read as "tool," not "app."
- **Max content width**: dashboard/settings pages cap at `1280px` centered; the annotation canvas view is full-bleed (no max-width — the image and canvas should use all available space).

---

## 4. Buttons

All buttons: `JetBrains Mono` 500 weight, `--text-sm`, `4px` radius, `150ms ease-out` transition on background/border/color, `36px` height default (`28px` for compact/inline, `44px` for primary CTAs on empty states).

| Variant | Default | Hover | Active/Pressed | Disabled |
|---|---|---|---|---|
| **Primary** | bg `--accent-cyan`, text `--bg` (inverted — dark text on cyan for contrast), no border | bg `--accent-cyan-hover` | scale `0.98`, no transition delay | bg `--surface-2`, text `--text-tertiary`, cursor not-allowed |
| **Secondary** | bg transparent, text `--text-primary`, border `1px solid --border-strong` | bg `--surface-hover`, border `--accent-cyan` | bg `--surface-2` | text `--text-tertiary`, border `--border` |
| **Destructive** | bg transparent, text `--accent-red`, border `1px solid --accent-red` | bg `rgba(255,84,112,0.1)` | bg `rgba(255,84,112,0.18)` | text `--text-tertiary`, border `--border` |
| **Ghost** | bg transparent, text `--text-secondary`, no border | bg `--surface-hover`, text `--text-primary` | bg `--surface-2` | text `--text-tertiary` |
| **Icon button** | 32×32px, bg transparent, icon `--text-secondary` | bg `--surface-hover`, icon `--text-primary` | bg `--surface-2` | icon `--text-tertiary` |

Every button gets a visible focus-visible ring (see §14) — never suppressed, even though the visual language is minimal.

**Keyboard-shortcut hint**: any button with a bound shortcut (Save & Next, Undo) shows the key in a small `IBM Plex Mono` pill to its right, e.g. `[Enter]` — muted text on `--surface-2` background, `2px` radius, `11px` text. This is a signature detail that reinforces the developer-tool feel and doubles as discoverable documentation.

---

## 5. Form Inputs

Text inputs, selects, textareas: `1px solid --border` default, `--surface` background, `4px` radius, `--text-base` in `Inter`. On focus: border becomes `--accent-cyan`, plus the focus ring from §14. Placeholder text in `--text-tertiary`.

- **Sliders** (turbidity score, any 0–10 scene-metadata field): track in `--surface-2`, filled portion in `--accent-cyan`, thumb a `14px` circle in `--accent-cyan` with a `2px` `--bg`-colored border (so it "pops" off the filled track) — plus a live numeric readout in `IBM Plex Mono` next to the slider, not just a floating tooltip, since precision matters for this data.
- **Color picker** (taxonomy class color): a 10-swatch quick-pick from the fixed palette in §1, plus a custom hex input below it in `IBM Plex Mono`.
- **Select/dropdown**: opens as a `--surface-2` panel, `8px` radius, `1px solid --border`, subtle shadow (§8). Selected item shows a small `--accent-cyan` checkmark, not a background fill, to keep it legible against per-class colors already in the list.
- **Textarea** (FCOT prose fields — Primary Cue, Decision Rule, etc.): `Inter`, generous `1.6` line-height since these are meant to be read/written as reasoning text, not scanned as UI chrome — this is the one place body text should feel spacious rather than dense.

---

## 6. Badges / Status Pills

Pill-shaped (`9999px` radius), `11px` `JetBrains Mono` 600 weight, uppercase, letter-spacing `0.03em`, `4px 10px` padding.

| Status | Background | Text |
|---|---|---|
| Pending review | `rgba(255,176,32,0.15)` | `--accent-amber` |
| Approved | `rgba(46,230,168,0.15)` | `--accent-green` |
| Flagged | `rgba(255,64,129,0.15)` | `--accent-magenta` |
| Draft (unsaved) | transparent, `1px dashed --border-strong` | `--text-tertiary` |
| Class label chip | per-class color at 15% opacity bg | per-class color, full opacity text |

---

## 7. Canvas & Annotation-Specific UI

This is the most important surface in the app and gets its own rules, distinct from general chrome:

- **Bounding boxes**: `1.5px` stroke in the class's assigned color (§1), no fill by default. On hover: fill appears at `8%` opacity. On selection: stroke becomes `2.5px`, fill at `15%` opacity, plus four `6px` square resize handles in the same class color with a `1px --bg`-colored border for contrast against the image underneath.
- **Live coordinate readout**: while drawing, a small floating tag follows the cursor showing `x, y` in `IBM Plex Mono`, `--bg` background at 85% opacity, `--text-primary` text — styled like a code editor's cursor-position status bar item, not a tooltip bubble (sharp corners, no arrow/pointer).
- **Class picker overlay** (appears after drawing a box): a horizontal strip of class chips (§6 style), each showing its number-key shortcut in a small `IBM Plex Mono` badge in the corner of the chip. Currently-hovered/keyboard-highlighted chip gets a `2px --accent-cyan` outline.
- **Progress indicator** (image N of total): thin `2px` bar along the top of the canvas viewport, filled in `--accent-cyan`, background `--border` — deliberately minimal, not a chunky progress bar component.
- **Canvas background** (outside the image bounds): `--bg` in dark mode, a subtle `--surface-2` in light mode — never pure white/black regardless of theme, to reduce eye strain against the actual photo content.

---

## 8. Cards, Panels & Elevation

This design uses **borders over shadows** as the primary separation technique — flat, not skeuomorphic, consistent with the developer-tool direction. Shadows are reserved for genuinely floating elements only:

- Cards/panels: `1px solid --border`, `--surface` background, no shadow.
- Dropdowns, popovers, tooltips: `1px solid --border-strong`, `--surface-2` background, **and** a shadow — `0 8px 24px var(--shadow-color)` — since these visually float above other content.
- Modals: same shadow as above but larger — `0 16px 48px var(--shadow-color)` — plus a `--bg`-colored backdrop at 60% opacity behind them.

---

## 9. Motion & Animation

Subtle and fast throughout — this is a tool people use for hours, not a marketing site; motion should confirm actions happened, never slow the user down or call attention to itself.

- **Standard transition**: `150ms ease-out` for hover/color/border changes on buttons, inputs, nav items.
- **Panel/modal entrance**: `180ms ease-out`, fade + `4px` upward translate — no bounce, no overshoot easing anywhere in the app; bounce reads as "playful consumer app," which is the wrong register here.
- **Toast notifications** (e.g. "Saved," export-ready): slide in from bottom-right, `200ms ease-out`, auto-dismiss after 3s with a fade-out, `IBM Plex Mono` for any embedded count/filename.
- **"Saved" confirmation on the canvas**: a brief (`400ms`) checkmark icon crossfade in `--accent-green` next to the Save button — not a full toast for this specific high-frequency action, since a toast every few seconds during rapid annotation would be noisy.
- **Draw/select on canvas**: **zero animation delay** — bbox rendering, handle dragging, and selection must feel instantaneous (0ms, direct state-to-pixel), since perceived lag here directly hurts annotation speed. This is the one place where "subtle animation" means "no animation."
- **Theme toggle**: icon (sun/moon) crossfades and rotates 90° over `200ms`; the color variable swap itself should not be transitioned (instant), since transitioning dozens of CSS variables simultaneously tends to look like a flash/glitch rather than smooth.
- **Skeleton loading** (dashboard charts, image lists while fetching): a slow (`1.5s`) horizontal shimmer in `--surface-2` → `--surface-hover` → `--surface-2`, not a spinner, to match the "data is arriving" feel of an IDE rather than a generic loading spinner.
- **Respect `prefers-reduced-motion`**: all of the above transitions/animations collapse to instant (`0ms`, no transform) when the user has this OS setting enabled. Non-negotiable, not optional polish.

---

## 10. Dark / Light Mode Toggle

- Implement with `next-themes`, `attribute="class"` strategy — `<html class="dark">` or no class for light.
- Toggle control lives in the top nav/sidebar, rendered as a sun/moon icon button (see §4 icon button style) with the crossfade/rotate animation from §9.
- Default to system preference (`prefers-color-scheme`) on first visit; persist the user's explicit choice in `localStorage` (handled automatically by `next-themes`) so it overrides system preference afterward.
- No flash-of-wrong-theme: `next-themes` handles this via a blocking inline script — confirm this is wired up correctly during the theming-pass milestone (§15, milestone 9), since a flash on every page load undermines the "polished tool" feel this whole guide is aiming for.

---

## 11. Iconography

`lucide-react` throughout (already an available library per the project's frontend stack). Consistent `1.5px` stroke width, `18px` size for inline/button icons, `20px` for standalone icon buttons, `16px` for dense contexts (badges, inline hints). Icons always paired with a visible text label except in icon-only buttons, which get an accessible `aria-label` instead.

---

## 12. Accessibility Floor (non-negotiable, not "nice to have")

- All color pairings in §1 meet WCAG AA contrast (4.5:1 for text) against their paired background — this is why light-mode cyan is darkened to `#0097A7` rather than reusing the dark-mode `#00E5FF`, which would fail contrast on white.
- Every interactive element gets a visible `focus-visible` outline: `2px solid var(--focus-ring)` with `2px` offset — never `outline: none` without a replacement.
- All motion in §9 respects `prefers-reduced-motion: reduce`.
- Minimum text size `12px` anywhere in the app, no exceptions.
- Canvas keyboard shortcuts (§7, and the implementation plan §7) must have a discoverable non-keyboard equivalent (visible buttons/menu) — shortcuts are an accelerator, not the only path to any action.

---

## 13. Implementation Notes for the Building Agent

- Define every token in §1 as a CSS custom property in `globals.css` under `:root` (light) and `.dark` (dark) — do not hardcode hex values in component files.
- Map Tailwind's theme config to reference these CSS variables (`theme.extend.colors.accent.cyan = 'var(--accent-cyan)'`, etc.) rather than duplicating the palette as static Tailwind values, so the variables remain the single source of truth.
- Fonts: `JetBrains Mono`, `Inter`, `IBM Plex Mono` — all via `next/font/google`, assigned to CSS variables (`--font-display`, `--font-body`, `--font-data`) and mapped into Tailwind's `fontFamily` config.
- Build a small internal style-guide/tokens page (`/dev/theme` or similar, not linked in nav) during the theming-pass milestone that renders every button variant, badge, and color swatch from this document in both modes side by side — makes it fast to spot any drift between this spec and the implementation, and costs almost nothing to build.
