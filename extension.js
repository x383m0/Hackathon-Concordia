// Popup : détecte les ToU de la page ouverte, lance l'analyse IA et affiche la note sur la jauge.

const resultDiv = document.getElementById("result");
const aiDiv = document.getElementById("ai");
const keyInput = document.getElementById("api");

const isHttp = (url) => /^https?:\/\//i.test(url || "");

// Affiche un bloc dans la zone de détection ("yes", "no" ou "err" donne la couleur)
function show(cls, content) {
  resultDiv.className = cls;
  resultDiv.style.display = "block";
  resultDiv.replaceChildren(content);
}

// On utilise textContent et jamais innerHTML, parce que le texte peut venir de la page
function text(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div;
}

// Seulement les liens http(s), pour éviter les liens "javascript:"
function addLink(parent, url) {
  if (!isHttp(url)) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.textContent = url;
  parent.appendChild(a);
}

// Affiche un bloc dans la zone de l'analyse IA
function showAi(content, isError = false) {
  const box = document.createElement("div");
  box.className = "ai-box" + (isError ? " ai-error" : "");
  box.appendChild(content);
  aiDiv.style.display = "block";
  aiDiv.replaceChildren(box);
}

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

// Tourne l'aiguille : 0 est tout à gauche (rouge), 100 tout à droite (vert). null remet la jauge à zéro
function setGauge(score) {
  const needle = document.getElementById("needle");
  const number = document.getElementById("score");
  const label = document.getElementById("analyse");

  if (score === null) {
    needle.style.transform = "rotate(0deg)";
    number.textContent = "";
    label.textContent = "";
    return;
  }

  needle.style.transform = `rotate(${(score / 100) * 180}deg)`;
  number.textContent = `${score}/100`;
  label.textContent = score >= 67 ? "Rather protective" : score >= 34 ? "Needs attention" : "Unfavorable to the user";
}

const RECOMMENDATION_ICON = { "accept": "🟢", "accept with caution": "🟠", "avoid": "🔴" };
const SEVERITY_ICON = { high: "🔴", medium: "🟠", low: "🟡" };

// Le modèle ne respecte pas toujours le format : un élément peut être un simple texte
// ou utiliser d'autres noms de champs. On ramène tout à { title, explanation, severity }.
function toItem(raw) {
  if (typeof raw === "string") return raw.trim() ? { title: raw.trim(), explanation: "" } : null;
  if (!raw || typeof raw !== "object") return null;

  const title = raw.title || raw.name || raw.clause || raw.point || "";
  const explanation = raw.explanation || raw.description || raw.details || "";
  if (!title && !explanation) return null; // élément vide : on l'ignore

  return { title, explanation, severity: raw.severity };
}

// Ajoute un titre suivi d'une liste à puces
function addList(box, title, items) {
  if (items.length === 0) return;

  const heading = text(title);
  heading.style.cssText = "margin-top:8px;font-weight:bold";
  box.appendChild(heading);

  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item.title && item.explanation ? `${item.title}: ${item.explanation}` : item.title || item.explanation;
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

// Transforme une liste du modèle en éléments affichables, en enlevant ceux qui sont vides
function cleanList(list) {
  return (Array.isArray(list) ? list : []).map(toItem).filter(Boolean);
}

// Affiche l'analyse : recommandation, résumé, risques et points favorables, et met la note sur la jauge
function renderAiResult(result) {
  if (result.valid_document === false) {
    setGauge(null);
    return showAi(text("⚠️ This page does not look like terms of use or a privacy policy."));
  }

  setGauge(computeScore(result));

  const box = document.createElement("div");

  if (result.recommendation) {
    const icon = RECOMMENDATION_ICON[result.recommendation] || "ℹ️";
    const recommendation = text(`${icon} Recommendation: ${result.recommendation}`);
    recommendation.style.fontWeight = "bold";
    box.appendChild(recommendation);
  }

  box.appendChild(text(result.summary || ""));

  const risks = cleanList(result.risks).map((risk) => ({
    ...risk,
    title: `${SEVERITY_ICON[risk.severity] || "•"} ${risk.title || ""}`.trim()
  }));
  addList(box, "Risks", risks);
  addList(box, "Favorable points", cleanList(result.favorable_points));

  if (result.truncated) {
    box.appendChild(text("(Very long text: only the first part was analyzed.)"));
  }

  showAi(box);
}

// Le background annonce chaque étape pendant l'analyse
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PROGRESS" && aiDiv.firstChild?.classList.contains("ai-box")) {
    aiDiv.firstChild.textContent = "⏳ " + message.text;
  }
});

// Demande l'analyse au background et affiche le résultat
async function runAnalysis(url, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Analyzing…";
  setGauge(null);
  showAi(text("⏳ AI analysis (a few seconds)…"));

  try {
    // Sécurité : si le background ne répond jamais, on arrête d'attendre
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("No answer after 2 minutes. Reload the extension and try again.")), 120000)
    );
    const response = await Promise.race([chrome.runtime.sendMessage({ type: "ANALYZE_LINK", url }), timeout]);
    if (!response?.ok) throw new Error(response?.error || "Unknown error");
    renderAiResult(response.result);
  } catch (e) {
    showAi(text("⚠️ " + e.message), true);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function addAnalyzeButton(parent, url) {
  if (!isHttp(url)) return; // sans lien, il n'y a rien à analyser

  const button = document.createElement("button");
  button.textContent = "Analyze with AI";
  button.style.marginTop = "6px";
  button.addEventListener("click", () => runAnalysis(url, button));
  parent.appendChild(button);
}

// La clé API reste dans le navigateur, elle n'est jamais écrite dans le code
chrome.storage.local.get("geminiApiKey").then(({ geminiApiKey }) => {
  if (geminiApiKey) keyInput.value = geminiApiKey;
});
keyInput.addEventListener("input", () => {
  chrome.storage.local.set({ geminiApiKey: keyInput.value.trim() });
});

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

// Quand rien n'est détecté, on montre ce que chaque cadre contenait pour comprendre pourquoi
function diagnosticBox(frames) {
  const box = document.createElement("div");
  box.appendChild(text("No ToU acceptance detected."));

  const summary = document.createElement("div");
  summary.style.cssText = "margin-top:8px;font-size:11px;opacity:.85";
  summary.appendChild(text(`Frames analyzed: ${frames.length}`));
  for (const f of frames) {
    const d = f.debug;
    summary.appendChild(text(
      `• ${f.page.slice(0, 55)} → ToU links: ${d.termsLinks}, buttons: ${d.buttons}, checkboxes: ${d.checkboxes}`
    ));
  }
  box.appendChild(summary);

  // Le détail complet, à copier-coller si on veut investiguer
  const report = document.createElement("textarea");
  report.value = JSON.stringify(frames.map((f) => ({ page: f.page, debug: f.debug })), null, 1);
  report.readOnly = true;
  report.rows = 5;
  report.style.cssText = "width:100%;margin-top:8px;font-size:10px;box-sizing:border-box";
  box.appendChild(report);

  const copy = document.createElement("button");
  copy.textContent = "Copy diagnostic";
  copy.style.marginTop = "6px";
  copy.addEventListener("click", () => {
    report.select();
    document.execCommand("copy");
    copy.textContent = "Copied";
  });
  box.appendChild(copy);

  return box;
}

// Affiche le nombre d'acceptations, avec pour chacune son lien et le bouton d'analyse
function acceptancesBox(items) {
  const box = document.createElement("div");
  box.appendChild(text(items.length > 1 ? `${items.length} ToU acceptances detected` : "1 ToU acceptance detected"));

  for (const item of items) {
    const row = document.createElement("div");
    row.style.marginTop = "8px";
    addLink(row, item.link);
    addAnalyzeButton(row, item.link);
    box.appendChild(row);
  }
  return box;
}

// Détecte les ToU de la page ouverte, dès l'ouverture du popup
async function detect() {
  aiDiv.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // detector.js est injecté dans la page et dans toutes ses iframes, chacune renvoie son résultat
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["detector.js"]
    });
    const frames = injected.map((r) => r.result).filter(Boolean);

    const items = collectAcceptances(frames);
    if (items.length === 0) {
      show("no", diagnosticBox(frames));
    } else {
      show("yes", acceptancesBox(items));
    }
  } catch (e) {
    // Arrive sur les pages où l'injection est interdite (chrome://, Chrome Web Store...)
    show("err", text("Cannot analyze this page: " + e.message));
  }
}

detect();
