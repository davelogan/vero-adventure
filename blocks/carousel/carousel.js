/*
 * Carousel block
 *
 * | Carousel   |                                  |
 * | Image      | Heading, text, CTA (optional)    |
 * | Image      | Heading, text, CTA (optional)    |
 *
 * Variant: "Carousel (auto)" advances every 6s; pauses on hover/focus
 * and is disabled when the user prefers reduced motion.
 */

import { createOptimizedPicture } from '../../scripts/aem.js';

let carouselCount = 0;

export default function decorate(block) {
  carouselCount += 1;
  const id = `carousel-${carouselCount}`;
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');

  const track = document.createElement('ul');
  track.className = 'carousel-slides';
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  const rows = [...block.children].filter((row) => row.children.length);
  rows.forEach((row, i) => {
    const slide = document.createElement('li');
    slide.className = 'carousel-slide';
    slide.id = `${id}-slide-${i}`;
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${rows.length}`);

    [...row.children].forEach((cell) => {
      const pic = cell.querySelector('picture');
      if (pic && cell.textContent.trim() === '') {
        cell.className = 'carousel-slide-image';
        const img = pic.querySelector('img');
        pic.replaceWith(createOptimizedPicture(img.src, img.alt, i === 0, [{ width: '1200' }]));
      } else {
        cell.className = 'carousel-slide-content';
      }
      slide.append(cell);
    });
    track.append(slide);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show slide ${i + 1}`);
    dot.setAttribute('aria-controls', slide.id);
    dots.append(dot);
    row.remove();
  });

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'carousel-nav carousel-prev';
  prev.setAttribute('aria-label', 'Previous slide');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-nav carousel-next';
  next.setAttribute('aria-label', 'Next slide');

  block.replaceChildren(track);
  if (rows.length > 1) block.append(prev, next, dots);

  let current = 0;
  const show = (index) => {
    const count = track.children.length;
    current = (index + count) % count;
    track.scrollTo({ left: track.children[current].offsetLeft, behavior: 'smooth' });
  };

  // keep dots in sync with swipe/scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      current = [...track.children].indexOf(entry.target);
      [...dots.children].forEach((d, i) => d.setAttribute('aria-current', i === current));
    });
  }, { root: track, threshold: 0.6 });
  [...track.children].forEach((slide) => observer.observe(slide));

  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  [...dots.children].forEach((dot, i) => dot.addEventListener('click', () => show(i)));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (block.classList.contains('auto') && rows.length > 1 && !reduceMotion) {
    let timer;
    const start = () => { timer = setInterval(() => show(current + 1), 6000); };
    const stop = () => clearInterval(timer);
    ['mouseenter', 'focusin'].forEach((ev) => block.addEventListener(ev, stop));
    ['mouseleave', 'focusout'].forEach((ev) => block.addEventListener(ev, start));
    start();
  }
}
