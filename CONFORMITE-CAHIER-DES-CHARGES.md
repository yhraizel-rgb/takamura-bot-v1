# Matrice de conformité — Takamura Bot Pro

## Verdict actuel

Le dépôt est maintenant **déployable et fonctionnel pour le pairing Baileys de base**, mais il ne doit pas encore être présenté comme une release de production totalement conforme au cahier des charges. Le dernier déploiement Railway sert le dashboard interactif et le backend Baileys, mais plusieurs exigences restent à finaliser.

## État par exigence

| Domaine | Exigence | État | Constat vérifié |
|---|---|---:|---|
| Audit | Rapport avant modification | Livré | `AUDIT-AVANT-REFONTE.md` est versionné avant la refonte. |
| Architecture | Modules TypeScript/config/middleware/database/WhatsApp | Partiel | Les modules principaux existent ; controllers/services/routes ne sont pas encore séparés finement. |
| Scalabilité | Plusieurs milliers de sessions | Non garanti | Le store JSON local et un processus unique ne constituent pas une architecture multi-instance pour milliers de sessions. |
| WhatsApp | Socket Baileys réel | Livré de base | Pairing code, credentials, messages et reconnexion sont branchés. |
| WhatsApp | QR code | À compléter | Le code de pairing est disponible ; le QR doit encore être capturé et rendu dans l’interface. |
| WhatsApp | Backup/restauration | Partiel | Restauration des credentials présente ; backup chiffré et procédure automatisée à renforcer. |
| WhatsApp | Queue, anti-spam, événements internes | À compléter | Les handlers existent, mais pas encore de queue persistante ni de rate limit par session/message. |
| Commandes | 29 commandes V1 conservées | Livré | Les fichiers V1 sont présents et chargés dynamiquement. |
| Commandes | Permissions/cooldown/validation/logs | Partiel | Métadonnées de registre présentes ; enforcement et audit d’utilisation à compléter. |
| Dashboard | Stats serveur/mémoire | Partiel | Stats bots/sessions/commandes présentes ; métriques mémoire et graphiques à ajouter. |
| Dashboard | Sessions: créer, pairing, supprimer | Livré de base | Création, pairing et désactivation sont disponibles ; QR et confirmation de suppression à compléter. |
| Dashboard | Commandes: activation, permissions | Non livré | La liste est visible, mais pas encore modifiable depuis l’interface. |
| Dashboard | Logs: recherche/filtres/export | Non livré | L’API logs existe ; l’écran et l’export restent à ajouter. |
| Dashboard | Temps réel/notifications | Non livré | L’interface est responsive, mais pas encore SSE/WebSocket/toasts d’événements réels. |
| Sécurité | JWT/refresh/password/CSRF/Helmet/rate limit | Partiel | Les primitives existent ; le mode `public` Railway désactive volontairement les protections et ne convient qu’à la recette. |
| RBAC | Owner/Admin/Moderator/User | Livré côté primitives | Les rôles et permissions existent ; l’UI de gestion reste à finaliser. |
| Base de données | Couche portable SQLite/MySQL/PostgreSQL | Partiel | Store JSON sans SQL utilisé pour Railway ; migration SQL initiale présente mais adaptateurs multi-moteurs non finalisés. |
| Performance | cache/queue/monitoring | Partiel | Health checks et métriques de base existent ; queue/cache/monitoring avancés restent à implémenter. |
| Qualité | lint/typecheck/tests/CI/docs | Livré de base | Typecheck, build, tests, ESLint, CI et guides sont présents ; couverture métier à élargir. |
| Déploiement | Docker/compose/PM2/Nginx/HTTPS/CI | Livré | Les artefacts existent ; Railway doit rester configuré séparément du mode VPS. |

## Point de sécurité important

Le mode Railway `AUTH_MODE=public` a été demandé pour la recette sans login. Il rend les endpoints d’administration accessibles à toute personne connaissant l’URL. Il est incompatible avec l’exigence « sécurité niveau production ». La configuration recommandée est donc : `public` uniquement en recette, puis `production` avec JWT/refresh/CSRF et secrets réels avant toute utilisation publique.

## Priorité de finalisation

La priorité est : (1) QR et session réellement observable, (2) queue/anti-spam/logs, (3) écrans commandes/logs/métriques, (4) backup chiffré et adaptateur de persistance, (5) tests d’intégration et séparation recette/production.
