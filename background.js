const ALARM_NAME = "daily-fetch";
const COLORS = {
  normal:  "#27ae60",
  loading: "#999999",
  logout:  "#999999",
  parse:   "#e67e22",
  error:   "#e74c3c",
  setup:   "#f39c12",
};

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 });
  fetchBookCount();
});

chrome.runtime.onStartup.addListener(() => {
  fetchBookCount();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    fetchBookCount();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "fetch") {
    fetchBookCount().then(() => sendResponse({ done: true }));
    return true; // keep channel open for async response
  }
});

async function fetchBookCount() {
  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) {
    setBadge("設定", COLORS.setup);
    return;
  }

  setBadge("…", COLORS.loading);

  try {
    const res = await fetch(`https://bookmeter.com/users/${userId}/data`, {
      credentials: "include",
    });

    const html = await res.text();
    const count = parseBookCount(html);

    if (res.url.includes("/login")) {
      await chrome.storage.local.set({ loggedIn: false });
      setBadge("－", COLORS.logout);
      return;
    }

    if (count === null) {
      setBadge("?", COLORS.parse);
      return;
    }

    const updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ bookCount: count, updatedAt, loggedIn: true });
    setBadge(String(count), COLORS.normal);
  } catch {
    setBadge("!", COLORS.error);
  }
}

function parseBookCount(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 読書メーターの /data ページ: 「今年読んだ本」の冊数を取得する
  // 複数のセレクターを試して最初にマッチしたものを使う
  const selectors = [
    // データページのカード形式
    ".yearly-book-num",
    ".data__count",
    // セクション見出しの次の数値要素
    "[data-count]",
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const num = parseInt(el.textContent.trim(), 10);
      if (!isNaN(num)) return num;
    }
  }

  // フォールバック: テキストから「今年」「冊」を含む行を探す
  const text = doc.body?.innerText || doc.body?.textContent || "";
  const match = text.match(/今年[^\d]*(\d+)\s*冊/);
  if (match) return parseInt(match[1], 10);

  return null;
}
