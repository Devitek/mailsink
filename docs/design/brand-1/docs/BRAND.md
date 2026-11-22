# Charte Mailsink

## Positionnement

Outil développeur : bac à sable pour emails transactionnels (Resend, Brevo, SMTP). Sobre, technique, précis. Un seul accent ; tout le reste est neutre.

## Baseline

| Usage | Texte |
|---|---|
| Principale | **Tout arrive. Rien ne part.** |
| Descriptive (SEO, stores) | Le bac à sable de vos emails transactionnels. |
| Développeur (README, CLI) | Branchez Resend, Brevo ou SMTP. Changez une URL. C'est tout. |
| International | Every email caught. None delivered. |

En titre, la seconde phrase peut prendre la couleur `--ms-accent-text`.

## Logo — « Le Bac »

Flèche descendante qui tombe dans un bac, dans une tuile arrondie jaune.

**Construction**
- Grille 64 u, rayon de tuile 15 u (≈ 23 %).
- Trait 5,5 u, terminaisons et jointures rondes.
- Petites tailles : 6 u ≤ 32 px, 6,5 u ≤ 24 px, 7 u à 16 px (fichier `mark-small-16.svg`).

**Logotype** : `mailsink`, tout en minuscules, Geist 600, approche −0,04 em. Espace symbole/texte = 0,25 × hauteur du symbole. Hauteur de capitale ≈ 0,7 × hauteur du symbole.

**Zone de protection** : ½ symbole sur tous les côtés.

**Fichiers**

| Fichier | Usage |
|---|---|
| `svg/mark.svg` | Symbole principal (jaune + encre) |
| `svg/mark-dark-bg.svg` | Variante calibrée pour fond sombre |
| `svg/mark-small-16.svg` | ≤ 16 px (traits épaissis) |
| `svg/mark-reversed.svg` | Sur aplat jaune (tuile encre, flèche jaune) |
| `svg/mark-mono-black.svg` / `-white` | Supports une couleur |
| `svg/symbol-*.svg` | Pictogramme sans tuile |
| `svg/lockup-on-light.svg` / `-on-dark` / `-on-yellow` | Symbole + logotype |
| `favicon.svg` | Favicon vectoriel |
| `png/mark-{16…1024}.png` | Rasters transparents |
| `png/apple-touch-icon-180.png` | iOS |
| `png/maskable-192.png` / `-512` | PWA (zone de sécurité respectée) |
| `png/lockup-*-2x.png` | Lockups raster (avec/sans fond) |

> Les lockups SVG utilisent un `<text>` en Geist. Si la police n'est pas chargée dans le contexte d'affichage, utiliser les PNG ou vectoriser le texte.

**Interdits** : déformer, recolorer la flèche hors palette, ajouter ombre/dégradé/contour, poser le symbole jaune sur un fond jaune ou orange, utiliser des majuscules dans le logotype.

## Couleurs

- **Accent — Jaune Poste** : la marque, la sélection, l'action principale, le focus. Jamais un statut.
- **Encre sur accent** : toujours sombre (`#16171a` / `#0b0c0e`), jamais de blanc sur jaune.
- **Accent texte** : en clair, ocre `#845b00` (le jaune n'est pas lisible sur fond clair). En sombre, le jaune lui-même.
- **Override** : orange, réservé aux réglages de simulation modifiés.
- **Statuts** : couleurs dédiées (delivered, soft_bounce, hard_bounce, complained, deferred, failed, suppressed). Ne pas les réutiliser à d'autres fins.
- **Connexions** : Resend (neutre), Brevo (vert), SMTP (violet).

Voir `TOKENS.md` pour les valeurs.

## Typographie

- **Geist** 400/500/600 — interface, titres, texte courant.
- **JetBrains Mono** 400/500 — tout ce qui se copie-colle : slugs, IDs, URLs, payloads, codes, en-têtes HTTP, badges de statut.

| Rôle | Taille / graisse | Approche |
|---|---|---|
| display | 48 / 600 | −0,04 em |
| title | 22 / 600 | −0,02 em |
| heading | 15 / 600 | −0,015 em |
| body | 13 / 400, interligne 1,5 | — |
| mono | 12,5 / 400 | — |
| label | 11 / 500, majuscules | +0,06 em |

## Formes et rythme

- Rayons : 4 (badges) · 6 (segments, petits boutons) · 8 (champs, boutons, blocs code) · 10 (cartes) · 14 (grands panneaux).
- Espacement en base 4 ; privilégier 12 / 16 / 20 / 24 dans les panneaux.
- Bordures 1 px `--ms-border` ; pas d'ombres sauf menus, toasts et panneaux flottants.

## Mouvement

- `fast` 120 ms : hover, toggles.
- `base` 200 ms ease-out : panneaux, popovers, tiroirs.
- Pulse 2 s : indicateur « Live » uniquement.
