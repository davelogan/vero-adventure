---
name: eds-design-standards
description: EDS design standards for AEM Edge Delivery Services CSS and blocks: 4-layer token architecture, rem sizing, compositor-only motion. Use when writing, reviewing or refactoring EDS styles or blocks.
---

# EDS Development Design Standards

Apply these rules whenever you create, edit or review CSS (and motion-related JS) in an AEM Edge Delivery Services project: `styles/*.css`, `blocks/{name}/{name}.{css,js}`.

## Before you write anything

1. List `styles/` and read the existing token files. Reuse existing tokens. Never invent a token name that is close to an existing one.
2. Check which layers the repo already has (`brand.css`, `themes.css`, `sections.css`). If a layer file is missing, don't create it unless the user asked to. Say which layer is missing and put the rule where it fits best.
3. Read the repo's `AGENTS.md`, `CONTRIBUTING.md`, `docs/lint-guardrails.md` and the stylelint config if present. Repo-specific rules win over this skill when they are stricter.

## The four token layers

Each layer may only consume tokens from layers above it. Values flow down; nothing flows up.

| Layer | File | Owns | Must not contain |
|---|---|---|---|
| 1. Brand | `styles/brand.css` | Raw palettes (`--palette-blue-500`), semantic roles mapped to them (`--color-action-primary: var(--palette-blue-500)`), typography scale, spacing scale, motion tokens | Selectors other than `:root`; block names |
| 2. Themes | `styles/themes.css` | Dark and high-contrast overrides that **remap semantic roles** (e.g. `:root[data-page-theme="dark"] { --color-surface: var(--palette-neutral-900); }`) | New raw hex values that bypass the palette; block selectors; layout |
| 3. Sections | `styles/sections.css` | Section-metadata-driven layout: container widths, grid definitions, gap tokens, background fills (via `data-section-*` attributes) | Block internals; raw colors |
| 4. Blocks | `blocks/{name}/{name}.css` | Scoped styling for that block, consuming inherited semantic tokens | Hardcoded hex/rgb/named colors; raw `--palette-*` references; selectors outside the block |

### Rules

- **Two-tier color tokens.** Palettes are raw (`--palette-{hue}-{step}`). Everything outside `brand.css` and `themes.css` uses **semantic** roles (`--color-text`, `--color-surface`, `--color-action-primary`, `--color-border`, …), never `--palette-*`. This is what makes theming work.
- **No hardcoded colors in blocks.** No hex, `rgb()`, `hsl()` or named colors. Allowed: `transparent`, `currentcolor`, `color-mix()` over tokens, and gradients built from tokens.
- **Themes remap, they don't restyle.** A theme only reassigns semantic custom properties. If a block needs a theme-specific rule, the semantic layer is missing a role; add the role to `brand.css` instead.
- **Block-local custom properties** are fine when they're derived from semantic tokens and scoped to the block (`.hero { --hero-bg: var(--color-surface-inverse); }`). This gives authors and variants one place to override.
- **Block scope.** Every selector in a block's CSS starts with the block class (or its `-wrapper`/`-container`). No IDs, no `!important`, no reaching into other blocks.
- **Sections own layout.** Width, grid columns, gaps and section backgrounds come from section metadata and `sections.css`. Blocks fill the space they're given and don't set page-level max widths.

## Sizing

- **Use `rem` for typography, padding, margins, gaps and layout widths.** This meets WCAG 2.2 AA (1.4.4 Resize Text, 1.4.10 Reflow) because everything scales with browser text zoom.
- Prefer spacing and type **tokens** over literal rem values when one fits the purpose.
- `line-height` is unitless.
- Allowed exceptions that may stay in `px`: border and outline widths, hairlines, SVG/artwork coordinates, and media-query breakpoints when the repo already uses px there. Say so when you use one.
- Use `clamp()`, `%`, `fr`, `min()`/`max()` and intrinsic sizing freely. Their rem parts follow the same rules.

## Motion

- **Animate only `transform` and `opacity`.** These run on the compositor. Never animate `width`, `height`, `top`/`left`, `margin`, `padding`, `box-shadow` or `filter` on large areas. For expand/collapse, use `transform: scaleY()` / `translate`, `grid-template-rows: 0fr → 1fr` (with a note that it's a layout transition), or the `<details>` element.
- **Prefer CSS transitions and `@keyframes` over JavaScript animation.** No `requestAnimationFrame` loops, `setInterval`/`setTimeout` chains or per-frame style writes for visual motion. CSS animations on transform/opacity run on the compositor, off the main thread, so they stay smooth and protect Core Web Vitals (INP, TBT). Use the Web Animations API only when CSS can't express the motion, and still animate only transform/opacity.
- **JS observes, CSS animates.** JavaScript's only job in motion is to detect a trigger and swap a class or data attribute; the CSS for that state does the transform:
  - `IntersectionObserver` for scroll-into-view reveals, lazy entrances, sticky/active states (never `scroll` listeners that read layout).
  - `MutationObserver` to react when content or attributes change (e.g. late-decorated blocks, authored content updates).
  - `ResizeObserver` for size-driven state instead of `resize` listeners.
  - Plain event listeners (`click`, `toggle`, `focusin`) that only toggle classes/attributes or `aria-expanded`.
  - Unobserve once a one-shot animation has fired, and disconnect observers when the block is removed.

  ```js
  // blocks/cards/cards.js: JS only flips state
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  block.classList.add('is-animated');
  block.querySelectorAll('.cards-card').forEach((card) => io.observe(card));
  ```

  ```css
  /* blocks/cards/cards.css: CSS does the motion */
  .cards.is-animated .cards-card {
    opacity: 0;
    transform: translateY(1.5rem);
    transition:
      opacity var(--motion-duration-normal) var(--motion-easing-standard),
      transform var(--motion-duration-normal) var(--motion-easing-spring);
  }

  .cards.is-animated .cards-card.is-visible {
    opacity: 1;
    transform: none;
  }
  ```

  Content must stay visible if JS never runs or the observer never fires, so gate the hidden starting state behind a class the JS sets (`is-animated` above).
- **Spring easing via `linear()`.** Use `linear(...)` timing functions for spring/bounce feel, defined once as tokens in `brand.css` (e.g. `--motion-easing-spring: linear(0, 0.009, 0.035 2.1%, …, 1);`). Durations come from tokens (`--motion-duration-fast|normal|slow`). Don't put literal `linear(...)` curves or ms values in blocks.
- **Respect reduced motion.** Every block with motion includes a `@media (prefers-reduced-motion: reduce)` path that removes transforms or cuts duration to near-zero. Prefer handling it globally by zeroing the duration tokens in `brand.css`.
- `will-change` only on elements that are about to animate, never as a blanket rule.

## Reviewing code against these standards

When reviewing, report violations grouped by layer, with file:line, the rule broken and the concrete fix (name the token to use). Check:

1. Hex/rgb/hsl/named colors outside `brand.css`/`themes.css`
2. `--palette-*` used outside `brand.css`/`themes.css`
3. Theme files doing more than remapping semantic roles
4. Layout (max-width, grid, section gaps/backgrounds) inside block CSS
5. `px` in font-size, spacing or layout widths
6. Transitions/animations on properties other than transform/opacity
7. JS driving visuals (`requestAnimationFrame`/`setInterval` loops, inline style writes, `scroll`/`resize` listeners) where an observer + class swap + CSS transition would do
8. Literal easing curves or durations instead of motion tokens
9. Missing `prefers-reduced-motion` handling
10. Unscoped selectors, IDs, `!important`

Don't flag vendored code (`scripts/aem.js`), generated fixtures, or files the repo's lint config explicitly excludes.

## Adding a new token

1. Raw value → add to the palette/scale in `brand.css`.
2. Map it to a semantic role in `brand.css`.
3. If dark or high-contrast need a different value, remap that role in `themes.css`.
4. Consume the semantic role in the block.

Run the repo's lint (`npm run lint`, or `npm run check` if it exists) after CSS changes and fix all warnings.
