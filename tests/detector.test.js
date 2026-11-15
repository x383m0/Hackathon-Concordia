// Tests de detector.js : on charge de petites pages dans un vrai Chromium et on lit ce que le détecteur trouve.
// Lancer avec : npm test   (nécessite : npm install)
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const detector = fs.readFileSync(path.join(__dirname, "..", "detector.js"), "utf8");
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function detect(fixture) {
  const page = await browser.newPage();
  await page.setContent(fs.readFileSync(path.join(__dirname, "fixtures", fixture), "utf8"));
  const result = await page.evaluate(detector);
  await page.close();
  return result;
}

test("detects a terms checkbox and its link", async () => {
  const r = await detect("checkbox.html");
  assert.strictEqual(r.checkboxes.length, 1);
  assert.strictEqual(r.checkboxes[0].link, "https://example.com/legal/terms-of-service");
  assert.strictEqual(r.checkboxes[0].checked, false);
});

test("detects a French terms checkbox", async () => {
  const r = await detect("checkbox-fr.html");
  assert.strictEqual(r.checkboxes.length, 1);
  assert.strictEqual(r.checkboxes[0].link, "https://example.com/cgu");
});

test("detects implicit acceptance next to a button", async () => {
  const r = await detect("implicit.html");
  assert.ok(r.implicit.length >= 1, "expected at least one implicit acceptance");
  assert.ok(r.implicit.some((i) => i.buttons.includes("Continue")));
  assert.ok(r.implicit.some((i) => /terms-of-use/.test(i.link)));
});

test("ignores a newsletter checkbox", async () => {
  const r = await detect("newsletter.html");
  assert.strictEqual(r.checkboxes.length, 0);
  assert.strictEqual(r.implicit.length, 0);
});

test("ignores \"je suis d'accord\" without a legal document", async () => {
  const r = await detect("dagreement.html");
  assert.strictEqual(r.checkboxes.length, 0);
});

test("finds nothing on a page without terms", async () => {
  const r = await detect("plain.html");
  assert.strictEqual(r.checkboxes.length + r.implicit.length, 0);
});
