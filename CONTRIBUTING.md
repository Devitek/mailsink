# Contributing to Mailsink

Thanks for helping. This guide covers code contributions and translations.

## Ground rules

- **One issue per change.** Open or pick an issue first. Issues are usually written in
  French, but English issues and comments are welcome.
- **Never push to `main`.** Fork, branch, open a pull request.
- **Conventional Commits** with the issue number: `fix(smtp): handle AUTH LOGIN (#42)`.
- **Green CI**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`.
- Fill in the pull request template (summary, checks, follow-ups, linked issues).

## Development setup

The project is being bootstrapped; setup instructions land with the monorepo scaffold
(roadmap Phase 1). Architecture lives in [docs/architecture](docs/architecture/README.md).

## Translations

The web UI ships in English and French, with [Lingui](https://lingui.dev). Fixing a
translation or adding a language is a great first contribution: see
[docs/contributing/translations.md](docs/contributing/translations.md).

## Security

Do not open a public issue for a vulnerability. Use GitHub private vulnerability
reporting on this repository.
