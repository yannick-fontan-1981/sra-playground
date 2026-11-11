# Lot 10B : résultat final du coût de native 0.62.0

Rapport établi le **2026-11-11T13:38:33-03:00**. Toutes les heures affichées ci-dessous sont en **UTC−03** ; les reçus bruts conservent leurs horodatages originaux.

## Décision globale

**Le coût global est accepté pour STCK et SMLP.** La médiane de session complète augmente de **+5,4005729298 %** pour STCK et diminue de **−1,7989027140 %** pour SMLP. La décision est celle de la [revue indépendante](owner-growth-review.json), confirmée après la fenêtre complète dans la [revue d’isolation](../coordination/cost-final-01/isolation-review.json). Le refus de l’agrégateur historique et les dépassements diagnostiques par phase restent conservés.

| Jeu | Sessions A / B | Médiane A 0.61.0 (ms) | Médiane B 0.62.0 (ms) | Variation globale | Critère strict |
| --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 11295.505846000002 | 11905.527877 | +5.4005729298 % | accepté : < +10 % |
| SMLP | 8 / 8 | 18028.853754500007 | 17704.532214999992 | -1.7989027140 % | accepté : < +10 % |

Les médianes ci-dessus reproduisent la précision enregistrée. Le calcul est `médiane(des 8 sessions B) / médiane(des 8 sessions A) − 1`, **séparément pour chaque jeu**. Une égalité à +10 % échouerait. Aucun jeu ne compense un autre ; les ratios des cohortes ne sont pas moyennés ; les phases imbriquées ne sont jamais additionnées pour fabriquer le total. Cette règle était fixée dans le [protocole](protocol.md) et la [politique globale](global-budget-policy.json) avant les mesures.

Conformément à la règle utilisateur, une phase peut dépasser +10 % lorsque le global de son jeu reste strictement inférieur à +10 %. La restauration de SMLP reste donc visible à **+26,3436295523 %** : elle n’a pas été reclassée comme conforme au diagnostic de phase.

## Identités réellement comparées

| Rôle | Version et provenance | Fichiers natifs | Digest SHA-256 |
| --- | --- | --- | --- |
| A | Site 98 ; native 0.61.0 ; commit `653e40a4f45df8ec8c6bda005004c7cdb8df074a` | 306 | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |
| B | Candidat gelé native 0.62.0 ; archive de 768 fichiers | 310 | `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12` |

La [publication native Site 98](../published7-integration-01/native-publication-observation.json) fournit la référence A. La [publication documentaire Site 101](../published7-integration-01/documentation101-observation.json), commit `d75a36f0a99bf6c301034523a3138a64d2f6e744`, conserve la même application 0.61.0 et la même empreinte d’archive applicative ; elle ne remplace pas le commit A déclaré. Les [octets A](../baseline-061/source-manifest.json), les [octets B](../integrated-final-02/source-manifest.json) et l’[archive B](../integrated-final-02/source-archive.json) identifient les sources mesurées. Aucun temps d’une ancienne publication n’est réutilisé.

Environnement enregistré par la [consolidation](owner-growth-comparison.json) : Node **v24.22.1**, **linux 6.18.57**, processeur **AMD EPYC 9V74 80-Core Processor**, **9 processeurs logiques exposés**. Ce résultat décrit cette machine et ce protocole ; il ne mesure pas le réseau, le moteur de jeu ou le rendu du navigateur de production.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’est déroulée du **2026-11-11T13:23:45.627421-03:00** au **2026-11-11T13:33:09.538152-03:00**. Ses quatre exécutions ont terminé avec le code **0**, et son intégrité finale est `passed`.

| Ordre | Série | Début UTC−03 | Fin UTC−03 | Sessions mesurées | Actions mesurées | Chauffes / actions |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 | 2026-11-11T13:23:45.736388-03:00 | 2026-11-11T13:26:07.663072-03:00 | 8 | 100 | 2 / 6 |
| 2 | B1 | 2026-11-11T13:26:07.775536-03:00 | 2026-11-11T13:28:27.095295-03:00 | 8 | 100 | 2 / 6 |
| 3 | B2 | 2026-11-11T13:28:27.185647-03:00 | 2026-11-11T13:30:52.186370-03:00 | 8 | 100 | 2 / 6 |
| 4 | A2 | 2026-11-11T13:30:52.294685-03:00 | 2026-11-11T13:33:09.403221-03:00 | 8 | 100 | 2 / 6 |

L’ordre réel est **A1 / B1 / B2 / A2**. Chaque série contient quatre sessions STCK de dix actions et quatre sessions SMLP de quinze actions, soit **32 sessions mesurées et 400 actions** au total. Les **8 chauffes et leurs 24 actions** étaient déclarées à l’avance et sont conservées séparément. Les sessions mesurées commencent avec un runtime neuf et une mémoire froide ; le processus et son JIT sont conservés à l’intérieur de chaque cas/série. Les traces enregistrées couvrent deux niveaux STCK et trois niveaux SMLP pour ces nombres d’actions. La cible déclarée de trois niveaux n’est pas transformée en trois niveaux STCK effectivement terminés.

**Aucune session mesurée ni valeur extrême n’a été retirée.** Aucune cohorte n’a été sélectionnée, aucune marge de bruit n’a été ajoutée et aucun temps n’a été soustrait pour les nouveaux nœuds. Les rapports bruts sont conservés : [A1](cohort1/baseline.json), [B1](cohort1/after.json), [B2](cohort2/after.json), [A2](cohort2/baseline.json). La consolidation conserve les 32 sessions et les huit chauffes avec leur multiplicité et leurs identités.

| Contrôle | Résultat réel | Preuve |
| --- | --- | --- |
| Inventaire, dépendances, outils et préflight statique | 77 / 77 contrôles satisfaits | [static-preflight.json](static-preflight.json) |
| Attribution causale des formes structurelles avant mesure | 64 / 64 contrôles réussis | [owner-graph-attribution.json](owner-graph-attribution.json) |
| Différences structurelles qualifiées | 432 positions conservées, chauffes comprises | [owner-growth-comparison.json](owner-growth-comparison.json) |
| Recalcul indépendant des sources, métriques, registres et seuil global | 10 297 / 10 297 contrôles réussis | [owner-growth-review.json](owner-growth-review.json) |
| Intégrité des quatre séries et des entrées finales | passed ; entrées de la revue inchangées | [window.json](window.json) et [revue](owner-growth-review.json) |

## Les 32 durées complètes conservées

Toutes les valeurs suivantes sont en millisecondes et reproduisent les nombres enregistrés dans `sessionLedger` de la [revue indépendante](owner-growth-review.json). Chaque colonne représente une série complète ; les lignes indiquent le rang interne de la session dans cette série. L’ordre chronologique est celui des colonnes A1, B1, B2, A2, et non une alternance entre les cellules d’une ligne.

### STCK

| Rang | A1, 0.61.0 | B1, 0.62.0 | B2, 0.62.0 | A2, 0.61.0 |
| --- | --- | --- | --- | --- |
| 1 | 10939.684865000001 | 12616.264931000002 | 12363.486731 | 11171.158217999999 |
| 2 | 11962.455753000002 | 11834.549447999998 | 11467.016011 | 11383.251005000002 |
| 3 | 11551.344142999998 | 11241.900346000002 | 11782.204821999996 | 11561.147548999998 |
| 4 | 11207.760687000002 | 11976.506306000003 | 12649.534330999995 | 11185.002235 |

### SMLP

| Rang | A1, 0.61.0 | B1, 0.62.0 | B2, 0.62.0 | A2, 0.61.0 |
| --- | --- | --- | --- | --- |
| 1 | 19323.643876999995 | 17577.091577 | 18830.012426999994 | 16663.664150999997 |
| 2 | 18895.993363 | 17671.989645999987 | 18528.039521 | 18541.871941000005 |
| 3 | 17399.333981000003 | 17490.896706999993 | 17737.074783999997 | 17474.267286999995 |
| 4 | 18129.340476000012 | 17286.780841 | 18683.796827 | 17928.367033000002 |

## Résultats des deux cohortes

Ces diagnostics sont conservés séparément et ne constituent pas le calcul global. Les [comparaisons de cohorte 1](cohort1/comparison.json) et de [cohorte 2](cohort2/comparison.json) gardent toutes deux le statut `budget_review_required`.

| Cohorte | Jeu | Sessions A / B | Médiane complète A (ms) | Médiane complète B (ms) | Variation complète |
| --- | --- | --- | --- | --- | --- |
| cohort_1 | STCK | 4 / 4 | 11379.552415 | 11905.527877 | +4.6221102801 % |
| cohort_1 | SMLP | 4 / 4 | 18512.666919500007 | 17533.994141999996 | -5.2865034614 % |
| cohort_2 | STCK | 4 / 4 | 11284.126620000001 | 12072.845776499998 | +6.9896340502 % |
| cohort_2 | SMLP | 4 / 4 | 17701.31716 | 18605.918174 | +5.1103599005 % |

| Diagnostics historiques | Dans le seuil diagnostique | Dépassements conservés |
| --- | --- | --- |
| Cohorte 1 | 15 / 16 | SMLP : restauration |
| Cohorte 2 | 12 / 16 | STCK : nouvelle décision ; SMLP : service du préfixe, requête du préfixe et restauration |
| Agrégat des huit sessions par version | 15 / 16 | SMLP : restauration |

Ces seize diagnostics comprennent les deux mesures de session complète et quatorze mesures de phases. Les cinq dépassements des cohortes et l’unique dépassement de l’agrégat restent `over_budget_with_noise_unresolved`. La décision globale distincte est acceptée pour les deux jeux.

## Médianes et dispersion des mesures regroupées

Les tableaux ci-dessous proviennent des champs `comparisons` de la [consolidation](owner-growth-comparison.json), recalculés par la [revue indépendante](owner-growth-review.json). `n` désigne le nombre d’observations de la mesure pour chaque version, et non toujours le nombre de sessions. Toutes les médianes, p95 et bornes en millisecondes sont reproduits avec leur précision enregistrée ; les pourcentages affichés sont arrondis à dix décimales pour les variations et six pour les indicateurs de dispersion.

Le p95 est le rang empirique `ceil(0,95 × n)` et n’est fourni qu’à partir de vingt observations. **Aucun p95 de session complète n’est estimé à partir des huit sessions par version.** Les durées de phases d’une même session sont corrélées. Les p95, étendues et indicateurs `roundMedianNoise` sont descriptifs : ils ne constituent pas des intervalles de confiance, ne démontrent pas la cause d’un écart et ne créent aucune tolérance supplémentaire.

### STCK : médianes regroupées

| Mesure | n A / B | Médiane A (ms) | Médiane B (ms) | Variation de médiane | Diagnostic |
| --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 8 / 8 | 11295.505846000002 | 11905.527877 | +5.4005729298 % | dans le seuil diagnostique |
| `new_decision` | 48 / 48 | 342.0381175000002 | 370.2127479999981 | +8.2372779695 % | dans le seuil diagnostique |
| `known_prefix_service` | 32 / 32 | 8.504992000001039 | 8.371046500000375 | -1.5749044796 % | dans le seuil diagnostique |
| `known_prefix_request` | 32 / 32 | 10.261496999998599 | 10.23486249999769 | -0.2595576454 % | dans le seuil diagnostique |
| `known_prefix_guard` | 32 / 32 | 0.22168450000117446 | 0.20919149999826914 | -5.6354864697 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 48 / 48 | 920.8436870000005 | 961.946669500001 | +4.4636221196 % | dans le seuil diagnostique |
| `persistence` | 104 / 104 | 202.25142549999873 | 210.3567534999993 | +4.0075504931 % | dans le seuil diagnostique |
| `restoration` | 96 / 96 | 18.815436999999292 | 18.110454499999832 | -3.7468303287 % | dans le seuil diagnostique |

### STCK : p95, étendues et dispersion

| Mesure | p95 A / B (ms) | [min ; max] A (ms) | [min ; max] B (ms) | `roundMedianNoise` A / B |
| --- | --- | --- | --- | --- |
| `session_elapsed` | non estimé / non estimé | [10939.684865000001 ; 11962.455753000002] | [11241.900346000002 ; 12649.534330999995] | 9.054671 % / 11.823365 % |
| `new_decision` | 665.6349499999997 / 705.0610759999981 | [220.13712000000305 ; 744.3784469999991] | [227.04821099999754 ; 1056.7478809999993] | 23.891340 % / 57.367930 % |
| `known_prefix_service` | 18.42759500000102 / 12.618171000000075 | [7.1486299999996845 ; 22.37432599999738] | [7.063751999998203 ; 12.928650999998354] | 31.302968 % / 50.350021 % |
| `known_prefix_request` | 20.333494999998948 / 14.909814000000551 | [8.756659999999101 ; 24.116348999996262] | [8.50521000000299 ; 15.3439520000029] | 26.179954 % / 41.401708 % |
| `known_prefix_guard` | 0.9322189999948023 / 0.4941149999995105 | [0.08425700000225333 ; 9.112306999999419] | [0.09439299999939976 ; 1.3281690000003437] | 63.845083 % / 85.085305 % |
| `acquisition_and_persistence` | 3949.7222469999997 / 4408.785858000003 | [427.54422200000045 ; 4158.708692999997] | [430.5455269999984 ; 4793.149088999999] | 17.019777 % / 16.828583 % |
| `persistence` | 482.67788499999915 / 527.1925730000003 | [14.217721999993955 ; 542.8617729999969] | [14.494063999998616 ; 727.181571000001] | 22.617597 % / 50.129542 % |
| `restoration` | 156.70942400000058 / 141.399906000006 | [2.285647999997309 ; 187.94168000000354] | [2.3955649999988964 ; 172.85460800000146] | 44.808184 % / 56.130503 % |

### SMLP : médianes regroupées

| Mesure | n A / B | Médiane A (ms) | Médiane B (ms) | Variation de médiane | Diagnostic |
| --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 8 / 8 | 18028.853754500007 | 17704.532214999992 | -1.7989027140 % | dans le seuil diagnostique |
| `new_decision` | 72 / 72 | 437.94090100000176 | 417.31032499999856 | -4.7108127953 % | dans le seuil diagnostique |
| `known_prefix_service` | 48 / 48 | 9.588345499993011 | 9.440925499991863 | -1.5374915307 % | dans le seuil diagnostique |
| `known_prefix_request` | 48 / 48 | 11.867802999993728 | 12.069829499989282 | +1.7023074953 % | dans le seuil diagnostique |
| `known_prefix_guard` | 48 / 48 | 0.3566184999945108 | 0.3412765000030049 | -4.3020763061 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 72 / 72 | 902.9614430000074 | 945.503575499999 | +4.7114007835 % | dans le seuil diagnostique |
| `persistence` | 152 / 152 | 160.36426999999094 | 160.28918699999485 | -0.0468202799 % | dans le seuil diagnostique |
| `restoration` | 144 / 144 | 7.519734499997867 | 9.500705499995092 | +26.3436295523 % | dépassement conservé |

### SMLP : p95, étendues et dispersion

| Mesure | p95 A / B (ms) | [min ; max] A (ms) | [min ; max] B (ms) | `roundMedianNoise` A / B |
| --- | --- | --- | --- | --- |
| `session_elapsed` | non estimé / non estimé | [16663.664150999997 ; 19323.643876999995] | [17286.780841 ; 18830.012426999994] | 14.754015 % / 8.716591 % |
| `new_decision` | 931.2191129999992 / 910.6568089999928 | [256.9162129999895 ; 1083.3090279999888] | [232.54373699999996 ; 1036.5134120000002] | 30.570080 % / 46.927500 % |
| `known_prefix_service` | 22.119693999993615 / 19.66775699998834 | [7.619837999984156 ; 24.810619999989285] | [8.038017000013497 ; 54.51224599999841] | 40.221915 % / 42.496535 % |
| `known_prefix_request` | 24.838004999997793 / 22.894662999984575 | [9.640588000009302 ; 27.451421999998274] | [10.014717000012752 ; 67.57561699999496] | 37.467934 % / 40.244701 % |
| `known_prefix_guard` | 0.5497890000115149 / 2.3195969999942463 | [0.19708800000080373 ; 0.7127270000055432] | [0.19480500000645407 ; 8.396020000000135] | 39.651642 % / 46.847371 % |
| `acquisition_and_persistence` | 2715.1258700000035 / 2787.6444429999974 | [360.86544799999683 ; 3735.158549999993] | [394.75635100000363 ; 2907.9003419999935] | 16.031256 % / 31.431989 % |
| `persistence` | 308.0826779999916 / 299.40848800000094 | [12.991534000000684 ; 387.6740520000021] | [12.703204000004916 ; 520.6270839999925] | 20.832440 % / 13.423791 % |
| `restoration` | 57.9089329999988 / 60.44805700000143 | [2.0932409999950323 ; 94.33405000000494] | [2.131745000006049 ; 90.91693700000178] | 41.122086 % / 99.752281 % |

La restauration de SMLP passe de **7.519734499997867 ms** à **9.500705499995092 ms** de médiane, soit **+26,3436295523 %**. Son p95 passe de **57.9089329999988 ms** à **60.44805700000143 ms**. La médiane de session complète de SMLP reste en baisse. Le p95 de `known_prefix_guard` de SMLP augmente également, de **0.5497890000115149 ms** à **2.3195969999942463 ms**, alors que sa médiane diminue. Ces deux observations sont conservées ; aucune garantie sur les durées élevées ou extrêmes n’est déduite de l’acceptation de la médiane globale.

## Détail intégral des diagnostics de cohorte

Les valeurs de médiane et de p95 sont en millisecondes. `n A / B` conserve les effectifs propres à chaque phase. Les indicateurs de dispersion relatifs sont ceux du rapport, sans correction des durées. Les étendues complètes et les observations brutes de chaque cohorte restent dans les rapports liés plus haut ; les étendues de toutes les mesures regroupées figurent dans les tableaux précédents.

### cohort_1 : STCK

| Mesure | n A / B | Médiane A / B (ms) | Variation | p95 A / B (ms) | `roundMedianNoise` A / B | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 4 / 4 | 11379.552415 / 11905.527877 | +4.6221102801 % | non estimé / non estimé | 8.987795 % / 11.543920 % | dans le seuil diagnostique |
| `new_decision` | 24 / 24 | 350.4584829999999 / 348.9934409999987 | -0.4180358219 % | 609.9597950000025 / 711.1013789999997 | 19.001436 % / 25.963044 % | dans le seuil diagnostique |
| `known_prefix_service` | 16 / 16 | 8.216731500004244 / 7.705237500000294 | -6.2250299892 % | non estimé / non estimé | 21.089707 % / 57.851337 % | dans le seuil diagnostique |
| `known_prefix_request` | 16 / 16 | 10.13006900000255 / 10.022035500000129 | -1.0664636144 % | non estimé / non estimé | 19.469870 % / 44.756632 % | dans le seuil diagnostique |
| `known_prefix_guard` | 16 / 16 | 0.21769850000055158 / 0.20610749999832478 | -5.3243361816 % | non estimé / non estimé | 31.323811 % / 85.085305 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 24 / 24 | 900.5587224999981 / 940.251405 | +4.4075618289 % | 3949.7222469999997 / 4408.785858000003 | 14.556498 % / 17.054844 % | dans le seuil diagnostique |
| `persistence` | 52 / 52 | 198.4504814999982 / 199.21229399999902 | +0.3838803989 % | 485.24076900000364 / 565.958961999997 | 11.331515 % / 19.793764 % | dans le seuil diagnostique |
| `restoration` | 48 / 48 | 18.815436999999292 / 18.110454499999832 | -3.7468303287 % | 139.67529600000125 / 137.97684400000435 | 18.688914 % / 17.351452 % | dans le seuil diagnostique |

### cohort_1 : SMLP

| Mesure | n A / B | Médiane A / B (ms) | Variation | p95 A / B (ms) | `roundMedianNoise` A / B | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 4 / 4 | 18512.666919500007 / 17533.994141999996 | -5.2865034614 % | non estimé / non estimé | 10.394558 % / 2.196926 % | dans le seuil diagnostique |
| `new_decision` | 36 / 36 | 435.88287800001126 / 383.29300550000335 | -12.0651384017 % | 985.7775550000079 / 852.8336150000032 | 20.335991 % / 19.192160 % | dans le seuil diagnostique |
| `known_prefix_service` | 24 / 24 | 11.075181000007433 / 8.967455500001961 | -19.0310704629 % | 22.237477999995463 / 12.405595000003814 | 18.622921 % / 18.974875 % | dans le seuil diagnostique |
| `known_prefix_request` | 24 / 24 | 13.81909799999994 / 11.32630450000579 | -18.0387569434 % | 25.165018999992753 / 15.044198000003234 | 17.922791 % / 15.605250 % | dans le seuil diagnostique |
| `known_prefix_guard` | 24 / 24 | 0.3869134999840753 / 0.3243960000036168 | -16.1580043041 % | 0.6134060000040336 / 0.5106629999936558 | 19.923562 % / 23.356111 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 36 / 36 | 921.1522025000158 / 929.8800015000015 | +0.9474871771 % | 2980.112519999995 / 2787.6444429999974 | 15.577190 % / 19.360539 % | dans le seuil diagnostique |
| `persistence` | 76 / 76 | 162.5276934999929 / 157.1372959999935 | -3.3166024718 % | 308.0826779999916 / 272.3122160000057 | 8.607303 % / 9.794058 % | dans le seuil diagnostique |
| `restoration` | 72 / 72 | 7.3861795000048005 / 8.951715499999409 | +21.1954773099 % | 57.9089329999988 / 55.048340000008466 | 31.936319 % / 34.892984 % | dépassement conservé |

### cohort_2 : STCK

| Mesure | n A / B | Médiane A / B (ms) | Variation | p95 A / B (ms) | `roundMedianNoise` A / B | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 4 / 4 | 11284.126620000001 / 12072.845776499998 | +6.9896340502 % | non estimé / non estimé | 3.456088 % / 9.794860 % | dans le seuil diagnostique |
| `new_decision` | 24 / 24 | 330.23769100000027 / 379.1709134999983 | +14.8175765013 % | 665.6349499999997 / 611.5669259999995 | 12.990196 % / 47.678722 % | dépassement conservé |
| `known_prefix_service` | 16 / 16 | 8.862615999998525 / 9.164088000002266 | +3.4016141510 % | non estimé / non estimé | 28.820200 % / 32.791638 % | dans le seuil diagnostique |
| `known_prefix_request` | 16 / 16 | 10.382627499999217 / 10.996453000001566 | +5.9120439407 % | non estimé / non estimé | 22.582639 % / 29.321375 % | dans le seuil diagnostique |
| `known_prefix_guard` | 16 / 16 | 0.22316699999737466 / 0.21393299999908777 | -4.1377085315 % | non estimé / non estimé | 48.620429 % / 43.989200 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 24 / 24 | 931.8190464999989 / 980.0138744999986 | +5.1721230834 % | 3767.1895509999995 / 4176.806262000002 | 10.327410 % / 13.736859 % | dans le seuil diagnostique |
| `persistence` | 52 / 52 | 206.92765750000035 / 225.09712299999865 | +8.7805882111 % | 475.6613499999985 / 467.53182700000616 | 21.758610 % / 39.140606 % | dans le seuil diagnostique |
| `restoration` | 48 / 48 | 19.28328949999741 / 18.383919999998398 | -4.6639838084 % | 156.70942400000058 / 157.51684400000158 | 33.928346 % / 47.655973 % | dans le seuil diagnostique |

### cohort_2 : SMLP

| Mesure | n A / B | Médiane A / B (ms) | Variation | p95 A / B (ms) | `roundMedianNoise` A / B | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| `session_elapsed` | 4 / 4 | 17701.31716 / 18605.918174 | +5.1103599005 % | non estimé / non estimé | 10.610554 % / 5.874140 % | dans le seuil diagnostique |
| `new_decision` | 36 / 36 | 437.94090100000176 / 431.8523084999979 | -1.3902772009 % | 898.6569270000036 / 945.3837140000105 | 31.787673 % / 40.591470 % | dans le seuil diagnostique |
| `known_prefix_service` | 24 / 24 | 8.991972000003443 / 10.782080499993754 | +19.9078522485 % | 12.101310999991256 / 23.68603899999289 | 12.259956 % / 32.046914 % | dépassement conservé |
| `known_prefix_request` | 24 / 24 | 11.216640499995265 / 13.617816999998468 | +21.4072698506 % | 15.355097000006936 / 26.066575000004377 | 10.356530 % / 31.977272 % | dépassement conservé |
| `known_prefix_guard` | 24 / 24 | 0.3419419999991078 / 0.36273800000344636 | +6.0817331607 % | 0.4666750000033062 / 2.3195969999942463 | 21.211089 % / 28.575004 % | dans le seuil diagnostique |
| `acquisition_and_persistence` | 36 / 36 | 902.9614430000074 / 989.0813740000012 | +9.5374981587 % | 2690.52023200001 / 2794.3100099999865 | 12.202026 % / 26.761450 % | dans le seuil diagnostique |
| `persistence` | 76 / 76 | 156.56362300000183 / 163.78065200000856 | +4.6096461373 % | 318.25749299999734 / 373.2109610000043 | 20.608726 % / 11.668042 % | dans le seuil diagnostique |
| `restoration` | 72 / 72 | 7.917255000000296 / 10.2236550000016 | +29.1313087680 % | 61.930755999987014 / 66.29957800000557 | 30.996283 % / 93.177299 % | dépassement conservé |

## Refus historique et qualification structurelle distincte

L’agrégateur historique inchangé a réellement été exécuté le **2026-11-11T13:33:35.238204-03:00** et s’est terminé avec le **code 1**. Son erreur est **`Within-cohort work metadata changed`**. Le [reçu d’échec](aggregation-failure.json) conserve les entrées inchangées, le [journal brut](aggregation-failure.log) et `outputExists: false` : le fichier de sortie strict `combined-comparison.json` n’a pas été produit. Ce contrôle reste `failed_work_metadata` ; aucun succès strict n’est annoncé.

L’acceptation présente provient du [contrat complémentaire déclaré avant la mesure](owner-growth-contract.json), de la [fixture structurelle](owner-graph-fixture.json), de son [attribution causale](owner-graph-attribution.json), puis des deux calculs indépendants JavaScript et Python. Le propriétaire ajouté est `public_window_question` et son programme est `v6.window_question.choose`. Les trois nœuds d’installation sont `family_state:public_window_question`, `family_activation:public_window_question` et `program:v6.window_question.choose`.

Les quatre seuls chemins structurels admissibles sont `observations[*].nodeCount`, `inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision`. Les 432 différences sont énumérées avec les valeurs A/B, chauffes comprises, et doivent correspondre exactement à la forme fonctionnelle capturée avant la fenêtre. Les autres métadonnées de travail entre versions et toutes les métadonnées de travail à l’intérieur de chaque version restent exactes. Les métadonnées comportementales entre versions restent exactes. Cette vérification de formes publiques n’affirme pas l’égalité de toutes les feuilles privées non exposées du graphe.

Les sources, la fixture, les outils de mesure et les règles ne sont pas adaptés aux résultats futurs. Le travail supplémentaire de graphe n’entraîne aucune réduction, soustraction ou normalisation des temps mesurés. Le refus historique, la qualification structurelle et la décision de coût ont des reçus et des statuts distincts.

## Isolation et portée de l’acceptation

L’acceptation coopérative a été enregistrée le **2026-11-11T13:35:26.168981-03:00** pour la demande `lot10b-cost-74143a-final-01`. La [revue d’isolation](../coordination/cost-final-01/isolation-review.json) lie les accords explicites des **trois lots** concernés, **six observations** de coordination et les instantanés finaux après revue. Les accords précèdent la fenêtre ; les états au repos restent identiques hors horodatage. **Aucun écart n’a été déclaré ou observé dans ces preuves.** Cette isolation coopérative ne constitue pas une surveillance continue des processus du système d’exploitation.

La [readiness](readiness.json) lie séparément les preuves fonctionnelles, le contrôle navigateur et la réserve HPDL. **La qualification HPDL reste partielle et distincte du résultat de performance.** Le passage du seuil de coût ne démontre ni une campagne HPDL complète, ni la contribution causale de WindowQuestion dans toutes les situations, ni la parité complète des appelants, ni une migration V6 complète. Les mesures STCK/SMLP sont des rejeux du chemin commun ; elles ne remplacent pas les preuves de jeu ou de source.

**Portée finale :** coût du candidat natif **0.62.0 / `74143a…`**, comparé à la référence publiée **0.61.0 / `f8d5097…`**, accepté sur les médianes de session complète de **STCK et SMLP**, avec les **32 sessions, 400 actions, huit chauffes, 24 actions de chauffe**, tous les diagnostics et le refus strict conservés. Ce rapport ne constate aucune publication du candidat et ne déclenche aucune nouvelle exécution.
