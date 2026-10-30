/*
 * Video block — self-hosted .mp4 / .webm
 *
 * | Video                          |
 * | Poster image (optional)        |
 * | https://.../clip.mp4           |
 *
 * Variant: "Video (autoplay)" plays muted + looped with no controls
 * (background-style); respects prefers-reduced-motion.
 */

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;
  const poster = block.querySelector('img');
  const autoplay = block.classList.contains('autoplay')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const video = document.createElement('video');
  video.preload = 'none';
  video.playsInline = true;
  if (poster) video.poster = poster.src;
  if (autoplay) {
    video.muted = true;
    video.loop = true;
    video.setAttribute('aria-hidden', 'true');
  } else {
    video.controls = true;
  }

  const source = document.createElement('source');
  source.src = link.href;
  source.type = link.href.endsWith('.webm') ? 'video/webm' : 'video/mp4';
  video.append(source);
  block.replaceChildren(video);

  if (autoplay) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    });
    observer.observe(block);
  }
}
