# Lot 9B — qualification officielle fonctionnelle et performance

Date : 2026-11-12

## Verdict

Le sous-lot **9B `region_intervention`** est maintenant :

**qualifié fonctionnellement et en performance**.

Le protocole officiel Worker/Pyodide optimisé a passé séparément les deux jeux :

- **STCK : +7,155963 % — PASS** ;
- **SMLP : −4,679306 % — PASS**.

Le seuil est strictement inférieur à +10,000 % pour chaque jeu. Aucun jeu ne
compense l’autre.

## Identités mesurées

- A :
  `lot9b-region-v1:A:9f1a55ee13abe82e6c688e8d91fb327582f3f9a86064c1f7f019586dd2887e68` ;
- B :
  `lot9b-region-v1:B:dca04a65d09d3354ee32d3659496e2dd20f013df7d522a1fae295da4bf587ed2` ;
- corpus : `native-region-action6-corpus-v1` ;
- transport :
  `BrowserGameRuntime → game-worker.ts → Pyodide → game_bridge.py → custom-games.zip` ;
- seed : 0 ;
- niveau initial : 1.

La seule différence mesurée reste :

- A : hook Region désactivé ;
- B : vrai hook `region_intervention` activé.

## Protocole exécuté

Ordre :

`A1 → B1 → B2 → A2`

Volumes :

- **40 invocations** ;
- **8 sessions de warmup** ;
- **24 actions de warmup exclues** ;
- **32 sessions mesurées** ;
- **400 actions mesurées** ;
- retries cachés : 0 ;
- échantillons supprimés : 0.

## STCK

- médiane A : **54,5000 ms** ;
- médiane B : **58,4000 ms** ;
- delta global : **+7,155963 %** ;
- verdict : **PASS**.

Phases médianes :

- politique publique A : 6,1000 ms ;
- politique publique B : 6,3500 ms ;
- hook candidat B : **1,0000 ms** ;
- action de jeu A : 48,4000 ms ;
- action de jeu B : 51,0500 ms.

L’intégrité Region côté B est conservée :

- 86 ACTION6 vues ;
- 86 preuves utiles ;
- 86 preuves liées ;
- 86 acquisitions ;
- 86 méthodes singleton.

## SMLP

- médiane A : **123,9500 ms** ;
- médiane B : **118,1500 ms** ;
- delta global : **−4,679306 %** ;
- verdict : **PASS**.

Phases médianes :

- politique publique A : 14,4000 ms ;
- politique publique B : 14,1000 ms ;
- hook candidat B : **1,0500 ms** ;
- action de jeu A : 109,7000 ms ;
- action de jeu B : 102,8000 ms.

Un échantillon candidat de **591,1 ms** a été conservé intégralement :

- série : B1 ;
- session mesurée : index 2 ;
- suppression : aucune.

L’intégrité Region côté B est conservée :

- 126 ACTION6 vues ;
- 126 preuves utiles ;
- 126 preuves liées ;
- 126 acquisitions ;
- 126 méthodes singleton.

## Correction par rapport au premier échec

Le premier run officiel avait localisé le coût SMLP dans `candidate_hook` :

- médiane hook SMLP avant correction : **43,5500 ms** ;
- médiane hook SMLP après correction : **1,0500 ms**.

Le correctif a uniquement :

- conservé le mode cloné général comme défaut sûr ;
- autorisé un mode readonly explicitement déclaré pour le hook benchmark ;
- limité l’entrée du producteur singleton `methodRef` à l’identité réellement
  utilisée ;
- supprimé les copies redondantes de frames 64×64.

Il n’a modifié ni :

- le corpus ;
- les coordonnées ;
- le transport ;
- le seed ;
- les volumes ;
- les acquisitions Region ;
- l’ordre ABBA ;
- les règles d’acceptation.

La preuve du premier échec reste durable :

`docs/recovery/lot9b-official-abba-baseline-failure.md`

## Environnement et preuves

La mesure est officiellement retenue, tout en restant explicitement décrite
comme non isolée au niveau infrastructure :

- runner GitHub Actions partagé ;
- aucune autre mesure benchmark concurrente dans ce dépôt grâce au groupe de
  concurrence dédié.

Preuves :

- run : `43356109888` ;
- job : `131658420516` ;
- commit mesuré : `2ba767fb698f58f831f1a11ad5e06b5da8cb86ee` ;
- code canonique mesuré : `e2b93371bf1272dd0f68ab56daeeabaebd880f44` ;
- Chrome : `157.0.8103.78` ;
- hardwareConcurrency : 4 ;
- artefact : `14004949988` ;
- SHA-256 de l’artefact ZIP :
  `5ce52300d1da85523cc72fb5601004e812f5b3788f7bc3725b1fc72cf45c76b2`.

Résumé machine durable :

`docs/recovery/lot9b-official-abba-performance-qualified.json`

## Compteur des 76

Aucun compteur des 76 n’est incrémenté. Le registre canonique correspondant
n’est pas encore reconstruit et vérifié.

## Suite

La prochaine étape du Lot 9 est :

**9C `joint_channels`**.

Cette préparation doit repartir de la baseline canonique contenant la
qualification 9B, sans réouvrir les contrats ou mesures déjà acquis sauf
régression démontrée.
