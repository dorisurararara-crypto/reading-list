// Reading List MV3 service worker.
// 진입 옵션 3중: 툴바 클릭 / 우클릭 컨텍스트 메뉴 / 단축키.
// 저장소: chrome.storage.local (정본). PWA localStorage 와 별도 (JSON import 옵션 페이지 제공).

const KEY = 'rl.items.v1';

// 우클릭 메뉴 등록 (설치 시 1회)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-page',
    title: '이 페이지를 Reading List에 저장',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'save-link',
    title: '이 링크를 Reading List에 저장',
    contexts: ['link'],
  });
  chrome.contextMenus.create({
    id: 'open-library',
    title: 'Reading List 라이브러리 열기',
    contexts: ['action'],
  });
});

// 툴바 아이콘 클릭 = 현재 탭 저장 (popup 없음 — 즉시 저장)
chrome.action.onClicked.addListener(async (tab) => {
  await saveTab(tab);
});

// 우클릭 메뉴
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-page') {
    await saveTab(tab);
  } else if (info.menuItemId === 'save-link' && info.linkUrl) {
    await saveByUrl(info.linkUrl, tab);
  } else if (info.menuItemId === 'open-library') {
    chrome.runtime.openOptionsPage();
  }
});

// 단축키
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await saveTab(tab);
  } else if (command === 'open-library') {
    chrome.runtime.openOptionsPage();
  }
});

async function saveTab(tab) {
  if (!tab || !tab.url) return;
  // chrome:// 같은 내부 URL 차단
  if (!/^https?:\/\//i.test(tab.url)) {
    notify('이 페이지는 저장할 수 없습니다 (브라우저 내부 페이지)', tab.id, true);
    return;
  }
  await saveByUrl(tab.url, tab, tab.title || '');
}

async function saveByUrl(url, tab, titleHint = '') {
  const existing = await loadItems();
  if (existing.some((x) => x.url === url)) {
    notify('이미 저장된 페이지', tab && tab.id, true);
    flashBadge('=', tab && tab.id);
    return;
  }
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    url,
    title: titleHint || hostOf(url) || url,
    desc: '',
    addedAt: Date.now(),
    archived: false,
    starred: false,
  };
  existing.unshift(item);
  await saveItems(existing);
  notify('저장됨: ' + (item.title || url).slice(0, 60), tab && tab.id);
  flashBadge('✓', tab && tab.id);
  // 메타 가져오기 (제목/요약) — 비동기, 실패해도 OK
  fetchMeta(item).catch(() => {});
}

async function fetchMeta(item) {
  try {
    const res = await fetch('https://r.jina.ai/' + item.url, {
      headers: { 'X-Return-Format': 'text' },
    });
    if (!res.ok) return;
    const text = await res.text();
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    const descMatch = text.match(/^Description:\s*(.+)$/m);
    if (titleMatch || descMatch) {
      const items = await loadItems();
      const it = items.find((x) => x.id === item.id);
      if (!it) return;
      if (titleMatch) it.title = titleMatch[1].trim().slice(0, 200);
      if (descMatch) it.desc = descMatch[1].trim().slice(0, 200);
      await saveItems(items);
    }
  } catch (_) {}
}

async function loadItems() {
  const data = await chrome.storage.local.get(KEY);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}
async function saveItems(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function flashBadge(text, tabId) {
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1400);
}

// 토스트 대신 chrome.notifications 사용 (권한 자동, MV3에서 지원)
function notify(message, tabId, isWarn = false) {
  // chrome.notifications 권한이 manifest에 없으면 fallback: badge만
  if (chrome.notifications && chrome.notifications.create) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Reading List',
      message,
      silent: true,
    });
  }
}
