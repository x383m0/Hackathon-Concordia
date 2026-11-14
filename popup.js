const resultDiv = document.getElementById("result");

function show(cls, content) {
  resultDiv.className = cls;
  resultDiv.style.display = "block";
  resultDiv.replaceChildren(content);
}

function text(str) {
  const p = document.createElement("div");
  p.textContent = str; // textContent: le texte vient de la page, jamais en innerHTML
  return p;
}

function safeLink(url) {
  // N'accepte que http(s) pour éviter les liens javascript:
  if (!/^https?:\/\//i.test(url)) return null;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.textContent = url;
  return a;
}

function addLink(parent, url) {
  const link = url && safeLink(url);
  if (link) parent.appendChild(link);
}

// =====================================================================
// MODULE IA : bouton « Analyser avec l'IA » sous chaque lien de ToU
// =====================================================================

const aiDiv = document.getElementById("ai");

function showAi(content, isError = false) {
  aiDiv.style.display = "block";
  const box = document.createElement("div");
  box.className = "ai-box" + (isError ? " ai-error" : "");
  box.appendChild(content);
  aiDiv.replaceChildren(box);
}

// ---------- T.O.U. Score (calculé ici, pas par le modèle) ----------
// Poids de chaque critère (total = 100). Chaque critère vaut 0, 1 ou 2.
// Note = 100 - pénalités : 0 = très défavorable à l'utilisateur, 100 = très protecteur.
const WEIGHTS = {
  sells_data_to_third_parties: 14,
  shares_with_advertisers: 10,
  tracking_and_profiling: 10,
  sensitive_data_collected: 10,
  no_deletion_right: 10,
  indefinite_retention: 8,
  broad_content_license: 8,
  unilateral_changes: 8,
  forced_arbitration: 8,
  location_tracking: 7,
  vague_language: 7
};

function computeScore(criteria) {
  let penalty = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const v = Math.min(2, Math.max(0, Number(criteria?.[key]) || 0)); // borne à 0-2, absent = 0
    penalty += (weight * v) / 2;
  }
  return Math.round(100 - penalty);
}

// Place l'aiguille : 0 = gauche (rouge), 100 = droite (vert)
function setGauge(score) {
  const needle = document.getElementById("needle");
  const num = document.getElementById("score");
  const label = document.getElementById("analyse");
  if (score === null) {
    needle.style.transform = "rotate(0deg)";
    num.textContent = "";
    label.textContent = "";
    return;
  }
  needle.style.transform = `rotate(${(score / 100) * 180}deg)`;
  num.textContent = `${score}/100`;
  label.textContent = score >= 67 ? "Plutôt protecteur" : score >= 34 ? "À surveiller" : "Défavorable à l'utilisateur";
}

function renderAiResult(response) {
  const r = response.result;
  const box = document.createElement("div");

  if (r.valid_document === false) {
    setGauge(null);
    box.appendChild(text("⚠️ Cette page ne semble pas être des conditions d'utilisation ou une politique de confidentialité."));
    return showAi(box);
  }

  setGauge(computeScore(r.criteria));

  const ICON = { "accepter": "🟢", "accepter avec prudence": "🟠", "éviter": "🔴" };
  if (r.recommendation) {
    const rec = text(`${ICON[r.recommendation] || "ℹ️"} Recommandation : ${r.recommendation}`);
    rec.style.fontWeight = "bold";
    box.appendChild(rec);
  }

  box.appendChild(text(r.summary || ""));

  // Liste de bullets : "Points clés", "Risques", "Points favorables"
  function addList(title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const h = text(title);
    h.style.cssText = "margin-top:8px;font-weight:bold";
    box.appendChild(h);
    const ul = document.createElement("ul");
    for (const it of items) {
      const li = document.createElement("li");
      li.textContent = typeof it === "string" ? it : it.title + (it.explanation ? " : " + it.explanation : "");
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }

  const SEV = { high: "🔴", medium: "🟠", low: "🟡" };
  addList("Points clés", r.key_points);
  addList("Risques", (r.risks || []).map(x => ({ title: `${SEV[x.severity] || "•"} ${x.title}`, explanation: x.explanation })));
  addList("Points favorables", r.favorable_points);

  if (r.truncated) {
    box.appendChild(text("(Texte très long : seule la première partie a été analysée.)"));
  }

  // JSON complet : à transmettre au calcul du T.O.U. Score et à l'affichage final
  const ta = document.createElement("textarea");
  ta.value = JSON.stringify(r, null, 2);
  ta.readOnly = true;
  ta.rows = 6;
  box.appendChild(ta);

  showAi(box);
}

// Envoie une demande au background (lien ou texte) et affiche le résultat.
// payload : { type: "ANALYZE_LINK", url }
async function runAnalysis(payload, btn, label) {
  btn.disabled = true;
  btn.textContent = "Analyse en cours…";
  setGauge(null);
  showAi(text("⏳ Analyse par l'IA (quelques secondes)…"));

  try {
    const response = await chrome.runtime.sendMessage(payload);
    if (!response?.ok) throw new Error(response?.error || "Erreur inconnue");
    renderAiResult(response);
  } catch (e) {
    showAi(text("⚠️ " + e.message), true);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function addAnalyzeButton(parent, url, label = "Analyser avec l'IA") {
  if (!url || !/^https?:\/\//i.test(url)) return; // pas de lien : rien à analyser
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.marginTop = "6px";
  btn.addEventListener("click", () => runAnalysis({ type: "ANALYZE_LINK", url }, btn, label));
  parent.appendChild(btn);
}

// =====================================================================

// ---------- Clé API : saisie dans le popup, stockée localement (jamais dans le code) ----------

const keyInput = document.getElementById("apikey");
chrome.storage.local.get("groqApiKey").then(({ groqApiKey }) => {
  if (groqApiKey) keyInput.value = groqApiKey;
});
keyInput.addEventListener("input", () => {
  chrome.storage.local.set({ groqApiKey: keyInput.value.trim() });
});

// ---------- Détection automatique des ToU à l'ouverture du popup ----------

async function detect() {
  aiDiv.style.display = "none"; // efface l'ancienne analyse
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Injecte detector.js dans la page ET dans toutes ses iframes
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["detector.js"]
    });

    // Un résultat par cadre (page principale + iframes) : on les regroupe
    const frames = injected.map(r => r.result).filter(Boolean);
    const checkboxes = frames.flatMap(f => f.checkboxes);
    const implicit = frames.flatMap(f => f.implicit);

    // Une acceptation = un lien (la même acceptation peut être vue par plusieurs cadres)
    const items = [];
    const seenLinks = new Set();
    for (const it of [...checkboxes, ...implicit]) {
      if (it.link) {
        if (seenLinks.has(it.link)) continue;
        seenLinks.add(it.link);
      }
      items.push(it);
    }

    if (items.length === 0) {
      const box = document.createElement("div");
      box.appendChild(text("Aucun ToU à accepter détecté."));

      // Diagnostic : ce que chaque cadre contient
      const diag = document.createElement("div");
      diag.style.cssText = "margin-top:8px;font-size:11px;opacity:.85";
      diag.appendChild(text(`Cadres analysés : ${frames.length}`));
      for (const f of frames) {
        const d = f.debug;
        diag.appendChild(text(
          `• ${f.page.slice(0, 55)} → liens ToU: ${d.termsLinks}, boutons: ${d.buttons}, cases: ${d.checkboxes}`
        ));
      }
      box.appendChild(diag);

      // Diagnostic détaillé à copier-coller pour comprendre pourquoi rien n'est détecté
      const report = JSON.stringify(frames.map(f => ({ page: f.page, debug: f.debug })), null, 1);
      const ta = document.createElement("textarea");
      ta.value = report;
      ta.readOnly = true;
      ta.rows = 5;
      ta.style.cssText = "width:100%;margin-top:8px;font-size:10px;box-sizing:border-box";
      const copy = document.createElement("button");
      copy.textContent = "Copier le diagnostic";
      copy.style.marginTop = "6px";
      copy.addEventListener("click", () => {
        ta.select();
        document.execCommand("copy");
        copy.textContent = "Copié";
      });
      box.appendChild(ta);
      box.appendChild(copy);

      show("no", box);
      return;
    }

    const box = document.createElement("div");
    const total = items.length;
    box.appendChild(text(`${total} acceptation${total > 1 ? "s" : ""} de ToU détectée${total > 1 ? "s" : ""}`));

    // Pour chaque acceptation : seulement le lien et le bouton d'analyse
    for (const it of items) {
      const item = document.createElement("div");
      item.style.marginTop = "8px";
      addLink(item, it.link);
      addAnalyzeButton(item, it.link); // MODULE IA
      box.appendChild(item);
    }

    show("yes", box);
  } catch (e) {
    // Ex: pages chrome://, Chrome Web Store, etc. où l'injection est interdite
    show("err", text("Impossible d'analyser cette page : " + e.message));
  }
}

detect();
