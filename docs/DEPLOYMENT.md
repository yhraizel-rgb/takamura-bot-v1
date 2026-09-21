# Déploiement

## Mono-VM

Utiliser un seul processus Node supervisé par PM2, un volume privé pour `RUNTIME_DIR`, HTTPS Nginx et une base persistante. Ne pas activer le cluster PM2 et ne pas lancer deux réplicas sur le même répertoire credentials.

## Workers partitionnés

Séparer l’API de contrôle et les workers WhatsApp. Chaque session doit avoir un propriétaire exclusif enregistré transactionnellement, avec bail renouvelable et reprise après expiration. Ajouter un cache/queue partagé seulement après mesure.

## Contrôle + pool dédié

Pour un produit multi-tenant, séparer plan de contrôle, secrets manager, observabilité, workers et stockage. Cette option augmente le coût et la complexité ; elle exige des budgets mémoire/socket et un test de capacité.

La procédure de rollback consiste à arrêter le worker, restaurer la version précédente et son schéma compatible, restaurer le volume credentials depuis le dernier backup vérifié, puis confirmer `/ready` avant reprise contrôlée.
