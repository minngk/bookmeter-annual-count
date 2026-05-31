const setupSection = document.getElementById("setup-section");
const mainSection = document.getElementById("main-section");
const loginSection = document.getElementById("login-section");

const userIdInput = document.getElementById("user-id-input");
const saveBtn = document.getElementById("save-btn");
const countValue = document.getElementById("count-value");
const updatedAtEl = document.getElementById("updated-at");
const refreshBtn = document.getElementById("refresh-btn");
const statusMsg = document.getElementById("status-msg");

async function init() {
  const data = await chrome.storage.local.get(["userId", "bookCount", "updatedAt", "loggedIn"]);

  if (!data.userId) {
    setupSection.style.display = "block";
    userIdInput.focus();
    return;
  }

  mainSection.style.display = "block";

  if (data.loggedIn === false) {
    loginSection.style.display = "block";
    countValue.textContent = "–";
    return;
  }

  if (data.bookCount != null) {
    countValue.textContent = data.bookCount;
  }
  if (data.updatedAt) {
    showUpdatedAt(data.updatedAt);
  }
}

saveBtn.addEventListener("click", async () => {
  const id = userIdInput.value.trim();
  if (!id || !/^\d+$/.test(id)) {
    userIdInput.focus();
    return;
  }
  await chrome.storage.local.set({ userId: id });
  setupSection.style.display = "none";
  mainSection.style.display = "block";
  await fetchAndDisplay(id);
});

refreshBtn.addEventListener("click", async () => {
  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) return;
  await fetchAndDisplay(userId);
});

const COLORS = {
  normal:  "#27ae60",
  loading: "#999999",
  logout:  "#999999",
  parse:   "#e67e22",
  error:   "#e74c3c",
};

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

async function fetchAndDisplay(userId) {
  refreshBtn.disabled = true;
  statusMsg.textContent = "取得中…";
  setBadge("…", COLORS.loading);

  let html = null;
  let finalUrl = null;
  let errorMsg = null;

  try {
    const res = await fetch(`https://bookmeter.com/users/${userId}/data`, {
      credentials: "include",
    });
    finalUrl = res.url;
    html = await res.text();
  } catch (e) {
    errorMsg = String(e);
  }

  if (errorMsg) {
    statusMsg.textContent = "通信エラー";
    setBadge("!", COLORS.error);
    refreshBtn.disabled = false;
    return;
  }

  if (finalUrl && finalUrl.includes("/login")) {
    await chrome.storage.local.set({ loggedIn: false });
    setBadge("－", COLORS.logout);
    loginSection.style.display = "block";
    countValue.textContent = "–";
    statusMsg.textContent = "";
    refreshBtn.disabled = false;
    return;
  }

  const count = parseBookCount(html);

  if (count === null) {
    statusMsg.textContent = "データの取得に失敗しました";
    setBadge("?", COLORS.parse);
    refreshBtn.disabled = false;
    return;
  }

  const updatedAt = new Date().toISOString();
  await chrome.storage.local.set({ bookCount: count, updatedAt, loggedIn: true });
  setBadge(String(count), COLORS.normal);

  loginSection.style.display = "none";
  countValue.textContent = count;
  showUpdatedAt(updatedAt);
  statusMsg.textContent = "";
  refreshBtn.disabled = false;
}

function parseBookCount(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const selectors = [
    ".yearly-book-num",
    ".data__count",
    "[data-count]",
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const num = parseInt(el.textContent.trim(), 10);
      if (!isNaN(num)) return num;
    }
  }

  const text = doc.body?.textContent || "";
  const match = text.match(/今年[^\d]*(\d+)\s*冊/);
  if (match) return parseInt(match[1], 10);

  return null;
}

function showUpdatedAt(iso) {
  const d = new Date(iso);
  updatedAtEl.textContent = `更新: ${d.toLocaleDateString("ja-JP")} ${d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}


init();
