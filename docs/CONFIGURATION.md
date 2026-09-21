# Configuration

Toutes les variables sont validées par Zod dans `src/config/env.ts`. Les secrets sont injectés par l’environnement et ne doivent pas être placés dans le dépôt.

| Variable | Défaut | Effet | Validation |
|---|---|---|---|
| `JWT_SECRET` | développement uniquement | Signature des access tokens | Secret aléatoire >= 32 caractères en production |
| `RUNTIME_DIR` | `./runtime` | Store et credentials privés | Volume absolu, permissions 0700 |
| `CORS_ORIGINS` | localhost | Origines autorisées | Liste explicite, jamais `*` avec cookies |
| `AUTO_JOIN_ENABLED` | `false` | Adhésion automatique | Consentement et test par session |
| `METRICS_ENABLED` | `false` | Endpoint métriques futur | Protéger avant activation |

La version initiale utilise un store local JSON pour rendre les tests et la démonstration autonomes. Le remplacement production doit implémenter les mêmes ports avec migrations SQLite/PostgreSQL/MySQL et transactions.
