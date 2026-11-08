# Developer guide — Supertext Translation for HubSpot

A hosted app: a Node.js/TypeScript service (Hono, server-rendered pages) that users install in their HubSpot account with OAuth 2. It reads website pages, landing pages, blog posts, marketing emails and knowledge base articles through HubSpot's content APIs, translates them with the Supertext AI file translation API and writes each language as a draft language version. Hosted on Railway. HubSpot has no extension point in its content editors, so the app has its own *Translate* page; the HubSpot app definition (`hubspot-project/`) only declares OAuth.

## Repository layout

```
src/
  server.ts               entry: database, static files, HTTP server
  app.ts                  routes (Hono): start/translate page, OAuth, settings, API for the page's script, health
  config.ts               environment variables
  version.ts              version from package.json, release link
  auth/session.ts         signed session cookies, CSRF tokens, OAuth state
  hubspot/
    client.ts             OAuth (install URL, code exchange, refresh, introspection); HTTP client with 401 refresh and 429 retries
    tokens.ts             TokenManager: keeps access tokens fresh, one refresh per account at a time, forgets revoked tokens
    content.ts            the five kinds: endpoints (list, read, draft, language version, remove), states, translations, editor links, what is translated
    extract.ts            Extraction: segments of an item and writing the translations back; the module (widget) walker
    rich-text.ts          HTML ↔ segments: one per paragraph, HubL placeholders, alt/title attributes
  translation/
    translate.ts          one item × one language: segments → Supertext (or `produce`: an imported file) → version draft
    files.ts              translation files: export (XLIFF/HTML) and import with the SDK's TranslationFiles, reference format
    jobs.ts               a job: one item × languages, progress, error handling
    languages.ts          HubSpot language codes, Supertext mapping, names
  supertext/
    client.ts             the app's layer over the Supertext SDK: one client per account (forReview(): the review service client for languages with Translation review), SDK error codes → app errors
  store/
    store.ts              Store interface, in-memory store, AES-GCM for tokens and keys
    postgres.ts           PostgreSQL store (creates its database and tables)
  reporting.ts            Commando Center glue (Supertext Plugin Health)
  i18n/                   en, de, fr, it messages; translator; LocalizedError
  views/                  server-rendered pages (hono/jsx): connect, translate (with Export for translation), import, job panel and history, settings
public/                   app.js (selection, start, polling, test connection), app.css (Supertext's look, see Look and feel), supertext-logo.svg, favicon.svg, fonts/ (Inter, SIL Open Font License); linked as /static/app.css?v=<content hash> (views/layout.tsx), cached for a year, pages never cached
hubspot-project/          the HubSpot app definition (developer platform 2026.09): OAuth, scopes, redirect URLs
scripts/probe.ts          look at a real account (read-only)
scripts/smoke.sh          the built app against the stand-ins (CI)
scripts/vendor-sdk.sh     updates vendor/supertext-sdk
scripts/vendor-plugin-health.sh  updates vendor/supertext-plugin-health
vendor/supertext-sdk/     the Supertext SDK (TypeScript, built), the app's `supertext-sdk` dependency
vendor/supertext-plugin-health/  Supertext Plugin Health (TypeScript, built), the app's `supertext-plugin-health` dependency
tests/                    Vitest tests; standin/ (HubSpot and Supertext stand-ins, sample account); docs/screenshots.ts, docs/movie*.ts (movies, kit in docs/movie/)
```

## How it fits into HubSpot

- **App definition:** `hubspot-project/` is a HubSpot developer project (`hsproject.json`, platform version 2026.09) with one app, `src/app/app-hsmeta.json`: `auth.type: oauth`, the redirect URLs (the Railway URL and `http://localhost:8080` for development), `requiredScopes` `oauth` + `content`, `optionalScopes` for the knowledge base, distribution `marketplace` (installable from its install URL before it is listed). The *Upload HubSpot app* workflow uploads it (see *Registering the app in HubSpot*); the client ID and secret are then on the app's *Auth* tab. The scopes in the install URL (`HUBSPOT_SCOPES`, `HUBSPOT_OPTIONAL_SCOPES`) must match the file.
- **OAuth 2** (authorization code): `/oauth/start` redirects to `https://app.hubspot.com/oauth/authorize` (`client_id`, `redirect_uri=APP_URL/oauth/callback`, `scope`, `optional_scope`, `state`); the callback exchanges the code at `POST https://api.hubapi.com/oauth/2026-09/token` and reads the account from `POST /oauth/2026-09/token/introspect` (`hub_id` = the account's key in the database, `hub_domain` shown in the app, `scopes`: the knowledge base is offered only with `cms.knowledge_base.articles.write`). The user's e-mail address isn't stored. The `state` is a random value in a signed, short-lived cookie.
- **Tokens:** access tokens live 30 minutes. `TokenManager` refreshes one that is due within a minute before the request (`grant_type=refresh_token`), and `HubSpotClient` forces one refresh after a 401 and repeats the request. Refreshes of the same account share one request. A refused refresh token (`invalid_grant` / `BAD_REFRESH_TOKEN`: the app was uninstalled) clears the tokens; the account has to connect again. Tokens are written only by `Store.saveTokens()`, so a settings save never puts back an older token.
- **Sessions:** a signed cookie (HMAC-SHA256, 30 days) with the account ID; the tokens stay in the database (encrypted). Form posts and API calls carry a CSRF token derived from the session cookie. Pages refuse framing (`frame-ancestors 'none'`).
- **API calls:** `https://api.hubapi.com/…` with `Authorization: Bearer <token>`. HTTP 429 (HubSpot's per-10-seconds limit) is retried up to 4 times like Supertext's (`Retry-After`, else 1/2/4/8 s). Errors become `HubSpotError`s with codes the UI translates (`hubspotAuth`, `hubspotForbidden`, `hubspotNotFound`, `hubspotRateLimited`, `hubspotUnavailable`, `hubspotHttp` …); HubSpot's own `message` is shown untranslated.

## HubSpot APIs

HubSpot's date-based versions: `2026-09` (the current GA version) for OAuth, pages, blog posts and emails; the knowledge base API is only in beta (`2027-03-beta`, Service Hub Professional+). Constants `API_VERSION` and `KB_API_VERSION` in `src/hubspot/client.ts`.

| Kind | List / read | Draft | New language version | Remove (clean-up) |
| --- | --- | --- | --- | --- |
| Website pages | `GET /cms/pages/2026-09/site-pages`, `…/{id}` | `GET`/`PATCH …/{id}/draft` | `POST …/site-pages/multi-language/create-language-variation` (`id`, `language`, `primaryLanguage` if the page has none) | `DELETE …/{id}` (archives) |
| Landing pages | `…/landing-pages` | same | same | same |
| Blog posts | `GET /cms/blogs/2026-09/posts`, `…/{id}` | `GET`/`PATCH …/{id}/draft` | `POST …/posts/multi-language/create-language-variation` (`id`, `language`) | `DELETE …/{id}` |
| Marketing emails | `GET /marketing/emails/2026-09`, `…/{id}` | `GET`/`PATCH …/{id}/draft` | `POST …/clone` (`id`, `cloneName`, `language`) | `DELETE …/{id}` |
| Knowledge base | `GET /cms/knowledge-base/2027-03-beta/articles`, `…/{id}` | `GET`/`PATCH …/{id}/draft` | `POST …/articles` with `language`, `translationOfId`, the content, `path`, `tagIds` | `PATCH …/{id}` `{archived: true}` (deletes) |

Lists: `limit=25&sort=-updatedAt&archived=false`, cursor `paging.next.after`. Language versions (`ContentSummary.translations`): HubSpot's `translations` of the item (a map keyed by language for pages and posts; a list for articles, both read), without the item itself; items with `translatedFromId` / `translationOfId` are versions and aren't listed. Email copies are recorded by the app (`translations` table) since HubSpot doesn't link them.

## How a translation runs

1. **Start:** `POST /api/jobs` with `kind`, `itemId` and languages (only languages of the settings). One job per item runs at a time.
2. **Checks** (`jobs.ts`): the item exists, isn't a language version itself or an email copy the app made (`isTranslation`), and has a language (pages, posts: the item's, else *Language of your content*; else `noSourceLanguage`).
3. **Segments** (`content.ts` → `extractItem`, `extract.ts`, `rich-text.ts`), from the item's **draft**:
   - pages: `name`, `htmlTitle`, `metaDescription`, `featuredImageAltText`; posts also `postBody`, `postSummary` (HTML); emails: `subject`, `content.widgets`/`widgetContainers`, `content.plainTextVersion` (one segment per line), `webversion.title`/`metaDescription`; articles: `title`, `subtitle`, `metaDescription`, `body` (HTML);
   - module data (`widgets`, `widgetContainers`, `layoutSections`) is walked: a string is text only under a text field's name (`TEXT_KEY`: `html`, `text`, `title`, `heading`, `button_text`, `alt`, `caption`, … and names ending in `_text`, `_title`, `_heading`, `_html`, `_description`, `_alt` …; the preview text's `value`); keys such as `name`, `label`, `type`, `path`, `src`, `href`, `url`, `css`, `styles`, `form_id` are never walked into; addresses, colours and file names are left alone. HTML fields are split by paragraph;
   - HTML: a *text block* is the innermost element with letters and no block-level element inside (p, h1–h6, li, td, div …); its inner HTML is one segment, so a whole paragraph with its `<b>`, `<a href>` travels as one `data-st-id` (the shared rule). Loose text between blocks and `alt`/`title` attributes are plain segments. `style`, `script`, `code`, `pre` and anything with `translate="no"` or class `notranslate` are left alone.
4. **HubL** (`{{ … }}`, `{% … %}`, `{# … #}`) in text becomes empty `<span data-hs="N"></span>` placeholders (numbered per segment) and is put back after translation. If a segment comes back with a placeholder missing or doubled, nothing is written for that language (`hublTags`). HubL in attributes isn't touched.
5. **Supertext** (through the SDK's `translateTexts`): all segments of the language as HTML fragments, packed into one document (several above 900,000 characters); source = the item's language as a bare Supertext source, target = the language's Supertext code, `politeness` from the form of address. If a segment doesn't come back, nothing is written (`incomplete`). Every segment is checked before anything is written to HubSpot.
6. **Version:** an existing version (HubSpot's `translations`; for emails the app's record, if the copy still exists and is a draft) gets its draft updated with *Update existing versions* (ticked by default on the Translate page; the API's `overwrite` is false unless sent), or is kept when it is unticked. Otherwise a new one is made **before** translating (`create-language-variation` or `clone`), so a version HubSpot refuses (a blog without that language: HubSpot's 400 *Blog does not have a variation for language fr-ch* becomes `blogLanguageMissing`) costs no Supertext translation. Then the segments are translated and checked, and the version's draft is written with `PATCH …/draft` (the whole module objects and, for emails, the whole `content` object, so styles and layout stay). If translating or writing fails, the new version is removed again (archived). Articles are created with their content in one call, after translating. Nothing is published.
7. **Errors:** Supertext authentication and limit, HubSpot authentication/permission and item problems stop the job; anything else (e.g. a blog without the language's variant, `INVALID_LANGUAGE_PAIR`) fails only that language. Jobs still running when the app restarts are marked *interrupted* on the next start.

## Translation files (export and import)

*Export for translation* (a section of the Translate page, `POST /api/export`, JSON body like `/api/jobs` plus `format`, answered with the file) and *Import translation* (its own page, `GET`/`POST /import`, multipart with `csrf`, `file`, `includeChanged`, `overwrite`) use the SDK's `TranslationFiles` (SDK 0.5.0, imported from `supertext-sdk`, not `supertext-sdk/v1`: it doesn't call the API). The glue is `src/translation/files.ts`:

- **Segments:** the item's extraction (`extractItem`), now with a stable `key` per unit (`Extraction.keys`): the field path (`htmlTitle`, `widgets.rich_text.body.html.0` for the first text of an HTML field, `content.plainTextVersion.3` for a line, `layoutSections.dnd_area.rows.0.0.params.html.0`, `webversion.title`); a repeated path gets `~2`. Every segment goes into the file as HTML (`html: true`), so the HubL placeholders `<span data-hs="N"></span>` become protected inline codes in XLIFF.
- **Job metadata:** `plugin` = `HubSpot-Supertext-Translation`; `sourceLanguage` = the item's language as a Supertext source, `targetLanguage` = the language's Supertext code (`resolvedTarget`), else the HubSpot code, so a language without a Supertext code can still be exported.
- **Reference format:** `<HubSpot account ID>:<kind>:<item ID>:<language>` (HubSpot code), each part URI-encoded, e.g. `48210377:site-page:101:de-ch` (`formatReference`/`parseReference`). A file from another account is *not found*.
- **Export:** `prepareItem` (the same checks as a job: exists, not a language version, has a language), XLIFF = one job per language, HTML = exactly one; file name `hubspot-<item ID>[-<language>].xlf|.html`.
- **Import:** the body is read with a 10 MB limit (`Content-Length` and while reading; nothing is stored), `TranslationFiles.read`, then per job: `plugin` must be ours (`fileOtherSystem`), the reference must parse and name this account (`fileNotFound`), the language must be one of the settings' targets (`fileNoLanguage`), `prepareItem` loads the item (`itemMissing` → `fileNotFound`). `importTranslations` with the item's current segments; `ok` results (and `source_changed` with *Also import …*) are checked with `segmentResult` (HubL placeholders exactly once, else counted as invalid). With nothing to import nothing is written. Otherwise `existingVersion` decides as in a job (kept without *Update existing versions*), and `translateItem` runs with `produce` instead of Supertext: imported texts, else the existing version's own segment at the same key (if its HubL matches), else the original, so the version is made, written and removed on failure exactly as for an API translation, and recorded with `saveTranslation`.
- The result per job: `state` (`created`/`updated`/`kept`), `targetId`, the counts, or an `error` (`ErrorInfo`), rendered by `views/import.tsx`.

## Interface languages

English, German, French and Italian. HubSpot doesn't pass the user's language to outside pages (only to UI extensions inside HubSpot), so the app follows the browser's `Accept-Language`, unless *Settings → Interface language* chose one: that choice is per browser, not per account (cookie `st_locale`, a year; *Automatic* deletes it), so colleagues sharing an account each keep their own. The connect page offers the four languages as links (`?lang=`, which sets the same cookie). If the browser asks for none of the four, the pages are in English. Strings live in `src/i18n/{en,de,fr,it}.ts`; `en.ts` defines the keys and the others are typed `Messages`, so a missing key fails `npm run typecheck`, and `tests/i18n.test.ts` checks keys, placeholders, URLs, "Supertext" and "HubSpot". **Every new or changed string gets all four languages in the same commit**, formal address (Sie, vous, Lei) and HubSpot's own terms (Website-Seiten, Landingpages, Blogbeiträge, Marketing-E-Mails, Wissensdatenbank; pages de destination, e-mails marketing, base de connaissances; landing page, e-mail di marketing, knowledge base), French narrow no-break space before `? ! : ;`. Language names come from `Intl.DisplayNames`. Errors are `LocalizedError`s (English message for logs, `code` → `error.<code>`).

## Look and feel

The pages follow supertext.com: the deep-green header bar (`#003230`, rounded bottom corners) with Supertext's mint logo (`public/supertext-logo.svg`, the website's own SVG), the warm off-white background (`#f7f5f3`), deep-green text and outlines, mint (`#78ffaf`) for the main action, the active tab and finished translations, light grey lines (`#dfe1df`), and pill-shaped buttons and filters. Text is set in Inter, bundled in `public/fonts/` (variable font, Latin and Latin Extended; SIL Open Font License in `Inter-LICENSE.txt`), so no font is loaded from elsewhere. Supertext's heading font (ABC Ginto Nord) is licensed and not bundled; headings use Inter Bold. The colours are CSS variables at the top of `public/app.css`. The favicon is the logo's S mark on deep green.

## Supertext API protocol

AI file translation API v1 at `https://api.supertext.com/v1/` (upload an HTML file, poll its status, download the translation, delete the file), handled entirely by the Supertext SDK: the `Supertext-Auth-Key` header (a pasted prefix is stripped), the multipart upload with a file part of type exactly `text/html`, HTTP 429 retries, polling every 2 s with a 3-minute timeout, the delete after every upload, the HTML packing (one `<div data-st-id="N">` per segment) and the language codes. See the SDK's [integration guide](https://github.com/Supertext/Supertext-API-SDK-and-Guide/blob/main/docs/integration-guide.md) and [API reference](https://github.com/Supertext/Supertext-API-SDK-and-Guide/blob/main/docs/api-reference.md).

`src/supertext/client.ts` creates one SDK client per account with the key and the base URL (`SUPERTEXT_API_ENDPOINT` for stand-ins), sends `HubSpot-Supertext-Translation/<version>` in the User-Agent, and turns the SDK's error codes into the app's (`authentication_failure` → `auth`, `quota_exceeded` → `limitExceeded`, `invalid_language_pair` → `languagePair`, `unsupported_language` → `unsupportedLanguage`, `unsupported_feature` → `unsupportedFeature`, `transport_error` → `unreachable`, `incomplete_response` → `incomplete` …). *Test connection* and the automatic key check are the SDK's cost-free `checkApiKey()` (`GET features`). The key is the account's own (Settings, AES-256-GCM encrypted with `APP_ENCRYPTION_KEY`, else a key derived from `HUBSPOT_CLIENT_SECRET`), else `SUPERTEXT_API_KEY`.

**Translation review** (`Account.reviewLanguages`, HubSpot codes, the checkbox per language under Settings → Languages; stored in the account's JSON, so existing accounts start with `[]` and need no migration): `jobs.ts` takes `supertext.forReview(account.reviewLanguages.includes(language))` for each language, a second SDK client with the same key, timeouts, fetch and User-Agent whose base URL is `SUPERTEXT_REVIEW_URL` (`Config.reviewUrl`, default `REVIEW_URL` in `src/config.ts`, the translation proxy of [Supertext Localization Review](https://github.com/Supertext/Localization-Review-Supertext-Translation)), created on first use. `translateSegments` uploads, polls, downloads and deletes with the same client, so a job is always collected where it was submitted. The proxy speaks the same API v1, forwards to the live Supertext API with the account's key, stores every segment per key and serves reviewers' corrections on the next upload, so nothing else changes in the app. `SUPERTEXT_REVIEW_URL=` (empty, or the same URL as the API) means `forReview()` always returns the direct client, and the settings page hides the column (saving then keeps the stored choice). The key check, *Test connection*, reports and file export/import never use the review service.

## Supertext SDK

All Supertext calls go through the [Supertext SDK](https://github.com/Supertext/Supertext-API-SDK-and-Guide) (`sdk/typescript`, npm name `supertext-sdk`, imported as `supertext-sdk/v1`), wrapped by `src/supertext/client.ts`. It isn't on npm yet, so it is a file dependency (`"supertext-sdk": "file:vendor/supertext-sdk"`): `vendor/supertext-sdk/` holds its built JavaScript and type declarations, a lean `package.json`, `LICENSE`, `COMMIT` (the SDK commit), `VERSION` and a `README.md` (SDK 0.5.0, commit `a47ca07`). The Docker image copies `vendor/` before `npm ci`. Never edit it: fix the SDK repository and copy it again:

```bash
scripts/vendor-sdk.sh                  # latest main of the SDK repository
scripts/vendor-sdk.sh <commit-or-branch>
SDK_DIR=/path/to/clone scripts/vendor-sdk.sh   # a local clone as it is
```

then `npm install`, run the tests and commit `vendor/`, `package-lock.json` and any app changes with a CHANGELOG entry. Same layout and script as the other npm plugins (e.g. Mailchimp, Directus).

## Supertext Plugin Health

[Supertext Plugin Health](https://github.com/Supertext/Commando-Center-Supertext-Translation/tree/main/plugin-health) (npm name `supertext-plugin-health`, 0.1.0, tag `plugin-health-v0.1.0`) sends the version reports and the API key check result to the Supertext Commando Center (`InstallationReporter`, `reportsEnabled()`; its ping answer isn't used, the app is hosted). `src/reporting.ts` passes it `SDK_VERSION` and a key checker built on the SDK. Like the SDK it is a file dependency from `vendor/supertext-plugin-health/`. Never edit it: fix it in Commando-Center-Supertext-Translation/plugin-health and copy it again:

```bash
scripts/vendor-plugin-health.sh <tag>                          # e.g. plugin-health-v0.1.0 (default: main)
PLUGIN_HEALTH_DIR=/path/to/clone scripts/vendor-plugin-health.sh   # a local clone as it is
```

## Language codes

Supertext accepts only the codes its `GET features` lists (the SDK's `Languages`): sources are bare (`en`); targets are regional only for de/en/fr/it/pt (`de-CH`, `en-US`, `pt-BR`), script for zh/sr (`zh-Hans`, `sr-Latn`), `gsw-u-sd-chzh`/`chbe`, and bare for everything else (`es`, `nl`, `nb`, `sl`). Anything else is HTTP 404 `INVALID_LANGUAGE_PAIR`.

**Defaults only where obvious (SDK 0.4.0).** HubSpot's content languages are lower-case codes, bare or regional (`LANGUAGE_CODES` in `src/translation/languages.ts`: `de`, `de-ch`, `fr-ca`, `zh-tw` …). Each account has its own **language mapping**, `Account.languageCodes` (HubSpot code → Supertext code), chosen per language on the settings page (*Supertext code*, a `<select data-combobox>` that `public/app.js` turns into a searchable combo box (ARIA combobox; the select stays in the form and is used as it is without script) of `Languages.targetOptions()` named with `Intl.DisplayNames` as *Name (code)*, the same language's codes first (`suggestedTargets`)). The dropdown preselects the saved code, else `Languages.suggestTarget(code)` (`suggestedTarget`: exact match, else the SDK default), else an empty *— choose —*; saving stores the code of every dropdown, accepted only if `Languages.matchTarget` finds it (in its exact form). There is no environment or config override: it is a hosted app with per-account settings. Codes saved before 0.4.0 stay as they are. One mapping serves both directions:

- **Target** (`supertextTarget` = `Languages.target(code, mapping)`): the mapping, else an exact match of the HubSpot code (`de-ch` → `de-CH`, `es`; case and `_`/`-` ignored), else the SDK default (`de` → `de-DE`, `en` → `en-US`, `fr` → `fr-FR`, `it` → `it-IT`, `pt` → `pt-PT`, `zh-cn`/`zh-hk` → `zh-Hans`/`zh-Hant`, `zh-tw` → `zh-Hant`, `sr` → `sr-Latn`, `es-mx` → `es`, `nl-be` → `nl`), else the SDK error `unsupported_language`. The job then fails that language with `unsupportedLanguage` and sends nothing for it; the other languages go on. `en-au`, `en-ca`, `fr-be`, `fr-ca` and `no` need a mapping; the settings page and the Translate page flag only those (`resolvedTarget` is null).
- **Source** (`supertextSource` = `Languages.source(code, mapping)`): the item's language (else the account's content language) through the mapping in its source form, else its bare language (`de-ch` → `de`, `en-us` → `en`), else `unsupported_language` (the whole job fails, nothing sent).
- **Politeness:** sent only where `Languages.supportsPoliteness(target)` is true; elsewhere nothing is sent.
- The HubSpot code itself (not the Supertext code) is what the language version gets in HubSpot.

The stand-in (`tests/standin/supertext.ts`) accepts only `Languages.TARGETS` (else 404 `INVALID_LANGUAGE_PAIR`) and refuses politeness where the target has none, like the live API.

## Commando Center

Version reports, the automatic API key check and the key status go to the Supertext Commando Center ([Commando-Center-Supertext-Translation](https://github.com/Supertext/Commando-Center-Supertext-Translation) → `docs/DEVELOPER.md` → *Report protocol*) through Plugin Health's `InstallationReporter` with the SDK's `checkApiKey()`. `src/reporting.ts` is the glue:

- **One installation per connected HubSpot account.** Site URL `https://app.hubspot.com/settings/<account ID>` (`siteUrl()`: an account may host several websites or none; the hub ID is stable and not personal), plugin `HubSpot-Supertext-Translation` with the version from `package.json`, system `HubSpot` without a version, runtime Node.js and `SDK_VERSION`. A hosted app: **no ping endpoint and no `callbackUrl`**.
- **State:** Plugin Health's `ReporterState` JSON in `Account.reporter` (the `data` JSONB of `accounts`). Only `Store.saveReporterState()` writes it; `saveAccount()` keeps the stored one. Calls are serialized per account.
- **When:** `afterSettingsSaved` after `POST /settings` (awaited; the result is shown under the API key with the center's messages, `keyCheck.*`); `onRequest` in the background on `GET /`, `GET /settings` and `POST /api/jobs`; `authenticationFailed` when a translation gets 401/403; `testConnection` on *Test connection* with the saved key (a typed, unsaved key is only checked).
- **Setting:** `Account.versionReports` (*Send version information to Supertext*, on by default), combined with `SUPERTEXT_VERSION_REPORTS` (`0` turns it off for every account and disables the checkbox). Off: nothing is sent; the key check still runs.
- **Never breaks anything:** `Reporting.run()` catches everything; reports time out after 3 s and wait an hour after a failure. The key is never logged or sent.
- **Tests never reach the live center:** `SUPERTEXT_REPORT_URL` points at the stand-in in `tests/helpers.ts`, `scripts/smoke.sh` and the screenshot script.

## Local development

Requirements: Node.js 22.12+. No HubSpot account needed for most work: the stand-ins answer like HubSpot (install page, OAuth and the content APIs above) and Supertext for a sample account (`tests/standin/seed.ts`: a Swiss chocolate shop with two website pages — one without a language —, a landing page with a personalization token and a form, a blog post whose blog has German and French (Switzerland) variants but no Italian one, a draft and a sent marketing email, and a knowledge base article; `samples.json` holds human translations of their texts into German, French and Italian).

```bash
npm install
npm run standin            # stand-in HubSpot :8766, stand-in Supertext :8765
HUBSPOT_CLIENT_ID=standin HUBSPOT_CLIENT_SECRET=standin-secret \
HUBSPOT_APP_BASE=http://127.0.0.1:8766 HUBSPOT_API_BASE=http://127.0.0.1:8766 \
SUPERTEXT_API_ENDPOINT=http://127.0.0.1:8765/v1/ SUPERTEXT_API_KEY=any npm run dev
# open http://127.0.0.1:8080 and click Connect HubSpot (the stand-in approves at once)
```

Without `DATABASE_URL`, everything lives in memory. Against real HubSpot you need the uploaded app (above) with `http://localhost:8080/oauth/callback` among its redirect URLs, and `APP_URL=http://localhost:8080`.

### Looking at a real account

```bash
HUBSPOT_TOKEN=<token> npm run hubspot:probe                  # a few items of each kind, languages, versions
HUBSPOT_TOKEN=<token> npm run hubspot:probe -- site-page <id>   # the segments the app would send for that item
```

Read-only: nothing is written to HubSpot or sent to Supertext. A legacy private app token with the `content` scope (plus the knowledge base scopes) works, as does an OAuth access token.

## Tests

```bash
npm test             # Vitest: rich text and HubL, module walker, HubSpot items, sessions, the app's SDK layer, languages, reporting, i18n, full flow
npm run typecheck
npm run build
bash scripts/smoke.sh   # after build: the built app against the stand-ins
```

The protocol itself (multipart, retries, polling, packing, language codes, error mapping) is tested in the SDK repository against its shared test vectors. `tests/supertext.test.ts` covers the app's layer: error mapping, User-Agent, and `forReview` (all four calls to the review URL with the same key and User-Agent, one review client, none without a review URL or with the API's own URL).

`tests/files.test.ts` covers translation files through the app against the stand-ins: the reference format; export (keys, mapped languages, HubL as codes, HTML with one language, no Supertext call); import (a new variant written as a draft, HubL lost → not imported, existing versions kept or updated with their own text where nothing is imported, `source_changed` only with the option, other system, other account, unknown item, missing language, unreadable and too large files, session and CSRF). `scripts/smoke.sh` also exports the landing page as XLIFF and imports it.

`tests/flow.test.ts` runs the whole app (`createApp`) against the stand-ins with an in-memory store: OAuth and scopes, every kind (variants with modules, layout sections and HubL, primary language, blog without the language's variant, email copies and a sent copy, article translations, the knowledge base without its scopes), kept and updated versions, unmapped languages, Translation review (a ticked language goes to the review service for all four calls while the others go directly; an empty `SUPERTEXT_REVIEW_URL` turns it off; the default is Supertext's review service), token refresh and a revoked refresh token, disconnecting, the Commando Center events.

## Screenshots

```bash
npm run docs:screenshots   # Playwright, 1× scale, into docs/images/
```

`tests/docs/screenshots.ts` starts the stand-ins (the Supertext stand-in also as the review service, so nothing reaches the live one) and the app in-process, connects through the stand-in's OAuth and captures the app's pages (connect, settings, translate page, results, list afterwards, update warning, email results, German UI, the export section, the import form and its summary: the landing page exported as HTML, filled with the sample German and imported). It also checks that every page fits a 390 px phone screen and fails if one is wider. Editor links point at app.hubspot.com, never at the stand-in. Regenerate them in the same commit as any UI change they show. Chromium: Playwright's own (`npx playwright install chromium`) or `CHROME=/path/to/chrome`. Screenshots of HubSpot's own screens (language settings, a translated variant in the page editor) follow from the demo account.

## Demo movie

`docs/images/demo.gif` (at the top of the README) is recorded by `tests/docs/movie.ts` with Supertext's shared movie kit (`tests/docs/movie/movie-kit.mjs`, its types in `movie-kit.d.mts`, and `assets/`: intro and outro cards, caption bar, cursor, cuts the waiting time; Inter under the SIL OFL, `assets/fonts/Inter-LICENSE.txt`). Like the screenshots, it starts the stand-in HubSpot and Supertext APIs and the app in-process (`tests/docs/movie/env.ts`; the Supertext stand-in holds its status answers for 2.5 s so the waiting state is visible, and the movie cuts the wait), connects and saves the settings off camera, then shows, with a spoken line for every step (the GIF is silent): the website pages with *About us* in English, the page picked, German kept and Swiss French unticked, *Translate into 1 language with Supertext*, the waiting state, the result (*New version (draft)*, *Open in HubSpot*) and the list with the page translated into German. HubSpot's own editor isn't shown (the stand-in has no UI): editors open the draft there.

```bash
pip install piper-tts      # the voice (once)
npm run docs:movie         # CHROME=/path/to/chrome as for the screenshots; MOVIE_PORT (default 8797)
```

The MP4 is narrated with [Piper](https://pypi.org/project/piper-tts/) (`pip install piper-tts`): the kit's `say()` speaks each step's line, shows its caption and holds until the line is finished; the time spent making the speech is cut. The voice model (63 MB, pinned revision, checked by SHA-256) downloads itself once into `tests/docs/movie/voice/` (git-ignored; never commit it). Without Piper, or with `MOVIE_VOICE=0`, the movie is made silent with the captions only.

Voice: Piper voice “alba” (en_GB), trained on a dataset from the University of Edinburgh's Centre for Speech Technology Research, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

It needs `ffmpeg` and writes 1280×720 at 30 fps. The GIF (800 px, 12 fps, keep it under 3 MB) is committed; the MP4 (about 45 s) isn't: it goes to `tests/docs/movie/out/HubSpot-Supertext-Translation.mp4` (git-ignored) or to `MOVIE_OUT`. Record it again when the Translate page changes. The kit is the same in every Supertext plugin repo: don't restyle it here.

### Install movie

`tests/docs/movie-install.ts` (`npm run docs:movie:install`) records the install and configuration movie with the same kit, voice and stand-ins (MP4 only, no GIF). A hosted app has no install commands, so there is no terminal scene: it shows the connect page and *Connect HubSpot* (HubSpot's sign-in and consent screen isn't shown, the stand-in approves at once; one spoken line sums it up), then *Settings*: the API key field with the fake key `st-demo-0000-0000-0000` and where to get a key, *Languages* (content in English, German ticked, its *Supertext code* searched and set to *German (Germany) (de-DE)*, *Translation review* left off), *Save*, *Test connection*, and the *Translate* tab where editors start. The MP4 (about 80 s) goes to `tests/docs/movie/out/HubSpot-Supertext-Translation-install.mp4` (git-ignored) or to `MOVIE_OUT`; it isn't committed. Record it again when the connect page or the settings change.

## CI

`.github/workflows/ci.yml`: typecheck, tests, build, then `scripts/smoke.sh`: the built app against the stand-ins (OAuth with a cookie jar, settings, a website page and a marketing email translated into two languages, the drafts checked in the stand-in, an API call without a session refused).

## Code quality and security checks

- *Checks* workflow (`.github/workflows/checks.yml`): actionlint and zizmor lint the workflows on every push and PR; dependency review fails a PR that adds a package with a known vulnerability (moderate or worse).
- *Links* workflow (`.github/workflows/links.yml`): lychee checks all Markdown links weekly and when docs change; broken links open or update the issue "Broken links in the docs". Links that can't work from CI (the local app and stand-ins, API and OAuth endpoints, HubSpot's app behind a login) are listed in `.lycheeignore`.
- All workflows default to `permissions: contents: read` (the release job alone gets `contents: write`), check out with `persist-credentials: false`, and pin every action to a commit SHA with the version as a comment; Dependabot keeps the pins current.
- GitHub settings (set by Remy's setup script, not in the repo): secret scanning with push protection and CodeQL default setup.
- Before starting work in this repo, look at its open findings: code scanning alerts, secret scanning alerts, Dependabot PRs and the "Broken links in the docs" issue.
- `.github/workflows/support-triage.yml`: support requests from the Supertext integrations website arrive as issues labelled `support` (contact details stay in the Supertext CMS). Claude classifies each one: answers questions (marked `<!-- supertext:reply -->`, emailed to the sender by the CMS) and closes them, fixes bugs as pull requests for review (never merged automatically), labels feature requests `feature-request`. Only people with triage rights can add labels, so outsiders can't start it. Needs the organisation secret `ANTHROPIC_API_KEY`; the workflow is the same in every Supertext repo.

## Hosting (Railway)

The service **HubSpot** in the Railway project *supertext-cms-demos* (region `europe-west4-drams3a`, Amsterdam; https://hubspot-production-ac4d.up.railway.app) builds this repo's `Dockerfile` (context = repo root; set on the service, Railway ignores `railway.json`). Health check `/health`. Every push to `main` deploys. One instance only: jobs run in the web process.

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}`; `APP_URL/oauth/callback` is in the app's `redirectUrls` |
| `PORT` | `8080` (the domain routes to it) |
| `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | from the app's *Auth* tab in HubSpot |
| `SESSION_SECRET` | random secret for session cookies |
| `DATABASE_URL` | the shared Postgres service with database `hubspot_supertext` (created on first start): `postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/hubspot_supertext` |
| `APP_ENCRYPTION_KEY` | random secret for stored tokens and keys; optional (falls back to the client secret) |
| `SUPERTEXT_API_KEY` | optional default key (the demo account) |
| `HUBSPOT_SCOPES`, `HUBSPOT_OPTIONAL_SCOPES` | optional; default `oauth content` and the knowledge base scopes |
| `SUPERTEXT_REVIEW_URL` | optional; the review service for languages with *Translation review* on (default: Supertext's review service, `https://localizationreview-production.up.railway.app/v1/`; empty turns review off for every account) |
| `SUPERTEXT_VERSION_REPORTS` | optional; `0` turns the version reports off for every account |
| `SUPERTEXT_REPORT_URL` | optional; tests and stand-ins only (default: the live Commando Center) |

Never commit these values.

## Registering the app in HubSpot

Once, in Supertext's HubSpot developer account; everything works from a phone's browser:

1. HubSpot → Development → Keys → *Personal access key*: create one for the developer account (scope *Developer projects*).
2. GitHub → this repository → Settings → Secrets and variables → Actions: the secret `HUBSPOT_PERSONAL_ACCESS_KEY` and, under *Variables*, `HUBSPOT_ACCOUNT_ID` (the developer account's ID).
3. Actions → *Upload HubSpot app* → *Run workflow*. It runs `hs project upload` on `hubspot-project/` through HubSpot's own action (pinned); later it runs by itself whenever `hubspot-project/` changes on `main`. Without the variable it is skipped.
4. HubSpot → Development → Projects → *supertext-translation* → the app → *Auth*: copy the client ID and secret into the Railway variables `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` (the service redeploys).
5. Once per developer account: the app → **Distribution** tab → **Begin publishing** → *Agree to HubSpot's Acceptable Use Policy* (done 17 October 2026). Without it HubSpot refuses installs in real accounts (*Couldn't complete the connection … has not signed the acceptable use policy*); developer test accounts work either way. Leave the panel's other steps (three installs, Marketplace listing) for later. Until the app is listed it can be installed in up to 25 real accounts (developer test accounts don't count).

With the HubSpot CLI on a computer it is the same as step 3: `npm install -g @hubspot/cli`, `hs account auth`, `cd hubspot-project && hs project upload`. The install URL is the app's `/oauth/start`. An App Marketplace listing (review by HubSpot) comes later.

## Demo

The demo is a HubSpot account, not a container: HubSpot hosts the content, Railway only the app. Set it up by hand (HubSpot accounts can't be created from outside):

1. A HubSpot developer test account (or a CMS/Content Hub trial) *Supertext Demo*, with English as the primary language and German, French and Italian (Switzerland) as further languages, a blog with language variants and, if available, a knowledge base.
2. Content in English with the texts of `tests/standin/seed.ts`: an *About us* page, an *Advent calendar* landing page, the roasting blog post, the autumn newsletter and the order tracking article.
3. **Accounts** (the demo accounts rule, as far as HubSpot allows): Supertext staff get access as HubSpot users with **Super Admin**; for tests and screenshots invite a user with marketing and content edit permissions (the closest to an editor role). HubSpot users are invited by hand and can't be created from Railway variables; passwords stay in Keeper, never in the repo or chat.
4. Install the app in the demo account, enter the API key under Settings or set `SUPERTEXT_API_KEY` on Railway, choose `de-ch`, `fr-ch` and `it-ch`.

## Dependency updates

Dependabot (`.github/dependabot.yml`) opens weekly pull requests: minor and patch updates grouped into one, GitHub Actions in another, each major update on its own. Merge one when CI is green and it doesn't change what the app supports.

Some major versions are ignored on purpose: TypeScript (7.x is the native compiler; stay on 5.x until the tooling here is moved to it) and `@types/node` (the types must match the oldest Node version the app supports, Node 22). Lift an ignore rule when the app moves to the new version.

## Releasing

`package.json` holds the version (the release workflow's `VERSION_FILES`); the settings page reads it at runtime.

1. Move the *Unreleased* entries in `CHANGELOG.md` under a new `## X.Y.Z — YYYY-MM-DD` heading, leaving *Unreleased* empty.
2. Set the same version in `package.json` and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`).
3. Push to `main`. `.github/workflows/release.yml` tags `vX.Y.Z` and creates the GitHub release with the changelog section; 0.x versions are pre-releases. Railway deploys the code on the same push.

Never tag or create releases by hand.

## Known limitations / roadmap

- **Confirmed on a real HubSpot account (17 October 2026, account 149573099, EU data centre):** installing through OAuth (`/oauth/2026-09/token`, token introspection, the optional knowledge base scopes), token refresh, listing blog posts, a blog post into a language its blog has (`create-language-variation`, then `PATCH …/draft`: the French variant appears in HubSpot with the translated text), updating that draft again, and HubSpot's refusal for a language the blog doesn't have (*Blog does not have a variation for language de-ch*, now `blogLanguageMissing`). The developer account must have signed the Acceptable Use Policy first (see *Registering the app in HubSpot*).
- **Not yet tested on a real HubSpot account:** website and landing pages, marketing emails and the knowledge base. The app follows HubSpot's API reference (2026-09 and the knowledge base beta); check these with `npm run hubspot:probe` on the demo account, and adapt the code if HubSpot differs:
  - the shape of `translations` on pages, posts and articles, and that `create-language-variation` copies the draft and accepts `primaryLanguage`;
  - which module fields real themes use for text (the walker's `TEXT_KEY` list) and that `PATCH …/draft` with whole `widgets` / `layoutSections` objects keeps the page editable in the drag-and-drop editor;
  - that `PATCH …/draft` of an email with the whole `content` object works, and where the preview text lives in emails made with the drag-and-drop editor;
  - the knowledge base beta: whether `POST /articles` takes the content directly, the required fields of `PATCH …/draft`, and how `translations` is returned;
  - the editor links for EU-hosted accounts (`app-eu1.hubspot.com`).
- Text in templates, global content (headers, footers), forms, CTAs and HubDB isn't translated; HubSpot keeps those per language elsewhere.
- A version removed after a failed translation is archived by HubSpot (`DELETE` archives pages, posts and emails); check whether an archived variant still blocks a new one in the same language.
- Translation files: one item per export; no bulk export yet.
- Translation review: reviewers' corrections reach HubSpot only with the next translation (no push); the review service works only with live Supertext keys.
- One item per job; bulk translation (several pages at once, a whole blog) comes later.
- Jobs run inside the web process (one Railway instance); a restart marks a running job *interrupted*. A queue comes later.
- No HubSpot App Marketplace listing yet; no app card or app home page inside HubSpot (the developer platform's UI extensions could add a *Translate with Supertext* card later).
