# Working on this repository

Part of Supertext's translation plugins project: Supertext AI translation for the top open source CMS, PIM, shop and email systems. Each system has its own repo named `Supertext/<System>-Supertext-Translation`.

This repo is a **hosted HubSpot app**: a Node.js/TypeScript service (Hono, server-rendered pages) that users install in HubSpot with OAuth. It makes draft language versions of website pages, landing pages, blog posts (HubSpot language variants), marketing emails (one copy per language) and knowledge base articles (beta API) through HubSpot's content APIs, started on the app's *Translate* page. Hosted on Railway. The HubSpot app definition is `hubspot-project/`. See `docs/DEVELOPER.md`.

## Documentation rule (always)

Every plugin repo keeps three guides, and **every change that affects behaviour, settings, installation or the code structure updates them in the same commit**:

| File | Audience | Must cover |
| --- | --- | --- |
| `docs/INSTALLATION.md` | Administrators | Requirements, install/update/uninstall, API key, language setup, all settings, troubleshooting |
| `docs/USER_GUIDE.md` | Editors | How to translate and review in the CMS's own UI, what is and isn't translated, what errors mean |
| `docs/DEVELOPER.md` | Developers | Architecture, Supertext API protocol, local setup, tests, CI/deploy, releasing, known limitations/roadmap |

Also: `README.md` stays a short overview linking the three guides, and `CHANGELOG.md` gets an entry under *Unreleased* for every user-visible change. Before finishing any task, check the docs still match the code.

## Supertext account and API key links (always)

Everywhere an administrator enters or is told about the API key — the settings field's help text, the "no API key" / "authentication failed" messages, `docs/INSTALLATION.md`, `README.md` and `.env.example` — show both links (same as the WordPress plugin):

- Create a Supertext account (or log in): https://www.supertext.com/person/en/account/signin
- Generate the AI API key: https://www.supertext.com/en/integrations/api (supertext.com → Integrations → API; requires the **Admin** role)

Wording: "No Supertext account yet? Create one at supertext.com. Generate your API key at supertext.com → Integrations → API (requires the Admin role)." In the UI, links open in a new tab (`target="_blank" rel="noopener"`).

## UI languages (always)

The app's pages are in English, German, French and Italian. HubSpot doesn't pass a language, so the app follows the browser's `Accept-Language`, unless *Settings → Interface language* chose one for that browser (cookie `st_locale`; the connect page has the same choice as links, `?lang=`). HubSpot only tells UI extensions inside HubSpot the user's language, not outside pages. Strings live in `src/i18n/{en,de,fr,it}.ts` (typed: a missing key fails `npm run typecheck`; `tests/i18n.test.ts` checks placeholders, URLs, "Supertext" and "HubSpot"). **New or changed strings get all four languages in the same commit.** Formal address (Sie, vous, Lei), HubSpot's own terms in each language, "Supertext", placeholders and URLs never translated. Errors shown in the UI are `LocalizedError`s with a `code` (`error.<code>`).

## Plugin version on the settings screen (always)

The settings page shows the version from `package.json` (read at runtime by `src/version.ts`, never a second copy) and links it to the GitHub release.

## Plugin list (always)

`README.md` ends with the shared list of all Supertext plugins (between the `<!-- supertext-plugins:start -->` and `<!-- supertext-plugins:end -->` markers). It is identical in every Supertext plugin repo: when a plugin is added, renamed or its description changes, update the list in **all** repos and on the org profile, not just this one. HubSpot is listed under *CMS* without *In development*: it was tested on a real HubSpot account on 17 October 2026.

## Releases (always)

Releases are published by `.github/workflows/release.yml`: never tag or create a GitHub release by hand. To release, follow `docs/DEVELOPER.md` → *Releasing* (new version section in `CHANGELOG.md`, same number in `package.json`) and push to `main`. A push without a new version releases nothing. A hosted app has no installable file: Railway deploys the code.

## Repo setup (always)

`LICENSE` (MIT, as `package.json` declares), `SECURITY.md`, `.github/dependabot.yml` (npm and GitHub Actions, weekly, minor and patch grouped), `.github/workflows/checks.yml` (actionlint + zizmor on every push and PR, dependency review on PRs) and `.github/workflows/links.yml` (lychee weekly and on docs changes; broken links open the issue "Broken links in the docs", exclusions in `.lycheeignore`). Third-party actions are pinned to commit SHAs; checkouts use `persist-credentials: false`; workflows default to `permissions: contents: read`. On GitHub: About box, ruleset "Protect main", Wiki and Projects off, Dependabot alerts, private vulnerability reporting, secret scanning with push protection and CodeQL default setup on, social preview image. Claude sessions can't change GitHub repo settings (HTTP 403): the repo is in Remy's setup script (`set-github-about`) and the social preview cards in the project docs.

## Checks and alerts (always)

Before starting work in this repo, look at its open findings and fix what the task touches or what is quick: code scanning alerts (`gh api 'repos/Supertext/HubSpot-Supertext-Translation/code-scanning/alerts?state=open'`), secret scanning alerts (`…/secret-scanning/alerts?state=open`), open Dependabot PRs and the issue "Broken links in the docs". New workflows and workflow changes must pass actionlint and zizmor. See `docs/DEVELOPER.md` → *Code quality and security checks*.

## Demo accounts rule (always)

The demo is a HubSpot account set up by hand (see `docs/DEVELOPER.md` → *Demo*): HubSpot users are invited by hand, so the `DEMO_*` accounts are HubSpot users (Super Admin for Supertext staff, a content/marketing editor for tests and screenshots). Values never go in the repo, in chat or in logs.

## Screenshots rule (always)

The user guide and installation guide include screenshots, taken by `npm run docs:screenshots` (Playwright, `tests/docs/screenshots.ts`) against the stand-in HubSpot and Supertext APIs, which return real translations of the sample account (`tests/standin/samples.json`), stored in `docs/images/` at 1× scale with alt text, and regenerated in the same commit whenever the UI they show changes. The README's demo movie: `npm run docs:movie` (`tests/docs/movie.ts`, shared kit in `tests/docs/movie/`); the install and configuration movie: `npm run docs:movie:install` (`tests/docs/movie-install.ts`, same kit, MP4 only). Screenshots of HubSpot's own screens (language settings, a variant in the editor) are added from the demo account once it exists. No secrets, no customer data, no local URLs.

## Shared Supertext protocol

AI file translation API v1, same as the WordPress plugin: POST HTML file → poll status → GET translation → DELETE. Details in `docs/DEVELOPER.md`. Never commit API keys or the HubSpot client secret; use environment variables or the app's settings (stored encrypted).

Lessons from the live API, apply them here: header `Authorization: Supertext-Auth-Key <key>` (strip a pasted prefix), retry HTTP 429, keep a whole paragraph in one `data-st-id` element with formatting as inline tags (`src/hubspot/rich-text.ts`: one segment per text block), and **languages:** only the codes Supertext's `GET features` lists (the SDK's `Languages`): bare sources; targets regional only for de/en/fr/it/pt, script for zh/sr, bare for the rest. **Defaults only where obvious:** the account's mapping (`Account.languageCodes`, the *Supertext code* dropdown under Settings → Languages, preselected with `Languages.suggestTarget`), else an exact match of the HubSpot code (`de-ch` → `de-CH`), else the SDK default (`de` → `de-DE`, `en` → `en-US`, `zh-cn` → `zh-Hans`, `es-mx` → `es` …), else the error `unsupported_language` (nothing sent; `fr-be`, `en-au`, `no` need a mapping). See `docs/DEVELOPER.md` → *Language codes*.

**Commando Center:** version reports and the automatic API key check go through Supertext Plugin Health's `InstallationReporter` with the SDK's `checkApiKey()` in `src/reporting.ts` (one installation per HubSpot account, site URL `https://app.hubspot.com/settings/<hub id>`, state in `Account.reporter`, written only by `Store.saveReporterState`). A hosted app: no ping endpoint, no callback URL. Tests set `SUPERTEXT_REPORT_URL` to the stand-in.

## This repo

- Before committing: `npm run typecheck`, `npm test`, `npm run build`, `bash scripts/smoke.sh`.
- All Supertext API calls go through the Supertext SDK (`vendor/supertext-sdk`, `supertext-sdk/v1`) wrapped by `src/supertext/client.ts`; version reports through Supertext Plugin Health (`vendor/supertext-plugin-health`). Never edit `vendor/`: run `scripts/vendor-sdk.sh` / `scripts/vendor-plugin-health.sh <tag>`.
- HubL (`{{ … }}`, `{% … %}`) must survive every translation: it travels as `<span data-hs="N">` placeholders and a segment that loses or doubles one is refused. Keep that check, and keep checking every segment before anything is written to HubSpot.
- Nothing is ever published or sent: the app only writes drafts.
- Changes to HubSpot calls go through `src/hubspot/` and the stand-in (`tests/standin/hubspot.ts`) together. Check real HubSpot behaviour with `npm run hubspot:probe` before relying on it.
- Tokens are written only by `Store.saveTokens`; access tokens are refreshed by `TokenManager`.
- Translation review: the checkbox per language under Settings → Languages (`Account.reviewLanguages`) picks `SupertextClient.forReview()` (base URL `SUPERTEXT_REVIEW_URL`, default `REVIEW_URL` in `src/config.ts`); key check, reports and file export/import never use it.
- New settings go in `src/store/store.ts` (`Account`), `src/views/settings.tsx`, the form handler in `src/app.ts` **and** the settings table in `docs/INSTALLATION.md`.
- Every page and API call needs the session cookie; POSTs also the CSRF token (`src/auth/session.ts`).
- The app definition (`hubspot-project/`) is uploaded by `.github/workflows/hubspot-app.yml` (by hand or when it changes on `main`); never change scopes or redirect URLs in HubSpot's UI only.
- Hosting: Railway service *HubSpot* in *supertext-cms-demos* (https://hubspot-production-ac4d.up.railway.app), building the `Dockerfile`, health check `/health`, its own database `hubspot_supertext` on the shared Postgres, one instance. Don't export-ignore anything the Dockerfile copies.
