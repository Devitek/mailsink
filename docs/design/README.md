# Design deliveries

Design work comes from an external design partner (Claude Design) who only sees the brief
archive. Each delivery is kept here **verbatim** (its texts are in French and may not follow
the repository's writing rules: they are not edited). Mockups plus the arbitrations below
are binding for the UI issues.

| Folder | Delivery | Issue |
|---|---|---|
| [`brand-1/`](brand-1/README.md) | Brand and UI kit « Jaune Poste »: logo « Le Bac », tokens, interactive prototype of the whole app | #36 |
| [`brief-2/`](brief-2/README.md) | Admin-key sign-in screen (L1a to L1e, desktop and 390) and the header « Language and session » menu (H2a to H2d), light and dark, FR and EN copy | #63 |
| `og/` | Open Graph images provided by the owner on 23/11 (1200 x 630, EN and FR): the app serves them per page locale (`og:image`, fr gets FR, any other locale EN); the EN one is the GitHub social preview of the repository | #36 |

## brand-1: contents

- `docs/IMPLEMENTATION.md`: migration checklist (tokens, theme, logo, fonts, density).
- `docs/TOKENS.md`, `tokens/tokens.css`, `tokens/tokens.json`: design tokens (`--ms-*`),
  light theme on `:root`, dark on `[data-theme="dark"]`.
- `tokens/tailwind.preset.js`: Tailwind v3 preset. The app uses Tailwind v4: the same
  variables are exposed through `@theme` in CSS instead (see « Integration notes »).
- `docs/BRAND.md`: logo construction, baselines, colour roles, typography, radii, motion.
- `logo/`, `social/`: SVG and PNG marks, lockups, favicon, PWA icons, Open Graph image.
- `mockups/Mailsink.dc.html` (open in a browser, keep `support.js` next to it): the
  reference for spacing, states and behaviour. `mockups/Mailsink Charte.dc.html`: the
  interactive brand sheet.

## Arbitrages du brief 1 (owner, 22/11/2026)

| # | Point raised by the delivery | Decision |
|---|---|---|
| B1-1 | The inspector offers « Hard Bounce » next to Opened / Clicked; the spec only forced opened and clicked | Extend `POST /capture/messages/:id/events` to forced simulated statuses per recipient (suppression list and webhooks follow). Contract in `03-contracts.md`, work in #34 |
| B1-2 | « Test d'envoi » on webhook endpoints (not in the spec) | Kept: `POST /capture/webhooks/:id/test`, work in #33 and #43 |
| B1-3 | « Charger des messages de démo » in an empty inbox (not in the spec) | Kept: `POST /capture/demo`, work in #62 |
| B1-4 | Default theme | Light by default, as delivered; the user's choice is remembered (cookie, applied during SSR, no flash); `prefers-color-scheme` is not followed |
| B1-5 | Fonts (Geist, JetBrains Mono) | Self-hosted (`@fontsource` packages in the bundle): no external request, consistent with local-first and offline CI |
| B1-6 | Repository README | Product variant of the Devitek README rules: Mailsink mark and name instead of the generic banner, English baseline « Every email caught. None delivered. », Devitek footer unchanged |
| B1-7 | Not designed: admin-key login screen (D13) and the place of the FR / EN language switcher | New Claude Design brief, #63 |

## Integration notes (architect's proposals, open to veto in #36)

- The delivery's `--ms-*` variables are the single source of truth. shadcn/ui semantic
  variables (`--background`, `--foreground`, `--primary`, `--ring`…) are aliases of
  `--ms-*`, so shadcn components pick the brand without forking them. Accent split from
  `IMPLEMENTATION.md` §1: `--primary` = `--ms-accent` with `--primary-foreground` =
  `--ms-on-accent`; links, focus ring and text accents use `--ms-accent-text`.
- Tailwind v4: the preset is translated into `@theme inline` declarations pointing at the
  `--ms-*` variables (colours, radii, fonts, durations); dark mode uses a custom variant on
  `[data-theme="dark"]`.
- UI copy in the mockups is French; the source locale stays English (D18) and the mockup
  texts serve as the reference for the French catalog.

## Arbitrages du brief 2 (owner, 23/11/2026)

The brief archive sent to the partner is not versioned; the request is recorded in #63.
Copy, interactions and accessibility rules of `brief-2/README.md` are binding unless changed
below.

| # | Point raised by the delivery | Decision |
|---|---|---|
| B2-1 | Sign-in composition: centred 420 px card (full width without border at 390), lockup, discreet baseline, instance block (URL and version), key field with Show and Paste, « Where do I find the key? » help, session-cookie reassurance line, language and theme controls top right | Accepted as delivered, FR and EN copy included |
| B2-2 | L1b « 2 attempts left » requires the server to expose remaining attempts | **Removed**: the server does not reveal how many attempts remain. L1b keeps « Key rejected. Check that it matches `MAILSINK_ADMIN_KEY` on the server. » |
| B2-3 | L1e « Too many attempts »: live countdown in the banner and the button, field still editable, everything re-enabled at zero without reload; duration from the server (`Retry-After`) | Accepted. The sign-in endpoint answers 429 with `Retry-After` once the limit is reached (threshold and duration server side, #37) |
| B2-4 | Header: one compact button showing the active locale (FR / EN, mono) before the theme toggle, opening a « Language and session » menu (languages as endonyms with a check, instance reminder, sign out; with `MAILSINK_UI_AUTH=none` the sign-out line becomes a note) | Accepted |
| B2-5 | No danger token: errors reuse `--ms-status-failed` | Add `--ms-danger: var(--ms-status-failed)` and use it for errors |
| B2-6 | Sign-in field and button at 44 px (48 px at 390), above the control scale | Add `--ms-control-h-xl: 44px` |
| B2-7 | Sign-in card radius 16 px, above the scale | Card uses `--ms-radius-xl` (14 px) |
