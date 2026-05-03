// Reading List — vanilla JS, localStorage 기반. 서버 X.
const KEY = 'rl.items.v1';
const FILTER_KEY = 'rl.filter.v1';
const $ = (id) => document.getElementById(id);

const els = {
  url: $('url'), addBtn: $('addBtn'),
  list: $('list'), empty: $('empty'),
  fAll: $('fAll'), fUnread: $('fUnread'), fStar: $('fStar'), fArch: $('fArch'),
  cAll: $('cAll'), cUnread: $('cUnread'), cStar: $('cStar'), cArch: $('cArch'),
  exportBtn: $('exportBtn'), importBtn: $('importBtn'), importFile: $('importFile'),
};

let items = loadItems();
let filter = localStorage.getItem(FILTER_KEY) || 'all';

function loadItems() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}
function saveItems() { localStorage.setItem(KEY, JSON.stringify(items)); }

function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function favicon(u) {
  const h = host(u);
  return h ? `https://www.google.com/s2/favicons?sz=64&domain=${h}` : '';
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function addItem(rawUrl) {
  const url = rawUrl.trim();
  if (!url) return;
  let normalized = url;
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
  try { new URL(normalized); } catch { alert('올바른 URL이 아닙니다.'); return; }

  if (items.some((x) => x.url === normalized)) {
    flashUrlField('이미 추가된 주소');
    return;
  }
  const item = {
    id: uid(),
    url: normalized,
    title: host(normalized) || normalized,
    desc: '',
    addedAt: Date.now(),
    archived: false,
    starred: false,
  };
  items.unshift(item);
  saveItems();
  els.url.value = '';
  render();
  // 비동기 메타 가져오기 (제목/요약). CORS 회피용 무료 oEmbed/r.jina.ai 시도, 실패해도 OK.
  fetchMeta(item).catch(() => {});
}

async function fetchMeta(item) {
  // 1차: r.jina.ai (무료, CORS 허용, 본문 텍스트 추출)
  try {
    const res = await fetch('https://r.jina.ai/' + item.url, { headers: { 'X-Return-Format': 'text' } });
    if (!res.ok) throw new Error('jina fail');
    const text = await res.text();
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    const descMatch = text.match(/^Description:\s*(.+)$/m) || text.match(/Markdown Content:\s*\n([^\n]{30,200})/m);
    if (titleMatch) item.title = titleMatch[1].trim().slice(0, 200);
    if (descMatch) item.desc = descMatch[1].trim().slice(0, 200);
    saveItems();
    render();
  } catch (_) {
    // 실패해도 host 기반 fallback 그대로 둠
  }
}

function flashUrlField(msg) {
  const orig = els.url.value;
  els.url.value = msg;
  els.url.style.color = '#ef4444';
  setTimeout(() => { els.url.value = orig; els.url.style.color = ''; }, 1100);
}

function toggleStar(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.starred = !it.starred;
  saveItems(); render();
}
function toggleArch(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.archived = !it.archived;
  saveItems(); render();
}
function removeItem(id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  items = items.filter((x) => x.id !== id);
  saveItems(); render();
}

function counts() {
  return {
    all: items.length,
    unread: items.filter((x) => !x.archived).length,
    star: items.filter((x) => x.starred).length,
    arch: items.filter((x) => x.archived).length,
  };
}

function render() {
  const c = counts();
  els.cAll.textContent = c.all;
  els.cUnread.textContent = c.unread;
  els.cStar.textContent = c.star;
  els.cArch.textContent = c.arch;

  for (const [k, btn] of [['all', els.fAll], ['unread', els.fUnread], ['star', els.fStar], ['arch', els.fArch]]) {
    btn.classList.toggle('on', filter === k);
  }
  let visible = items.slice();
  if (filter === 'unread') visible = visible.filter((x) => !x.archived);
  else if (filter === 'star') visible = visible.filter((x) => x.starred);
  else if (filter === 'arch') visible = visible.filter((x) => x.archived);

  els.empty.style.display = visible.length === 0 ? '' : 'none';
  if (visible.length === 0) {
    els.list.innerHTML = '';
    if (filter === 'all' && items.length === 0) {
      els.empty.querySelector('h2').textContent = '읽을거리 0개';
    } else {
      els.empty.querySelector('h2').textContent = '해당 항목 없음';
    }
    return;
  }
  els.list.innerHTML = visible.map((x) => {
    const date = new Date(x.addedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    return `<div class="card${x.archived ? ' archived' : ''}">
      <img src="${escapeHtml(favicon(x.url))}" alt="" width="20" height="20" style="margin-top:3px;border-radius:3px" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'" />
      <div class="body">
        <a class="t" href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.title)}</a>
        <p class="meta"><span>${escapeHtml(host(x.url))}</span><span>·</span><span>${date}</span>${x.archived ? '<span>·</span><span>읽음</span>' : ''}</p>
        ${x.desc ? `<p class="desc">${escapeHtml(x.desc)}</p>` : ''}
      </div>
      <div class="acts">
        <button class="star${x.starred ? ' on' : ''}" data-id="${x.id}" data-act="star" title="즐겨찾기">★</button>
        <button data-id="${x.id}" data-act="arch" title="${x.archived ? '읽지 않음으로' : '읽음 표시'}">${x.archived ? '↺' : '✓'}</button>
        <button data-id="${x.id}" data-act="del" title="삭제">×</button>
      </div>
    </div>`;
  }).join('');
}

els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'star') toggleStar(id);
  else if (btn.dataset.act === 'arch') toggleArch(id);
  else if (btn.dataset.act === 'del') removeItem(id);
});

els.addBtn.addEventListener('click', () => addItem(els.url.value));
els.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(els.url.value); });

for (const [k, btn] of [['all', els.fAll], ['unread', els.fUnread], ['star', els.fStar], ['arch', els.fArch]]) {
  btn.addEventListener('click', () => { filter = k; localStorage.setItem(FILTER_KEY, k); render(); });
}

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reading-list-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
els.importBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(incoming)) throw new Error('잘못된 형식');
    let added = 0;
    for (const it of incoming) {
      if (it && it.url && !items.some((x) => x.url === it.url)) {
        items.unshift({ ...it, id: it.id || uid() }); added++;
      }
    }
    saveItems(); render();
    alert(`${added}개 항목 복원됨 (중복 제외)`);
  } catch (err) {
    alert('복원 실패: ' + err.message);
  }
  els.importFile.value = '';
});

// Web Share Target API: PWA 설치 후 다른 앱에서 공유 → ?url= 자동 추가
const params = new URLSearchParams(location.search);
const sharedUrl = params.get('url') || params.get('text');
if (sharedUrl) {
  history.replaceState(null, '', location.pathname);
  addItem(sharedUrl);
}

render();
