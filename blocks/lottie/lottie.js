/*
 * Lottie block — vector animations exported from After Effects / LottieFiles
 *
 * | Lottie                            |
 * | https://.../animation.json        |
 * | Alt text (optional)               |
 *
 * Default: plays once when scrolled into view.
 * Variants: (loop) repeats, (hover) plays while hovered/focused,
 * (wide) 16:9 box instead of the default square. The box size is fixed
 * up front so nothing shifts when the animation loads (CLS).
 * Users who prefer reduced motion see a still final frame.
 */

import { loadScript } from '../../scripts/aem.js';

async function startAnimation(block, container, src) {
  await loadScript(`${window.hlx.codeBasePath}/scripts/vendor/lottie_light.min.js`);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = block.classList.contains('hover');
  const loop = block.classList.contains('loop') || hover;

  const anim = window.lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop,
    autoplay: false,
    path: src,
  });

  anim.addEventListener('DOMLoaded', () => {
    block.classList.add('lottie-loaded');
    if (reduceMotion) {
      anim.goToAndStop(anim.totalFrames - 1, true);
      return;
    }
    if (hover) {
      ['mouseenter', 'focusin'].forEach((ev) => block.addEventListener(ev, () => anim.play()));
      ['mouseleave', 'focusout'].forEach((ev) => block.addEventListener(ev, () => anim.pause()));
      return;
    }
    // play while visible, pause when scrolled away (saves CPU/battery)
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? anim.play() : anim.pause()));
    }).observe(block);
  });
}

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;
  const altText = [...block.querySelectorAll(':scope > div > div')]
    .map((cell) => cell.textContent.trim())
    .find((text) => text && text !== link.textContent.trim());

  const container = document.createElement('div');
  container.className = 'lottie-player';
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', altText || 'Animation');
  if (block.classList.contains('hover')) container.tabIndex = 0;
  block.replaceChildren(container);

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    startAnimation(block, container, link.href);
  }, { rootMargin: '200px' });
  observer.observe(block);
}
