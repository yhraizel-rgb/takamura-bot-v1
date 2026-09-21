# Backup et restauration

Sauvegarder séparément la base et le volume privé des credentials. Chiffrer les archives, limiter leur accès à l’Owner opérateur et tester une restauration mensuelle dans un environnement isolé. Ne jamais écrire de credentials, tokens ou contenus média dans les logs.

Procédure : arrêter le worker concerné, prendre un snapshot cohérent de la base et du volume runtime, restaurer dans un répertoire privé avec permissions 0700, exécuter les migrations compatibles, lancer `/ready`, puis réactiver progressivement les sessions. Conserver la version applicative et le hash de migration avec chaque backup.
