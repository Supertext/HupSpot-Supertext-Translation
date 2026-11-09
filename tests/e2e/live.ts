/**
 * End-to-end test against the REAL Supertext API. There is no HubSpot account in CI, so the
 * app talks to the stand-in HubSpot (tests/standin/hubspot.ts with the sample account of
 * seed.ts, in this process) and to the real Supertext API (SUPERTEXT_API_KEY on the app,
 * never typed into the page). Version reports are off.
 *
 * Through the app's own pages, like an editor: connect HubSpot (the stand-in's OAuth),
 * choose English → Swiss German, French and Italian (de-CH, fr-CH, it-CH) in the settings,
 * test the connection, then translate the sample website page, landing page, blog post,
 * marketing email and knowledge base article on the Translate page. Then the language
 * versions the stand-in HubSpot received are checked: one per item and language, drafts
 * (never published or sent), every text the app translates filled and mostly changed, HubL,
 * links and formatting kept, nothing of the protocol left, really in the target language
 * (de-CH without "ß"), originals untouched. Translating again with "Update existing
 * versions" updates the same drafts in place. See "End-to-end tests" in docs/DEVELOPER.md.
 *
 *   SUPERTEXT_API_KEY=… npx tsx tests/e2e/live.ts
 *
 * Which texts count is decided by the app's own extraction (src/hubspot/content.ts), so the
 * test follows its field rules; what the translation does with them is checked here.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { extractItem, type Item, type Kind } from '../../src/hubspot/content.js';
import { HUBL } from '../../src/hubspot/rich-text.js';
import { MemoryStore } from '../../src/store/store.js';
import { createHubSpotStandin } from '../standin/hubspot.js';
import { createSupertextStandin } from '../standin/supertext.js';

const key = process.env.E2E_STANDIN === '1' ? 'stand-in' : (process.env.SUPERTEXT_API_KEY ?? '');
if (!key.trim()) {
  console.log('::error::SUPERTEXT_API_KEY is not set');
  process.exit(1);
}
const artifacts = new URL('./artifacts/', import.meta.url).pathname;
mkdirSync(artifacts, { recursive: true });

/** HubSpot language → the Supertext code the settings must map it to. */
const TARGETS: Record<string, string> = { 'de-ch': 'de-CH', 'fr-ch': 'fr-CH', 'it-ch': 'it-CH' };
const LANG: Record<string, string> = { 'de-ch': 'de', 'fr-ch': 'fr', 'it-ch': 'it' };

/** The sample items; the blog only has German and French variants (HubSpot refuses others). */
const ITEMS: { kind: Kind; id: string; languages: string[] }[] = [
  { kind: 'site-page', id: '101', languages: ['de-ch', 'fr-ch', 'it-ch'] },
  { kind: 'landing-page', id: '201', languages: ['de-ch', 'fr-ch', 'it-ch'] },
  { kind: 'blog-post', id: '301', languages: ['de-ch', 'fr-ch'] },
  { kind: 'email', id: '401', languages: ['de-ch', 'fr-ch', 'it-ch'] },
  { kind: 'kb-article', id: '501', languages: ['de-ch', 'fr-ch', 'it-ch'] },
];

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ''): boolean {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}
const note = (text: string) => console.log(`note ${text}`);

// Common words, to tell the languages apart. Lower case, whole words.
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'are', 'with', 'for', 'you', 'your', 'our', 'of', 'to', 'we', 'who', 'what', 'this', 'from', 'in', 'on', 'since', 'us'],
  de: ['der', 'die', 'das', 'und', 'ist', 'sind', 'mit', 'für', 'sie', 'ihre', 'ihr', 'unser', 'unsere', 'wir', 'eine', 'ein', 'den', 'zu', 'von', 'was', 'diese', 'im', 'am', 'seit', 'uns', 'in'],
  fr: ['le', 'la', 'les', 'et', 'est', 'sont', 'avec', 'pour', 'vous', 'votre', 'vos', 'notre', 'nos', 'nous', 'des', 'une', 'un', 'du', 'de', 'qui', 'que', 'ce', 'dans', 'depuis', 'à'],
  it: ['il', 'lo', 'la', 'gli', 'le', 'e', 'è', 'sono', 'con', 'per', 'lei', 'sua', 'suo', 'nostro', 'nostra', 'nostri', 'noi', 'una', 'un', 'del', 'della', 'di', 'che', 'chi', 'questa', 'nel', 'dal', 'a'],
};
const words = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];
const score = (text: string, lang: string) => words(text).filter((w) => STOPWORDS[lang].includes(w)).length;
const LEFTOVERS = ['data-st-id', 'data-hs=', 'data-st-ph', 'st-ph-'];
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
const sorted = (list: string[]) => [...list].sort().join(' ');
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(HUBL, ' ').replace(/\s+/g, ' ').trim();

/** The texts the app translates in an item, by key (its own extraction). */
function texts(kind: Kind, item: Item): Map<string, string> {
  const { extraction } = extractItem(kind, item);
  const map = new Map<string, string>();
  extraction.keys.forEach((k, i) => {
    const segment = extraction.segments[i];
    // Restore the HubL placeholders, so the text is compared as the editor sees it.
    let n = 0;
    map.set(k, segment.html.replace(/<span data-hs="\d+"><\/span>/g, () => segment.tags[n++] ?? ''));
  });
  return map;
}

// --- Stand-in HubSpot (and, for the Supertext stand-in's /report, nothing live) -------------
const listen = (fetch: (request: Request) => Response | Promise<Response>, port = 0) =>
  new Promise<string>((resolve) => {
    const server = serve({ fetch, port, hostname: '127.0.0.1' }, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });
const hubspot = createHubSpotStandin();
const reports = createSupertextStandin();
const hubspotUrl = await listen((request) => hubspot.handle(request));
const reportsUrl = await listen((request) => reports.handle(request));
const sources = new Map(ITEMS.map(({ kind, id }) => [id, structuredClone(hubspot.draft(id)!)]));
for (const { kind, id } of ITEMS) check(`sample ${kind} ${id} exists`, Boolean(sources.get(id)) && texts(kind, sources.get(id)!).size > 0);

const port = Number(process.env.E2E_PORT || 8791);
const appUrl = `http://127.0.0.1:${port}`;
const app = createApp({
  config: loadConfig({
    APP_URL: appUrl,
    HUBSPOT_CLIENT_ID: 'e2e',
    HUBSPOT_CLIENT_SECRET: 'e2e-secret',
    HUBSPOT_APP_BASE: hubspotUrl,
    HUBSPOT_API_BASE: hubspotUrl,
    SUPERTEXT_API_KEY: key,
    // The live API (SUPERTEXT_API_ENDPOINT unset). Reports off, and if anything reported, the stand-in gets it.
    SUPERTEXT_VERSION_REPORTS: '0',
    SUPERTEXT_REPORT_URL: `${reportsUrl}/report`,
    // Only to try changes to this test without a key: E2E_STANDIN=1 translates with the stand-in.
    ...(process.env.E2E_STANDIN === '1' ? { SUPERTEXT_API_ENDPOINT: `${reportsUrl}/v1/` } : {}),
  }),
  store: new MemoryStore(),
});
app.use('/static/*', serveStatic({ root: new URL('../../public/', import.meta.url).pathname, rewriteRequestPath: (path) => path.replace(/^\/static/, '') }));
await listen(app.fetch, port);

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, locale: 'en-US' });
page.setDefaultTimeout(30_000);

// --- Connect HubSpot (the stand-in approves at once) and save the settings -----------------
await page.goto(`${appUrl}/?lang=en`);
await Promise.all([page.waitForURL(`${appUrl}/settings`), page.click('text=Connect HubSpot')]);
check('connected to HubSpot (stand-in OAuth)', page.url() === `${appUrl}/settings`, page.url());
check('settings: no API key typed in (the server\'s is used)', (await page.locator('input[name="apiKey"]').inputValue()) === '');
await page.selectOption('select[name="sourceLanguage"]', 'en');
for (const [code, supertext] of Object.entries(TARGETS)) {
  await page.check(`#t-${code}`);
  const preselected = await page.inputValue(`select[name="code:${code}"]`);
  check(`settings: ${code} preselects ${supertext}`, preselected === supertext, preselected);
  if (preselected !== supertext) {
    await page.locator(`select[name="code:${code}"]`).evaluate((select, value) => {
      (select as HTMLSelectElement).value = value;
    }, supertext);
  }
}
await page.click('button.primary');
await page.waitForSelector('.notice.success');
const settingsWarnings = await page.locator('.notice.warning, .notice.error').allTextContents();
check('settings saved without warnings or errors', settingsWarnings.length === 0, settingsWarnings.map((s) => s.replace(/\s+/g, ' ').trim()).join(' | '));
await page.click('#test-button');
await page.waitForSelector('#test-result.ok, #test-result.failed', { timeout: 60_000 });
check('settings: Test connection against the real API', (await page.locator('#test-result.ok').count()) === 1, (await page.locator('#test-result').textContent())?.trim());
await page.screenshot({ path: `${artifacts}settings.png`, fullPage: true });

// --- Translating on the Translate page ------------------------------------------------------
async function translate(label: string, kind: Kind, id: string, languages: string[], overwrite: boolean, expect: string): Promise<void> {
  const tag = `${label}: ${kind} ${id}`;
  await page.goto(`${appUrl}/?kind=${kind}&lang=en`);
  await page.locator('#translate-form').waitFor();
  await page.check(`input[name="item"][value="${id}"]`);
  for (const code of Object.keys(TARGETS)) {
    const box = page.locator(`input[name="language"][value="${code}"]`);
    if (!check(`${tag}: ${code} offered`, (await box.count()) === 1)) continue;
    if (languages.includes(code)) await box.check();
    else await box.uncheck();
  }
  if (overwrite) await page.check('#overwrite');
  else await page.uncheck('#overwrite');
  const started = Date.now();
  await page.click('#translate-button');
  // The page polls the job and reloads with ?item=… when it has finished.
  await page.waitForURL(new RegExp(`item=${id}`), { timeout: 20 * 60_000 });
  await page.locator('.job').waitFor();
  await page.screenshot({ path: `${artifacts}${label}-${kind}-${id}.png`, fullPage: true });
  console.log(`${tag}: ${Math.round((Date.now() - started) / 1000)} s`);
  const summary = ((await page.locator('.job .notice').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
  check(`${tag}: ${expect}`, summary === expect, summary);
  const errors = [
    ...(await page.locator('main .notice.error').allTextContents()),
    ...(await page.locator('.job .result.failed').allTextContents()),
  ].map((e) => e.replace(/\s+/g, ' ').trim());
  check(`${tag}: no error shown`, errors.length === 0, errors.join(' | '));
}

/** The language versions of an item: variants of its group, or (emails) its clones. */
function versions(kind: Kind, id: string): Map<string, Item[]> {
  const all = hubspot.items(kind).filter((item) => !item.archived && item.id !== id);
  const mine = all.filter((item) =>
    kind === 'email' ? String(item.clonedFrom) === id : String(item.translatedFromId ?? item.translationOfId ?? '') === id,
  );
  const out = new Map<string, Item[]>();
  for (const item of mine) {
    const lang = String(item.language ?? '').toLowerCase();
    out.set(lang, [...(out.get(lang) ?? []), item]);
  }
  return out;
}

/** Checks one language version against its source. */
function checkVersion(tag: string, kind: Kind, source: Item, version: Item, lang: string): void {
  check(`${tag}: a draft, not published or sent`, version.state === 'DRAFT' && !version.currentlyPublished && !version.isPublished, String(version.state));
  const before = texts(kind, source);
  const after = texts(kind, version);
  if (!check(`${tag}: the same texts`, sorted([...after.keys()]) === sorted([...before.keys()]), `${after.size}/${before.size}`)) return;
  let changed = 0;
  let all = '';
  for (const [k, s] of before) {
    const t = after.get(k) ?? '';
    if (!check(`${tag}: ${k} filled`, plain(t) !== '', plain(s).slice(0, 40))) continue;
    if (plain(t) !== plain(s)) changed++;
    else note(`${tag}: ${k} "${plain(s).slice(0, 60)}" unchanged`);
    all += ` ${plain(t)}`;
    const left = LEFTOVERS.filter((l) => t.includes(l));
    if (left.length) check(`${tag}: ${k} has no protocol leftovers`, false, left.join(', '));
    if ((s.match(HUBL) ?? []).length) check(`${tag}: ${k} keeps its HubL`, sorted(t.match(HUBL) ?? []) === sorted(s.match(HUBL) ?? []));
    if (hrefs(s).length) check(`${tag}: ${k} keeps its links`, sorted(hrefs(t)) === sorted(hrefs(s)));
    for (const [what, needle] of [['bold', '<strong'], ['italics', '<em'], ['list items', '<li']]) {
      if (count(s, needle)) check(`${tag}: ${k} keeps its ${what}`, count(t, needle) === count(s, needle), `${count(t, needle)}/${count(s, needle)}`);
    }
  }
  check(`${tag}: texts were changed by the translation`, before.size > 0 && changed / before.size >= 0.8, `${changed}/${before.size} texts`);
  const scores = Object.fromEntries(Object.keys(STOPWORDS).map((l) => [l, score(all, l)]));
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  check(`${tag}: text is in the target language`, best === LANG[lang], JSON.stringify(scores));
  if (lang === 'de-ch') check(`${tag}: Swiss German spelling (no "ß")`, !all.includes('ß'));
}

// --- First translation: every item into its languages ----------------------------------------
for (const { kind, id, languages } of ITEMS) {
  await translate('first-run', kind, id, languages, false, `Done: ${languages.length} created, 0 updated, 0 kept, 0 failed.`);
}
const firstIds = new Map<string, string>();
for (const { kind, id, languages } of ITEMS) {
  const source = sources.get(id)!;
  check(`${kind} ${id}: original unchanged`, JSON.stringify(texts(kind, hubspot.draft(id)!)) === JSON.stringify(texts(kind, source)));
  const found = versions(kind, id);
  for (const lang of languages) {
    const tag = `${kind} ${id} → ${TARGETS[lang]}`;
    const list = found.get(lang) ?? [];
    if (!check(`${tag}: exactly one language version`, list.length === 1, String(list.length))) continue;
    firstIds.set(`${id}:${lang}`, list[0].id);
    checkVersion(tag, kind, source, list[0], lang);
  }
}

// --- Again with "Update existing versions": the same drafts, updated in place ------------------
const again = ITEMS[0];
const countBefore = hubspot.items(again.kind).length;
await translate('second-run', again.kind, again.id, again.languages, true, `Done: 0 created, ${again.languages.length} updated, 0 kept, 0 failed.`);
check('updating makes no new items', hubspot.items(again.kind).length === countBefore, `${countBefore} → ${hubspot.items(again.kind).length}`);
const updated = versions(again.kind, again.id);
for (const lang of again.languages) {
  const tag = `updated ${again.kind} ${again.id} → ${TARGETS[lang]}`;
  const list = updated.get(lang) ?? [];
  if (check(`${tag}: same draft updated in place`, list.length === 1 && list[0].id === firstIds.get(`${again.id}:${lang}`))) {
    checkVersion(tag, again.kind, sources.get(again.id)!, list[0], lang);
  }
}

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll end-to-end checks passed.');
process.exit(0);
