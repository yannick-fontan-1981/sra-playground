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

- branche : `recovery/op01-op31-c7-config-reconcile-canonical-20261113` ;
- commit mesuré : `ea6bc872b90261133dfc8780664b487f5917653f` ;
- run : `43364316353` ;
- job : `131685000996` ;
- A : `lot9b-region-v1:A:99faf15665a8401a4b5e9867f1cfd1935d68f6171c46c839c34818f04b51f231` ;
- B : `lot9b-region-v1:B:8e23f39ba219a43a3d5b7cc7644551dea24ca0fc0216d5b58a8c808fdc315a83` ;
- STCK : +2,2222 % ;
- SMLP : +1,8695 % ;
- verdict : accepté séparément pour les deux jeux ;
- régression TypeScript : 367/367 ;
- contrats natifs : 24/24 ;
- build et parité Worker/Pyodide : réussis.

## Synchronisation

Le changement et ses preuves sont commités sur GitHub. Aucune publication Site n’est effectuée dans cette étape.

## Mesure canonique rejetée conservée

La première mesure indépendante de l’identité courante a été rejetée et reste intégralement conservée :

- run : `43364040206` ;
- job : `131684105998` ;
- commit mesuré : `f172f1ad504742a7a84d3373d7a2da2bfb19ef77` ;
- STCK : +1,9900 %, accepté ;
- SMLP : +11,3795 %, rejeté ;
- seuil : strictement inférieur à +10 % par jeu ;
- suppression ou substitution d’échantillon : aucune ;
- nouvelle tentative à l’intérieur du run : aucune.

La qualification acceptée documentée ci-dessus provient d’une exécution indépendante ultérieure. Elle ne remplace ni ne masque cette mesure rejetée.
