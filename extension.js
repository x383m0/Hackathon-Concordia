// Popup : détecte les ToU de la page ouverte et affiche l'état de l'analyse IA.
// L'analyse tourne dans background.js, donc elle continue quand on change d'onglet (le popup se ferme).
// Le popup relit simplement l'état de la tâche (chrome.storage.session) à chaque ouverture et pendant qu'il est ouvert.

const $ = (id) => document.getElementById(id);
const resultDiv = $("result");
const aiDiv = $("ai");

const isHttp = (url) => /^https?:\/\//i.test(url || "");

let detection = { status: "loading" }; // loading | done | error
let jobs = {};                         // état des analyses, lu dans chrome.storage.session
let activeUrl = null;                  // le lien dont on affiche le résultat
let lastScore = null;                  // pour n'animer la jauge que quand la note change

const jobKey = (url) => `job:${url}`;

function jobFor(url) {
  const job = url && jobs[jobKey(url)];
  if (job?.status === "running" && Date.now() - job.updated > 150000) {
    return { ...job, status: "error", error: "STALLED" }; // le background s'est arrêté en route
  }
  return job;
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

// On utilise textContent et jamais innerHTML, parce que le texte peut venir de la page ou du modèle
const text = (str) => el("div", "", str);

function show(cls, content) {
  resultDiv.className = cls;
  resultDiv.style.display = "block";
  resultDiv.replaceChildren(content);
}

function addLink(parent, url) {
  if (!isHttp(url)) return; // seulement http(s), pour éviter les liens "javascript:"
  const a = el("a", "", url);
  a.href = url;
  a.target = "_blank";
  parent.appendChild(a);
}

function showAi(content, extraClass = "") {
  const box = el("div", "ai-box " + extraClass);
  box.appendChild(content);
  aiDiv.style.display = "block";
  aiDiv.replaceChildren(box);
}

function hideAi() {
  aiDiv.style.display = "none";
  aiDiv.replaceChildren();
}

// ----- Note -----

// Poids de chaque critère. Le modèle donne 0, 1 ou 2 à chacun, le total des poids sert de base
const WEIGHTS = {
  sells_data_to_third_parties: 20,
  shares_with_advertisers: 12,
  tracking_and_profiling: 12,
  sensitive_data_collected: 12,
  no_deletion_right: 10,
  indefinite_retention: 8,
  broad_content_license: 8,
  unilateral_changes: 8,
  forced_arbitration: 8,
  location_tracking: 7,
  vague_language: 7
};

// Points perdus pour chaque risque listé, selon sa gravité
const RISK_PENALTY = { high: 14, medium: 8, low: 3 };

// Note maximale selon la recommandation, pour ne pas avoir une note verte qui contredit le texte
const RECOMMENDATION_CAP = { "avoid": 40, "accept with caution": 69 };

// Calcule la note de 0 (très défavorable) à 100 (protecteur)
function computeScore(result) {
  let criteriaPenalty = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const value = Math.min(2, Math.max(0, Number(result.criteria?.[key]) || 0));
    criteriaPenalty += (weight * value) / 2;
  }

  let riskPenalty = 0;
  const risks = Array.isArray(result.risks) ? result.risks : [];
  for (const risk of risks) riskPenalty += RISK_PENALTY[risk?.severity] || 0;

  // On garde la pénalité la plus sévère : si le modèle oublie les critères, les risques comptent, et inversement
  let score = Math.round(100 - Math.min(100, Math.max(criteriaPenalty, riskPenalty)));

  const cap = RECOMMENDATION_CAP[result.recommendation];
  if (cap !== undefined) score = Math.min(score, cap);

  return Math.max(0, score);
}

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// La note monte de 0 jusqu'à sa valeur
function countUp(node, target) {
  if (prefersReducedMotion()) {
    node.textContent = `${target}/100`;
    return;
  }
  const start = performance.now();
  const duration = 800;
  function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = `${Math.round(target * eased)}/100`;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Tourne l'aiguille : 0 est tout à gauche (rouge), 100 tout à droite (vert). null remet la jauge à zéro
function setGauge(score) {
  const needle = $("needle");
  const number = $("score");
  const label = $("analyse");

  if (score === null) {
    needle.style.transform = "rotate(0deg)";
    number.textContent = "";
    label.textContent = "";
    lastScore = null;
    return;
  }

  needle.style.transform = `rotate(${(score / 100) * 180}deg)`;
  label.textContent = score >= 67 ? t("gaugeGood") : score >= 34 ? t("gaugeMid") : t("gaugeBad");
  if (score !== lastScore) countUp(number, score);
  else number.textContent = `${score}/100`;
  lastScore = score;
}

// ----- Résultat de l'analyse -----

const RECOMMENDATION_ICON = { "accept": "🟢", "accept with caution": "🟠", "avoid": "🔴" };
const SEVERITY_ICON = { high: "🔴", medium: "🟠", low: "🟡" };

// Le modèle ne respecte pas toujours le format : un élément peut être un simple texte
// ou utiliser d'autres noms de champs. On ramène tout à { title, explanation, severity, quote }.
function toItem(raw) {
  if (typeof raw === "string") return raw.trim() ? { title: raw.trim(), explanation: "" } : null;
  if (!raw || typeof raw !== "object") return null;

  const title = raw.title || raw.name || raw.clause || raw.point || "";
  const explanation = raw.explanation || raw.description || raw.details || "";
  if (!title && !explanation) return null; // élément vide : on l'ignore

  const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
  return { title, explanation, severity: raw.severity, quote };
}

function cleanList(list) {
  return (Array.isArray(list) ? list : []).map(toItem).filter(Boolean);
}

function addList(box, title, items) {
  if (items.length === 0) return;

  box.appendChild(el("div", "section-title", title));
  const ul = document.createElement("ul");
  items.forEach((item, i) => {
    const li = el("li", "", item.title && item.explanation ? `${item.title}: ${item.explanation}` : item.title || item.explanation);
    li.style.setProperty("--i", i);
    if (item.quote) li.appendChild(el("div", "quote", `“${item.quote}”`)); // extrait exact du texte analysé
    ul.appendChild(li);
  });
  box.appendChild(ul);
}

function renderResult(result, otherLang) {
  if (result.valid_document === false) {
    setGauge(null);
    return showAi(text(t("notValid")));
  }

  setGauge(computeScore(result));

  const box = document.createElement("div");

  if (result.recommendation) {
    const icon = RECOMMENDATION_ICON[result.recommendation] || "ℹ️";
    const label = I18N[LANG][`rec.${result.recommendation}`] || result.recommendation;
    box.appendChild(el("div", "rec", `${icon} ${t("recommendation")}: ${label}`));
  }

  box.appendChild(text(result.summary || ""));

  const risks = cleanList(result.risks).map((risk) => ({
    ...risk,
    title: `${SEVERITY_ICON[risk.severity] || "•"} ${risk.title || ""}`.trim()
  }));
  addList(box, t("risks"), risks);
  addList(box, t("favorable"), cleanList(result.favorable_points));

  if (otherLang) box.appendChild(el("div", "note", t("otherLang", { lang: otherLang === "fr" ? "Français" : "English" })));
  if (result.cached) box.appendChild(el("div", "note", t("cached")));
  if (result.truncated) box.appendChild(el("div", "note", t("truncated")));

  showAi(box);
}

// Transforme les erreurs techniques en messages compréhensibles
function friendlyError(message) {
  const m = String(message || "");
  if (/STALLED/.test(m)) return t("errStalled");
  if (/API key not valid|API_KEY_INVALID|error 40[13]/i.test(m)) return t("errKey");
  if (/Add your Gemini API key/i.test(m)) return t("errNoKey");
  if (/error 429/i.test(m)) return t("err429");
  if (/error (500|503|504)|took more than/i.test(m)) return t("errBusy");
  if (/error 404/i.test(m)) return t("err404");
  if (/Frame with ID|error page|takes too long to load/i.test(m)) return t("errLoad");
  if (/too short|Unable to read/i.test(m)) return t("errRead");
  if (/valid JSON/i.test(m)) return t("errJson");
  return m;
}

function stepText(job) {
  const steps = {
    starting: () => t("stepStarting"),
    opening: () => t("stepOpening"),
    reading: () => t("stepReading"),
    sending: () => t("stepSending", { n: job.n }),
    asking: () => t("stepAsking", { model: job.model }),
    retry: () => t("stepRetry", { model: job.model })
  };
  return (steps[job.step] || steps.starting)();
}

// ----- Affichage selon l'état -----

function renderAnalysis() {
  const job = jobFor(activeUrl);

  if (!job) {
    setGauge(null);
    hideAi();
    return;
  }

  if (job.status === "running") {
    setGauge(null);
    const box = document.createElement("div");
    const progress = el("div", "progress");
    progress.appendChild(el("span", "spinner"));
    progress.appendChild(el("span", "", stepText(job))).id = "progress";
    box.appendChild(progress);
    box.appendChild(el("div", "hint", t("backgroundHint")));
    showAi(box);
    return;
  }

  if (job.status === "error") {
    setGauge(null);
    const box = document.createElement("div");
    box.appendChild(text("⚠️ " + friendlyError(job.error)));
    const retry = el("button", "", t("btnRetry"));
    retry.addEventListener("click", () => start(activeUrl, false));
    box.appendChild(retry);
    showAi(box, "ai-error");
    return;
  }

  // Le résultat reste dans la langue où il a été écrit ; changer de langue propose de le refaire
  const otherLang = job.lang && job.lang !== LANG ? job.lang : null;
  renderResult(job.result, otherLang);
  const note = aiDiv.querySelector(".ai-box");
  if (note && job.result?.valid_document !== false) {
    const again = el("button", "", otherLang ? t("btnTranslate") : t("btnReanalyze"));
    again.style.marginTop = "8px";
    again.addEventListener("click", () => start(activeUrl, !otherLang));
    note.appendChild(again);
  }
}

// Met à jour seulement le texte d'avancement (évite de rejouer les animations)
function updateProgress() {
  const node = $("progress");
  const job = jobFor(activeUrl);
  if (node && job) node.textContent = stepText(job);
}

function actionButton(url) {
  const job = jobFor(url);
  const button = document.createElement("button");

  if (job?.status === "running") {
    button.disabled = true;
    button.appendChild(el("span", "spinner"));
    button.appendChild(document.createTextNode(t("btnAnalyzing")));
  } else if (job?.status === "done") {
    const isActive = url === activeUrl;
    const otherLang = job.lang && job.lang !== LANG;
    button.textContent = isActive ? (otherLang ? t("btnTranslate") : t("btnReanalyze")) : t("btnShow");
    button.addEventListener("click", () => (isActive ? start(url, !otherLang) : select(url)));
  } else if (job?.status === "error") {
    button.textContent = t("btnRetry");
    button.addEventListener("click", () => start(url, false));
  } else {
    button.textContent = t("btnAnalyze");
    button.addEventListener("click", () => start(url, false));
  }
  return button;
}

function acceptancesBox(items) {
  const box = document.createElement("div");
  box.appendChild(text(items.length > 1 ? t("detectedN", { n: items.length }) : t("detected1")));

  for (const item of items) {
    const row = el("div", "row");
    addLink(row, item.link);
    if (isHttp(item.link)) row.appendChild(actionButton(item.link)); // sans lien, il n'y a rien à analyser
    box.appendChild(row);
  }
  return box;
}

// Quand rien n'est détecté, on montre ce que chaque cadre contenait pour comprendre pourquoi
function diagnosticBox(frames) {
  const box = document.createElement("div");
  box.appendChild(text(t("noToU")));

  const details = document.createElement("details");
  details.appendChild(el("summary", "", t("details")));

  const summary = el("div");
  summary.appendChild(text(`Frames: ${frames.length}`));
  for (const f of frames) {
    const d = f.debug;
    summary.appendChild(text(`• ${f.page.slice(0, 55)} → ToU links: ${d.termsLinks}, buttons: ${d.buttons}, checkboxes: ${d.checkboxes}`));
  }
  details.appendChild(summary);

  const report = document.createElement("textarea");
  report.value = JSON.stringify(frames.map((f) => ({ page: f.page, debug: f.debug })), null, 1);
  report.readOnly = true;
  report.rows = 5;
  details.appendChild(report);

  const copy = el("button", "", t("copyDiag"));
  copy.style.marginTop = "6px";
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(report.value).then(() => (copy.textContent = t("copied")));
  });
  details.appendChild(copy);

  box.appendChild(details);
  return box;
}

function renderDetection() {
  if (detection.status === "loading") return show("loading", text(t("detecting")));
  if (detection.status === "error") return show("err", text(t("cannotAnalyze", { msg: detection.message })));
  if (detection.items.length === 0) return show("no", diagnosticBox(detection.frames));
  show("yes", acceptancesBox(detection.items));
}

function render() {
  renderDetection();
  renderAnalysis();
  const running = detection.items?.some((item) => jobFor(item.link)?.status === "running");
  document.body.classList.toggle("busy", !!running);
}

function select(url) {
  activeUrl = url;
  render();
}

// Lance l'analyse dans le background et affiche tout de suite l'état "en cours"
async function start(url, force) {
  activeUrl = url;
  jobs[jobKey(url)] = { status: "running", step: "starting", updated: Date.now() };
  render();
  try {
    await chrome.runtime.sendMessage({ type: "START_ANALYSIS", url, force, lang: LANG });
  } catch (e) {
    jobs[jobKey(url)] = { status: "error", error: e.message, updated: Date.now() };
    render();
  }
}

// ----- Détection sur la page -----

// Regroupe les acceptations trouvées dans tous les cadres de la page.
// Une acceptation = un lien, car plusieurs cadres peuvent voir la même.
function collectAcceptances(frames) {
  const all = frames.flatMap((f) => [...f.checkboxes, ...f.implicit]);
  const seenLinks = new Set();
  const unique = [];

  for (const item of all) {
    if (item.link) {
      if (seenLinks.has(item.link)) continue;
      seenLinks.add(item.link);
    }
    unique.push(item);
  }
  return unique;
}

async function readJobs() {
  const keys = (detection.items || []).filter((i) => isHttp(i.link)).map((i) => jobKey(i.link));
  jobs = keys.length ? await chrome.storage.session.get(keys) : {};
}

async function detect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // detector.js est injecté dans la page et dans toutes ses iframes, chacune renvoie son résultat
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["detector.js"]
    });
    const frames = injected.map((r) => r.result).filter(Boolean);
    detection = { status: "done", frames, items: collectAcceptances(frames) };
  } catch (e) {
    // Arrive sur les pages où l'injection est interdite (chrome://, Chrome Web Store...)
    detection = { status: "error", message: e.message, items: [] };
  }

  await readJobs();

  // Si une analyse est en cours ou terminée pour un de ces liens (lancée avant de changer d'onglet), on l'affiche
  const urls = (detection.items || []).map((i) => i.link).filter(isHttp);
  activeUrl = urls.find((u) => jobFor(u)?.status === "running") || urls.find((u) => jobFor(u)) || null;
  render();
}

// ----- Démarrage -----

// Le background met à jour l'état de la tâche : on réagit en direct si le popup est ouvert
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "session") return;
  const known = new Set((detection.items || []).map((i) => jobKey(i.link)));
  let changed = false;
  let progressOnly = false;

  for (const [key, change] of Object.entries(changes)) {
    if (!known.has(key)) continue;
    progressOnly = jobs[key]?.status === "running" && change.newValue?.status === "running";
    jobs[key] = change.newValue;
    changed = true;
  }

  if (!changed) return;
  if (progressOnly) updateProgress();
  else render();
});

function updateKeyHint() {
  chrome.storage.local.get("geminiApiKey").then(({ geminiApiKey }) => {
    $("keyhint").hidden = !!geminiApiKey;
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.geminiApiKey) updateKeyHint();
});

function markLanguage() {
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
}

document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => chrome.storage.local.set({ lang: b.dataset.lang }))
);
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("keyhint").addEventListener("click", () => chrome.runtime.openOptionsPage());

(async function init() {
  await initUi(async () => {
    markLanguage();
    render();
  });
  markLanguage();
  chrome.action.setBadgeText({ text: "" }); // on a vu le popup : on efface le badge
  updateKeyHint();
  render();
  detect();
})();
