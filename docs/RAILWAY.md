# Déploiement Railway sans SQL

Le chemin Railway n’utilise aucune base SQL. Le store applicatif est un fichier JSON atomique dans `RUNTIME_DIR`, avec permissions privées. Sur Railway, ajouter un **Volume** monté sur `/app/runtime`; sans volume, les sessions et utilisateurs sont perdus lors d’un redeploy ou d’un redémarrage.

## Version test sans login

Créer un service Railway depuis ce dépôt, ajouter un volume `/app/runtime`, puis définir :

```env
NODE_ENV=production
AUTH_MODE=test
JWT_SECRET=<secret aleatoire de 32 caracteres ou plus>
RUNTIME_DIR=/app/runtime
PUBLIC_ORIGIN=https://<domaine-railway>
CORS_ORIGINS=https://<domaine-railway>
```

Le frontend obtient automatiquement un token de démonstration via `GET /api/v1/auth/demo`. Ce mode ne doit jamais être utilisé avec des comptes WhatsApp réels ou des données sensibles.

## Version finale prête à utiliser

Passer `AUTH_MODE=production`, définir `FIRST_OWNER_EMAIL` et `FIRST_OWNER_PASSWORD`, puis redéployer. Exécuter une fois `npm run migrate` dans un shell Railway ou initialiser l’Owner avec la commande de migration. En production, `/api/v1/auth/demo` répond `404`, les routes d’administration exigent un JWT, le refresh token est httpOnly et le CSRF reste obligatoire pour les mutations.

Variables minimales :

```env
NODE_ENV=production
AUTH_MODE=production
PORT=8080
JWT_SECRET=<secret aleatoire long>
RUNTIME_DIR=/app/runtime
FIRST_OWNER_EMAIL=owner@example.com
FIRST_OWNER_PASSWORD=<mot de passe long>
PUBLIC_ORIGIN=https://<domaine-railway>
CORS_ORIGINS=https://<domaine-railway>
```

## Contrôles après déploiement

Vérifier `/live` et `/ready`, puis confirmer que `/package.json`, `/index.js`, `/runtime/store.json` et `/api/v1/auth/demo` sont inaccessibles en production. Tester une connexion Owner, le refresh token, la création d’une session et la persistance après redémarrage. Le volume credentials Baileys doit rester privé et sauvegardé.
