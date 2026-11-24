# Mailsink: agent rules

Read `docs/architecture/` before any change: it holds the tree, schema, contracts,
sequence and roadmap, plus the decision log (D1, D2…) in `docs/architecture/README.md`.

## Communication
- Issues, PRs, comments and commits are written in French. Code, code comments, README and
  `docs/` are written in English. Never use an em dash.
- Commits follow Conventional Commits in French, with the issue number:
  `feat(ingestion): ajoute l'endpoint batch natif (#12)`.
- Pull requests are squash merged and the squash commit is the PR title alone: a PR title
  is a valid Conventional Commit, `type(scope): description (#N)`, with no space before the
  colon (French typography does not apply there), or release-please skips it (D225).

## Tracking conventions
- Repo: Devitek/mailsink. Every feature, bug, fix, idea, decision or documentation request
  goes through a GitHub issue. Never commit to main: always a branch and a PR.
  Exception: Dependabot PRs need no issue.
- Issues are living documentation: requests, decisions, analyses, successes and pitfalls are
  recorded in issue bodies and comments. No subject is ever lost: every deferred or noticed
  point is traced as an issue or a checkbox in a tracking issue; a summary comment never
  suffices.
- Labels (describe the issue, never change): one `type:` (`type:bug`, `type:feature`,
  `type:chore`, `type:docs`, `type:idea`); at least one `area:` among `area:ingestion`,
  `area:smtp`, `area:capture`, `area:simulation`, `area:webhooks`, `area:admin`,
  `area:frontend`, `area:design-system`, `area:mcp`, `area:db`, `area:i18n`, `area:infra`;
  `follow-up` (born from a report, origin cited); `needs-decision` / `blocked` (waits: set
  and remove them); `security` only when it is the core subject; `epic` on parent issues
  only.
- Epics (children attached as native GitHub sub-issues), one per roadmap phase of
  `docs/architecture/05-roadmap.md`: #1 Phase 1 socle DB et ingestion, #2 Phase 2
  workspaces éphémères et overrides, #3 Phase 3 dialectes providers et webhooks, #4 Phase 4
  interface web et MCP, #122 Phase 5 SDK, helpers de test, CLI et OpenAPI (v0.2). Ideas
  not planned in a phase are sub-issues of the backlog epic #123 (Idées non planifiées)
  until a phase picks them up. Provider fidelity gaps (Mailsink must behave like the real
  provider, for any application) are sub-issues of the epic #159 (Fidélité des connecteurs
  Resend et Brevo), analysed in `docs/architecture/06-provider-fidelity.md`.
- `good first issue` marks issues open to outside contributors (translations included).
- GitHub Project « Mailsink » (owner Devitek, number 1,
  https://github.com/orgs/Devitek/projects/1): every issue gets a status (À trier, Prêt,
  En cours, En revue, Terminé), a priority (P1, P2, P3) and, when estimable, a size
  (S, M, L). Status, priority and size live in the Project, never as labels. Update the
  status when starting (En cours), opening the PR (En revue), merging (Terminé).
- PR template sections: Résumé, Vérifications, Suivi, Issues
  (`.github/pull_request_template.md`). The Suivi section lists every deferred point with its
  issue, or `Aucun point reporté.`. `Closes #N` only if the issue has no open checkbox left,
  else `Refs #N`.
- Decisions the agent takes without owner confirmation are marked « proposition » in the
  docs decision log and in the issue, so the owner can veto them.

## Definition of Done
When relevant, before considering an issue done:
- `pnpm lint` (Biome), `pnpm typecheck` and `pnpm test` pass.
- DB-dependent code is tested on both drivers (Postgres and PGlite).
- Provider dialects keep their contract tests with the official SDKs green.
- Every user-facing UI string goes through Lingui; FR and EN catalogs are extracted and
  complete (`pnpm i18n:check`). API, SMTP and MCP messages stay English and untranslated.
- Design system tokens only (no hard-coded colors, fonts or radii).
- `docs/` updated when behaviour, contracts or schema change; decision log updated.
- Every deferred point is traced in an issue and listed in the PR Suivi section.

## Stack
- pnpm monorepo: `apps/mailsink` (TanStack Start: UI and every HTTP surface),
  private `packages/{contracts,db,core,smtp,mcp,ui,openapi}` (`@mailsink/*`) and the npm
  packages `packages/{sdk,playwright,vitest,cli}` (`@devitek/mailsink`,
  `@devitek/mailsink-playwright`, `@devitek/mailsink-vitest`, `@devitek/mailsink-cli`,
  published at release, D226, D255).
- TanStack Start / Router / Query / Form / Table / Virtual, Zod 4, Drizzle (Postgres and
  PGlite), smtp-server + mailparser, MCP TypeScript SDK, Tailwind CSS, shadcn/ui on Base UI
  (`@base-ui/react`), Lingui, Biome, Vitest, Playwright.
