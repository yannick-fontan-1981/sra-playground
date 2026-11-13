# OP01–OP31 — acceptation officielle C7

Date : 13 novembre 2026

## Identité qualifiée

- branche : recovery/op01-op31-browser-field-stock-context-20261112 ;
- commit mesuré : d45f2ce6566d052bbd3477c5653e99ae24381a0a ;
- source A : lot9b-region-v1:A:8b795085bfc26379c0736b7e4032fb28b3a78b66c21c63cb18585724c6d37531 ;
- source B : lot9b-region-v1:B:cdb33000d61a6ccc1df8b6de417be32e2fd04a669fb1a5972de0e3330d3cfc95 ;
- protocole : A1/B1/B2/A2 ;
- environnement déclaré : non-isolated-shared-github-actions-runner-no-repository-concurrency.

Cette qualification ferme le critère de coût de la reconstruction courante. Elle ne prétend pas reproduire le matériel historique du Site 109 ni établir une identité binaire avec le runtime 0.68.

## Critère

- médiane globale de chaque jeu strictement inférieure à +10 % ;
- STCK et SMLP évalués séparément ;
- aucune compensation entre jeux ;
- aucune suppression ou substitution d’échantillon mesuré ;
- une phase interne peut dépasser +10 % si le global du jeu reste sous le seuil.

## Exécution stricte principale

- run : 43359480072 ;
- job : 131669316899 ;
- SHA : d45f2ce6566d052bbd3477c5653e99ae24381a0a ;
- artifact : 14007143067, op01-op31-strict-native-cost-report ;
- 40 invocations ;
- 8 sessions de warmup et 24 actions de warmup ;
- 32 sessions mesurées et 400 actions mesurées.

| Jeu | Médiane A | Médiane B | Delta global | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 59,35 ms | 56,70 ms | −4,4650 % | accepté |
| SMLP | 114,70 ms | 120,05 ms | +4,6643 % | accepté |

Les deux jeux satisfont indépendamment le seuil strict inférieur à +10 %.

## Répétition indépendante dans la qualification complète

- run : 43359480115 ;
- job : 131669385975 ;
- SHA : d45f2ce6566d052bbd3477c5653e99ae24381a0a ;
- STCK : +2,0423 %, accepté ;
- SMLP : −0,9298 %, accepté.

Cette seconde exécution confirme l’acceptation sans être utilisée pour compenser ou remplacer le résultat principal.

## Qualification fonctionnelle du même SHA

- Node 22.18.0 ;
- npm ci réussi ;
- tsc --noEmit réussi ;
- 335/335 tests TypeScript réussis ;
- build Vite réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas natifs générés ;
- parité Worker/Pyodide qualifiée ;
- 24/24 contrats benchmark/sourceRef réussis.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes, restent signalées par npm ci. Elles ne sont pas introduites par cette tranche.

## Optimisations admises

- calcul du delta public 64×64 avec buffers typés bornés, à sortie équivalente ;
- identité methodRef minimale sans copie des frames lorsqu’elle ne dépend que de l’identité de l’action/session ;
- contrat explicite borrowed-readonly pour le hook Region officiel ;
- comportement cloned conservé par défaut pour les autres hooks.

Aucune optimisation ne modifie la décision Region, le corpus, le transport, les actions ou le protocole d’acceptation.

## Verdict

**C7 est accepté pour la reconstruction courante sur STCK et SMLP.**

Les dettes restantes concernent l’acquisition initiale réelle du prior FieldStock, le candidat produit Region complet, les acquisitions passives multi-propriétaires, la sauvegarde/restauration et OP31. Elles ne rouvrent pas le résultat C7 tant que l’identité mesurée ne change pas.
