# Changelog

## [0.3.0](https://github.com/Devitek/mailsink/compare/v0.2.0...v0.3.0) (2026-11-24)


### Features

* **docs:** rend les diagrammes Mermaid du site et solde les suivis du site et de la Phase 5 ([#150](https://github.com/Devitek/mailsink/issues/150)) ([#151](https://github.com/Devitek/mailsink/issues/151)) ([c7ec886](https://github.com/Devitek/mailsink/commit/c7ec886adf428553ae58ffef81991035ba2741b3))
* **ingestion:** complète le dialecte Brevo, lecture des envois, contacts bloqués et webhooks ([#149](https://github.com/Devitek/mailsink/issues/149)) ([#152](https://github.com/Devitek/mailsink/issues/152)) ([27b9617](https://github.com/Devitek/mailsink/commit/27b961726ad08cdc520ad08caa6d78e042b4cdb1))
* **simulation:** ajoute l'adresse invalide email.invalid et solde les suivis de la vague 0.3 ([#153](https://github.com/Devitek/mailsink/issues/153)) ([#158](https://github.com/Devitek/mailsink/issues/158)) ([da6f15a](https://github.com/Devitek/mailsink/commit/da6f15a6f1b86a1e9de8c62132064cf60e8e5ddd))

### Changements de comportement et migrations

* **Nouveau statut simulé `invalid` et événement `email.invalid`** (adresse de destinataire invalide) : utilisable dans les taux, les règles par destinataire (`*+invalid@*`), le statut forcé (API, MCP, bouton « Invalid » de l'interface) et la CLI (`--invalid`). Émis en `invalid_email` vers Brevo (abonnement `invalid`), en `email.failed` vers Resend, en `email.invalid` en unified. Une adresse invalide n'entre pas dans la suppression list.
* **Brevo : un envoi en échec (`failed`) est émis en `error`** (abonnement `error`), comme chez Brevo, et non plus ignoré.
* **Brevo, `POST /v3/smtp/email`** : l'en-tête HTTP `Idempotency-Key` est désormais ignoré ; la clé d'idempotence est l'entrée `idempotencyKey` du champ `headers`, qui doit être un UUID (sinon `400 invalid_parameter`) ; toute réutilisation dans les 30 minutes répond `400 duplicate_parameter` sans traitement (D279).
* Brevo, routes de lecture : `startDate` et `endDate` sont des jours du fuseau du workspace.
* Les endpoints Resend abonnés à `email.failed` reçoivent aussi les adresses invalides (migration automatique) ; les identifiants écrits dans l'URL d'un endpoint Brevo avant la 0.3.0 sont déplacés en authentification basic (migration automatique).

## [0.2.0](https://github.com/Devitek/mailsink/compare/v0.1.0...v0.2.0) (2026-11-24)


### Features

* **api:** génère la spécification OpenAPI 3.1 depuis les contrats et la sert sur /openapi.json ([#124](https://github.com/Devitek/mailsink/issues/124)) ([#129](https://github.com/Devitek/mailsink/issues/129)) ([174858c](https://github.com/Devitek/mailsink/commit/174858c7aa3b97970bcc942eed10765ed9d8bd13))
* **capture:** ajoute les helpers Vitest et Jest @devitek/mailsink-vitest ([#127](https://github.com/Devitek/mailsink/issues/127)) ([#139](https://github.com/Devitek/mailsink/issues/139)) ([74fcf42](https://github.com/Devitek/mailsink/commit/74fcf4223c4b07c85696425025cf43078bfefbdb))
* **cli:** ajoute les commandes de pilotage workspace, wait, override et purge ([#50](https://github.com/Devitek/mailsink/issues/50)) ([#138](https://github.com/Devitek/mailsink/issues/138)) ([109ff59](https://github.com/Devitek/mailsink/commit/109ff59820d24bdfae82b2298c09f655e2f41ca1))
* **playwright:** ajoute les helpers Playwright @devitek/mailsink-playwright ([#126](https://github.com/Devitek/mailsink/issues/126)) ([#137](https://github.com/Devitek/mailsink/issues/137)) ([cca294a](https://github.com/Devitek/mailsink/commit/cca294a6f452a4571b62463052219d0e95d8a10d))
* **sdk:** ajoute le SDK TypeScript @devitek/mailsink ([#125](https://github.com/Devitek/mailsink/issues/125)) ([#130](https://github.com/Devitek/mailsink/issues/130)) ([d5ec902](https://github.com/Devitek/mailsink/commit/d5ec902d8bf840f122c8d837c6f05bf00994cc35))

## 0.1.0 (2026-11-23)

Première version publique : Mailsink capture les emails transactionnels sans jamais les délivrer, pour les tests E2E et les environnements de staging. Image `ghcr.io/devitek/mailsink` (amd64, arm64), stockage PGlite embarqué ou PostgreSQL.

### Features

* **workspaces :** workspaces persistants (staging) et éphémères avec TTL d'inactivité et nettoyage automatique, API Admin complète (création avec connexions en une requête, liste, édition, suppression, rotation des clés `msk_` et `mskw_`, templates Brevo, journaux sans workspace) ([#13](https://github.com/Devitek/mailsink/issues/13), [#19](https://github.com/Devitek/mailsink/issues/19), [#20](https://github.com/Devitek/mailsink/issues/20), [#30](https://github.com/Devitek/mailsink/issues/30), [#106](https://github.com/Devitek/mailsink/issues/106))
* **ingestion :** API native `POST /v1/emails` et batch (EML brut, pièces jointes, liens, idempotence) ([#14](https://github.com/Devitek/mailsink/issues/14))
* **ingestion :** dialecte Resend compatible avec le SDK officiel (`/emails`, batch, lecture) ([#28](https://github.com/Devitek/mailsink/issues/28))
* **ingestion :** dialecte Brevo compatible avec le SDK officiel (`/v3/smtp/email`, `messageVersions`, templates et `{{ params.x }}`) ([#29](https://github.com/Devitek/mailsink/issues/29))
* **smtp :** serveur SMTP avec AUTH PLAIN/LOGIN, STARTTLS optionnel et parsing MIME, compatible Nodemailer ([#31](https://github.com/Devitek/mailsink/issues/31))
* **simulation :** statuts tirés selon des taux, règles déterministes par destinataire, latence, reports `deferred`, ouvertures et clics automatiques ([#16](https://github.com/Devitek/mailsink/issues/16), [#21](https://github.com/Devitek/mailsink/issues/21), [#34](https://github.com/Devitek/mailsink/issues/34))
* **simulation :** overrides temporaires (taux, règles, latence, chaos HTTP et SMTP, rate limit) avec reset, liste de suppression automatique, rate limiting par connexion ([#22](https://github.com/Devitek/mailsink/issues/22), [#23](https://github.com/Devitek/mailsink/issues/23), [#24](https://github.com/Devitek/mailsink/issues/24), [#25](https://github.com/Devitek/mailsink/issues/25))
* **webhooks :** endpoints par workspace ou connexion, formats unified, Resend (signature Svix) et Brevo indépendants du canal d'ingestion, retries, rejeu `exact` ou `resign`, test d'envoi, blocage optionnel des adresses privées ([#32](https://github.com/Devitek/mailsink/issues/32), [#33](https://github.com/Devitek/mailsink/issues/33), [#47](https://github.com/Devitek/mailsink/issues/47), [#94](https://github.com/Devitek/mailsink/issues/94))
* **capture :** API de capture (recherche, détail, EML brut, pièces jointes, purge), flux SSE temps réel, attente `wait=true`, événements forcés (ouverture, clic, statut), messages de démo ([#15](https://github.com/Devitek/mailsink/issues/15), [#26](https://github.com/Devitek/mailsink/issues/26), [#34](https://github.com/Devitek/mailsink/issues/34), [#62](https://github.com/Devitek/mailsink/issues/62))
* **capture :** journaux des requêtes API et des sessions SMTP, avec API de lecture ([#35](https://github.com/Devitek/mailsink/issues/35))
* **mcp :** serveur MCP en Streamable HTTP et en stdio (`mailsink mcp`), 13 outils pour lire, attendre, simuler et purger ([#44](https://github.com/Devitek/mailsink/issues/44), [#99](https://github.com/Devitek/mailsink/issues/99))
* **interface :** connexion par clé admin, sélecteur de workspace, gestion des workspaces et connexions, boîte de réception temps réel, visionneuse (aperçu isolé, texte, liens, source MIME, historique), explorateur de logs, panneau d'override, liste de suppression, réglages et webhooks ([#37](https://github.com/Devitek/mailsink/issues/37) à [#43](https://github.com/Devitek/mailsink/issues/43), [#104](https://github.com/Devitek/mailsink/issues/104), [#106](https://github.com/Devitek/mailsink/issues/106), [#112](https://github.com/Devitek/mailsink/issues/112))
* **interface :** charte « Jaune Poste », thèmes clair et sombre, interface en anglais et en français ([#10](https://github.com/Devitek/mailsink/issues/10), [#36](https://github.com/Devitek/mailsink/issues/36))
* **infra :** image Docker multi-arch, `docker-compose.yml` (PGlite ou PostgreSQL), commande `mailsink migrate`, option `MAILSINK_TRUST_PROXY` ([#11](https://github.com/Devitek/mailsink/issues/11), [#18](https://github.com/Devitek/mailsink/issues/18), [#45](https://github.com/Devitek/mailsink/issues/45), [#99](https://github.com/Devitek/mailsink/issues/99))
* **docs :** guides de la recette E2E (Playwright, un workspace par worker) et de configuration MCP ([#27](https://github.com/Devitek/mailsink/issues/27), [#44](https://github.com/Devitek/mailsink/issues/44))

### Performance

* **db :** index de recherche plein texte et de pagination, rétention en parcours d'index, polices réduites aux sous-ensembles latins ([#71](https://github.com/Devitek/mailsink/issues/71), [#77](https://github.com/Devitek/mailsink/issues/77))
