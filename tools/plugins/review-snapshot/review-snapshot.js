/* eslint-disable import/no-unresolved */
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// Diagnostic plugin: add the current page to an AEM review snapshot using only
// the DA SDK, and log every admin API call so failures are visible.

const ADMIN = 'https://admin.hlx.page';
const REF = 'main';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

let daFetch = null;
let org = '';
let site = '';
let pagePath = '';
// Manifest of the selected snapshot, so actions can check its lock and review state.
let currentManifest = null;

const $ = (id) => document.getElementById(id);
const selectEl = $('snapshot-select');
const nameInput = $('new-name');
const btnRefresh = $('btn-refresh');
const btnCreate = $('btn-create');
const btnAdd = $('btn-add');
const btnPreview = $('btn-preview');
const btnReject = $('btn-reject');
const btnApprove = $('btn-approve');
const lockStateEl = $('lock-state');
const reviewActionsEl = $('review-actions');
const statusEl = $('status');
const resourcesEl = $('resources');
const logEl = $('log');

const snapshotUrl = (...parts) => [`${ADMIN}/snapshot/${org}/${site}/${REF}`, ...parts].join('/');
const reviewUrl = (name, path) => `https://${name}--${REF}--${site}--${org}.aem.reviews${path}`;

// The snapshot API wants extensionless paths: /blog/post, not /blog/post.html or /index.
const normalizePath = (path) => {
  let p = path || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\.html$/, '');
  if (p === '/index' || p.endsWith('/index')) p = p.slice(0, -'index'.length);
  return p;
};

const setStatus = (text, type = '') => {
  statusEl.textContent = text;
  statusEl.className = `status${type ? ` ${type}` : ''}`;
};

const log = (method, url, result) => {
  const li = document.createElement('li');
  li.className = result.ok ? 'ok' : 'error';
  li.textContent = `${method} ${url.replace(ADMIN, '')} → ${result.status} (${result.ms}ms)`;
  if (result.detail) {
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = result.detail;
    li.append(detail);
  }
  logEl.prepend(li);
};

// Wraps the SDK's daFetch so every call is logged with status and x-error.
// A thrown TypeError here usually means the browser blocked the request (CORS).
const api = async (url, { method = 'GET', body, quiet = false } = {}) => {
  const opts = { method };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  const start = performance.now();
  let resp;
  try {
    resp = await daFetch(url, opts);
  } catch (err) {
    const result = {
      ok: false, status: 'network error', ms: Math.round(performance.now() - start), detail: err.message,
    };
    if (!quiet || !result.ok) log(method, url, result);
    return result;
  }
  const result = { ok: resp.ok, status: resp.status, ms: Math.round(performance.now() - start) };
  if (!resp.ok) {
    result.detail = resp.headers.get('x-error') || resp.statusText || (resp.status === 500 ? 'blocked or failed (check console for CORS)' : '');
  }
  const type = resp.headers.get('content-type') || '';
  if (type.includes('json')) {
    try { result.json = await resp.json(); } catch { /* empty body */ }
  }
  if (!quiet || !result.ok) log(method, url, result);
  return result;
};

const describeError = (result) => {
  if (result.status === 401 || result.status === 403) return `Not allowed (${result.status}). ${result.detail || ''}`;
  return `Failed (${result.status}). ${result.detail || ''}`;
};

const pollJob = async (url) => {
  for (let i = 0; i < 40; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await api(url);
    if (!result.ok) return result;
    if (result.json?.state === 'stopped') return result;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 750); });
  }
  return { ok: false, status: 'timeout', detail: 'Job did not finish in 30s' };
};

const renderResources = (name, resources) => {
  resourcesEl.textContent = '';
  if (!resources?.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No pages in this snapshot yet.';
    resourcesEl.append(li);
    return;
  }
  resources.forEach(({ path }) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = path;
    const link = document.createElement('a');
    link.href = reviewUrl(name, path);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Review ↗';
    li.append(label, link);
    resourcesEl.append(li);
  });
};

const fetchManifest = async (name, opts) => {
  const result = await api(snapshotUrl(name), opts);
  return { result, manifest: result.ok ? result.json?.manifest : null };
};

// A locked snapshot (review requested) silently ignores new paths: the add call
// still returns 200. So the UI blocks adding and offers reject/approve instead.
const renderLockState = (manifest) => {
  const locked = Boolean(manifest?.locked);
  selectEl.classList.toggle('locked', locked);
  const option = selectEl.selectedOptions[0];
  if (manifest && option?.value) option.text = locked ? `🔒 ${option.value} (locked)` : option.value;
  btnAdd.disabled = !manifest || locked;
  btnAdd.title = locked ? 'This snapshot is locked for review. Reject & unlock it to add pages.' : '';
  reviewActionsEl.hidden = !locked;
  lockStateEl.hidden = !locked;
  if (!locked) return;
  const requested = manifest.review === 'requested';
  lockStateEl.textContent = requested
    ? '🔒 Locked for review. Pages can\'t be added until it is rejected and unlocked.'
    : '🔒 Locked. Pages can\'t be added until it is unlocked.';
  btnApprove.disabled = !requested;
  btnApprove.title = requested ? '' : 'Request review in the Snapshots app before approving.';
};

const loadManifest = async () => {
  const name = selectEl.value;
  currentManifest = null;
  if (!name) {
    renderLockState(null);
    renderResources('', []);
    return;
  }
  const { result, manifest } = await fetchManifest(name);
  if (!result.ok) {
    renderLockState(null);
    setStatus(describeError(result), 'error');
    return;
  }
  currentManifest = manifest;
  renderLockState(manifest);
  renderResources(name, manifest?.resources);
};

const loadSnapshots = async (selected) => {
  selectEl.disabled = true;
  const result = await api(snapshotUrl());
  selectEl.textContent = '';
  if (!result.ok) {
    selectEl.append(new Option('Could not load snapshots', ''));
    setStatus(describeError(result), 'error');
    return;
  }
  const names = result.json?.snapshots || [];
  // The list only has names, so read each manifest to mark locked snapshots.
  const manifests = await Promise.all(names.map((name) => fetchManifest(name, { quiet: true })));
  selectEl.append(new Option(names.length ? 'Choose a snapshot…' : 'No snapshots yet', ''));
  names.forEach((name, i) => {
    const locked = manifests[i].manifest?.locked;
    selectEl.append(new Option(locked ? `🔒 ${name} (locked)` : name, name));
  });
  if (selected && names.includes(selected)) selectEl.value = selected;
  selectEl.disabled = false;
  await loadManifest();
};

const loadPreviewStatus = async () => {
  const result = await api(`${ADMIN}/status/${org}/${site}/${REF}${pagePath}`);
  if (!result.ok) {
    $('ctx-preview').textContent = describeError(result);
    return;
  }
  const preview = result.json?.preview;
  const previewed = preview?.status === 200;
  $('ctx-preview').textContent = previewed
    ? `Yes, ${new Date(preview.lastModified).toLocaleString()}`
    : 'Not previewed: snapshots capture the preview, so preview first';
  btnPreview.disabled = false;
};

btnPreview.addEventListener('click', async () => {
  btnPreview.disabled = true;
  const result = await api(`${ADMIN}/preview/${org}/${site}/${REF}${pagePath}`, { method: 'POST' });
  setStatus(result.ok ? 'Page previewed.' : describeError(result), result.ok ? 'ok' : 'error');
  await loadPreviewStatus();
});

btnRefresh.addEventListener('click', () => loadSnapshots(selectEl.value));

btnCreate.addEventListener('click', async () => {
  const name = nameInput.value.trim().toLowerCase();
  if (!NAME_PATTERN.test(name)) {
    setStatus('Use lowercase letters, numbers and hyphens, e.g. "spring-launch".', 'error');
    return;
  }
  btnCreate.disabled = true;
  const result = await api(snapshotUrl(name), { method: 'POST' });
  btnCreate.disabled = false;
  if (!result.ok) {
    setStatus(describeError(result), 'error');
    return;
  }
  nameInput.value = '';
  setStatus(`Created "${name}".`, 'ok');
  await loadSnapshots(name);
});

btnAdd.addEventListener('click', async () => {
  const name = selectEl.value;
  if (!name) return;
  btnAdd.disabled = true;
  // Re-check right before adding: someone may have requested review since we loaded it.
  const { result: check, manifest: fresh } = await fetchManifest(name);
  if (!check.ok) {
    btnAdd.disabled = false;
    setStatus(describeError(check), 'error');
    return;
  }
  if (fresh?.locked) {
    currentManifest = fresh;
    renderLockState(fresh);
    setStatus(`"${name}" is locked for review, so ${pagePath} was not added.`, 'error');
    return;
  }
  setStatus(`Adding ${pagePath} to "${name}"…`);
  const result = await api(snapshotUrl(name, '*'), { method: 'POST', body: { paths: [pagePath] } });
  let final = result;
  if (result.ok && result.status === 202 && result.json?.links?.self) {
    final = await pollJob(result.json.links.self);
  }
  btnAdd.disabled = false;
  if (!final.ok) {
    setStatus(describeError(final), 'error');
    return;
  }
  await loadManifest();
  // A 200 doesn't prove the page went in, so confirm it's in the manifest.
  const added = currentManifest?.resources?.some((r) => r.path === pagePath);
  if (added) {
    setStatus(`Added. Review link: ${reviewUrl(name, pagePath)}`, 'ok');
  } else {
    setStatus(`The API accepted the request but ${pagePath} is not in "${name}". Is it locked or not previewed?`, 'error');
  }
});

const setReview = (name, state) => api(`${snapshotUrl(name)}?review=${state}&keepResources=true`, { method: 'POST' });

btnReject.addEventListener('click', async () => {
  const name = selectEl.value;
  if (!name || !currentManifest) return;
  btnReject.disabled = true;
  let result;
  if (currentManifest.review === 'requested') {
    result = await setReview(name, 'reject');
  } else {
    // Locked without a review request: unlock by saving the manifest, as the Snapshots app does.
    const { title, description, metadata } = currentManifest;
    result = await api(snapshotUrl(name), {
      method: 'POST',
      body: {
        title, description, metadata, locked: false,
      },
    });
  }
  btnReject.disabled = false;
  setStatus(result.ok ? `"${name}" is unlocked. You can add pages again.` : describeError(result), result.ok ? 'ok' : 'error');
  await loadSnapshots(name);
});

// Publishing overwrites live content, so it takes a second click within 5 seconds.
let approveTimer = null;
const resetApprove = () => {
  clearTimeout(approveTimer);
  approveTimer = null;
  btnApprove.classList.remove('confirming');
  btnApprove.textContent = 'Approve & publish';
};

btnApprove.addEventListener('click', async () => {
  const name = selectEl.value;
  if (!name) return;
  if (!approveTimer) {
    btnApprove.classList.add('confirming');
    btnApprove.textContent = 'Click again to publish live';
    approveTimer = setTimeout(resetApprove, 5000);
    return;
  }
  resetApprove();
  btnApprove.disabled = true;
  setStatus(`Publishing "${name}"…`);
  const result = await setReview(name, 'approve');
  setStatus(result.ok ? `"${name}" approved and published.` : describeError(result), result.ok ? 'ok' : 'error');
  await loadSnapshots(name);
});

selectEl.addEventListener('change', () => {
  resetApprove();
  setStatus('');
  loadManifest();
});

(async () => {
  const { context, token, actions } = await DA_SDK;
  daFetch = actions.daFetch;
  org = context.org;
  site = context.repo;
  pagePath = normalizePath(context.path);

  $('ctx-site').textContent = `${org}/${site}`;
  $('ctx-path').textContent = `${context.path} → ${pagePath}`;
  $('ctx-token').textContent = token ? 'Yes (token received from editor)' : 'No token from editor: admin calls will fail';
  // eslint-disable-next-line no-console
  console.log('[review-snapshot] context:', context, 'token:', Boolean(token));

  btnRefresh.disabled = false;
  btnCreate.disabled = false;
  await Promise.all([loadPreviewStatus(), loadSnapshots()]);
})();
