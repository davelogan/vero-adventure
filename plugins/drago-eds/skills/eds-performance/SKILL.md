---
name: eds-performance
description: Performance standards for AEM Edge Delivery Services: LCP-first loading phases, never blocking the main thread, lazy-loading below the fold, split deferral. Use when writing, reviewing or debugging EDS scripts, blocks or third-party loading.
---

# EDS Performance Standards

Apply these rules whenever you write, review or debug JavaScript, block loading, media or third-party integrations in an AEM Edge Delivery Services project. Goal: Lighthouse 100 and good field Core Web Vitals (LCP, INP, CLS). For CSS, tokens and motion rules, also follow the `eds-design-standards` skill.

## Before you change anything

1. Read `scripts/scripts.js` (`loadEager`, `loadLazy`, `loadDelayed`, `loadPage`) and know which phase your code will run in.
2. Treat `scripts/aem.js` as vendored. Don't edit it to fix performance.
3. Read the repo's `AGENTS.md` and lint/guardrail docs. Stricter repo rules win.

## 1. LCP first: respect the EDS loading phases

EDS deliberately loads the **LCP element first**, usually the hero image or video, **before the header/nav**. That's unusual (most stacks load top-down, nav first), and it's intentional. Don't "fix" it.

| Phase | What belongs here | What must not be here |
|---|---|---|
| **Eager** (`loadEager`) | Decorate `main`, load the **first section only**, wait for the LCP image. Minimal CSS (`styles.css`). | Header, footer, fonts on slow connections, any third-party, any block below the first section |
| **Lazy** (`loadLazy`) | Header/nav, remaining sections and blocks, footer, `lazy-styles.css`, fonts | Analytics, tag managers, chat, consent banners' heavy UI, anything not needed to render the page |
| **Delayed** (`loadDelayed` / `delayed.js`) | Martech, tag managers, analytics, chat widgets, A/B tooling, demo/dev tools | Anything that affects layout or first render |

Rules:

- **One LCP candidate, loaded eager.** The first image in the first section gets `loading="eager"` (and `fetchpriority="high"` if the repo uses it). Never lazy-load it, never put it behind JS that runs later, never swap it after load.
- **Keep the first section light.** Don't put heavy blocks (carousels, tabs, market data, forms) in the first section. If the design needs one, render a static first frame and enhance it later.
- **Don't move header/footer into eager** to "fix" a visual pop-in. Reserve their space with CSS (`min-height`) instead.
- **Delayed means delayed.** The boilerplate waits about 3 seconds after load before `delayed.js`. If a repo calls `loadDelayed()` immediately, check that nothing heavy runs there, and flag it.
- **Prevent CLS.** Reserve space for anything that loads later (header height, images with width/height or `aspect-ratio`, embeds, ads, consent banners).

## 2. Lazy-load everything below the fold

"Everything" means everything:

- Images and media: `loading="lazy"` via `createOptimizedPicture` for everything except the LCP image.
- Video and iframes/embeds: render a lightweight poster/facade, then load the real player on intersection or interaction.
- Blocks: EDS loads block JS/CSS per section. Don't import a block's heavy dependencies at module top level; `import()` them when the block is visible or used.
- Fonts: follow the repo's font loading (fallback font with metric overrides in eager, real fonts in lazy).
- Data: fetch JSON (rates, market data, FAQs) when the consuming block is near the viewport, not on page load.
- Use `IntersectionObserver` with a `rootMargin` (e.g. `'200px'`) to start loading slightly before the content scrolls in.

## 3. Never block the main thread

The main thread handles input. Long tasks (over 50 ms) hurt INP and TBT.

- **Yield in long work.** Break loops over many elements or data rows into chunks and yield between them:

  ```js
  const yieldToMain = () => (globalThis.scheduler?.yield
    ? globalThis.scheduler.yield()
    : new Promise((resolve) => { setTimeout(resolve, 0); }));

  for (const [i, item] of items.entries()) {
    render(item);
    if (i % 20 === 19) await yieldToMain();
  }
  ```

- **Respond to input first, work later.** In event handlers, update the visible state (class toggle, `aria-expanded`) immediately, then yield before analytics, storage writes or re-renders.
- **Move heavy computation off the main thread:**
  - **Web Workers** for parsing, sorting, filtering or calculating large data client-side.
  - **Edge workers / edge functions** (CDN workers, AEM Edge Functions) for request shaping, personalization, API proxying and response transforms, so the browser gets ready-to-use data.
  - **Serverless** (e.g. Adobe I/O Runtime) for business logic and aggregation. Don't ship raw APIs to the browser and process them there.
- **Avoid layout thrashing.** Don't interleave DOM reads (`offsetHeight`, `getBoundingClientRect`) and writes in loops. Batch reads, then writes. Prefer observers (`ResizeObserver`, `IntersectionObserver`) over `scroll`/`resize` listeners.
- **No synchronous third-party scripts** in `head.html`. No `document.write`. Nothing parser-blocking.

## 4. Defer, and split the deferral

Don't move everything into one big deferred chunk; that just moves the long task later.

- **Split by phase.** Decide per feature whether it's eager, lazy or delayed (table above), and load each in its own phase.
- **Split by feature.** Use dynamic `import()` per feature/integration (consent, analytics, chat, each widget) rather than one `delayed.js` that imports everything at once.
- **Split by trigger.** Load on intent where possible: on interaction (click, focus, hover), on visibility, or on idle (`requestIdleCallback` with a timeout fallback).
- **Stagger third parties.** Don't start all tags in the same tick. Let consent decide what loads, and load consented tags one by one, yielding between them.
- **No unused code.** Gate demo, debug and dev tooling by host or flag so production visitors never download it.

## Reviewing code against these standards

Report findings with file:line, the rule broken, the user impact (LCP / INP / CLS / TBT) and the concrete fix. Check:

1. Anything other than the first section and LCP media loading in the eager phase
2. LCP image lazy-loaded, swapped, or rendered by late JS
3. Heavy blocks or carousels in the first section
4. Header/footer forced into eager, or missing reserved space (CLS)
5. Below-the-fold images, iframes, video or data loaded without lazy/visibility triggers
6. Top-level imports of heavy dependencies inside blocks
7. Loops or handlers that can run longer than 50 ms without yielding
8. Client-side processing that belongs in a Web Worker, edge function or serverless function
9. Layout thrashing, `scroll`/`resize` listeners where an observer would do
10. Synchronous or parser-blocking scripts in `head.html`; third parties outside the delayed phase
11. One monolithic deferred bundle instead of split, triggered imports
12. Dev/demo code reachable on production hosts

Verify changes with Lighthouse (mobile) on the branch preview URL (`https://{branch}--{repo}--{owner}.aem.page/`). Also check Chrome DevTools Performance for long tasks, and the LCP element.
