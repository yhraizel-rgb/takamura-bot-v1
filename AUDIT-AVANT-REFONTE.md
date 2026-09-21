# AUDIT-AVANT-REFONTE — Takamura Bot V1

## Verdict exécutif

**Verdict : refonte structurelle nécessaire avant tout usage de recette ou de production.** Le dépôt V1 contient un bot WhatsApp Baileys fonctionnel autour d’un unique `index.js`, une interface HTML statique et 29 commandes JavaScript. Les comportements métier principaux sont identifiables et peuvent être conservés, mais l’implémentation actuelle ne fournit pas les garanties minimales attendues pour un SaaS : l’API de pairage est une mutation publique en GET, la racine du projet est servie par Express, les credentials sont dans un sous-répertoire potentiellement accessible, l’état et les paramètres sont en mémoire, les restaurations au redémarrage ne sont pas orchestrées, et les commandes de masse ne disposent ni de confirmation ni de verrou par groupe.

L’audit a été réalisé sur le commit `20605e500a085c46dd1f3f9229641bbc82ad7df9`, cloné depuis `https://github.com/yhraizel-rgb/takamura-bot-v1.git`, puis figé sous le tag local `audit-baseline` avant toute modification fonctionnelle. Aucun compte WhatsApp réel n’a été utilisé et aucun risque dépendant d’un test réseau Baileys n’est présenté comme confirmé.

## Périmètre, méthode et limites

L’analyse a couvert `index.js`, `package.json`, `index.html`, les 29 fichiers de `commands/`, les assets, l’historique Git et la structure du dépôt. Les preuves ci-dessous citent les chemins et lignes du baseline. Les limites sont les suivantes : aucun environnement de recette n’a été fourni, aucune base de données n’existe dans V1, le trafic réel WhatsApp n’a pas été exercé, la configuration d’hébergement n’est pas connue et les dépendances n’ont pas encore été installées avec un lockfile reproductible.

## Architecture actuelle

Le point d’entrée `index.js` crée directement l’application Express, configure les body parsers, sert la racine du dépôt et gère les sockets Baileys dans le même module (`index.js:31-45`). Les sessions sont stockées sous `./sessions`, les bots actifs dans une `Map` globale et les commandes sont importées dynamiquement depuis `./commands` (`index.js:43-45`, `166-184`). Les paramètres et automatismes sont construits en mémoire pour chaque démarrage (`index.js:287-299`).

Le traitement des messages, des événements de groupe, de la reconnexion et des routes HTTP se trouve également dans ce fichier (`index.js:302-558`). Il n’existe pas de TypeScript, de couche de base de données, de migrations, de tests, de lockfile, de pipeline CI, de `.env.example`, de politique de backup ou de documentation d’exploitation substantielle. Le README actuel ne contient que le titre du projet.

## Inventaire des fonctionnalités à préserver

Les 29 commandes détectées et leurs aliases déclarés sont :

| Catégorie | Commandes à préserver | Aliases détectés |
|---|---|---|
| Groupe et rôles | `add`, `kick`, `kickall`, `left`, `mute`, `unmute`, `promote`, `promoteall`, `demote`, `demoteall`, `purge`, `resetlink`, `link` | Aucun alias déclaré |
| Mentions et information | `tag`, `tagall`, `tagadmin`, `menu`, `ping`, `owner`, `gpp` | `tagadmin`: `admins`, `admin`, `tagadmins`; `gpp`: `grouppp`, `groupicon`, `groupavatar` |
| Profil et médias | `img`, `photo`, `pp`, `setpp`, `sticker`, `take`, `vv`, `save`, `url` | Aucun autre alias déclaré |

Les fonctionnalités transverses actuelles sont le préfixe `.`, l’autorisation self-bot/owners, l’autoread, l’autoreact, l’autotyping, l’autorecording, le welcome, le bye et l’antilink déclarés dans `index.js:288-297`. Ces réglages doivent devenir persistants et par session. L’auto-adhésion actuelle à un groupe et à un canal est définie en dur dans `index.js:70-76` et exécutée à la connexion (`index.js:516-519`) : elle devra être désactivée par défaut et explicitement opt-in.

## Registre des risques

| ID | Criticité | Preuve dans le baseline | Impact | Validation attendue |
|---|---|---|---|---|
| R-01 | Critique | `app.use(express.static(__dirname))` à `index.js:40` | La racine du projet peut servir les sources, `package.json`, assets et potentiellement `sessions/` via HTTP. | Test HTTP négatif sur credentials, sources et manifestes ; seul `public/` doit répondre. |
| R-02 | Critique | `GET /pair-api/code` à `index.js:537-549` | Une mutation créatrice d’état est publique, sans authentification, CSRF, rate limit, audit ni idempotence. | Route GET absente ; POST authentifié, validé, limité, journalisé et verrouillé. |
| R-03 | Critique | `bots`, `global.bots`, `global.owners` et `process.env.NUMBER` à `index.js:45-65`, `364-365` | Le contexte d’une commande peut mélanger deux sessions sous concurrence ou réentrance. | Test à deux sessions simulées prouvant l’isolation owners/numéros/sockets. |
| R-04 | Élevée | `messages[0]` à `index.js:306` | Les autres messages d’un upsert sont ignorés ; l’ordre et la reprise ne sont pas définis. | Tous les messages admissibles traités via file bornée et déduplication TTL. |
| R-05 | Élevée | `setTimeout(..., 3000)` à `index.js:495-496` | Reconnexion fixe, timers multiples possibles, pas de jitter, plafond ni métriques ; suppression automatique à plusieurs codes (`482-493`). | Machine d’état, backoff borné, un timer/session, état `invalid`, politique de suppression explicite. |
| R-06 | Élevée | `useMultiFileAuthState` sur `./sessions` à `index.js:43-44`, `256-270` | Chemins relatifs, permissions non contrôlées, pas de backup/restauration progressive ni verrou inter-process. | Volume privé absolu, permissions minimales, backup restaurable, restauration limitée. |
| R-07 | Élevée | `requestPairingCode` déclenché depuis la route à `index.js:526-531` | Le pairage dépend directement de la requête HTTP et n’est pas protégé par lock par session. | Service SessionManager, lock local, idempotence et test de concurrence. |
| R-08 | Élevée | Opérations massives dans `commands/kickall.js:14-27`, `commands/purge.js:14-46`, `commands/promoteall.js:33-44` | Expulsions/promotions sans aperçu, confirmation expirante, verrou de groupe, limite ou bilan détaillé. | Confirmation unique et TTL, voie exclusive, plafonds et rapport succès/échecs. |
| R-09 | Élevée | Concaténation sans plafond dans `commands/vv.js:29-36`, `51-58`, `73-80` et `commands/setpp.js` | Un média peut consommer une quantité de mémoire non bornée ; risque DoS et temporaires non nettoyés. | Limites bytes/MIME/dimensions/durée/concurrence et tests de rejet. |
| R-10 | Élevée | Upload externe Catbox dans `commands/url.js:40+`, axios distant dans `commands/owner.js` | Pas d’allowlist, contrôle SSRF, timeout ou politique de confidentialité centralisée. | Client HTTP borné, réseaux privés bloqués, domaines autorisés et consentement/audit. |
| R-11 | Moyenne | `loadCommands()` avec import `?v=${Date.now()}` à `index.js:166-184`, appelé à chaque session à `287` | Le registre n’est pas unique par version ; collisions, aliases et métadonnées ne sont pas validés. | CommandRegistry chargé une fois, collisions détectées au démarrage, schéma de métadonnées. |
| R-12 | Moyenne | `bot.features` réinitialisé à chaque démarrage à `index.js:289-297` | Les automatismes ne sont pas persistants et l’API de réglages n’existe pas. | Table Settings versionnée, contrat API et migration testée. |
| R-13 | Moyenne | Absence de `tsconfig`, tests, lockfile, CI, `.gitignore` et scripts qualité | Installation et build non reproductibles, régression non détectée, secrets/runtime non exclus. | Node/TypeScript strict, lockfile, lint, tests, build et pipeline reproductibles. |
| R-14 | Moyenne | `innerHTML` dans l’interface à `index.html:898-900`, interpolation de données à `921-926` | Une réponse API non fiable peut être injectée dans le DOM. | Rendu textuel sûr, CSP stricte et test d’encodage. |
| R-15 | Moyenne | `console.log`/`console.error` nombreux, numéros dans les messages (`index.js:129-150`, `388-390`) | Pas de logs JSON, redaction, request ID, audit asynchrone ou masquage des numéros. | Pino structuré, redaction et métriques opérationnelles. |

## Architecture cible proposée

La refonte doit conserver un premier déploiement mono-worker mais préparer l’extension sans prétendre gérer plusieurs milliers de sockets sans mesure.

```text
src/
  config/          configuration Zod et chemins absolus
  controllers/     traduction HTTP -> cas d’usage
  routes/          /api/v1, /live, /ready, métriques
  middleware/      auth, RBAC, CSRF, validation, rate limit, request ID
  database/        ports, adaptateurs SQLite/PostgreSQL/MySQL, migrations
  services/        SessionManager, auth, audit, metrics, media policy
  modules/
    whatsapp/      BaileysGateway, états, locks, queues, reconnect
    commands/      registry, context immuable, policies, adaptateurs V1
  utils/           numéros, redaction, erreurs et horloges
public/            seuls assets web publics
runtime/           credentials/temp/logs privés hors webroot
```

Le `SessionManager` devient l’unique propriétaire du cycle de vie : états désiré/observé, verrou par session, fermeture avant recréation, credentials, restauration graduée, arrêt borné et backoff classifié. Une file par session, déduplication TTL et sérialisation conversation/groupe alimentent un `MessagePipeline` unique.

Le `CommandRegistry` doit reprendre les 29 noms et aliases, avec description, catégorie, permissions, cooldown, validation, risque et statut. Les commandes V1 seront adaptées derrière un `CommandContext` immuable ; aucune commande ne lira `global.owners` ni `process.env.NUMBER`. Les actions destructrices passent par un service de confirmation et un verrou par groupe.

La persistance cible comprend Users, Sessions, Commands, Logs, Settings, Permissions et RefreshTokens, avec identifiants internes distincts des numéros. SQLite est adapté au développement ; PostgreSQL est le choix de référence pour la production, tandis que MySQL reste supporté par l’adaptateur et les migrations validées.

## Plan de migration incrémental et retour arrière

1. **Baseline et audit** : tag `audit-baseline`, rapport committé ; aucune modification métier avant cette étape.
2. **Fondations** : TypeScript strict, configuration validée, structure `src/`, lockfile, scripts qualité, `.gitignore`, logs et erreurs stables.
3. **Sécurité HTTP** : webroot `public/`, Helmet/CSP, CORS explicite, validation Zod, limites, rate limit, auth JWT court + refresh rotatif httpOnly, CSRF et RBAC.
4. **Données** : schéma, migrations SQLite/PostgreSQL/MySQL, persistance des sessions/settings/commandes/audit.
5. **SessionManager** : migration Baileys avec états, locks, restauration, reconnexion et arrêt gracieux ; aucun nouveau pairage tant que les tests ne passent pas.
6. **Pipeline messages et registre** : traitement de tous les upserts, déduplication, queues bornées et contexte immuable.
7. **Compatibilité commandes** : adaptateur pour les 29 commandes, policies et confirmations ; tests de non-régression à deux sessions.
8. **Dashboard** : pages Sessions, Commandes, Logs et Vue d’ensemble alimentées par contrats API réels et états vides explicites.
9. **Exploitation** : Docker non-root, compose, PM2 mono-propriété, Nginx TLS, healthchecks, CI, runbook et backup/restore.

Chaque phase doit être committée séparément et revenir au commit précédent en cas d’échec. La coexistence temporaire d’un adaptateur V1 permet de comparer les comportements sans exposer la racine du dépôt.

## Options d’exécution et de déploiement

| Option | Approche | Coût récurrent indicatif | Complexité | Compromis |
|---|---|---:|---|---|
| A. Petite VM supervisée | Un processus Node/PM2, SQLite ou PostgreSQL managé, volume privé | Environ 10–40 €/mois selon VM, stockage et base | Faible à moyenne | Simple et économique ; point de panne unique et capacité limitée. Recommandée pour recette et petit pilote. |
| B. Workers partitionnés | Plan de contrôle API + workers, sessions affectées exclusivement, registre transactionnel et baux | Environ 60–250 €/mois selon nombre de workers, base, cache et observabilité | Moyenne à élevée | Meilleure isolation et montée progressive ; nécessite leasing, métriques et tests de capacité. |
| C. Plan de contrôle + pool dédié | API/dashboard séparés des workers WhatsApp, secrets manager, files et autoscaling contrôlé | Souvent 200 €/mois et plus | Élevée | Meilleure résilience et gouvernance multi-tenant ; coûts et opérations nettement supérieurs, à justifier par des mesures réelles. |

Aucune option n’est imposée par cet audit. Le scale-out ne doit être entrepris qu’après budget mémoire par session, seuils de file, taux de reconnexion, durée de traitement et test de capacité Baileys.

## Critères de validation

La validation finale devra démontrer : routes de secrets inaccessibles ; absence de pairage GET ; POST authentifié et verrouillé ; isolation de deux sessions ; restauration progressive ; traitement multi-messages et déduplication ; présence des 29 commandes et aliases ; confirmation des opérations destructrices ; auth/RBAC/refresh/CSRF/Helmet/CORS/rate limits testés ; dashboard accessible et alimenté par des données autorisées ; installation propre avec lockfile, migrations, lint, typecheck, tests et build ; artefacts Docker/Nginx/PM2/CI et procédure de rollback testée.

## Personnalisation à confirmer

Les valeurs par défaut devront être centralisées dans `src/config/product.ts` et `src/config/policies.ts` en attendant validation : produit **Takamura Bot Pro**, thème sombre graphite avec accent violet, langue française, fuseau `Europe/Paris`, premier Owner initialisé par variable d’environnement, auto-join désactivé, logs masqués et conservation courte en développement. Restent à confirmer : nom/slogan/logo/support, premier Owner, rôles autorisés à créer/supprimer une session, politique self-bot/team/multi-tenant, pays et formats de numéros, owners/sudo initiaux, quotas, base et région d’hébergement, rétention/chiffrement, domaine/TLS, supervision/alertes et budget.

## Conclusion

La V1 doit être considérée comme une preuve de concept à fonctionnalités riches, non comme une base directement déployable en production. Les fonctionnalités existantes sont suffisamment inventoriées pour être portées, mais les garanties de sécurité, isolation, persistance, observabilité et reproductibilité doivent être livrées avant l’ouverture à des utilisateurs ou comptes WhatsApp réels.
