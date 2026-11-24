'use strict';

const pages = window.ESTRATUM_ISSUE;
const get = (id) => document.getElementById(id);
const compact = window.matchMedia('(max-width: 700px)');
const reader = get('reader');
const stage = get('stage');
const spread = get('spread');
const sidebar = get('sidebar');
const pageInput = get('pageNum');
const pageRatio = 612 / 792;
let page = 1;
let two = !compact.matches;
let zoom = 1;
let toastTimer;
let touchStart;

const pageHash = (number) => '#revista/pagina/' + number;
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function showToast(message) {
  const toast = get('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3300);
}

function visiblePages() {
  if (!two || page === 1 || (page === pages.length && page % 2 === 0)) return [page];
  const left = page % 2 === 0 ? page : page - 1;
  return [left, left + 1];
}

function fitSize() {
  if (reader.hidden) return;
  const count = visiblePages().length;
  const style = getComputedStyle(stage);
  const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availableWidth = Math.max(stage.clientWidth - horizontal + (stage.offsetWidth - stage.clientWidth), 1);
  const availableHeight = Math.max(stage.clientHeight - vertical, 1);
  const fitWidth = Math.min(availableWidth - 12, availableHeight * pageRatio * count);
  spread.style.width = Math.max(120, fitWidth * zoom) + 'px';
}

function makeHotspot(link) {
  const anchor = document.createElement('a');
  anchor.className = 'hotspot';
  anchor.title = link.page ? 'Ir a la página ' + link.page + ' · ' + link.label : link.label;
  anchor.setAttribute('aria-label', anchor.title);
  Object.assign(anchor.style, {
    left: link.x + '%',
    top: link.y + '%',
    width: link.w + '%',
    height: link.h + '%'
  });
  if (link.page) {
    anchor.href = pageHash(link.page);
    anchor.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(link.page);
    });
  } else {
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

function draw() {
  const currentSpread = visiblePages();
  spread.replaceChildren();
  for (const number of currentSpread) {
    const data = pages[number - 1];
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.dataset.page = number;
    const cover = 'revista/pagina-' + String(number).padStart(2, '0') + '.webp';
    const image = document.createElement('img');
    image.src = cover;
    image.alt = 'Página ' + number + ' · ' + data.title;
    image.draggable = false;
    sheet.append(image, ...data.links.map(makeHotspot));
    spread.append(sheet);
  }
  pageInput.value = page;
  get('pageTotal').textContent = currentSpread.length === 2
    ? 'Pliego ' + currentSpread.join('–') + ' de ' + pages.length
    : 'de ' + pages.length;
  for (const id of ['prev', 'first']) get(id).disabled = page === 1;
  for (const id of ['next', 'last']) get(id).disabled = currentSpread.at(-1) === pages.length;
  get('single').setAttribute('aria-pressed', String(!two));
  get('double').setAttribute('aria-pressed', String(two));
  fitSize();
  updateActiveEntries();
}

function go(number, updateHash = true) {
  page = Math.max(1, Math.min(pages.length, Math.floor(Number(number) || 1)));
  if (updateHash) history.replaceState(null, '', pageHash(page));
  draw();
  stage.scrollTo({ top: 0, left: 0 });
}

function step(direction) {
  const currentSpread = visiblePages();
  go(direction < 0 ? currentSpread[0] - 1 : currentSpread.at(-1) + 1);
}

function updateActiveEntries() {
  for (const item of get('entries').children) {
    if (Number(item.dataset.page) === page) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
}

function renderEntries() {
  const entries = get('entries');
  const query = normalize(get('query').value.trim());
  const resultCount = get('resultCount');
  const matching = document.createDocumentFragment();
  let count = 0;
  for (const [index, info] of pages.entries()) {
    const number = index + 1;
    const position = normalize(info.text).indexOf(query);
    if (query && position < 0 && !normalize(info.title).includes(query)) continue;
    count++;
    const entry = document.createElement('a');
    entry.className = 'entry';
    entry.dataset.page = number;
    entry.href = pageHash(number);
    const folio = document.createElement('b');
    folio.textContent = String(number).padStart(2, '0');
    const title = document.createElement('span');
    title.textContent = info.title;
    if (query && position >= 0) {
      const excerpt = document.createElement('small');
      excerpt.textContent = '…' + info.text.slice(Math.max(0, position - 30), position + 90) + '…';
      title.append(excerpt);
    }
    entry.append(folio, title);
    entry.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (compact.matches) setPanel(false);
      go(number);
    });
    matching.append(entry);
  }
  entries.replaceChildren(matching);
  resultCount.hidden = !query;
  resultCount.textContent = count ? count + (count === 1 ? ' página con coincidencias' : ' páginas con coincidencias') : 'Sin coincidencias';
  get('panelTitle').textContent = query ? 'Resultados de búsqueda' : 'Índice de VENUS';
  updateActiveEntries();
}

function setPanel(visible) {
  sidebar.hidden = !visible;
  get('tocBtn').setAttribute('aria-expanded', String(visible));
  fitSize();
}

function loadRoute() {
  const match = /^#revista\/pagina\/(\d+)$/.exec(location.hash);
  if (!match) {
    reader.hidden = true;
    get('catalog').hidden = false;
    document.body.classList.remove('reading');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return;
  }
  const wasHidden = reader.hidden;
  get('catalog').hidden = true;
  reader.hidden = false;
  document.body.classList.add('reading');
  if (wasHidden) setPanel(!compact.matches);
  go(Number(match[1]));
}

function setZoom(value) {
  zoom = Math.max(.5, Math.min(3, value));
  const percent = Math.round(zoom * 100);
  get('zoomRange').value = percent;
  get('zoomLabel').value = percent + '%';
  fitSize();
  if (zoom <= 1) stage.scrollTo({ top: 0, left: 0 });
}

get('tocBtn').addEventListener('click', () => setPanel(sidebar.hidden));
get('closePanel').addEventListener('click', () => setPanel(false));
get('query').addEventListener('input', renderEntries);
get('readerSearch').addEventListener('submit', (event) => {
  event.preventDefault();
  renderEntries();
});
get('clearQuery').addEventListener('click', () => {
  get('query').value = '';
  renderEntries();
  get('query').focus();
});
get('pageForm').addEventListener('submit', (event) => {
  event.preventDefault();
  go(pageInput.value);
});
pageInput.addEventListener('change', () => {
  if (pageInput.value) go(pageInput.value);
});
get('first').addEventListener('click', () => go(1));
get('last').addEventListener('click', () => go(pages.length));
get('prev').addEventListener('click', () => step(-1));
get('next').addEventListener('click', () => step(1));
get('single').addEventListener('click', () => { two = false; draw(); });
get('double').addEventListener('click', () => { two = true; draw(); });
get('zoomIn').addEventListener('click', () => setZoom(zoom + .25));
get('zoomOut').addEventListener('click', () => setZoom(zoom - .25));
get('zoomRange').addEventListener('input', (event) => setZoom(Number(event.target.value) / 100));
get('fit').addEventListener('click', () => setZoom(1));
get('showLinks').addEventListener('click', (event) => {
  const active = stage.classList.toggle('show-links');
  event.currentTarget.setAttribute('aria-pressed', String(active));
  event.currentTarget.textContent = active ? 'Ocultar enlaces' : 'Ver enlaces';
});
get('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast('La pantalla completa no está disponible en este navegador.');
  }
});
function filterCatalog() {
  const found = normalize('Estratum Venus Namibia aguas ultraprofundas noviembre 2026 ingeniería petrolera').includes(normalize(get('catalogQuery').value.trim()));
  document.querySelector('.issue').hidden = !found;
  get('noIssues').hidden = found;
}
get('catalogQuery').addEventListener('input', filterCatalog);
get('catalogSearch').addEventListener('submit', (event) => { event.preventDefault(); filterCatalog(); });

document.addEventListener('keydown', (event) => {
  if (reader.hidden || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (event.key === 'Escape') setPanel(false);
  if (event.target.matches('input,textarea,select') || sidebar.contains(event.target)) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    if (!get(event.key === 'ArrowLeft' ? 'prev' : 'next').disabled) step(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
stage.addEventListener('touchstart', (event) => {
  const t = event.changedTouches[0];
  touchStart = event.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
stage.addEventListener('touchend', (event) => {
  if (!touchStart) return;
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (zoom <= 1 && Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
    const action = get(dx < 0 ? 'next' : 'prev');
    if (!action.disabled) action.click();
  }
}, { passive: true });

window.addEventListener('hashchange', loadRoute);
new ResizeObserver(fitSize).observe(stage);
renderEntries();
loadRoute();
