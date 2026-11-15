// Page de réglages : clé API, modèle et cache. Tout est enregistré dans le navigateur dès qu'on tape.
const keyInput = document.getElementById("key");
const modelInput = document.getElementById("model");
const status = document.getElementById("status");
const cacheInfo = document.getElementById("cache-info");

let timer;
function saved() {
  status.textContent = "Saved ✓";
  clearTimeout(timer);
  timer = setTimeout(() => (status.textContent = ""), 1500);
}

async function showCacheInfo() {
  const { analysisCache = {} } = await chrome.storage.local.get("analysisCache");
  const n = Object.keys(analysisCache).length;
  cacheInfo.textContent = n === 1 ? "1 analysis saved." : `${n} analyses saved.`;
}

chrome.storage.local.get(["geminiApiKey", "geminiModel"]).then(({ geminiApiKey, geminiModel }) => {
  keyInput.value = geminiApiKey || "";
  modelInput.value = geminiModel || "";
});
showCacheInfo();

keyInput.addEventListener("input", () => {
  chrome.storage.local.set({ geminiApiKey: keyInput.value.trim() }).then(saved);
});
modelInput.addEventListener("input", () => {
  chrome.storage.local.set({ geminiModel: modelInput.value.trim() }).then(saved);
});

document.getElementById("toggle").addEventListener("click", (e) => {
  const hidden = keyInput.type === "password";
  keyInput.type = hidden ? "text" : "password";
  e.target.textContent = hidden ? "Hide" : "Show";
});

document.getElementById("clear-cache").addEventListener("click", async () => {
  await chrome.storage.local.remove("analysisCache");
  showCacheInfo();
  status.textContent = "Saved analyses cleared ✓";
});
