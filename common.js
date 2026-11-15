// Code partagé par le popup et la page de réglages : textes anglais/français et thème clair/sombre.
const I18N = {
  en: {
    tagline: "Because nobody reads the terms",
    settings: "Settings",
    keyHint: "⚙ Add your Gemini API key",
    detecting: "Looking for terms…",
    noToU: "No ToU acceptance detected.",
    detected1: "1 ToU acceptance detected",
    detectedN: "{n} ToU acceptances detected",
    cannotAnalyze: "Cannot analyze this page: {msg}",
    details: "Details",
    copyDiag: "Copy diagnostic",
    copied: "Copied",
    btnAnalyze: "Analyze with AI",
    btnAnalyzing: "Analyzing…",
    btnReanalyze: "Re-analyze",
    btnShow: "Show result",
    btnRetry: "Retry",
    btnTranslate: "Analyze again in English",
    otherLang: "(This analysis is written in {lang}.)",
    stepStarting: "Starting…",
    stepOpening: "Opening the terms page…",
    stepReading: "Reading the page…",
    stepSending: "Sending {n} characters to Gemini…",
    stepAsking: "Asking {model}…",
    stepRetry: "Asking {model} again…",
    backgroundHint: "You can switch tabs: the analysis keeps running in the background.",
    gaugeGood: "Rather protective",
    gaugeMid: "Needs attention",
    gaugeBad: "Unfavorable to the user",
    notValid: "⚠️ This page does not look like terms of use or a privacy policy.",
    recommendation: "Recommendation",
    "rec.accept": "accept",
    "rec.accept with caution": "accept with caution",
    "rec.avoid": "avoid",
    risks: "Risks",
    favorable: "Favorable points",
    truncated: "(Very long text: only the first part was analyzed.)",
    cached: "(Saved result from an earlier analysis.)",
    errKey: "Your Gemini API key isn't valid. Get a free one at aistudio.google.com/apikey and paste it in Settings.",
    errNoKey: "Open Settings (⚙) and add your Gemini API key first (free at aistudio.google.com/apikey).",
    err429: "You've reached the free Gemini limit. Wait a minute, or try again tomorrow.",
    errBusy: "Gemini is busy or slow right now. Try again in a moment.",
    err404: "The AI model isn't available. Pick another one in Settings (⚙).",
    errLoad: "The terms page couldn't be loaded. Check your connection and try again.",
    errRead: "Couldn't read any text on that page. It may need a login or load its text with JavaScript.",
    errJson: "The AI answered in an unexpected format. Try again.",
    errStalled: "The analysis stopped unexpectedly. Try again.",
    optTitle: "FinePrint settings",
    keyLabel: "Gemini API key",
    show: "Show",
    hide: "Hide",
    keyHelp1: "Free at",
    keyHelp2: ". The key stays in this browser and is only sent to Google.",
    modelLabel: "Model",
    modelHelp: "Leave empty for the default (gemini-3.5-flash-lite: fast, about 500 free requests a day). Flash models are smarter but the free tier is limited to about 20 a day.",
    langLabel: "Language",
    langAuto: "Automatic (browser)",
    langHelp: "Also sets the language of the AI's analysis.",
    themeLabel: "Theme",
    themeAuto: "Automatic (system)",
    themeLight: "Light",
    themeDark: "Dark",
    clearCache: "Clear saved analyses",
    cacheN: "{n} analyses saved.",
    cache1: "1 analysis saved.",
    saved: "Saved ✓",
    cleared: "Saved analyses cleared ✓",
  },
  fr: {
    tagline: "Parce que personne ne lit les conditions",
    settings: "Réglages",
    keyHint: "⚙ Ajoutez votre clé API Gemini",
    detecting: "Recherche des conditions…",
    noToU: "Aucune acceptation de conditions détectée.",
    detected1: "1 acceptation de conditions détectée",
    detectedN: "{n} acceptations de conditions détectées",
    cannotAnalyze: "Impossible d'analyser cette page : {msg}",
    details: "Détails",
    copyDiag: "Copier le diagnostic",
    copied: "Copié",
    btnAnalyze: "Analyser avec l'IA",
    btnAnalyzing: "Analyse en cours…",
    btnReanalyze: "Réanalyser",
    btnShow: "Voir le résultat",
    btnRetry: "Réessayer",
    btnTranslate: "Analyser à nouveau en français",
    otherLang: "(Cette analyse est rédigée en {lang}.)",
    stepStarting: "Démarrage…",
    stepOpening: "Ouverture de la page des conditions…",
    stepReading: "Lecture de la page…",
    stepSending: "Envoi de {n} caractères à Gemini…",
    stepAsking: "Question à {model}…",
    stepRetry: "Nouvelle question à {model}…",
    backgroundHint: "Vous pouvez changer d'onglet : l'analyse continue en arrière-plan.",
    gaugeGood: "Plutôt protecteur",
    gaugeMid: "À surveiller",
    gaugeBad: "Défavorable à l'utilisateur",
    notValid: "⚠️ Cette page ne ressemble pas à des conditions d'utilisation ni à une politique de confidentialité.",
    recommendation: "Recommandation",
    "rec.accept": "accepter",
    "rec.accept with caution": "accepter avec prudence",
    "rec.avoid": "éviter",
    risks: "Risques",
    favorable: "Points favorables",
    truncated: "(Texte très long : seule la première partie a été analysée.)",
    cached: "(Résultat enregistré d'une analyse précédente.)",
    errKey: "Votre clé API Gemini n'est pas valide. Obtenez-en une gratuite sur aistudio.google.com/apikey et collez-la dans les Réglages.",
    errNoKey: "Ouvrez les Réglages (⚙) et ajoutez d'abord votre clé API Gemini (gratuite sur aistudio.google.com/apikey).",
    err429: "Vous avez atteint la limite gratuite de Gemini. Attendez une minute, ou réessayez demain.",
    errBusy: "Gemini est occupé ou lent en ce moment. Réessayez dans un instant.",
    err404: "Le modèle d'IA n'est pas disponible. Choisissez-en un autre dans les Réglages (⚙).",
    errLoad: "La page des conditions n'a pas pu être chargée. Vérifiez votre connexion et réessayez.",
    errRead: "Aucun texte n'a pu être lu sur cette page. Elle demande peut-être une connexion ou charge son texte avec JavaScript.",
    errJson: "L'IA a répondu dans un format inattendu. Réessayez.",
    errStalled: "L'analyse s'est arrêtée de façon inattendue. Réessayez.",
    optTitle: "Réglages de FinePrint",
    keyLabel: "Clé API Gemini",
    show: "Afficher",
    hide: "Masquer",
    keyHelp1: "Gratuite sur",
    keyHelp2: ". La clé reste dans ce navigateur et n'est envoyée qu'à Google.",
    modelLabel: "Modèle",
    modelHelp: "Laissez vide pour le modèle par défaut (gemini-3.5-flash-lite : rapide, environ 500 requêtes gratuites par jour). Les modèles Flash sont plus intelligents mais limités à environ 20 par jour en version gratuite.",
    langLabel: "Langue",
    langAuto: "Automatique (navigateur)",
    langHelp: "Définit aussi la langue de l'analyse de l'IA.",
    themeLabel: "Thème",
    themeAuto: "Automatique (système)",
    themeLight: "Clair",
    themeDark: "Sombre",
    clearCache: "Effacer les analyses enregistrées",
    cacheN: "{n} analyses enregistrées.",
    cache1: "1 analyse enregistrée.",
    saved: "Enregistré ✓",
    cleared: "Analyses enregistrées effacées ✓",
  },
};

let LANG = "en";
let THEME = "auto";

function t(key, vars = {}) {
  let s = I18N[LANG]?.[key] ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

function resolveLang(value) {
  if (value === "en" || value === "fr") return value;
  return (navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function translateDom() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll("[data-i18n-title]").forEach((e) => {
    e.title = t(e.dataset.i18nTitle);
    e.setAttribute("aria-label", t(e.dataset.i18nTitle));
  });
}

// Charge la langue et le thème enregistrés, les applique, puis rappelle onChange quand ils changent
async function initUi(onChange) {
  const stored = await chrome.storage.local.get(["lang", "theme"]);
  LANG = resolveLang(stored.lang);
  THEME = ["light", "dark"].includes(stored.theme) ? stored.theme : "auto";
  document.documentElement.dataset.theme = THEME;
  translateDom();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(changes.lang || changes.theme)) return;
    if (changes.lang) LANG = resolveLang(changes.lang.newValue);
    if (changes.theme) THEME = ["light", "dark"].includes(changes.theme.newValue) ? changes.theme.newValue : "auto";
    document.documentElement.dataset.theme = THEME;
    translateDom();
    onChange?.();
  });
}
