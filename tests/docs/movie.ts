/**
 * Records the README's demo movie (docs/images/demo.gif, plus a narrated MP4 that isn't committed)
 * with the shared Supertext movie kit (movie/movie-kit.mjs), against the stand-in HubSpot and
 * Supertext APIs (real translations of the sample account), like tests/docs/screenshots.ts.
 * See docs/DEVELOPER.md → Demo movie.
 *
 *   npm run docs:movie
 *
 * MOVIE_OUT: where the MP4 goes (default tests/docs/movie/out/HubSpot-Supertext-Translation.mp4, git-ignored).
 * MOVIE_PORT: the app's port (default 8797). Chromium: Playwright's own, or CHROME=/path.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator } from 'playwright';
import { MovieKit } from './movie/movie-kit.mjs';
import { startDemo } from './movie/env.js';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const mp4 = process.env.MOVIE_OUT ?? here('movie/out/HubSpot-Supertext-Translation.mp4');
const gif = here('../../docs/images/demo.gif');
const workDir = mkdtempSync(join(tmpdir(), 'hubspot-movie-'));

// The Supertext stand-in holds each status answer, so the waiting state is visible (the movie cuts it).
const appUrl = await startDemo({ statusDelayMs: 2500 });
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US' });
page.setDefaultTimeout(60_000);

// Set up (not recorded): connect through the stand-in's OAuth, a fake key, English → German and Swiss French.
await page.goto(appUrl);
await page.click('text=Connect HubSpot');
await page.waitForURL(`${appUrl}/settings`);
await page.fill('input[name="apiKey"]', 'st-demo-0000-0000-0000');
await page.selectOption('select[name="sourceLanguage"]', 'en');
for (const code of ['de', 'fr-ch']) await page.check(`#t-${code}`);
await page.click('form.settings button.primary');
await page.waitForSelector('.notice.success');
await page.goto(`${appUrl}/?kind=site-page`);
await page.locator('#translate-form').waitFor();
await page.waitForTimeout(800);

const scrollTo = async (locator: Locator, block: ScrollLogicalPosition = 'start') => {
  await locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'smooth' }), block);
  await page.waitForTimeout(900);
};

const kit = await MovieKit.start(page, { workDir, assets: here('movie/assets'), voiceCache: here('movie/voice') });

// 1. The page in English.
const row = page.locator('table.items tr').filter({ hasText: 'About us' });
await kit.say('Here are the website pages of a HubSpot account. The About us page is in English.', {
  caption: 'A page in English',
  during: () => kit.moveTo(row.locator('label')),
});

// 2. Pick it and the language.
await kit.say('In Translate with Supertext, pick the page.', {
  caption: '<b>Translate with Supertext</b>: pick the page',
  during: () => kit.click(page.locator('input[name="item"][value="101"]')),
});
await kit.say('Keep German ticked, and untick Swiss French for now.', {
  caption: 'Choose the language: <b>German</b>',
  during: async () => {
    await kit.click(page.locator('label.language').filter({ hasText: 'Swiss French' }));
    await kit.moveTo(page.locator('label.language').filter({ hasText: 'German' }).first());
  },
});

// 3. Translate.
const button = page.locator('#translate-button');
await kit.say('Then click Translate with Supertext.', {
  caption: 'Click <b>Translate into 1 language with Supertext</b>',
  during: () => kit.click(button),
});

// 4. Waiting.
await kit.say('Supertext translates the content.', {
  caption: 'Supertext translates the content…',
  during: async () => {
    await page.locator('.job .progress').waitFor();
    await scrollTo(page.locator('#job-panel'), 'center');
  },
});
kit.pause();
await page.waitForURL(/item=101/, { timeout: 60_000 });
await page.locator('.job .notice.success').waitFor();
await page.locator('.job').evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(600);
kit.resume();

// 5. The result: a German draft in HubSpot, linked to the English page.
await kit.say('A few seconds later, the German version is in HubSpot, as a draft linked to the English page.', {
  caption: 'Done: a <b>German draft</b> in HubSpot',
  during: () => kit.moveTo(page.locator('.job .results td.title').first()),
});
await kit.say('Open it in HubSpot, review it and publish it as usual.', {
  caption: 'Review the draft in HubSpot and publish it',
  during: () => kit.moveTo(page.locator('.job .results td.link a').first()),
});
await kit.say('The list shows the page as translated into German.', {
  caption: 'The page now has a German version',
  during: async () => {
    await scrollTo(page.locator('#translate-form'));
    await kit.moveTo(row.locator('.badge.done'));
  },
});
await kit.caption('');

await kit.finish(mp4, { system: 'HubSpot', repo: 'HubSpot-Supertext-Translation', gif });
await browser.close();
rmSync(workDir, { recursive: true, force: true });
console.log(`Saved ${mp4} and ${gif} (${(statSync(gif).size / 1e6).toFixed(2)} MB)`);
process.exit(0);
