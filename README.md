# Takamura Bot Pro

Takamura Bot Pro est une base SaaS sécurisée pour piloter des sessions WhatsApp Baileys. La livraison conserve les 29 commandes V1 dans `commands/` et les expose dans un registre contrôlé ; les commandes à risque (`kickall`, `purge`, `promoteall`, `demoteall`) sont désactivées par défaut en attendant une voie de confirmation complète.

## Démarrage local

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Le dashboard est disponible sur `http://localhost:8080`. Pour initialiser le premier Owner, renseigner `FIRST_OWNER_EMAIL` et `FIRST_OWNER_PASSWORD` puis exécuter `npm run migrate`. La création de session s’effectue uniquement via `POST /api/v1/sessions` authentifié et protégé par CSRF ; aucune route legacy GET de pairage n’est conservée.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
npm audit
```

## Railway sans SQL

Le dépôt est déployable sur Railway avec un seul service Node.js et un Volume monté sur `/app/runtime`. Aucune base SQL n’est nécessaire : la persistance applicative utilise le store JSON atomique privé. Pour une recette sans login, définir `AUTH_MODE=test`; pour la version finale, définir `AUTH_MODE=production`, un `JWT_SECRET` aléatoire long et les variables `FIRST_OWNER_*`. Le guide complet est dans [`docs/RAILWAY.md`](docs/RAILWAY.md).

## Architecture

`src/config` valide l’environnement ; `src/middleware` applique request ID, Helmet, CORS, auth, RBAC et CSRF ; `src/database` isole la persistance runtime ; `src/modules/whatsapp` centralise le cycle de vie des sessions ; `src/modules/commands` charge une fois le registre de compatibilité ; `public/` est l’unique webroot. Les credentials et fichiers runtime doivent rester dans un volume privé hors webroot.

La persistance JSON livrée est le store de recette et de production mono-worker ; le Volume Railway doit être sauvegardé. Un seul worker doit posséder une session. Le scale-out exige affectation exclusive, bail transactionnel, secrets manager et partitionnement.

## Décisions par défaut

| Paramètre | Défaut | Emplacement | Validation |
|---|---|---|---|
| Produit | Takamura Bot Pro | `src/config/env.ts` | Vérifier le dashboard et les emails |
| Auto-join | Désactivé | `AUTO_JOIN_ENABLED=false` | Test de non-adhésion automatique |
| Session max | À définir par capacité | politique d’environnement | Test mémoire et file |
| Logs | Pino JSON, téléphone masqué | `src/utils/logger.ts` | Inspecter redaction |
| Rétention | 30 jours | `LOG_RETENTION_DAYS` | Exécuter la purge contrôlée |
| Premier Owner | Variables d’environnement | `FIRST_OWNER_*` | `npm run migrate` |

## Exploitation et sécurité

Ne jamais committer `.env`, `runtime/` ou credentials Baileys. Utiliser HTTPS, un reverse proxy, un secret JWT aléatoire de longueur suffisante, des sauvegardes chiffrées et une rotation testée. `/live` indique seulement que le processus répond ; `/ready` doit être étendu aux dépendances critiques de la base et du registre avant production. Les numéros ne sont jamais renvoyés en clair dans les listes.

Baileys n’est pas une garantie de capacité : mesurer mémoire/socket, reconnects, profondeur et âge des files avant tout relèvement de plafond. Les comptes connectés doivent être autorisés et les automatismes, exports et partages respecter le consentement et les conditions applicables de WhatsApp.

Voir `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`, `docs/PERMISSIONS.md` et `AUDIT-AVANT-REFONTE.md`.
