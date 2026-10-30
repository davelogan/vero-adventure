/*
 * Modal
 *
 * Not authored as a table. Any link to a page under /modals/ opens that
 * page in a dialog instead of navigating (wired up in scripts/scripts.js).
 * Author the modal content as a normal page, e.g. /modals/newsletter.
 */

import { loadFragment } from '../fragment/fragment.js';
import { loadCSS } from '../../scripts/aem.js';

export async function openModal(fragmentUrl) {
  const path = fragmentUrl.startsWith('http')
    ? new URL(fragmentUrl, window.location).pathname
    : fragmentUrl;
  await loadCSS(`${window.hlx.codeBasePath}/blocks/modal/modal.css`);
  const fragment = await loadFragment(path);
  if (!fragment) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.append(...fragment.childNodes);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());

  dialog.append(close, content);
  // click on the backdrop closes
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    dialog.remove();
  });

  document.body.append(dialog);
  document.body.classList.add('modal-open');
  dialog.showModal();
}

export default function decorate(block) {
  // Not used as a table block; kept so an authored "Modal" table doesn't 404.
  block.remove();
}
