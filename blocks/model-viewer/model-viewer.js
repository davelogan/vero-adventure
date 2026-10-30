/*
 * Model Viewer block — interactive 3D (.glb / .gltf)
 *
 * | Model Viewer                       |
 * | https://.../model.glb              |
 * | Alt text describing the model      |  (optional)
 * | Poster image                       |  (optional, recommended)
 *
 * Variants: (auto rotate), (ar) — AR button on supported phones.
 *
 * Click-to-load: the page only shows the poster and a "View in 3D" button.
 * The ~900KB <model-viewer> library (vendored in /scripts/vendor/) and the
 * model file are downloaded only when the visitor asks for them, so the
 * block costs almost nothing for page speed.
 */

import { loadScript } from '../../scripts/aem.js';

function buildViewer(block, src, alt) {
  const viewer = document.createElement('model-viewer');
  viewer.setAttribute('src', src);
  viewer.setAttribute('alt', alt);
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('touch-action', 'pan-y');
  viewer.setAttribute('shadow-intensity', '1');
  if (block.classList.contains('auto-rotate')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    viewer.setAttribute('auto-rotate', '');
  }
  if (block.classList.contains('ar')) {
    viewer.setAttribute('ar', '');
    viewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  }
  return viewer;
}

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;

  const src = link.href;
  const picture = block.querySelector('picture');
  const alt = [...block.querySelectorAll(':scope > div > div')]
    .map((cell) => cell.textContent.trim())
    .find((text) => text && text !== link.textContent.trim()) || '3D model';

  const stage = document.createElement('div');
  stage.className = 'model-viewer-stage';
  if (picture) {
    picture.querySelector('img')?.setAttribute('alt', alt);
    stage.append(picture);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'model-viewer-launch';
  button.textContent = 'View in 3D';
  button.setAttribute('aria-label', `View in 3D: ${alt}`);
  stage.append(button);

  block.replaceChildren(stage);

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Loading…';
    try {
      await loadScript(`${window.hlx.codeBasePath}/scripts/vendor/model-viewer.min.js`, { type: 'module' });
      await customElements.whenDefined('model-viewer');
      const viewer = buildViewer(block, src, alt);
      stage.replaceChildren(viewer);
      viewer.focus();
    } catch (e) {
      button.disabled = false;
      button.textContent = 'View in 3D';
    }
  });
}
