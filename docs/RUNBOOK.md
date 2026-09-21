# Runbook incident

En cas de reconnexions répétées, ne pas supprimer automatiquement les credentials. Passer la session en `invalid` si la déconnexion est définitive, capturer l’ID de session et vérifier le dernier backup. En cas de saturation mémoire, désactiver les commandes médias et réduire les quotas avant redémarrage borné. En cas de fuite suspectée, révoquer les refresh tokens, remplacer le secret JWT et auditer les logs.

# Permissions

| Capacité | Owner | Admin | Moderator | User |
|---|---:|---:|---:|---:|
| Lire dashboard/sessions | Oui | Oui | Oui | Oui |
| Créer une session | Oui | Oui | Non | Non |
| Modifier réglages | Oui | Oui | Non | Non |
| Gérer commandes | Oui | Oui | Oui | Non |
| Supprimer session | Oui | Oui | Non | Non |
| Lire/exporter logs | Oui | Oui | Oui | Non |
| Modifier permissions | Oui | Non | Non | Non |
