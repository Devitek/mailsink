# Mailsink — Brand & UI kit (Jaune Poste)

Package à destination de l'agent de code chargé de mettre à jour le projet.

> **Tout arrive. Rien ne part.**

## Contenu

```
mailsink-brand/
├── README.md               ← ce fichier
├── docs/
│   ├── BRAND.md            ← logo, baseline, couleurs, typo, règles d'usage
│   ├── TOKENS.md           ← référence complète des design tokens
│   └── IMPLEMENTATION.md   ← checklist de migration pour l'agent de code
├── tokens/
│   ├── tokens.css          ← variables CSS (light par défaut + dark)
│   ├── tokens.json         ← mêmes valeurs, format JSON (oklch + hex)
│   └── tailwind.preset.js  ← preset Tailwind basé sur les variables CSS
├── logo/
│   ├── favicon.svg
│   ├── svg/                ← mark, lockups, monochromes, symbole seul
│   └── png/                ← mark 16→1024, apple-touch, maskable, lockups @2x
├── social/
│   └── og-image-1200x630.png
└── mockups/
    ├── Mailsink.dc.html         ← prototype interactif de référence
    ├── Mailsink Charte.dc.html  ← charte interactive (accent / mode)
    ├── support.js               ← runtime requis pour ouvrir les .dc.html
    └── screenshots/
```

## Ordre de lecture recommandé

1. `docs/IMPLEMENTATION.md` — ce qu'il faut changer, dans l'ordre.
2. `docs/TOKENS.md` — valeurs de référence.
3. `docs/BRAND.md` — règles visuelles en cas de doute.

Les maquettes `.dc.html` s'ouvrent directement dans un navigateur (garder `support.js` à côté). Elles font foi pour l'espacement, les états et le comportement ; tous les styles y sont inline.

## Décisions clés

- **Thème clair par défaut**, thème sombre disponible via `[data-theme="dark"]`.
- **Accent Jaune Poste** `oklch(0.86 0.16 92)` ≈ `#f7cd3a`, toujours avec une **encre sombre** dessus.
- En clair, le jaune ne sert **qu'en aplat** ; le texte accentué utilise l'**ocre** `oklch(0.50 0.11 80)` ≈ `#845b00`.
- **Override** : passe de l'ambre à l'**orange** pour ne pas se confondre avec l'accent.
- Logo **1a « Le Bac »** : flèche qui tombe dans un bac, tuile arrondie.
- Interface **aérée** : paddings ≈ +35 %, gaps ≈ +30 %, header 56 px, liste 400 px.
