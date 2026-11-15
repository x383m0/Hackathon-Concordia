// Page de réglages : clé API, modèle, langue, thème et cache. Tout est enregistré dès qu'on change une valeur.
const keyInput = $("key");
const modelInput = $("model");
const langSelect = $("lang");
const themeSelect = $("theme");
const status = $("status");
const cacheInfo = $("cache-info");
const toggle = $("toggle");

function $(id) { return document.getElementById(id); }

let timer;
function flash(message) {
  status.textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => (status.textContent = ""), 1500);
}

async function showCacheInfo() {
  const { analysisCache = {} } = await chrome.storage.local.get("analysisCache");
  const n = Object.keys(analysisCache).length;
  cacheInfo.textContent = n === 1 ? t("cache1") : t("cacheN", { n });
}

function updateToggle() {
  toggle.textContent = keyInput.type === "password" ? t("show") : t("hide");
}

// Remet les listes de langue et de thème à jour (le popup peut aussi changer la langue)
async function syncSelects() {
  const stored = await chrome.storage.local.get(["lang", "theme"]);
  langSelect.value = ["en", "fr"].includes(stored.lang) ? stored.lang : "auto";
  themeSelect.value = ["light", "dark"].includes(stored.theme) ? stored.theme : "auto";
}

(async function init() {
  await initUi(() => {
    showCacheInfo();
    updateToggle();
    syncSelects();
  });

  const stored = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  keyInput.value = stored.geminiApiKey || "";
  modelInput.value = stored.geminiModel || "";
  await syncSelects();
  showCacheInfo();
})();

keyInput.addEventListener("input", () => {
  chrome.storage.local.set({ geminiApiKey: keyInput.value.trim() }).then(() => flash(t("saved")));
});
modelInput.addEventListener("input", () => {
  chrome.storage.local.set({ geminiModel: modelInput.value.trim() }).then(() => flash(t("saved")));
});
langSelect.addEventListener("change", () => {
  chrome.storage.local.set({ lang: langSelect.value }).then(() => flash(t("saved")));
});
themeSelect.addEventListener("change", () => {
  chrome.storage.local.set({ theme: themeSelect.value }).then(() => flash(t("saved")));
});

toggle.addEventListener("click", () => {
  keyInput.type = keyInput.type === "password" ? "text" : "password";
  updateToggle();
});

$("clear-cache").addEventListener("click", async () => {
  await chrome.storage.local.remove("analysisCache");
  showCacheInfo();
  flash(t("cleared"));
});
