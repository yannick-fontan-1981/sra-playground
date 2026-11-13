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
- `sourceRef` A/B figés et vérifiés ;
- manifeste officiel des quatre runners vérifié ;
- harness officiel Worker/Pyodide construit, typechecké et couvert par tests ;
- preuves GitHub Actions et rapports durables.

## R1 — transport benchmark Worker/Pyodide

Statut : **qualifié**.

Le harness réel utilise :

`BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py → custom-games.zip`

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

## R3 — `sourceRef` A/B

Statut : **qualifié**.

Identités finales :

- A :
  `lot9b-region-v1:A:46ce3478dbc07268333a6a2d423489a689cc5ff509abf1e4bf1f948b174b842c` ;
- B :
  `lot9b-region-v1:B:557ca909c4c9b68ec70d2055a02dfb5c27dffcae338f1025e3b53c67937a609f`.

Racines :

- composants communs :
  `3935f5106c478715040b5b49e6e8ebdd6e960cd353c2eff733f7399571dc521b` ;
- composants Region candidats :
  `b77bf3e8c9e31f4d18ac8a8468a9081dc10788b0c8c317fe7d79adb84e24e32e`.

Le périmètre commun contient transport, Pyodide, ZIP, corpus, runners,
protocole, scope de timing et harness officiel. Le périmètre B supplémentaire
contient uniquement le hook et les composants Region nécessaires.

Propriétés testées :

- un changement commun invalide A et B ;
- un changement Region invalide B seulement ;
- aucun chemin ne se trouve simultanément dans les deux périmètres ;
- le hook Region reste la seule différence mesurée.

Preuve :

`docs/recovery/native-loop-source-refs.json`

Qualification finale :

- run : `43354155809` ;
- job : `131652043976` ;
- typecheck : réussi ;
- tests de contrats source/transport : **7/7** ;
- recalcul des empreintes : réussi ;
- vérification anti-dérive du manifeste : réussie.

## R4 — manifeste officiel

Statut : **qualifié**.

Manifeste :

`docs/recovery/native-loop-runner-manifest.json`

Il fixe :

- A/STCK ;
- A/SMLP ;
- B/STCK ;
- B/SMLP ;
- les deux `sourceRef` ;
- le corpus ;
- le transport Worker/Pyodide ;
- le seed et le niveau initial ;
- le scope de timing ;
- les volumes ;
- le seuil strict ;
- les interdictions de fallback, retry et retrait d’échantillon.

Le script :

`scripts/verify-native-loop-runner-manifest.mjs`

recalcule les composants et bloque toute dérive.

## R5 — mesure officielle

Statut : **prête à exécuter**.

Le workflow :

`.github/workflows/lot9b-official-native-region-abba.yml`

ne s’exécute que sur la branche dédiée :

`recovery/lot9b-official-measurement-20261112`

Il exécutera exactement :

`A1 → B1 → B2 → A2`

avec :

- 8 warmups ;
- 24 actions de warmup exclues ;
- 32 sessions mesurées ;
- 400 actions mesurées ;
- aucun échantillon supprimé ;
- concurrency GitHub dédiée au benchmark du dépôt.

L’environnement GitHub Actions restera explicitement classé :

**non isolé, runner partagé, sans autre benchmark concurrent du dépôt**.

Cette nature devra être conservée dans le rapport final.

## R6 — décision

Calcul :

`delta_global = 100 * (median_candidate / median_reference - 1)`

Acceptation uniquement si :

- STCK < +10.000 % ;
- SMLP < +10.000 % ;
- aucun jeu ne compense l’autre.

Les diagnostics CPython antérieurs ne sont pas un résultat R5/R6.

## Prochaine action immédiate

Intégrer R3/R4 dans la branche canonique, créer la branche dédiée R5 depuis
cette intégration exacte, puis laisser le workflow officiel produire le rapport
ABBA complet sans modifier les runners ni le corpus.
