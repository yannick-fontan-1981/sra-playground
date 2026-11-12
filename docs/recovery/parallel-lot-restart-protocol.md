# Reprise coordonnée des lots — 2026-11-12

## Branche canonique de reconstruction

Tous les lots repartent de :

`recovery/site109-reconstruction-20261112`

Cette branche est une base de reconstruction, pas encore une copie certifiée de Site 109 / native 0.68.

## Règles communes

- Lire `/AGENTS.md`.
- Lire `docs/migration/git-site-sync-policy.md`.
- Lire `docs/recovery/site109-reconstruction-status.md`.
- Travailler dans un checkout et une branche propres.
- Committer et pousser régulièrement.
- Ne jamais conserver un changement utile uniquement dans un checkout temporaire.
- Ne pas publier le Site depuis un état non poussé sur GitHub.
- Ne pas revendiquer la parité Site 109 tant que les composants et preuves manquants ne sont pas restaurés.
- Préserver toutes les branches de récupération existantes.
- Comparer les apports d'une ancienne branche au nouveau socle avant intégration.
- Les mesures concurrentes peuvent être utilisées comme diagnostics, mais leur nature non isolée doit être signalée.
- Critère historique de coût : global STCK et SMLP séparément strictement < +10 % lorsque le protocole officiel est disponible.

## Sources de récupération connues

- Lot 5 : `recovery/lot5-canonical-buffer`
- Lot 6 : `recovery/lot6c-product-dispatch`
- Lot 9 : `lot9b-github-recovery-20261112`
- Lot 10 : `lot10d-temporal-selection-github-20261112`
- OP01–OP31 : `op01-op31-c0-c7-audit`
- Lot 8 : aucune branche GitHub récupérée ; repartir de la branche canonique et n'utiliser que les preuves documentées disponibles.

## Rapport obligatoire

À la fin de chaque étape :

`lot | branche | commit local | commit GitHub | intégré reconstruction ? | tests | coût | Site publié ? | SHA Site | prochaine étape`
