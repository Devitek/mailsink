# Design tokens

Source de vérité : `tokens/tokens.css` (variables `--ms-*`). `tokens.json` contient les mêmes valeurs avec leur équivalent hex. `tailwind.preset.js` expose les variables à Tailwind.

Le thème **clair** est appliqué sur `:root` ; le sombre via `[data-theme="dark"]`.

## Couleurs — thème clair (défaut)

| Token | Valeur | Hex |
|---|---|---|
| `--ms-bg` | #f5f5f3 | |
| `--ms-panel` | #ffffff | |
| `--ms-raised` | #fafaf9 | |
| `--ms-hover` | #efefec | |
| `--ms-border` | #e5e5e1 | |
| `--ms-border-strong` | #d4d4cf | |
| `--ms-text` | #16171a | |
| `--ms-text-muted` | #5d6067 | |
| `--ms-text-faint` | #989ba1 | |
| `--ms-accent` | oklch(0.86 0.16 92) | #f7cd3a |
| `--ms-on-accent` | #16171a | |
| `--ms-accent-text` | oklch(0.50 0.11 80) | #845b00 |
| `--ms-override` | oklch(0.58 0.17 45) | #c84f00 |

## Couleurs — thème sombre

| Token | Valeur | Hex |
|---|---|---|
| `--ms-bg` | #0b0c0e | |
| `--ms-panel` | #111214 | |
| `--ms-raised` | #16171a | |
| `--ms-hover` | #1d1f23 | |
| `--ms-border` | #222429 | |
| `--ms-border-strong` | #2d3036 | |
| `--ms-text` | #e7e8ea | |
| `--ms-text-muted` | #8d9199 | |
| `--ms-text-faint` | #5f636b | |
| `--ms-accent` | oklch(0.87 0.16 92) | #fad03e |
| `--ms-on-accent` | #0b0c0e | |
| `--ms-accent-text` | oklch(0.87 0.16 92) | #fad03e |
| `--ms-override` | oklch(0.74 0.17 45) | #ff8244 |

## Statuts

| Statut | Clair | Sombre |
|---|---|---|
| delivered | oklch(0.52 0.14 155) | oklch(0.76 0.15 155) |
| soft_bounce | oklch(0.57 0.14 60) | oklch(0.80 0.14 70) |
| hard_bounce | oklch(0.54 0.19 25) | oklch(0.70 0.18 25) |
| complained | oklch(0.52 0.16 320) | oklch(0.74 0.14 320) |
| deferred | oklch(0.52 0.13 250) | oklch(0.76 0.11 245) |
| failed | oklch(0.50 0.20 15) | oklch(0.66 0.20 10) |
| suppressed | #787b82 | #868a92 |

Fond de badge : `color-mix(in oklch, <statut> 14%, transparent)`.

## Connexions

| Provider | Clair | Sombre |
|---|---|---|
| Resend | #2a2c30 | #d6d8dc |
| Brevo | oklch(0.50 0.11 165) | oklch(0.78 0.11 165) |
| SMTP | oklch(0.50 0.12 270) | oklch(0.76 0.10 270) |

## Échelles

| Catégorie | Valeurs |
|---|---|
| Rayon | xs 4 · sm 6 · md 8 · lg 10 · xl 14 |
| Espacement | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 |
| Hauteur de contrôle | sm 24 · md 30 · lg 34 |
| Layout | header 56 · liste de messages 400 |
| Durée | fast 120 ms · base 200 ms |

## Correspondance avec le prototype

Le prototype utilise des noms courts. Mapping :

| Prototype | Token |
|---|---|
| `--bg` | `--ms-bg` |
| `--p` | `--ms-panel` |
| `--r` | `--ms-raised` |
| `--h` | `--ms-hover` |
| `--bd` / `--bd2` | `--ms-border` / `--ms-border-strong` |
| `--tx` / `--mu` / `--fa` | `--ms-text` / `-muted` / `-faint` |
| `--ac` | `--ms-accent-text` (texte, liens, focus, coches) |
| `--acf` | `--ms-accent` (aplats : logo, toggles, barres, cases cochées) |
| `--on` | `--ms-on-accent` |
| `--am` | `--ms-override` |
| `--s-*` | `--ms-status-*` |
| `--c-*` | `--ms-conn-*` |
