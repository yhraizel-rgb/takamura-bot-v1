# Architecture

Le plan de contrôle Express expose une API versionnée et un dashboard statique depuis `public/`. Les responsabilités métier sont séparées des adaptateurs HTTP et du gateway Baileys. `SessionManager` est l’unique propriétaire d’une session et doit évoluer vers un bail partagé lors du scale-out.

Le pipeline cible est : admission, validation, déduplication TTL, autorisation, file bornée, exécution sérialisée, audit et métriques. Les commandes V1 restent dans un adaptateur compatible, tandis que leur catalogue est déterminé une fois par version de déploiement.

En production, PostgreSQL est le choix conseillé pour les utilisateurs, sessions, réglages versionnés, permissions, logs et refresh tokens. Le volume credentials doit être privé et sauvegardé séparément de la base.
