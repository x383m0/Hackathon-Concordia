// Ce fichier est injecté dans la page par popup.js.
// Il détecte deux façons d'accepter des ToU :
//   1. une case à cocher  ("J'accepte les conditions")
//   2. une acceptation implicite : une phrase avec un lien vers les termes
//      + un bouton ("Review our Terms... [Continue]", "En continuant, vous acceptez...")
// La valeur de la dernière expression est renvoyée au popup.
(() => {
  // ---------- Regex ----------

  // Le texte d'une case doit parler d'un document légal : termes, conditions, accord, contrat...
  // (?<!d['’])accord : évite "je suis d'accord" qui veut juste dire "I agree"
  const LEGAL = /(\bterms\b|\btermes\b|\btos\b|\bconditions?\b|\bagreement\b|\bcontrat\b|(?<!d['’])\baccord\b|\bcgu\b|\bcgv\b|\beula\b|\blicen[cs]e\b|mentions l[ée]gales|\bprivacy\b|confidentialit[ée]|vie priv[ée]e|donn[ée]es personnelles)/i;

  // ...ET demander d'accepter (ça exclut "Recevoir la newsletter", etc.)
  const AGREE = /(agree|accept|i have read|i['’]ve read|acknowledge|consent|j['’]accepte|j['’]ai lu|d['’]accord|accepte|consens)/i;

  // Phrase qui annonce que continuer = accepter (mode implicite), en anglais et en français
  const NOTICE = /(\b(review|read|agree|accept|acknowledge|consent)\b|by (continuing|clicking|signing|creating|registering|using|proceeding)|\b(lire|lisez|consulter|consultez|veuillez)\b|prendre connaissance|prenez connaissance|en (continuant|cliquant|vous inscrivant|cr[ée]ant|utilisant)|\baccepte(z|r)?\b|\bd['’]accord\b)/i;

  // Texte précis d'un lien vers les termes (pas juste le mot "terms" dans une phrase)
  const PHRASE = /(terms (of (use|service|sale)|(and|&|&amp;) conditions)|termes (et conditions|d['’ ]?utilisation|du service)|conditions (g[ée]n[ée]rales|d['’ ]?utilisation|de (service|vente))|mentions l[ée]gales|(subscriber|user|service|license|membership|customer) agreement|contrat d['’ ]?(abonnement|utilisation|service)|accord d['’ ]?(abonnement|utilisation|souscription|service)|accord de souscription|privacy (policy|notice|statement)|(data|personal data) (protection|privacy) (policy|notice)|(politique|avis|charte|d[ée]claration) (de |sur la |relative [àa] la )?(confidentialit[ée]|vie priv[ée]e|protection des donn[ée]es)|politique de protection des donn[ée]es)/i;
  const EXACT = /^(terms|tos|cgu|cgv|privacy|confidentialit[ée])$/i;

  // Un segment du chemin de l'URL (ex: /legal/terms-of-service, /subscriber_agreement)
  const SEGMENT = /^((consumer|commercial|website|site|legal|general|user)-terms|(subscriber|user|service|license|membership|customer)[-_]agreement|eula|terms|tos|cgu|cgv|termsofuse|termsofservice|terms-of-(use|service|sale)|terms-(and-)?conditions|conditions-g[ée]n[ée]rales|conditions-d-?utilisation|privacy([-_]?(policy|notice|statement))?|privacypolicy|politique-de-confidentialit[ée]|confidentialit[ée])(\.html?|\.php)?$/i;

  // Libellé d'un bouton qui valide / continue (anglais et français)
  const ACTION = /^(continue|continuer|accept|accepter|tout accepter|agree|i agree|j['’]accepte|sign up|sign in|log in|s['’]inscrire|se connecter|create( an)? account|cr[ée]er (un )?compte|register|join|next|suivant|submit|valider|confirm|confirmer|allow|autoriser|get started|commencer|ok|yes|oui)\b/i;

  const BUTTONS = 'button, input[type="submit"], input[type="button"], [role="button"]';

  // Limites du mode implicite
  const MAX_LEVELS = 10;   // combien de parents on remonte depuis le lien
  const NOTICE_MAX = 600;  // taille max (caractères) de la phrase d'acceptation
  const DIALOG_MAX = 1500; // taille max d'un bloc proche qui contient phrase + bouton
  const SCOPE_MAX = 2500;  // taille max du texte VISIBLE entre la phrase et le bouton éloigné

  // ---------- Outils ----------

  function clean(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  // Texte réellement visible (innerText ignore <script>, <style> et les éléments cachés,
  // contrairement à textContent qui compte aussi le code caché de la page)
  function visibleText(el) {
    return clean(el.innerText !== undefined ? el.innerText : el.textContent);
  }

  function isTermsUrl(href) {
    try {
      return new URL(href).pathname.split("/").some(s => SEGMENT.test(s));
    } catch {
      return false;
    }
  }

  function isTermsText(raw) {
    const t = clean(raw);
    return t.length > 0 && t.length <= 40 && (PHRASE.test(t) || EXACT.test(t));
  }

  function isTermsLink(a) {
    return (
      isTermsText(a.textContent) ||
      isTermsText(a.getAttribute("aria-label")) ||
      isTermsUrl(a.href)
    );
  }

  function buttonLabel(b) {
    return clean(b.textContent) || clean(b.getAttribute("value")) || clean(b.getAttribute("aria-label"));
  }

  // ---------- Mode 1 : cases à cocher ----------

  // Éléments qui peuvent contenir le texte d'une case à cocher
  function candidates(el) {
    const out = [];

    // <label for="..."> ou <label> qui entoure la case
    if (el.labels) out.push(...el.labels);

    // aria-labelledby
    const ids = el.getAttribute("aria-labelledby");
    if (ids) {
      ids.split(/\s+/).forEach(id => {
        const n = document.getElementById(id);
        if (n) out.push(n);
      });
    }

    // Parents proches (cases personnalisées sans <label>), max 3 niveaux
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      if (clean(p.textContent).length > 300) break; // trop gros = tout le formulaire
      out.push(p);
    }
    return out;
  }

  function analyze(el) {
    // Texte donné directement en aria-label
    const aria = clean(el.getAttribute("aria-label"));
    if (aria && LEGAL.test(aria) && AGREE.test(aria)) {
      return { label: aria, container: null };
    }

    for (const c of candidates(el)) {
      const t = clean(c.textContent);
      if (LEGAL.test(t) && AGREE.test(t)) return { label: t, container: c };
    }
    return null;
  }

  function findLink(container) {
    if (!container) return null;
    const a = [...container.querySelectorAll("a[href]")].find(
      x => LEGAL.test(clean(x.textContent)) || isTermsUrl(x.href)
    );
    return a ? a.href : null;
  }

  const boxes = [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')];

  const checkboxes = [];
  const usedContainers = [];
  for (const el of boxes) {
    const info = analyze(el);
    if (!info) continue;
    if (info.container) usedContainers.push(info.container);
    checkboxes.push({
      label: info.label.slice(0, 160),
      checked: el.checked === true || el.getAttribute("aria-checked") === "true",
      link: findLink(info.container)
    });
  }

  // ---------- Mode 2 : acceptation implicite (phrase + bouton) ----------

  // Boutons qui SUIVENT la phrase dans la page (même s'ils sont très loin dans le HTML).
  // Il faut un bouton "valider" (Continue, Sign up...) et que le texte visible entre
  // la phrase et ce bouton reste raisonnable (sinon c'est un bouton sans rapport).
  function buttonsAfter(notice) {
    const near = [...document.querySelectorAll(BUTTONS)]
      .filter(b => !notice.contains(b) && (notice.compareDocumentPosition(b) & 4)) // 4 = vient après
      .slice(0, 4);

    const main = near.find(b => ACTION.test(buttonLabel(b)));
    if (!main) return null;

    let common = notice.parentElement;
    while (common && !common.contains(main)) common = common.parentElement;
    if (!common || visibleText(common).length > SCOPE_MAX) return null;

    return near;
  }

  const implicit = [];
  const seen = new Set();

  for (const a of document.querySelectorAll("a[href]")) {
    if (!isTermsLink(a)) continue;

    // Déjà couvert par une case à cocher : on ne le compte pas deux fois
    if (usedContainers.some(c => c.contains(a))) continue;

    // On remonte depuis le lien pour trouver :
    //   notice  = la phrase qui annonce l'acceptation
    //   buttons = un bouton dans un bloc proche
    let notice = null;
    let buttons = null;
    let p = a.parentElement;
    for (let i = 0; i < MAX_LEVELS && p; i++, p = p.parentElement) {
      const t = visibleText(p);
      if (!notice && t.length <= NOTICE_MAX && NOTICE.test(t)) notice = p;
      if (t.length > DIALOG_MAX) break;
      // On veut un bloc qui contient un vrai bouton "valider" (I agree, Continue...),
      // pas seulement des boutons d'interface (menus déroulants, etc.)
      const found = [...p.querySelectorAll(BUTTONS)];
      if (found.some(b => ACTION.test(buttonLabel(b)))) { buttons = found; break; }
    }

    // Pas de bouton dans un bloc proche : on cherche un bouton plus loin, après la phrase
    if (notice && !buttons) buttons = buttonsAfter(notice);

    if (!notice || !buttons || seen.has(notice)) continue;
    seen.add(notice);

    implicit.push({
      label: visibleText(notice).slice(0, 160),
      // Libellés courts seulement (écarte "X" et les longs titres de menus déroulants)
      buttons: buttons.map(buttonLabel).filter(l => l && l.length > 1 && l.length <= 30).slice(0, 3),
      link: a.href
    });
  }

  // ---------- Diagnostic (pour comprendre pourquoi rien n'est détecté) ----------

  // Pour un lien : la liste de ses parents avec taille du texte visible, phrase d'acceptation ?, nb de boutons
  function chainInfo(a) {
    const out = [];
    let p = a.parentElement;
    for (let i = 0; i < 12 && p; i++, p = p.parentElement) {
      const t = visibleText(p);
      out.push({
        tag: p.tagName ? p.tagName.toLowerCase() : "",
        len: t.length,
        notice: NOTICE.test(t),
        buttons: p.querySelectorAll(BUTTONS).length
      });
    }
    return out;
  }

  // Pour une case : les textes trouvés autour d'elle et ce que les regex en pensent
  function boxInfo(el) {
    return {
      checked: el.checked === true || el.getAttribute("aria-checked") === "true",
      ariaLabel: clean(el.getAttribute("aria-label")).slice(0, 80),
      candidates: candidates(el).slice(0, 3).map(c => {
        const t = clean(c.textContent);
        return { text: t.slice(0, 140), legal: LEGAL.test(t), agree: AGREE.test(t) };
      })
    };
  }

  const termsLinks = [...document.querySelectorAll("a[href]")].filter(isTermsLink);

  return {
    found: checkboxes.length > 0 || implicit.length > 0,
    checkboxes: checkboxes,
    implicit: implicit,
    page: location.href,
    debug: {
      title: (document.title || "").slice(0, 60),
      termsLinks: termsLinks.length,
      buttons: document.querySelectorAll(BUTTONS).length,
      checkboxes: boxes.length,
      boxes: boxes.slice(0, 5).map(boxInfo),
      // éléments qui cachent leur contenu dans un "shadow DOM" (invisible pour querySelectorAll)
      shadowHosts: [...document.querySelectorAll("*")].filter(e => e.shadowRoot).length,
      buttonLabels: [...document.querySelectorAll(BUTTONS)].slice(0, 8).map(buttonLabel),
      links: termsLinks.slice(0, 5).map(a => ({
        text: clean(a.textContent).slice(0, 40),
        href: (a.href || "").slice(0, 80),
        chain: chainInfo(a)
      }))
    }
  };
})();
