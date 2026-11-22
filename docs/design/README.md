# Design deliveries

Design work comes from an external design partner (Claude Design) who only sees the brief
archive. Each delivery is kept here **verbatim** (its texts are in French and may not follow
the repository's writing rules: they are not edited). Mockups plus the arbitrations below
are binding for the UI issues.

| Folder | Delivery | Issue |
|---|---|---|
| [`brand-1/`](brand-1/README.md) | Brand and UI kit « Jaune Poste »: logo « Le Bac », tokens, interactive prototype of the whole app | #36 |

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
