// English: the source language and the fallback for missing keys.
// Placeholders in braces ({count}, {settings}) are filled in by the code;
// never translate them. Keys ending in .one / .other are plural forms.

export const en = {
  // Top bar
  'nav.translate': 'Translate',
  'nav.settings': 'Settings',
  'nav.language': 'Language',

  // API key help (shown wherever the key is mentioned)
  'apiKeyHelp.text':
    'No Supertext account yet? {signup}. Generate your API key at {apiKey} (requires the Admin role).',
  'apiKeyHelp.signup': 'Create one at supertext.com',
  'apiKeyHelp.apiKey': 'supertext.com → Integrations → API',

  // Connect page
  'connect.heading': 'Supertext Translation for HubSpot',
  'connect.intro':
    'Translate your HubSpot website pages, landing pages, blog posts, marketing emails and knowledge base articles with Supertext AI. Each language gets its own version in HubSpot, as a draft for you to review.',
  'connect.point1': 'Pick a page, post, email or article and the languages.',
  'connect.point2': 'Texts, titles and meta descriptions are translated; layout, images, links and personalization tokens stay.',
  'connect.point3': 'Review the drafts in HubSpot and publish them as usual.',
  'connect.button': 'Connect HubSpot',
  'connect.hint':
    'You log in with HubSpot and allow Supertext to read your content and create language versions of it. The knowledge base is offered if your account has it.',
  'connect.denied': "HubSpot access wasn't granted. Connect again to use the app.",
  'connect.disconnected': 'HubSpot is disconnected. Your settings were removed.',

  // Kinds of content
  'kind.site-page': 'Website pages',
  'kind.landing-page': 'Landing pages',
  'kind.blog-post': 'Blog posts',
  'kind.email': 'Marketing emails',
  'kind.kb-article': 'Knowledge base',

  // Translate page
  'translate.heading': 'Translate with Supertext',
  'translate.intro':
    'Make a language version of a page, post, email or article. The versions appear in HubSpot as drafts, linked to the original where HubSpot supports language variants.',
  'translate.noKey.heading': 'Add your Supertext API key',
  'translate.noKey.text': 'The app needs a Supertext API key before it can translate. Enter it under {settings}.',
  'translate.noKey.settings': 'Settings',
  'translate.noLanguages.heading': 'Choose your languages',
  'translate.noLanguages.text': 'Choose the languages to translate into under {settings}.',
  'translate.step1': '1. Choose what to translate',
  'translate.name': 'Name',
  'translate.language': 'Language',
  'translate.empty': 'Nothing here yet. Create it in HubSpot, then come back here.',
  'translate.kbMissing':
    "The knowledge base isn't connected: it needs Service Hub Professional or Enterprise, and the app's knowledge base access when you connected HubSpot. Connect HubSpot again to grant it.",
  'translate.nextPage': 'Next page',
  'translate.firstPage': 'First page',
  'translate.step2': '2. Choose the languages',
  'translate.notMapped': 'No Supertext code yet (see Settings)',
  'translate.from':
    'Translated from the language set on the item in HubSpot, else from {language}.',
  'translate.fromAuto': 'Translated from the language set on the item in HubSpot, else Supertext detects it.',
  'translate.overwrite': 'Update existing versions',
  'translate.overwriteHint': 'Without this option, languages that have a version already are kept.',
  'translate.overwriteWarning':
    "The drafts of the existing versions will be replaced, including changes made by hand in HubSpot. Their published pages stay until you publish the new drafts.",
  'translate.submit': 'Translate with Supertext',
  'translate.submitCount.one': 'Translate into {count} language with Supertext',
  'translate.submitCount.other': 'Translate into {count} languages with Supertext',
  'translate.selectSomething': 'Select an item and at least one language.',
  'translate.starting': 'Starting…',

  // State of an item (HubSpot's)
  'state.draft': 'Draft',
  'state.published': 'Published',
  'state.scheduled': 'Scheduled',
  'state.other': 'Other',

  // Language versions per language
  'version.none': 'Not translated',
  'version.exists': 'Translated',

  // Progress and results
  'job.heading': 'Translation',
  'job.running': 'Translating “{item}”… {completed} of {total}',
  'job.done': 'Done: {created} created, {updated} updated, {kept} kept, {failed} failed.',
  'job.failed': 'The translation stopped: {reason}',
  'job.created': 'New version (draft)',
  'job.updated': 'Draft updated',
  'job.kept': 'Version exists, kept',
  'job.open': 'Open in HubSpot',
  'job.review': 'Review the drafts in HubSpot and publish them when they are ready.',
  'history.heading': 'Recent translations',
  'history.empty': 'No translations yet.',

  // Settings page
  'settings.heading': 'Supertext settings',
  'settings.saved': 'Settings saved.',
  'settings.invalidCodes':
    "Saved, except these codes, which aren't Supertext codes (pick one from the list, for example de-CH or es): {codes}.",
  'settings.apiKey.heading': 'Supertext API key',
  'settings.apiKey.label': 'API key',
  'settings.apiKey.placeholder': 'Paste your Supertext API key',
  'settings.apiKey.placeholderSaved': 'A key is saved (stored encrypted). Enter a new one to replace it.',
  'settings.apiKey.server': 'No key of your own yet: the app uses the key set on the server.',
  'settings.apiKey.remove': 'Remove the saved key',
  'settings.test': 'Test connection',
  'settings.testing': 'Testing…',
  'settings.languages.heading': 'Languages',
  'settings.languages.text':
    "HubSpot gives every page, post, email and article a language. Each translation becomes a version in the target language; for pages, landing pages and blog posts HubSpot links it to the original (multi-language group).",
  'settings.languages.source': 'Language of your content',
  'settings.languages.sourceHint':
    'Used for items that have no language set in HubSpot. Items that have one are translated from their own language.',
  'settings.languages.auto': 'Let Supertext detect it',
  'settings.languages.targets': 'Translate into',
  'settings.languages.code': 'Supertext code',
  'settings.languages.codeHint':
    'Choose the language Supertext translates into for each language, for example Swiss High German (de-CH) for German. Variants of the same language come first. Each language starts with its suggestion: the same code where HubSpot\'s code is already a Supertext code (de-ch, es, nl), else the usual variant (German → de-DE, English → en-US, Chinese (China) → zh-Hans, Spanish (Mexico) → es). A language without a suggestion shows — choose — and isn\'t translated until you pick its code.',
  'settings.languages.review': 'Translation review',
  'settings.languages.reviewHint':
    "Translation review: translations into a language ticked here go through Supertext's review service, so reviewers can check and correct them on the website with the Supertext Localization Review extension. Their corrections are used the next time the item is translated into that language.",
  'settings.languages.suggested': 'Suggested',
  'settings.languages.all': 'All Supertext languages',
  'settings.languages.search': 'Type a name or code',
  'settings.languages.noMatch': 'No Supertext language matches',
  'settings.languages.choose':
    '— choose —',
  'settings.languages.unmapped':
    'These languages have no Supertext code yet and aren\'t translated until you choose one in the Supertext code column under Languages: {languages}.',
  'settings.languages.sourceUnsupported':
    "Supertext doesn't know {language} as the language of your content. Enter its Supertext code under Languages (for example en-US for English), or let Supertext detect it.",
  'settings.languages.blogHint':
    'Blog posts: a language version goes into the blog of that language, so set up a language variant of the blog in HubSpot first (Settings → Content → Blog).',
  'settings.style.heading': 'Translation',
  'settings.style.label': 'Form of address',
  'settings.style.default': 'Let Supertext decide',
  'settings.style.more': 'Formal (e.g. German “Sie”)',
  'settings.style.less': 'Informal (e.g. German “du”)',
  'settings.style.notOffered':
    "Supertext offers no formal or informal address for {languages}; these are translated with Supertext's default.",
  'settings.keyCheck.label': 'API key check:',
  'settings.keyCheck.at': '(last checked {time} UTC)',
  'settings.ui.heading': "Interface language",
  'settings.ui.label': "Language of these pages",
  'settings.ui.auto': "Automatic (your browser's language)",
  'settings.ui.help': "Applies to this browser only, so each colleague can choose their own. It doesn't affect which languages your content is translated into.",
  'settings.reports.heading': 'Supertext support',
  'settings.reports.label': 'Send version information to Supertext',
  'settings.reports.help':
    'Sends the ID of your HubSpot account and the versions of this app and the runtime to Supertext when you save these settings and after an update, so Supertext support can see which version you run. No content, no API key and no personal data are sent.',
  'settings.reports.fixed': 'Set for all accounts on the server (SUPERTEXT_VERSION_REPORTS).',
  'settings.save': 'Save',
  'settings.connection.heading': 'HubSpot',
  'settings.connection.account': 'Connected to the HubSpot account {account}.',
  'settings.connection.kb': 'Knowledge base: connected.',
  'settings.connection.noKb': 'Knowledge base: not connected (needs Service Hub Professional or Enterprise).',
  'settings.connection.disconnect': 'Disconnect HubSpot',
  'settings.connection.disconnectHint':
    'Removes your settings and the stored tokens. Language versions already made stay in HubSpot. To remove the app from HubSpot too, uninstall it under Settings → Integrations → Connected apps in HubSpot.',
  'settings.connection.confirm': 'Disconnect HubSpot from Supertext? Your settings will be removed.',
  'settings.about.heading': 'About',
  'settings.about.version': 'Supertext Translation for HubSpot, version {version}',

  // Errors from Supertext and HubSpot (codes set by LocalizedError)
  'error.noApiKey':
    'No Supertext API key configured. Add it under Settings. No Supertext account yet? Create one at https://www.supertext.com/person/en/account/signin. Generate your API key at https://www.supertext.com/en/integrations/api (requires the Admin role).',
  'error.noFileId': 'Supertext did not return a file id.',
  'error.translationFailed': 'Supertext failed to translate the document.',
  'error.limitExceeded': 'Your Supertext translation limit is exceeded.',
  'error.fileDeleted': 'The Supertext file was deleted before it could be downloaded.',
  'error.timeout': 'Timed out waiting for the Supertext translation.',
  'error.emptyTranslation': 'The translated document was empty.',
  'error.unreachable': 'Could not reach Supertext: {reason}',
  'error.auth':
    'Authentication failed. Please check the Supertext API key. No Supertext account yet? Create one at https://www.supertext.com/person/en/account/signin. Generate your API key at https://www.supertext.com/en/integrations/api (requires the Admin role).',
  'error.notFound': 'The requested Supertext resource was not found.',
  'error.tooLarge': 'The content is too large for Supertext to translate in one go.',
  'error.rateLimited': 'Too many requests to Supertext. Please try again shortly.',
  'error.unavailable': 'The Supertext service is currently unavailable.',
  'error.http': 'Supertext answered with HTTP {status}.',
  'error.languagePair':
    "Supertext doesn't translate from \"{source}\" into \"{target}\". Check the Supertext codes under Settings → Languages (for example de-CH or es).",
  'error.languagePairUnknown':
    "Supertext doesn't translate into this language. Check its Supertext code under Settings → Languages (for example de-CH or es).",
  'error.incomplete': 'Supertext returned an incomplete translation; nothing was saved for this language.',
  'error.unsupportedLanguage':
    'The language “{code}” has no Supertext code yet, so nothing was sent. Ask your administrator to choose one in the Supertext code dropdown under Settings → Languages.',
  'error.unsupportedFeature':
    'Supertext offers no formal or informal address for this language. Set the form of address to “Let Supertext decide” under Settings → Translation.',
  'error.hublTags':
    'Supertext returned {received} of {sent} personalization tokens or HubL tags; nothing was saved for this language.',
  'error.notConnected': 'HubSpot is not connected. Connect it again.',
  'error.notConfigured': 'The app is missing its HubSpot credentials (HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET).',
  'error.oauthFailed': 'HubSpot did not grant access. Connect again.',
  'error.hubspotAuth': 'HubSpot refused the connection. Connect HubSpot again.',
  'error.hubspotForbidden':
    'HubSpot refused the request. The app may lack access to this kind of content, or your HubSpot subscription may not include it.',
  'error.hubspotNotFound': 'Not found in HubSpot.',
  'error.hubspotRateLimited': 'Too many requests to HubSpot. Please try again shortly.',
  'error.hubspotUnavailable': 'HubSpot is currently unavailable. Please try again shortly.',
  'error.blogLanguageMissing': "The blog has no “{language}” version in HubSpot yet, so nothing was translated for this language. Add a language variation of the blog in HubSpot (Settings → Content → Blog), then translate again.",
  'error.hubspotHttp': 'HubSpot answered with HTTP {status}.',
  'error.hubspotUnreachable': 'Could not reach HubSpot: {reason}',
  'error.itemMissing': 'The item no longer exists in HubSpot.',
  'error.isTranslation': 'This is a language version of another item. Translate its primary instead.',
  'error.noSourceLanguage':
    "The item has no language in HubSpot, so HubSpot can't make a language version of it. Set its language in HubSpot, or set the language of your content under Settings.",
  'error.sameLanguage': 'This is the language of the item itself.',
  'error.interrupted': 'The app restarted during the translation. Start it again; finished languages are kept.',
  'error.session': 'Your session has expired. Connect HubSpot again.',
  'error.select': 'Select an item and at least one language.',
  'keyCheck.ok': 'API key checked: the connection to Supertext works.',
  'keyCheck.invalid':
    'Supertext rejected the API key. Check that you copied the whole key, or generate a new one at supertext.com → Integrations → API (requires the Admin role). No Supertext account yet? Create one at supertext.com.',
  'keyCheck.missing':
    'No API key is set yet. No Supertext account yet? Create one at supertext.com. Generate your API key at supertext.com → Integrations → API (requires the Admin role).',
  'keyCheck.unreachable':
    "The API key couldn't be checked because Supertext can't be reached. The settings are saved; check again later.",
  'keyCheck.error':
    "The API key couldn't be checked: Supertext answered with an error ({status}). The settings are saved; check again later.",

  // Translation files
  'nav.import': 'Import translation',
  'export.heading': '3. Or: Export for translation',
  'export.intro':
    'Download the texts as a file for a translator, a translation tool or Supertext\'s web app, and bring the translated file back under Import translation. No API key needed.',
  'export.format': 'File format',
  'export.xliff': 'XLIFF 1.2 (for translation tools)',
  'export.html': 'HTML (one language per file)',
  'export.oneLanguage': 'Choose exactly one language for an HTML file.',
  'export.download': 'Download file',
  'import.heading': 'Import translation',
  'import.intro':
    'Bring back a file exported under Translate → Export for translation, translated by a translator, a translation tool or Supertext\'s web app. Each language version is written as a draft in HubSpot, like a Supertext translation.',
  'import.file': 'Translated file (XLIFF or HTML)',
  'import.fileHelp': 'At most 10 MB. The file says which item and language it belongs to.',
  'import.includeChanged': 'Also import texts whose source changed since the export',
  'import.overwriteHelp': 'Without this option, languages that have a version already are kept.',
  'import.submit': 'Import translation',
  'import.results': 'Imported files',
  'import.ok': 'Imported: {count}',
  'import.changed': 'Skipped, source changed since the export: {count}',
  'import.untranslated': 'Not translated in the file: {count}',
  'import.invalid': 'Formatting changed, not imported: {count}',
  'import.missing': 'Not in the file: {count}',
  'error.fileNothing': 'Nothing to translate.',
  'error.fileHtmlOneLanguage': 'Choose exactly one language for an HTML file.',
  'error.fileMissing': 'Choose a file.',
  'error.fileInvalid': "This file isn't a valid XLIFF or HTML translation file.",
  'error.fileMissingMetadata': "This file wasn't exported by the Supertext app, or its header was removed.",
  'error.fileTooLarge': 'The file is too large (at most 10 MB).',
  'error.fileOtherSystem': 'This file belongs to another system ({plugin}).',
  'error.fileNotFound': 'The item this file was exported from no longer exists.',
  'error.fileNoLanguage': 'The site has no language {language}.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
