/*
 * Table block
 *
 * | Table      |            |            |
 * | Header 1   | Header 2   | Header 3   |
 * | Cell       | Cell       | Cell       |
 *
 * Variants: (striped), (bordered), (no header)
 */

export default function decorate(block) {
  const table = document.createElement('table');
  const noHeader = block.classList.contains('no-header');
  const rows = [...block.children];

  if (!noHeader && rows.length) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    [...rows.shift().children].forEach((cell) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.append(...cell.childNodes);
      tr.append(th);
    });
    thead.append(tr);
    table.append(thead);
  }

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    [...row.children].forEach((cell) => {
      const td = document.createElement('td');
      td.append(...cell.childNodes);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);

  // wrapper lets wide tables scroll on mobile
  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  scroller.tabIndex = 0;
  scroller.append(table);
  block.replaceChildren(scroller);
}
