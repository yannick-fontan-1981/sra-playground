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
- preuves GitHub Actions et rapports durables.

## Reste avant mesure officielle

### R1 — transport benchmark Worker/Pyodide

Construire un `dispatch` de benchmark lié au vrai Worker navigateur et au
`game_bridge.py` exécuté par Pyodide, sans serveur externe ni checkout Sites.

Critères :

- chargement réel de `custom-games.zip` ;
- observation publique identique au contrat browser ;
- ACTION6 avec coordonnées conservées ;
- aucune inspection moteur ;
- session neuve seed 0 par invocation ;
- erreur propagée sans fallback.

### R2 — parité CPython/Pyodide

Comparer au minimum :

- action initiale sélectionnée ;
- séquence 3/10/15 actions ;
- identité de jeu ;
- nombre de pixels modifiés par action ;
- niveau et état après chaque action.

Toute divergence bloque le benchmark officiel.

### R3 — `sourceRef` A/B

Figer des identités durables :

- A : baseline canonique de référence ;
- B : même baseline + candidat 9B Region ;
- hashes des fichiers constitutifs ;
- preuve que transport, corpus et configuration sont identiques.

### R4 — manifeste officiel

Créer seulement après R1–R3 :

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

Les diagnostics CPython actuels ne sont pas un résultat R5/R6.

## Prochaine action immédiate

R1 : reconstruire le transport benchmark Worker/Pyodide et ajouter une campagne
de parité courte avant toute mesure officielle.
