# Migration — checklist pour l'agent de code

Objectif : appliquer la nouvelle identité (Jaune Poste, logo « Le Bac », thème clair par défaut, interface aérée) au projet existant. Référence visuelle : `mockups/Mailsink.dc.html` et `mockups/screenshots/`.

## 1. Tokens

- [ ] Ajouter `tokens/tokens.css` au bundle global (avant tout autre style).
- [ ] Si Tailwind : ajouter `tokens/tailwind.preset.js` dans `presets`.
- [ ] Remplacer toutes les couleurs codées en dur par les variables `--ms-*` (voir le mapping dans `TOKENS.md`).
- [ ] **Séparer l'accent en deux usages** — c'est le point le plus important :
  - aplats (fonds de boutons primaires, toggles actifs, cases cochées, barres de progression, tuile du logo, puce non-lu) → `--ms-accent` + texte/icône `--ms-on-accent` ;
  - texte (liens, boutons texte, focus ring, coches seules, clés de headers) → `--ms-accent-text`.
- [ ] Ne jamais mettre de texte blanc sur `--ms-accent`.
- [ ] Remplacer l'ancien ambre d'override par `--ms-override` (orange).

## 2. Thème

- [ ] Thème **clair par défaut** : `:root` porte le clair ; le sombre s'active avec `data-theme="dark"` sur `<html>`.
- [ ] Respecter le choix utilisateur persistant s'il existe ; sinon clair (ne pas suivre `prefers-color-scheme` par défaut sauf décision produit contraire).
- [ ] Déclarer `color-scheme` (déjà inclus dans tokens.css).

## 3. Logo et assets

- [ ] Remplacer l'icône d'en-tête par le symbole `logo/svg/mark.svg` (20 px dans le header, trait 6,5 u — reprendre le SVG inline du prototype qui utilise `var(--ms-accent)` / `var(--ms-on-accent)`).
- [ ] Le nom affiché devient `mailsink` en minuscules, Geist 600, `letter-spacing: -0.04em`.
- [ ] Favicon : `logo/favicon.svg` + `logo/png/mark-32.png` en fallback.
- [ ] iOS : `logo/png/apple-touch-icon-180.png`.
- [ ] Manifest PWA : `maskable-192.png`, `maskable-512.png` (`purpose: "maskable"`) et `mark-512.png` (`purpose: "any"`).
- [ ] Open Graph / Twitter : `social/og-image-1200x630.png`.
- [ ] `theme-color` : `#f5f5f3` (clair) / `#0b0c0e` (sombre) via `media`.

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/mark-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<meta name="theme-color" content="#f5f5f3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0c0e" media="(prefers-color-scheme: dark)">
<meta property="og:image" content="/og-image-1200x630.png">
```

## 4. Typographie

- [ ] Charger Geist (400, 500, 600) et JetBrains Mono (400, 500).
- [ ] Mono pour : slugs de workspace, IDs, URLs, emails destinataires, payloads, en-têtes HTTP, badges de statut, horodatages.

## 5. Densité (« interface aérée »)

Les maquettes ont été aérées par rapport à la version précédente :

- [ ] Paddings de panneaux, cartes et lignes : ≈ +35 % (ex. 10 → 14, 12 → 16, 14 → 19/20, 16 → 22/24).
- [ ] Gaps : ≈ +30 % (ex. 8 → 10, 10 → 13/12, 12 → 16).
- [ ] Header : 50 → **56 px**. Liste de messages : 380 → **400 px**.
- [ ] Interligne du corps : 1,45 → **1,5**.
- [ ] **Ne pas** agrandir les hauteurs de contrôles (24 / 30 / 34) ni les badges.

En cas de doute, mesurer dans `mockups/Mailsink.dc.html` (styles inline).

## 6. Toggles et contrôles

- [ ] Toggle actif : fond `--ms-accent`, pastille blanche avec `box-shadow: 0 1px 2px rgba(0,0,0,.35)` pour rester visible sur le jaune.
- [ ] Case cochée : fond `--ms-accent`, coche `--ms-on-accent`.
- [ ] Focus : bordure `--ms-accent-text` + `--ms-focus-ring`.

## 7. Contrôle final

- [ ] Aucune occurrence de l'ancien cyan (`oklch(0.80 0.12 195)`, `oklch(0.52 0.11 205)`).
- [ ] Aucun texte blanc sur jaune.
- [ ] Contraste ≥ 4.5:1 pour tout texte en `--ms-accent-text` sur `--ms-bg` / `--ms-panel` en clair.
- [ ] Vérifier les deux thèmes sur : boîte de réception, inspecteur, logs, réglages (webhooks, connexions), panneau d'override.
