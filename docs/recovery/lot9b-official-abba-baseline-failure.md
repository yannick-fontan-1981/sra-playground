# Lot 9B — premier ABBA officiel et localisation du coût

Date : 2026-11-12

## Statut

Le premier protocole officiel Worker/Pyodide a été exécuté sur la baseline
canonique pure :

`85d8c5e57a26ae3f02a0e89c49f5894dc571bf70`

Résultat :

- STCK : **accepté** ;
- SMLP : **refusé** ;
- Lot 9B performance : **non qualifiée**.

Le résultat est conservé intégralement. Aucun échantillon n’a été supprimé,
remplacé ou rejoué pour améliorer le verdict.

## Identités mesurées

- A :
  `lot9b-region-v1:A:46ce3478dbc07268333a6a2d423489a689cc5ff509abf1e4bf1f948b174b842c` ;
- B :
  `lot9b-region-v1:B:557ca909c4c9b68ec70d2055a02dfb5c27dffcae338f1025e3b53c67937a609f` ;
- corpus : `native-region-action6-corpus-v1` ;
- transport : `BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py` ;
- environnement : runner GitHub Actions partagé, explicitement non isolé ;
- concurrence benchmark du dépôt : désactivée par groupe de concurrence.

## Protocole

Ordre :

`A1 → B1 → B2 → A2`

Volumes observés :

- 40 invocations ;
- 8 sessions de warmup ;
- 24 actions de warmup exclues ;
- 32 sessions mesurées ;
- 400 actions mesurées.

Tous les volumes correspondent au manifeste.

## Résultat STCK

- médiane A : **69,1000 ms** ;
- médiane B : **74,0500 ms** ;
- delta global : **+7,163531 %** ;
- critère : strictement inférieur à +10 % ;
- verdict : **PASS**.

Phases médianes :

- `candidate_hook` B : 21,0000 ms ;
- `game_action` A : 54,5500 ms ;
- `game_action` B : 42,5000 ms ;
- `public_policy` A : 6,5000 ms ;
- `public_policy` B : 4,9000 ms.

## Résultat SMLP

- médiane A : **99,7500 ms** ;
- médiane B : **144,0500 ms** ;
- delta global : **+44,411028 %** ;
- verdict : **FAIL**.

Phases médianes :

- `candidate_hook` B : **43,5500 ms** ;
- `game_action` A : 78,5500 ms ;
- `game_action` B : 79,6000 ms, soit +1,3367 % ;
- `public_policy` A : 10,9000 ms ;
- `public_policy` B : 10,9000 ms.

Le dépassement est donc localisé dans la phase `candidate_hook`, pas dans le
transport, le corpus, la politique ou l’action du jeu.

## Intégrité fonctionnelle pendant la mesure

Côté B :

### STCK

- 86 actions vues ;
- 86 ACTION6 ;
- 86 preuves utiles ;
- 86 preuves liées ;
- 86 acquisitions ;
- 86 méthodes singleton conservées.

### SMLP

- 126 actions vues ;
- 126 ACTION6 ;
- 126 preuves utiles ;
- 126 preuves liées ;
- 126 acquisitions ;
- 126 méthodes singleton conservées.

La correction de performance doit préserver ces compteurs.

## Preuves GitHub Actions

Run officiel principal :

- run : `43354466595` ;
- job : `131653056843` ;
- commit : `85d8c5e57a26ae3f02a0e89c49f5894dc571bf70` ;
- Chrome : `157.0.8103.78` ;
- hardwareConcurrency : 4 ;
- artefact : `14004873060` ;
- SHA-256 artefact ZIP :
  `4a9c9ce7b258f7a17ec237a6f8433c96581f636c00d016403bc1142a2ac7a75c`.

Résumé machine :

`docs/recovery/lot9b-official-abba-baseline-failure.json`

## Run doublon non retenu

La création du fichier de demande de mesure a déclenché un second run sur le
même code mesuré plus un fichier de demande hors périmètre hashé.

Ce run n’est pas utilisé comme remplacement du premier résultat.

- run : `43354501792` ;
- job : `131653393087` ;
- commit : `83bb377c000c7e0b929b833c957cbcf139887070` ;
- STCK : +25,632563 %, FAIL ;
- SMLP : +43,855422 %, FAIL ;
- hook médian STCK : 16,6500 ms ;
- hook médian SMLP : 36,3500 ms ;
- artefact : `14004644274` ;
- SHA-256 artefact ZIP :
  `10b695cc0808f7b095ed11e870400db2b400524d13d4b17396bca9ed68ce3297`.

Il confirme que le coût Region reste le problème, mais ne modifie pas le
verdict principal.

## Correction autorisée

Le correctif doit viser uniquement les copies et préparations redondantes de
la phase `candidate_hook` :

- préserver le mode cloné général ;
- autoriser un mode readonly seulement pour le hook benchmark explicitement
  fiable ;
- limiter l’entrée `methodRef` aux identités réellement utilisées ;
- conserver exactement les mêmes preuves, acquisitions et méthodes Region ;
- répéter le même protocole officiel après recalcul des `sourceRef`.
