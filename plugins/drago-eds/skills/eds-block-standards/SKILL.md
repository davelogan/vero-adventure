---
name: eds-block-standards
description: Project Drago EDS Prototype Standard for building AEM Edge Delivery Services blocks: decorate semantic HTML with vanilla ESM, lint hygiene, WCAG 2.2 AA, Lighthouse budget, data-layer/consent queueing, authoring plugins, Gherkin and Playwright verification. Use when planning, implementing, reviewing or testing blocks, autoblocks or authoring tools in Drago EDS projects.
---

# Drago EDS Block Standards

Source: *Edge Delivery Services Prototype Standard* (Project Drago, Peter Stolmar, Oct 28 2026), a living document. Apply it whenever you plan, build, review or test a block, an autoblock, or an authoring tool in an AdobeDrago EDS project.

Companion skills: CSS tokens, rem sizing and motion are in `eds-design-standards`. Loading phases, lazy-loading and main-thread rules are in `eds-performance`. This skill covers what those two don't.

**Precedence.** The repo's `AGENTS.md`, `CONTRIBUTING.md` and lint config win when they are stricter or more specific. When this standard and a repo convention disagree (for example, extra files in a block folder), follow the repo and mention the difference.

## Before you build a block

1. **Write the requirements as Gherkin first.** Draft `Feature` / `Scenario` / `Given-When-Then` for the block's authoring variants, behavior, keyboard use and empty/missing-cell cases. Agree on it before writing code. Keep it with the block's docs or in the PR description, as the repo prefers.
2. **Look at the real markup.** Run the local server (`npx -y @adobe/aem-cli up`) and read `http://localhost:3000/{path}.plain.html`. Blocks decorate what the Helix pipeline delivers; don't design against imagined markup.
3. **Check autoblocking.** Read `buildAutoBlocks()` in `scripts/scripts.js`. It rewrites content (video links into embed/video blocks, project-specific transforms such as fragments or disclosure references) before any block's `decorate()` runs.
4. **Check for an existing block** in the repo and in the Adobe Block Collection before creating a new one.

## Block shape

- **Three-file rule.** A block is `blocks/{name}/{name}.js`, `blocks/{name}/{name}.css` and an optional mock `blocks/{name}/{name}.json`. Don't add helper modules, sub-folders or build artifacts to a block folder; shared code goes in `/scripts/`. If the repo already keeps extra docs in block folders (`README.md`, `metadata.json`), follow the repo.
- **Vanilla only.** Blocks are vanilla ECMAScript modules using standard DOM APIs. No React, Vue, Angular or other framework runtimes in the main content stream, and no build step.
- **Decorate, don't replace.** The authored semantic HTML is the single source of truth. Restructure and enhance the existing elements (move nodes, add classes, ARIA and wrappers); don't throw them away and rebuild from strings. Keep authored text, links, headings, `alt` text and order.
- **Decorate defensively.** Authors omit and add rows and cells. Handle missing images, empty cells and extra rows without throwing.
- **Export one default `decorate(block)`** that the loader imports and calls. Don't run work at module top level.

## Code quality

- ESLint with `eslint-config-airbnb-base` plus EDS rules:
  - No global namespace pollution. Don't assign to `window.*` except the agreed shared queues (such as `window.adobeDataLayer`).
  - No unused variables.
  - Explicit `.js` extensions on every ESM import: `import { loadCSS } from '../../scripts/aem.js';`
- Stylelint: every block selector is scoped to the block. No bare tag selectors (`p`, `a`, `h2`) at the top level of a block stylesheet.
- Run `npm run lint` (and the repo's tests) before calling the block done, and fix every warning.

## Accessibility: WCAG 2.2 AA

- Text contrast at least **4.5:1**, large text at least **3:1**. Check every color pair, including hover, focus and dark-theme states.
- Every interactive element has explicit **`:focus-visible`** styling. Never remove the outline without replacing it.
- Decorative images get `alt=""`. Semantic images keep the author's alt text; don't overwrite or invent it.
- Use real elements (`button`, `a`, `details`, headings in order) before ARIA. Every JS-driven control is keyboard-operable and exposes its state (`aria-expanded`, `aria-selected`, `aria-current`).
- Sizes in `rem` so text zoom and reflow work (details in `eds-design-standards`).

## Performance budget

- Lighthouse **95 minimum on mobile and desktop** for every PR; a mobile performance score below 95 blocks the PR. Aim for 100.
- Targets for a 100 score, as given by the standard: TBT 0 ms, INP under 200 ms, FCP under 934 ms, LCP under 500 ms (under 1,200 ms on mobile), CLS under 0.02.
- Test on the branch preview URL. Phase and lazy-loading rules are in `eds-performance`.

## Analytics, consent and third parties

- **Never delay rendering or drop events for consent.** Push analytics events into the in-memory queue and let the delayed phase send them:

  ```js
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({ event: 'cta-click', component: 'hero', label: link.textContent.trim() });
  ```

- Consent platforms (OneTrust, Cookiebot) may start in `<head>` or `loadEager()` when strict GDPR/CCPA compliance requires it. Their state may gate features, but not page rendering.
- **No beacons, marketing tags or below-the-fold blocks in the eager phase.**
- In `loadDelayed()` (about 3 s after load, or on idle): initialize the AEP Web SDK (`alloy.js`), flush the queued data layer to CJA, load marketing pixels (Google, Meta, LinkedIn) via `requestIdleCallback()`, and start feedback or chat widgets.
- Blocks only push events. They never load analytics or pixel scripts themselves.

## Authoring tools and plugins

- Custom authoring tools (DA Library plugins, Sidekick sidebar apps) run sandboxed. They read and write the open document through the official SDK or plugin API (for DA, `daFetch` and `sendHTML`), inserting block tables, metadata rows or fragments. Keep the author's normal save/undo flow.
- Privileged operations (approval gates, cache purges, inventory sync) go through Adobe I/O Runtime (App Builder) actions, never straight from the browser:
  1. Send the author's IMS token as `Authorization: Bearer <token>`.
  2. The action rejects requests without a valid bearer token (`401`).
  3. Shared state (locks, cached backend tokens, rate limits) lives in `@adobe/aio-lib-state` with a TTL. Return `423` when a lock is held.
- Never write tokens to files, logs or browser storage.

## Architecture context

- Delivery runs through a CDN edge worker with three routes: static marketing paths served from the EDS cache; `/app/*` and `/api/*` reverse-proxied to dynamic apps on the same domain; and `/portal/*` closed user groups, whose JWT cookie is verified at the edge with a redirect to the IdP when invalid. Blocks must not assume cookies or APIs from another domain, and must not put auth logic in the browser.
- Use Adobe's official tools before custom ones: the AEM AI coding-agent skills for block generation, refactoring and review, and the Experience Workspace MCPs for reading DA documents, sheets and block catalogs.

## Verification before a PR

1. Lint passes with no warnings.
2. Every Gherkin scenario passes on the local server and on the `{branch}--{repo}--{owner}.aem.page` preview.
3. Playwright journeys (or a manual equivalent) check DOM structure, the accessibility tree and keyboard navigation. Compare visuals with the legacy page or an agreed baseline.
4. Lighthouse mobile and desktop are at least 95.
5. The PR links the branch preview URL for every changed page.

Don't commit, push, preview or publish without the user's explicit approval.
