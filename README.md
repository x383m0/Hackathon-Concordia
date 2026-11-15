# FinePrint
*Because nobody reads the terms.*

A Chrome extension built for **Hackathon Découverte Concordia 2026**.

FinePrint spots when a website asks you to accept its Terms of Service or Privacy Policy, reads the document for you, and tells you in plain language what you are agreeing to.

## How it works

1. Open the popup on a page with a sign-up form or a "by continuing you accept…" notice.
2. FinePrint detects the terms or privacy-policy link (checkbox or implicit acceptance, in English and French).
3. Click **Analyze with AI**. The linked document is opened in a hidden tab, its text is read, and Gemini summarizes it.
4. You get a recommendation, a list of risks and favorable points (each with the exact quote from the terms when available), and a 0–100 score on the gauge.

## Install

1. Clone or download this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
4. Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Click **⚙ Settings** in the popup (or right-click the extension icon → Options) and paste it there. You can also choose the Gemini model and clear saved analyses.

## Files

| File | Role |
|---|---|
| `manifest.json` | Extension manifest (Manifest V3) |
| `extension.html` / `extension.css` / `extension.js` | Popup UI, gauge and score calculation |
| `options.html` / `options.css` / `options.js` | Settings page (API key, model, cache) |
| `detector.js` | Injected in the page to find terms acceptances |
| `background.js` | Opens the terms page, reads it, calls Gemini (default `gemini-3.5-flash-lite`) |

## Permissions

- `activeTab` + `scripting`: read the page you have open and the terms page the link leads to.
- `storage`: keep your API key and recent analyses in your browser.
- Access to all sites (`<all_urls>`): needed to open and read the terms page, which can be on any site. Fine for personal use; for a public release it should be narrowed.

Results are cached for 7 days (up to 50 documents) so repeat analyses are instant.

## Tests

```bash
npm install
npx playwright install chromium   # if Chromium isn't installed yet
npm test
```

The tests load small fixture pages (`tests/fixtures/`) and check what `detector.js` finds.

## Privacy

- Your API key is stored only in your browser (`chrome.storage.local`), never in the code.
- The text of the terms you analyze is sent to Google's Gemini API. Nothing else from the page is sent. On the free tier, Google may use submitted content to improve its products.

## Presentation

[Slides](https://docs.google.com/presentation/d/113rWbCeLpDQ16BDayJHOl-AymdDe-8NRU9l6fvCi4Xo/edit?usp=sharing)
