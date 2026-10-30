/*
 * Model Viewer block — interactive 3D (.glb / .gltf)
 *
 * | Model Viewer                       |
 * | https://.../model.glb              |
 * | Alt text describing the model      |  (optional)
 * | Poster image                       |  (optional, shown until the model loads)
 *
 * Variants: (auto rotate), (ar) — AR button on supported phones.
 *
 * Uses Google's <model-viewer> web component, vendored in /scripts/vendor/
 * and only downloaded when the block scrolls near the viewport.
 */

import { loadScript } from '../../scripts/aem.js';

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;

  const img = block.querySelector('img');
  const altText = [...block.querySelectorAll(':scope > div > div')]
    .map((cell) => cell.textContent.trim())
    .find((text) => text && text !== link.textContent.trim());

  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('src', link.href);
  viewer.setAttribute('alt', altText || '3D model');
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('touch-action', 'pan-y');
  viewer.setAttribute('shadow-intensity', '1');
  viewer.setAttribute('loading', 'lazy');
  if (img) viewer.setAttribute('poster', img.src);
  if (block.classList.contains('auto-rotate')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    viewer.setAttribute('auto-rotate', '');
  }
  if (block.classList.contains('ar')) {
    viewer.setAttribute('ar', '');
    viewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  }

  block.replaceChildren(viewer);

  // ~900KB library: only fetch it when the block is about to be seen
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    loadScript(`${window.hlx.codeBasePath}/scripts/vendor/model-viewer.min.js`, { type: 'module' });
  }, { rootMargin: '200px' });
  observer.observe(block);
}
