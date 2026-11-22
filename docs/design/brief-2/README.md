# Brief 2 · Écran de connexion et sélecteur de langue (#63)

Livrables :

- `screens/` : 28 PNG (L1a à L1e en bureau 1440 et en 390, H2a à H2d en bureau 1440 ; clair et sombre). Captures en français, sauf H2c.
- `prototype/` : prototype interactif à jour. Ouvrir `Mailsink.dc.html` en gardant `support.js` et `Login.dc.html` à côté. `Planches.dc.html` affiche tous les cadres ; son réglage `lang` passe les écrans de connexion en anglais.

Le prototype s'ouvre sur l'écran de connexion. Clé valide : `msk_admin_4f8a2c91d7e34b6a9f0e`. Le bouton **Coller** la saisit si le presse-papiers est vide ou refusé. Trois clés erronées déclenchent L1e. Depuis le menu **FR / EN** de l'en-tête : **Se déconnecter**, et **Simuler l'expiration de session** (élément réservé au prototype) pour voir L1d.

## 1. Écran de connexion (L1)

### Composition (Proposition, à arbitrer)

- Une carte centrée de 420 px sur le fond `--ms-bg`. En 390, la carte disparaît : le contenu occupe toute la largeur, sans bordure.
- De haut en bas : le lockup, la baseline en petit (`--ms-text-muted`), l'éventuelle bannière d'état, le titre et la consigne, le bloc instance (URL et version en mono), le champ, le bouton, puis l'aide « Où trouver la clé ? ». Sous la carte, une ligne de réassurance sur le cookie de session.
- **Baseline conservée**, en discret : elle rappelle ce qu'est l'outil à une personne qui reçoit un lien sans contexte, sans concurrencer le titre.
- **Bloc instance** : il confirme qu'on se connecte au bon serveur (staging et non local), point utile quand plusieurs instances coexistent.
- En haut à droite : le sélecteur de langue et la bascule clair / sombre, pour que le thème soit choisi avant la connexion.

### Interactions

- Focus initial dans le champ (L1a montre l'anneau de focus).
- Champ masqué par défaut (`type="password"`, `autocomplete="current-password"`). **Afficher / Masquer** et **Coller** sont intégrés au champ, à droite.
- Entrée valide le formulaire ; le bouton reste désactivé tant que le champ est vide.
- Après une clé refusée, le focus revient dans le champ avec la saisie sélectionnée, prête à être remplacée.
- Après connexion, retour à la page d'origine (L1d), sinon à la boîte de réception du dernier workspace.
- 390 : champ, bouton, langues et thème à 48 px de haut (40 px plus 3 px de marge de chaque côté pour les boutons de langue), tous en pleine largeur.
- Accessibilité : `label` lié au champ, `aria-invalid` et `aria-describedby` sur l'erreur, `role="status"` pour L1d, `role="alert"` pour L1e, attribut `lang` sur chaque nom de langue.

### États

**L1c, vérification** : champ grisé et inactif ; le bouton garde l'aplat jaune avec une icône de chargement.

**L1e, trop de tentatives**, comportement pendant l'attente (Proposition, à arbitrer) :
- la bannière affiche un compte à rebours en direct ;
- le champ reste saisissable, pour pouvoir coller la bonne clé en attendant ;
- le bouton est désactivé et affiche le même compte à rebours ;
- à zéro, tout se réactive sans recharger la page.

La durée (42 s dans les maquettes) et le seuil (3 essais) viennent du serveur, qui doit renvoyer `Retry-After`.

**L1b** : le message « 2 essais restants » suppose que le serveur expose le nombre d'essais restants. Sinon, supprimer cette phrase (Proposition, à arbitrer).

### Textes

| Clé | Français | English |
|---|---|---|
| Baseline | Tout arrive. Rien ne part. | Every email caught. None delivered. |
| Titre | Connexion à l'instance | Sign in to this instance |
| Consigne | Saisissez la clé d'administration que l'opérateur de cette instance vous a transmise. | Enter the admin key the operator of this instance gave you. |
| Libellé | Clé d'administration | Admin key |
| Placeholder | msk_admin_… | msk_admin_… |
| Afficher / Masquer | Afficher / Masquer | Show / Hide |
| Coller | Coller | Paste |
| Bouton (L1a, L1b, L1d) | Se connecter | Sign in |
| Bouton (L1c) | Vérification… | Checking… |
| Bouton (L1e) | Réessayer dans 0:42 | Try again in 0:42 |
| Erreur (L1b) | **Clé refusée.** Vérifiez qu'elle correspond à `MAILSINK_ADMIN_KEY` sur le serveur. 2 essais restants avant une pause. | **Key rejected.** Check that it matches `MAILSINK_ADMIN_KEY` on the server. 2 attempts left before a pause. |
| Bannière (L1d) | Votre session a expiré. Reconnectez-vous pour revenir à `/messages/msg_01JDA7K3QX9R`. | Your session has expired. Sign in again to return to `/messages/msg_01JDA7K3QX9R`. |
| Bannière (L1e) | **Trop de tentatives.** Pour protéger l'instance, les essais sont suspendus pendant 0:42. | **Too many attempts.** To protect this instance, sign-in is paused for 0:42. |
| Aide (Proposition, à arbitrer) | **Où trouver la clé ?** Elle est définie au déploiement dans la variable `MAILSINK_ADMIN_KEY`. Demandez-la à l'opérateur de l'instance : il n'y a ni compte ni mot de passe oublié. | **Where do I find the key?** It is set at deployment in the `MAILSINK_ADMIN_KEY` variable. Ask the instance operator: there are no accounts and no password reset. |
| Réassurance | La clé n'est jamais stockée dans le navigateur : elle est échangée contre un cookie de session. | The key is never stored in your browser: it is exchanged for a session cookie. |
| Bascule thème (title) | Basculer clair / sombre | Toggle light / dark |

## 2. En-tête de l'application (H2)

### Forme du sélecteur (Proposition, à arbitrer)

Un seul nouvel élément dans l'en-tête : un bouton compact qui affiche le code de la langue active (**FR** ou **EN**, en mono), placé juste avant la bascule de thème. Il ouvre un menu **Langue et session** :

1. **Langue** : English, Français (endonymes ; une coche pour la langue active ; code ISO en discret à droite). Le changement est immédiat, sans rechargement, et le menu reste ouvert pour confirmer visuellement le choix.
2. **Instance** : URL et version, en rappel.
3. **Se déconnecter**.

Raisons :
- L'en-tête est déjà dense. Un sélecteur segmenté FR / EN prendrait environ 90 px et ne passerait pas à l'échelle quand la communauté ajoutera des langues.
- Regrouper la langue et la session évite un menu « compte » trompeur, puisqu'il n'y a pas de comptes.
- La bascule de thème reste un bouton direct, comme décidé (B1-4).

**Sans protection** (`MAILSINK_UI_AUTH=none`, H2d) : le menu garde la langue et l'instance ; la ligne de déconnexion est remplacée par une note : « Protection désactivée `MAILSINK_UI_AUTH=none` : pas de connexion ni de déconnexion. »

### Textes

| Clé | Français | English |
|---|---|---|
| Bouton (title) | Langue et session | Language and session |
| Section | Langue | Language |
| Section | Instance | Instance |
| Action | Se déconnecter | Sign out |
| Note sans protection | Protection désactivée `MAILSINK_UI_AUTH=none` : pas de connexion ni de déconnexion. | Protection disabled `MAILSINK_UI_AUTH=none`: no sign-in and no sign-out. |

### H2c, interface en anglais

Le prototype traduit l'en-tête, la liste des messages et l'inspecteur (onglets, libellés, actions). Les données restent inchangées : les sujets et contenus des emails sont ceux des messages capturés. Les vues Logs, Paramètres et le panneau d'override ne sont pas traduites dans ce prototype ; elles suivent les mêmes règles.

Format de date : « 22 nov. 2026 » en français, « Nov 22, 2026 » en anglais.

## 3. Écarts à la charte et tokens

- **Couleur d'erreur** : la charte ne définit pas de token « danger ». L1b et L1e réutilisent `--ms-status-failed`, ce qui contredit la règle « ne pas réutiliser les couleurs de statut ». Proposition, à arbitrer : ajouter un alias `--ms-danger: var(--ms-status-failed)` dans `tokens.css`.
- **Hauteur de contrôle** : le champ et le bouton de connexion font 44 px sur bureau et 48 px en 390, au-delà de l'échelle `--ms-control-h-lg` (34). Écart volontaire pour un écran à action unique et pour la cible tactile. Proposition, à arbitrer : ajouter `--ms-control-h-xl: 44px`.
- **Rayons** : 16 px pour la carte et 10 px pour le champ et le bouton. La carte dépasse l'échelle (`xl` = 14). Proposition, à arbitrer : passer la carte à 14.

Tokens utilisés : `--ms-bg`, `--ms-panel`, `--ms-raised`, `--ms-hover`, `--ms-border`, `--ms-border-strong`, `--ms-text`, `--ms-text-muted`, `--ms-text-faint`, `--ms-accent` (aplats), `--ms-on-accent`, `--ms-accent-text` (focus, coche du menu), `--ms-status-failed`, `--ms-font-sans`, `--ms-font-mono`.

Les règles de la charte sont respectées : un seul accent, jamais de texte blanc sur jaune, texte accentué en ocre en thème clair, aucun tiret cadratin dans les textes.

## 4. Fichiers

```
brief-2/
├── README.md
├── screens/
│   ├── L1{a..e}-{slug}-bureau-{clair|sombre}.png
│   ├── L1{a..e}-{slug}-390-{clair|sombre}.png
│   └── H2{a..d}-{slug}-bureau-{clair|sombre}.png
└── prototype/
    ├── Mailsink.dc.html   ← application + passage par la connexion
    ├── Login.dc.html      ← écran de connexion (props : initialState, lang, theme, device)
    ├── Planches.dc.html   ← tous les cadres des captures
    └── support.js
```

Le prototype n'affiche aucun contenu dans l'aperçu de l'email (iframe) des captures H2. Cette zone n'est pas concernée par le brief.
