/**
 * Records the install and configuration movie (a narrated MP4 that isn't committed) with the shared
 * Supertext movie kit (movie/movie-kit.mjs), against the stand-in HubSpot and Supertext APIs like
 * tests/docs/screenshots.ts: the connect page, then Settings (a fake API key, the language mapping,
 * Save, Test connection) and where editors translate. A hosted app has no install commands; HubSpot's
 * own consent screen isn't shown (the stand-in approves at once), the narration sums it up.
 * See docs/DEVELOPER.md → Demo movie.
 *
 *   npm run docs:movie:install
 *
 * MOVIE_OUT: where the MP4 goes (default tests/docs/movie/out/HubSpot-Supertext-Translation-install.mp4, git-ignored).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator } from 'playwright';
import { MovieKit } from './movie/movie-kit.mjs';
import { startDemo } from './movie/env.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const mp4 = process.env.MOVIE_OUT ?? here('movie/out/HubSpot-Supertext-Translation-install.mp4');
const workDir = mkdtempSync(join(tmpdir(), 'hubspot-install-movie-'));

const appUrl = await startDemo();
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });
page.setDefaultTimeout(60_000);
await page.goto(appUrl);
await page.locator('.connect').waitFor();
await page.waitForTimeout(800);

const scrollTo = async (locator: Locator, block: ScrollLogicalPosition = 'start') => {
  await locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'smooth' }), block);
  await page.waitForTimeout(900);
};

const kit = await MovieKit.start(page, { workDir, assets: here('movie/assets'), voiceCache: here('movie/voice') });

// 1. Connect (the app is hosted: nothing to install).
const connect = page.getByRole('link', { name: 'Connect HubSpot' });
await kit.say('Supertext for HubSpot is a hosted app: there is nothing to install. Open the app and click Connect HubSpot.', {
  caption: 'Open the app and click <b>Connect HubSpot</b>',
  during: async () => {
    await kit.hold(1200);
    await kit.moveTo(connect);
  },
});
// The consent step happens at HubSpot (the stand-in approves at once): not recorded.
kit.pause();
await connect.click();
await page.waitForURL(`${appUrl}/settings`);
await page.waitForTimeout(800);
kit.resume();
await kit.say('Sign in to HubSpot and allow Supertext to read your content and create language versions. The app then opens its settings.', {
  caption: 'Allow access in HubSpot: the app opens its <b>Settings</b>',
});

// 2. The API key.
const key = page.locator('input[name="apiKey"]');
await kit.say('Paste your Supertext API key.', {
  caption: 'Paste your <b>Supertext API key</b>',
  during: () => kit.type(key, 'st-demo-0000-0000-0000'),
});
await kit.say('Generate it at supertext.com, Integrations, API. No account yet? Create one at supertext.com.', {
  caption: 'Generate your API key at <b>supertext.com → Integrations → API</b>. No account yet? Create one at supertext.com.',
  during: () => kit.moveTo(page.locator('.card').first().locator('a').last()),
});

// 3. Languages: the source, a target and its Supertext code.
const source = page.locator('select[name="sourceLanguage"]');
await kit.say('Under Languages, choose the language your content is written in: English.', {
  caption: '<b>Languages</b>: your content is in <b>English</b>',
  during: async () => {
    await scrollTo(page.locator('h2').filter({ hasText: 'Languages' }));
    await kit.moveTo(source);
    await source.selectOption('en');
    await page.waitForTimeout(500);
  },
});
const deRow = page.locator('#targets tr:has(#t-de)');
await kit.say('Then tick the languages to translate into. Tick German.', {
  caption: '<b>Translate into</b>: tick <b>German</b>',
  during: async () => {
    await scrollTo(deRow, 'center');
    await kit.click(page.locator('#t-de'));
  },
});
const combo = deRow.locator('.combo-input');
await kit.say('Each language gets a Supertext code. For German, the app suggests German, Germany. Search the list to pick another.', {
  caption: '<b>Supertext code</b>: German → <b>German (Germany) (de-DE)</b>',
  during: async () => {
    await kit.click(combo);
    await combo.pressSequentially('germ', { delay: 90 });
    await page.waitForSelector('#targets tr:has(#t-de) .combo-list:not([hidden])');
    await page.waitForTimeout(900);
    await kit.moveTo(deRow.locator('.combo-list').getByText('German (Germany)').first());
    await combo.fill('germany');
    await combo.press('Enter');
  },
});
if ((await page.inputValue('select[name="code:de"]')) !== 'de-DE') throw new Error('the dropdown did not choose de-DE');
await kit.say('Translation review can be ticked for each language. Leave it off for now.', {
  caption: '<b>Translation review</b>: optional, per language',
  during: () => kit.moveTo(deRow.locator('input[name="review"]')),
});

// 4. Save, then test the key.
const save = page.locator('form.settings button.primary');
await kit.say('Click Save.', {
  caption: 'Click <b>Save</b>',
  during: async () => {
    await scrollTo(save, 'center');
    await kit.click(save);
    await page.locator('.notice.success').waitFor();
  },
});
await kit.say('Click Test connection. The API key works.', {
  caption: '<b>Test connection</b>: the API key works',
  during: async () => {
    await kit.click(page.locator('#test-button'));
    await page.waitForSelector('#test-result.ok');
    await kit.moveTo(page.locator('#test-result'));
  },
});
await kit.say('German is now at the top of the list, with its code.', {
  caption: 'German → <b>de-DE</b> is saved',
  during: async () => {
    await scrollTo(page.locator('#targets'), 'start');
    await kit.moveTo(page.locator('#targets tr:has(#t-de) label').first());
  },
});

// 5. Where editors translate.
await kit.say('Done. Editors now translate pages, posts, emails and articles under Translate.', {
  caption: 'Editors translate under <b>Translate</b>',
  during: async () => {
    await kit.click(page.locator('nav.tabs a').filter({ hasText: 'Translate' }).first());
    await page.locator('#translate-form').waitFor();
    await kit.moveTo(page.locator('#translate-button'));
  },
});
await kit.caption('');

await kit.finish(mp4, { system: 'HubSpot', repo: 'HubSpot-Supertext-Translation', kind: 'install' });
await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${mp4}`);
process.exit(0);
