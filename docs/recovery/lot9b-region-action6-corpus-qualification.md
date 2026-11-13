# Lot 9B — qualification fonctionnelle du corpus Region ACTION6

Date : 2026-11-12

## Statut

Le corpus candidat :

`native-region-action6-corpus-v1`

est qualifié fonctionnellement sur les moteurs réels extraits de :

`public/python/custom-games.zip`

Il ne s'agit pas du corpus historique perdu et cette qualification ne constitue
pas encore une mesure officielle de performance.

Statut retenu :

**fonctionnellement qualifié sur le protocole complet ; performance officielle à confirmer**.

## Périmètre public

Le sélecteur utilise uniquement :

- le frame public 64×64 ;
- les identifiants d'actions publiques ;
- le code public du jeu.

Il n'utilise pas :

- les objets moteur ;
- `view()` ou `inspect()` ;
- les fixtures de niveau ;
- les coordonnées cachées ;
- une trajectoire préparée ;
- un état auteur.

## STCK

L'audit source durable montre que :

- la barre shop active est visible dans les lignes publiques 54–58 ;
- les cartes de la pile sont visibles dans le panneau gauche ;
- cliquer une carte visible lorsque le shop est actif retire cette carte.

Le probe public :

1. vérifie que la barre shop est publiquement active ;
2. cherche la carte visible la plus basse dans le panneau de pile ;
3. clique son centre ;
4. lorsqu'aucune carte n'est visible, clique le premier bouton shop visible.

Première action native seed 0 :

`ACTION6(x=4, y=52)`

Effet public observé :

**211 pixels modifiés**.

Sur les sessions de dix actions, la séquence publique alterne ensuite entre :

- retrait d'une carte visible à `(4,52)` ;
- ajout par le premier bouton visible à `(6,56)` lorsque la pile est vide.

Toutes les actions du protocole complet ont produit un delta public utile :

- minimum : **64 pixels modifiés** ;
- maximum : **211 pixels modifiés**.

## SMLP

Le probe public détecte le premier glyph de porte visible, fermée ou ouverte,
et clique son centre.

Action seed 0 :

`ACTION6(x=32, y=26)`

Chaque action du protocole complet a produit :

**9 pixels modifiés**.

## Identité A/B

Les variantes utilisent exactement :

- le même ZIP ;
- le même moteur par jeu ;
- le même seed 0 ;
- le même niveau initial 1 ;
- le même corpus `native-region-action6-corpus-v1` ;
- le même sélecteur public ;
- le même nombre d'actions ;
- la même séquence déterministe par type de session.

La seule différence voulue est :

- A : hook Region désactivé ;
- B : vrai hook `region_intervention` activé.

## `methodRef` du benchmark

Le benchmark ne déduit aucune équivalence entre interventions.

Chaque retour utile reçoit une identité singleton explicite :

`native-region-singleton:<game>:<invocationIndex>:<actionIndex>`

Cette stratégie :

- permet d'exercer l'acquisition et la conservation Region ;
- n'invente aucune réutilisation de méthode ;
- ne prétend pas qu'une intervention est équivalente à une autre.

## Protocole exécuté

Ordre :

`A1 → B1 → B2 → A2`

Volumes validés :

- **40 invocations** ;
- **8 sessions de warmup** ;
- **24 actions de warmup** ;
- **32 sessions mesurées** ;
- **400 actions mesurées**.

Les séquences A et B ont été comparées et sont identiques pour chaque :

`jeu + type de session + index de session`.

## Acquisition Region côté B

### STCK

- actions vues : 86 ;
- ACTION6 vues : 86 ;
- preuves utiles : 86 ;
- preuves liées : 86 ;
- acquisitions : 86 ;
- méthodes singleton conservées : 86.

### SMLP

- actions vues : 126 ;
- ACTION6 vues : 126 ;
- preuves utiles : 126 ;
- preuves liées : 126 ;
- acquisitions : 126 ;
- méthodes singleton conservées : 126.

Les limites du modèle Region restent respectées séparément par jeu.

## Tests et exécution durable

GitHub Actions :

- run : `43351088067` ;
- job : `131642041309` ;
- SHA qualifié : `0b0e34c76f63b8c29251e297a2973d4ada80de4c` ;
- Node : `22.18.0` ;
- Python : `3.12` ;
- suite ciblée : **36/36 réussie** ;
- probe unitaire réel : réussi pour STCK et SMLP ;
- protocole fonctionnel complet : réussi ;
- artefact : `14004415631` ;
- SHA-256 de l'artefact ZIP :
  `4a83f4fbe2a5bfd4195f5516f9adc045fdbdb18364fbe69a7631dacd0e347bf8`.

## Mesures diagnostiques non officielles

Le run CI a également produit des temps CPython sur un runner partagé.

Ces valeurs sont conservées uniquement pour localiser les coûts. Elles ne sont
pas une mesure officielle, car :

- le runtime est CPython extrait du ZIP, pas le Worker navigateur/Pyodide ;
- l'environnement GitHub Actions n'était pas isolé comme mesure officielle ;
- les `sourceRef` A/B officiels ne sont pas encore figés ;
- le run n'a pas été déclaré comme exclusivité de mesure officielle.

Diagnostics observés :

### STCK

- médiane A : 22,6506 ms ;
- médiane B : 42,9867 ms ;
- delta diagnostique : +89,7816 % ;
- phase hook candidat B : environ 18,9620 ms médian.

### SMLP

- médiane A : 40,1555 ms ;
- médiane B : 67,2718 ms ;
- delta diagnostique : +67,5283 % ;
- phase hook candidat B : environ 26,8605 ms médian.

Ces valeurs ne doivent être utilisées ni comme acceptation ni comme échec du
seuil officiel de 10 %.

## Pièces restant à qualifier avant ABBA officiel

1. exécution des quatre runners via le vrai Worker navigateur/Pyodide ;
2. identité durable et figée des `sourceRef` A et B ;
3. manifeste de runners officiel reliant corpus, sources et timing scope ;
4. environnement de mesure isolé ;
5. répétition du protocole A1/B1/B2/A2 sans exécution concurrente ;
6. application du seuil strict séparément à STCK et SMLP.

Aucun `docs/recovery/native-loop-runner-manifest.json` officiel n'est créé à
ce stade.

## Prochaine étape

Construire et qualifier le transport de benchmark Worker/Pyodide utilisant le
même corpus et les mêmes quatre identités de runners, puis figer les
`sourceRef`. Seulement après cela, lancer la mesure ABBA officielle.
