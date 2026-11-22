# Translating Mailsink

The web UI is localized with [Lingui](https://lingui.dev). English (`en`) is the source
locale; French (`fr`) is maintained by the core team. Other languages are welcome.

What is translated: every string a person reads in the web UI. What is **not**
translated: API, SMTP and MCP responses, logs, and error codes. They stay in English so
they match the providers Mailsink emulates and stay stable for tests.

## Where the strings live

```
apps/mailsink/src/locales/
├── en/messages.po    # source, generated from the code
└── fr/messages.po
```

Catalogs are [PO files](https://lingui.dev/ref/catalog-formats#po): one `msgid` (the
English source or an explicit id) and one `msgstr` (the translation) per entry, with the
source file as a comment (no line numbers, so unrelated edits do not churn the catalogs).

The configuration is `lingui.config.ts` at the repository root. The commands run from
anywhere in the repository:

| Command | What it does |
| --- | --- |
| `pnpm i18n:extract` | Scans `apps/mailsink/src`, adds new strings to every catalog, removes obsolete ones. |
| `pnpm i18n:check` | Fails if a catalog is out of sync with the code or has an empty `msgstr` (what CI runs). |
| `pnpm i18n:compile` | Compiles the catalogs to JS (`--strict`). Optional: the Vite plugin compiles PO files itself in `pnpm dev` and `pnpm build`. |

The UI language is the one chosen in the language selector (stored in the
`mailsink_locale` cookie), else the best match of the browser `Accept-Language` header,
else English. It is resolved on the server, so the page arrives already translated.

## Fix an existing translation

1. Find the entry in `apps/mailsink/src/locales/<lang>/messages.po`.
2. Change only the `msgstr`. Never edit `msgid`: it is generated from the code.
3. Keep placeholders as they are (`{count}`, `{name}`, `<0>…</0>`), in any order your
   language needs.
4. Run `pnpm i18n:check`, then open a pull request titled
   `fix(i18n): corrige la traduction <lang> de <écran>` (English titles are fine too).

## Add a language

1. Open an issue with the « Translation » template to announce it (avoids duplicate work).
2. Add the locale code (BCP 47, e.g. `de`, `pt-BR`) to `locales` in `lingui.config.ts` and
   to `LOCALES` and `LOCALE_LABELS` (the language name in that language) in
   `apps/mailsink/src/i18n/locales.ts`.
3. Run `pnpm i18n:extract`: it creates `apps/mailsink/src/locales/<lang>/messages.po`.
4. Translate every entry. Plurals use ICU syntax:
   `{count, plural, one {# message} other {# messages}}`; add the categories your
   language needs (`few`, `many`…).
5. Run `pnpm i18n:check` (fails on any missing translation), and look at the UI with
   `pnpm dev`, switching language with the language selector.
6. Open a pull request `feat(i18n): ajoute la langue <lang>`, linking the issue. Add a
   screenshot of a couple of screens if you can.

A new language is merged when it is complete. Later UI changes add English strings;
maintainers ping the language contributors on the pull request, and missing entries
fall back to English until they are translated.

## Writing guidelines

- Short, plain, neutral. Product terms stay as is: Mailsink, workspace, webhook, override,
  SMTP, API key. Translate them only if your language has a settled equivalent (French
  keeps « workspace » and « webhook »).
- Keep the meaning of status names (`delivered`, `hard_bounce`…) consistent with the
  API value shown next to them.
- No em dash. Follow your language's typography (French: non-breaking space before
  `: ; ? !`).

## For developers adding UI strings

- Wrap every user-facing string with the Lingui macros: `<Trans>…</Trans>` or
  `` const { t } = useLingui() `` then `` t`Delete workspace` ``, both from
  `@lingui/react/macro`. Use an explicit id and a `comment` when the English text is
  ambiguous. Never use the global `i18n` from `@lingui/core`: the active instance is
  per request (SSR) and comes from `I18nProvider` in `apps/mailsink/src/routes/__root.tsx`.
- API, SMTP and MCP messages are never wrapped (D19).
- Run `pnpm i18n:extract` and fill the French entries in the same pull request. CI
  rejects a pull request whose FR or EN catalog is incomplete.
