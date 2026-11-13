# Lot 9B — parité Worker/Pyodide du corpus Region ACTION6

Date : 2026-11-12

## Statut

Les étapes R1 et R2 de la feuille de route sont qualifiées :

- R1 : transport benchmark via le vrai Worker navigateur/Pyodide ;
- R2 : parité fonctionnelle CPython/Pyodide.

Statut retenu :

**transport Worker/Pyodide et parité fonctionnelle qualifiés ; performance
officielle non mesurée.**

## Chemin navigateur réellement exécuté

La campagne a traversé :

`BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py → custom-games.zip`

Le Worker a chargé les assets Pyodide épinglés par
`scripts/python-runtime-assets.json` :

- Pyodide : `314.0.7` ;
- Python navigateur : `3.14.2` ;
- ZIP de jeux : `public/python/custom-games.zip` ;
- seed : `0` ;
- niveau initial : `1`.

Aucun serveur de jeu distant, aucun checkout Sites et aucune inspection moteur
n’ont été utilisés.

## Référence comparée

La référence utilise le même ZIP et le même seed sous CPython :

`native-python-archive-session.py → custom_games.registry → build_seeded_engine`

Les labels de backend diffèrent volontairement :

- référence : `python-native-archive` ;
- navigateur : `python-wasm`.

Cette différence n’entre pas dans le verdict de parité. Toutes les propriétés
publiques de session, elles, doivent correspondre exactement.

## Plan de parité

Quatre campagnes fraîches ont été comparées :

1. STCK, 3 actions ;
2. STCK, 10 actions ;
3. SMLP, 3 actions ;
4. SMLP, 15 actions.

Total :

- **4 campagnes** ;
- **31 actions ACTION6**.

Pour chaque campagne, la comparaison stricte porte sur :

- identité du jeu ;
- nombre d’actions ;
- hash SHA-256 du frame initial ;
- actions et coordonnées ;
- nombre de pixels modifiés ;
- hash SHA-256 de chaque frame après action ;
- actions publiques disponibles ;
- état ;
- niveau ;
- niveaux terminés.

Toute divergence échoue immédiatement.

## Résultat

Verdict :

**4/4 campagnes identiques, 31/31 étapes identiques.**

### STCK

Hash initial commun :

`80a028f10a54e97bddb3130b5089a5b3902b2bfde249876864aa9610f728c25f`

Séquence 10 actions commune :

1. `(4,52)` → 211 pixels ;
2. `(4,52)` → 138 pixels ;
3. `(4,52)` → 95 pixels ;
4. `(4,52)` → 64 pixels ;
5. `(6,56)` → 64 pixels ;
6. `(4,52)` → 64 pixels ;
7. `(6,56)` → 64 pixels ;
8. `(4,52)` → 64 pixels ;
9. `(6,56)` → 64 pixels ;
10. `(4,52)` → 64 pixels.

Les hashes de frames CPython et Pyodide sont identiques après chacune des dix
actions.

### SMLP

Hash initial commun :

`0be203b6ce80ac043c30f42b08b925eeccb433d124957070d77b93903e67635c`

Les quinze actions communes utilisent :

`ACTION6(x=32, y=26)`

Chaque action modifie exactement **9 pixels** et les deux hashes alternent de
façon identique entre :

- porte ouverte :
  `90888a03979b86c5f515ab0e21b11512314861cd067517f5d34705a23bbac1ac` ;
- porte fermée :
  `0be203b6ce80ac043c30f42b08b925eeccb433d124957070d77b93903e67635c`.

## Preuves GitHub Actions

Qualification finale :

- workflow : `Lot 9B Worker Pyodide parity` ;
- run : `43352422359` ;
- job : `131646423929` ;
- SHA qualifié : `db27cfd16bbf6d7d8c439951964a4b3b418a919c` ;
- Node : `22.18.0` ;
- Chrome : `156.0.8078.79` ;
- tests du contrat : **4/4 réussis** ;
- campagnes comparées : **4** ;
- étapes comparées : **31** ;
- artefact : `14003939069` ;
- SHA-256 de l’artefact ZIP :
  `2a775384ad45d401ad893a7d14af1799080b342624973db06773a5372ebf0f38`.

Le rapport complet de l’artefact est résumé durablement dans :

`docs/recovery/lot9b-worker-pyodide-parity-report.json`

## Non-performance

Cette campagne ne chronomètre rien pour l’acceptation officielle.

Elle qualifie uniquement :

- le transport réel Worker/Pyodide ;
- la parité des frames ;
- la parité des actions ;
- la parité des transitions publiques.

Aucun delta de performance STCK/SMLP n’est produit ni interprété.

## Étape suivante

R3 : figer les identités `sourceRef` A et B, avec :

- composants communs explicitement identiques ;
- hook Region désactivé pour A ;
- hook Region réel activé pour B ;
- hashes durables des composants ;
- aucune autre différence de transport, corpus, seed ou session.

Le manifeste officiel des quatre runners ne doit être créé qu’après cette
qualification des sources.
