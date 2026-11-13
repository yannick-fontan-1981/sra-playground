# Lot 9B — feuille de route après qualification du corpus ACTION6

## Acquis

- quatre runners explicites A/B × STCK/SMLP ;
- même corpus public ACTION6 pour A et B ;
- même seed 0 et même niveau initial ;
- vrai hook `region_intervention` uniquement côté B ;
- protocole fonctionnel complet A1/B1/B2/A2 ;
- 40 invocations, 8 warmups, 32 sessions mesurées, 24 + 400 actions ;
- chaque action produit un delta public utile ;
- séquences A/B identiques et déterministes ;
- transport réel `BrowserGameRuntime → game-worker.ts → Pyodide` qualifié ;
- parité CPython/Pyodide exacte sur 4 campagnes et 31 actions ;
- preuves GitHub Actions et rapports durables.

## R1 — transport benchmark Worker/Pyodide

Statut : **qualifié**.

Le harness réel utilise :

`BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py → custom-games.zip`

Critères satisfaits :

- chargement réel de `custom-games.zip` ;
- observation publique du contrat browser ;
- ACTION6 avec coordonnées conservées ;
- aucune inspection moteur ;
- session neuve seed 0 par campagne ;
- erreur propagée sans fallback ;
- aucun checkout Sites.

Preuve :

`docs/recovery/lot9b-worker-pyodide-parity.md`

## R2 — parité CPython/Pyodide

Statut : **qualifié**.

Comparaison exacte :

- STCK 3 actions ;
- STCK 10 actions ;
- SMLP 3 actions ;
- SMLP 15 actions ;
- **4/4 campagnes** ;
- **31/31 actions** ;
- actions, coordonnées, deltas, hashes de frames, niveau, état et actions
  disponibles identiques.

Preuve :

`docs/recovery/lot9b-worker-pyodide-parity-report.json`

## Reste avant mesure officielle

### R3 — `sourceRef` A/B

Figer des identités durables :

- A : baseline canonique de référence ;
- B : même baseline + candidat 9B Region ;
- hashes des fichiers constitutifs ;
- preuve que transport, corpus et configuration sont identiques ;
- différence A/B limitée au hook Region mesuré.

### R4 — manifeste officiel

Créer seulement après R3 :

`docs/recovery/native-loop-runner-manifest.json`

Le manifeste devra nommer les quatre runners, leurs sources, le corpus, le
scope de timing et les preuves de qualification.

### R5 — mesure isolée

Exécuter exactement :

`A1 → B1 → B2 → A2`

Séparément pour STCK et SMLP, avec :

- 8 warmups ;
- 24 actions de warmup exclues ;
- 32 sessions mesurées ;
- 400 actions mesurées ;
- aucun échantillon supprimé ;
- absence de mesure concurrente, ou signalement explicite si impossible.

### R6 — décision

Calculer :

`delta_global = 100 * (median_candidate / median_reference - 1)`

Acceptation uniquement si :

- STCK < +10.000 % ;
- SMLP < +10.000 % ;
- aucun jeu ne compense l’autre.

Les diagnostics CPython antérieurs ne sont pas un résultat R5/R6.

## Prochaine action immédiate

R3 : calculer et figer les `sourceRef` A/B à partir des composants communs et
des seuls composants Region actifs côté B. Après vérification, construire le
manifeste officiel R4.
