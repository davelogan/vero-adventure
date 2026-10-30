/*
 * Embed block — YouTube, Vimeo, or any https iframe-able URL
 *
 * | Embed                          |
 * | Poster image (optional)        |
 * | https://youtu.be/xxxx          |
 *
 * The iframe is only created when the block scrolls into view,
 * or when the poster is clicked, so embeds never hurt LCP.
 */

function embedUrl(url, autoplay) {
  const { hostname, pathname, searchParams } = url;
  if (hostname.includes('youtu')) {
    const vid = hostname.includes('youtu.be') ? pathname.slice(1) : searchParams.get('v') || pathname.split('/').pop();
    return { src: `https://www.youtube-nocookie.com/embed/${vid}?rel=0${autoplay ? '&autoplay=1' : ''}`, type: 'youtube' };
  }
  if (hostname.includes('vimeo')) {
    const vid = pathname.split('/').filter(Boolean).pop();
    return { src: `https://player.vimeo.com/video/${vid}${autoplay ? '?autoplay=1' : ''}`, type: 'vimeo' };
  }
  return { src: url.href, type: 'generic' };
}

function loadIframe(block, url, autoplay) {
  if (block.classList.contains('embed-loaded')) return;
  const { src, type } = embedUrl(url, autoplay);
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = `Embedded ${type === 'generic' ? 'content' : `${type} video`}`;
  iframe.loading = 'lazy';
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.allowFullscreen = true;
  const frame = document.createElement('div');
  frame.className = `embed-frame embed-${type}`;
  frame.append(iframe);
  block.replaceChildren(frame);
  block.classList.add('embed-loaded');
}

export default function decorate(block) {
  const link = block.querySelector('a[href]');
  if (!link) return;
  const url = new URL(link.href);
  const picture = block.querySelector('picture');

  if (picture) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'embed-poster';
    button.setAttribute('aria-label', 'Play video');
    button.append(picture);
    block.replaceChildren(button);
    button.addEventListener('click', () => loadIframe(block, url, true));
    return;
  }

  block.replaceChildren();
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      loadIframe(block, url, false);
    }
  });
  observer.observe(block);
}
