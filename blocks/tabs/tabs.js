/*
 * Tabs block
 *
 * | Tabs        |                  |
 * | Tab label   | Panel content    |
 * | Tab label   | Panel content    |
 */

let tabsCount = 0;

export default function decorate(block) {
  tabsCount += 1;
  const id = `tabs-${tabsCount}`;
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const rows = [...block.children].filter((row) => row.children.length);
  const tabs = [];
  const panels = [];

  rows.forEach((row, i) => {
    const [labelCell, panelCell] = row.children;

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.id = `${id}-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `${id}-tab-${i}`);
    panel.tabIndex = 0;
    if (panelCell) panel.append(...panelCell.childNodes);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tabs-tab';
    tab.id = `${id}-tab-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.textContent = labelCell ? labelCell.textContent.trim() : `Tab ${i + 1}`;

    tabs.push(tab);
    panels.push(panel);
    tablist.append(tab);
    row.remove();
  });

  const select = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      const last = tabs.length - 1;
      const next = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(next, true);
    });
  });

  block.replaceChildren(tablist, ...panels);
  if (tabs.length) select(0);
}
