const KEY = 'rl.items.v1';
const FILTER_KEY = 'rl.filter.v1';
const $ = (id) => document.getElementById(id);

const els = {
  q: $('q'),
  list: $('list'), empty: $('empty'),
  fAll: $('fAll'), fUnread: $('fUnread'), fStar: $('fStar'), fArch: $('fArch'),
  cAll: $('cAll'), cUnread: $('cUnread'), cStar: $('cStar'), cArch: $('cArch'),
  exportBtn: $('exportBtn'), importBtn: $('importBtn'), importFile: $('importFile'),
};

let items = [];
let filter = localStorage.getItem(FILTER_KEY) || 'all';
let query = '';

async function load() {
  const data = await chrome.storage.local.get(KEY);
  items = Array.isArray(data[KEY]) ? data[KEY] : [];
  render();
}
async function save() {
  await chrome.storage.local.set({ [KEY]: items });
}

function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function favicon(u) {
  const h = host(u);
  return h ? `https://www.google.com/s2/favicons?sz=64&domain=${h}` : '';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function toggleStar(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.starred = !it.starred;
  await save(); render();
}
async function toggleArch(id) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  it.archived = !it.archived;
  await save(); render();
}
async function removeItem(id) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  items = items.filter((x) => x.id !== id);
  await save(); render();
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
  els.cAll.textContent = c.all; els.cUnread.textContent = c.unread;
  els.cStar.textContent = c.star; els.cArch.textContent = c.arch;
  for (const [k, btn] of [['all', els.fAll], ['unread', els.fUnread], ['star', els.fStar], ['arch', els.fArch]]) {
    btn.classList.toggle('on', filter === k);
  }
  let visible = items.slice();
  if (filter === 'unread') visible = visible.filter((x) => !x.archived);
  else if (filter === 'star') visible = visible.filter((x) => x.starred);
  else if (filter === 'arch') visible = visible.filter((x) => x.archived);
  if (query) {
    const q = query.toLowerCase();
    visible = visible.filter((x) => (x.title || '').toLowerCase().includes(q) || (x.url || '').toLowerCase().includes(q));
  }

  els.empty.style.display = visible.length === 0 ? '' : 'none';
  if (visible.length === 0) {
    els.list.innerHTML = '';
    els.empty.querySelector('h2').textContent = items.length === 0 ? '저장된 글 0개' : '해당 항목 없음';
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

for (const [k, btn] of [['all', els.fAll], ['unread', els.fUnread], ['star', els.fStar], ['arch', els.fArch]]) {
  btn.addEventListener('click', () => { filter = k; localStorage.setItem(FILTER_KEY, k); render(); });
}

els.q.addEventListener('input', (e) => { query = e.target.value; render(); });

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
        items.unshift({ ...it, id: it.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)) });
        added++;
      }
    }
    await save(); render();
    alert(`${added}개 항목 복원됨 (중복 제외)`);
  } catch (err) {
    alert('복원 실패: ' + err.message);
  }
  els.importFile.value = '';
});

// storage 변경 감지 (다른 탭/액션에서 저장 시 자동 갱신)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) {
    items = changes[KEY].newValue || [];
    render();
  }
});

load();
