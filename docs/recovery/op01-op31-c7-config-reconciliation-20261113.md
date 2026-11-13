# OP01–OP31 — réconciliation canonique du contrat C7

Date : 13 novembre 2026

## Objet

Le benchmark navigateur refusait le statut canonique `qualified-functionally-and-performance` alors que le vérificateur du manifeste l’acceptait. Une requalification depuis l’état canonique pouvait donc attendre le timeout après une erreur de configuration valide.

Le correctif :

- centralise la validation de la configuration ;
- accepte exactement les deux états canoniques `ready-for-official-abba-measurement` et `qualified-functionally-and-performance` ;
- charge la configuration dans le bloc de rapport d’erreur ;
- inclut ce contrat dans l’identité source commune A/B ;
- conserve toutes les mesures et l’activité Region.

## Qualification

- branche : `recovery/op01-op31-c7-config-reconcile-20261113` ;
- commit mesuré : `1428683411e91423747ef5021b30d96d528dc362` ;
- run : `43363531876` ;
- job : `131682410527` ;
- A : `lot9b-region-v1:A:99faf15665a8401a4b5e9867f1cfd1935d68f6171c46c839c34818f04b51f231` ;
- B : `lot9b-region-v1:B:8e23f39ba219a43a3d5b7cc7644551dea24ca0fc0216d5b58a8c808fdc315a83` ;
- STCK : -1,3550 % ;
- SMLP : +2,1409 % ;
- verdict : accepté séparément pour les deux jeux ;
- régression TypeScript : 355/355 ;
- contrats natifs : 24/24 ;
- build et parité Worker/Pyodide : réussis.

## Synchronisation

Le changement et ses preuves sont commités sur GitHub. Aucune publication Site n’est effectuée dans cette étape.
