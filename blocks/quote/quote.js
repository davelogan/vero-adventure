/*
 * Quote block
 *
 * | Quote                       |
 * | The quotation text          |
 * | Attribution (optional)      |
 */

export default function decorate(block) {
  const [quoteRow, attributionRow] = block.children;
  const figure = document.createElement('figure');

  const blockquote = document.createElement('blockquote');
  const quoteCell = quoteRow?.querySelector(':scope > div');
  if (quoteCell) blockquote.append(...quoteCell.childNodes);
  figure.append(blockquote);

  const attributionCell = attributionRow?.querySelector(':scope > div');
  if (attributionCell && attributionCell.textContent.trim()) {
    const caption = document.createElement('figcaption');
    caption.append(...attributionCell.childNodes);
    figure.append(caption);
  }

  block.replaceChildren(figure);
}
