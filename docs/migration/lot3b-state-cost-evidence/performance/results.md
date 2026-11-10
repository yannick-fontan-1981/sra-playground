# Résultats officiels 0.42 : 14/16, budget encore non conforme

**La comparaison officielle reste `budget_review_required` : 14 médianes sur 16 respectent le seuil de +10 %. Les deux dépassements concernent la continuation STCK : service +27,720362563 % et requête +26,350747636 %. Le lot 3B reste ouvert ; 3C attend sa clôture.**

Les deux réserves de la fenêtre 0.41 rentrent dans le budget de cette nouvelle fenêtre : **persistance STCK −8,261037252 %**, **restauration SMLP +6,223865983 %**. Cette dernière reste plus lente que la référence fraîche 0.38, tout en respectant le seuil. Les temps de session baissent de **17,795781140 % sur STCK** et de **13,442301828 % sur SMLP**. Ces baisses ne compensent aucun dépassement local.

La [revue indépendante](consolidation-review.json), exécutée avec le script historique inchangé, réussit **231 contrôles sur 231** et confirme exactement les deux cohortes et leur [agrégat](combined-comparison.json). Son statut `passed` concerne les calculs et les preuves conservées ; son `budgetStatus` reste `budget_review_required`.

## Source et fenêtre réalisées

Le [protocole](protocol.md) a été déclaré le **2026-11-10T04:22:29.574793+00:00**, avant les mesures. Son SHA-256 est **`5cb3e2547319f0f66b228f38d0b8b54677fb89dfaff652f253f4078d1d1accdd`**. La référence de coût A est **Site 66 / native 0.38**, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`, 245 fichiers. B est le gel **native 0.42**, digest **`2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19`**, 249 fichiers. La référence fonctionnelle demeure **Site 69 / 0.41**.

La [fenêtre](window.json) court de **2026-11-10T04:28:42.564698+00:00** à **2026-11-10T04:37:35.095112+00:00**, dans l’ordre fixé **A1/B1/B2/A2**. Les quatre exécutions terminent avec le code zéro ; `status` et `finalIntegrity` valent `passed`. Ce statut d’intégrité ne vaut pas acceptation du budget.

| Série | Source | Début UTC | Fin UTC | État |
| --- | --- | --- | --- | --- |
| A1 | 0.38 | 04:28:42.800818 | 04:31:06.547949 | `passed`, code 0 |
| B1 | 0.42 | 04:31:06.637718 | 04:33:17.277236 | `passed`, code 0 |
| B2 | 0.42 | 04:33:17.375542 | 04:35:15.930327 | `passed`, code 0 |
| A2 | 0.38 | 04:35:16.016663 | 04:37:34.958939 | `passed`, code 0 |

Chaque série contient quatre sessions mesurées STCK10 puis quatre sessions SMLP15, après une chauffe de trois actions par cas. L’ensemble comprend **32 sessions mesurées, huit sessions par jeu/version et 400 actions** : 200 sur A, 200 sur B. Les seules exclusions sont les **huit chauffes de trois actions**, soit 24 actions. **Aucune session mesurée, cohorte ou valeur extrême n’est retirée.** STCK10 termine deux niveaux ; SMLP15 en termine trois. Les commandes sont recalculées avant restitution de leurs retours publics.

Les métadonnées de travail sont identiques sur les sessions retenues ; les inventaires natifs restent identiques au sein de chaque version. Le runner, ses entrées, les cas, la politique et l’environnement déclaré concordent. Environnement : **Node v24.22.1, Linux 6.18.57, AMD EPYC 9V74, neuf CPU logiques déclarés**. Les rapports de référence sont recopiés sans modifier leurs octets. Le protocole exclut les autres travaux lourds et le preview pendant la fenêtre ; la revue ne mesure pas indépendamment l’isolation du système d’exploitation.

## Les seize médianes agrégées

Toutes les durées ci-dessous sont en millisecondes. **n** désigne le nombre d’observations par version et par phase, identique avant/après. L’affichage arrondit les temps et pourcentages à neuf décimales ; les JSON conservent la pleine précision numérique. Les décisions ont été calculées sur ces valeurs complètes, avant tout arrondi.

| Cas et phase | n par version | Médiane A : 0.38 fraîche | Médiane B : 0.42 | Variation | Décision |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK · Session complète | 8 | 11507,688439500 | 9459,805390500 | -17,795781140 % | Dans le seuil |
| STCK · Nouvelle décision | 48 | 309,917134000 | 288,112360000 | -7,035678770 % | Dans le seuil |
| STCK · Service de continuation | 32 | 8,844152000 | 11,295783000 | +27,720362563 % | **Hors budget, non résolu** |
| STCK · Requête de continuation | 32 | 10,522126500 | 13,294785500 | +26,350747636 % | **Hors budget, non résolu** |
| STCK · Garde de continuation | 32 | 0,227991500 | 0,243714500 | +6,896309730 % | Dans le seuil |
| STCK · Acquisition et persistance | 48 | 967,482846000 | 782,620510000 | -19,107556973 % | Dans le seuil |
| STCK · Persistance | 104 | 179,444488000 | 164,620512000 | -8,261037252 % | Dans le seuil |
| STCK · Restauration | 96 | 10,576676500 | 8,128645000 | -23,145564677 % | Dans le seuil |
| SMLP · Session complète | 8 | 18844,401597500 | 16311,280257000 | -13,442301828 % | Dans le seuil |
| SMLP · Nouvelle décision | 72 | 411,372268500 | 348,846547000 | -15,199303961 % | Dans le seuil |
| SMLP · Service de continuation | 48 | 10,359747000 | 10,751807500 | +3,784460181 % | Dans le seuil |
| SMLP · Requête de continuation | 48 | 12,814216000 | 13,238993000 | +3,314888714 % | Dans le seuil |
| SMLP · Garde de continuation | 48 | 0,362470000 | 0,357322500 | -1,420117529 % | Dans le seuil |
| SMLP · Acquisition et persistance | 72 | 1008,602396500 | 935,698130500 | -7,228246359 % | Dans le seuil |
| SMLP · Persistance | 152 | 165,905441000 | 139,462379000 | -15,938634586 % | Dans le seuil |
| SMLP · Restauration | 144 | 5,118209500 | 5,436760000 | +6,223865983 % | Dans le seuil |

Le service de continuation STCK passe de **8,844152 à 11,295783 ms**, soit **+2,451631 ms**. La requête complète passe de **10,5221265 à 13,2947855 ms**, soit **+2,772659 ms**. Les deux métriques sont distinctes mais liées : la requête inclut le service, le transport et l’ordonnancement. Ce sont deux critères déclarés hors budget, pas la démonstration de deux causes indépendantes.

La conformité actuelle de la persistance STCK et de la restauration SMLP est établie face à **la référence 0.38 de cette fenêtre**. Comparer directement les durées absolues de cette fenêtre à celles de 0.41 ne constituerait pas un essai apparié 0.41 → 0.42. Le résultat officiel historique 0.41, ses 14/16 et ses deux anciennes réserves restent conservés dans [leur rapport](../../lot3b-smlp-cost-evidence/performance/results.md).

## Les deux cohortes restent au bilan

La [cohorte 1](cohort1/comparison.json) donne **14/16**, avec les mêmes deux dépassements de continuation STCK. La [cohorte 2](cohort2/comparison.json) donne **13/16** : les deux continuations STCK et la garde STCK dépassent +10 %. La garde STCK de cette seconde cohorte reste à **+13,578553527 %** même si son agrégat, **+6,896309730 %**, satisfait le seuil.

| Cas et phase | Cohorte 1 | Cohorte 2 | Agrégat des huit sessions |
| --- | ---: | ---: | ---: |
| STCK · Session complète | -12,427084934 % | -19,140262643 % | -17,795781140 % |
| STCK · Nouvelle décision | -3,273615905 % | -15,633042716 % | -7,035678770 % |
| STCK · Service de continuation | +26,747999826 % | +13,141427609 % | +27,720362563 % |
| STCK · Requête de continuation | +27,364774938 % | +11,737053580 % | +26,350747636 % |
| STCK · Garde de continuation | +8,234464788 % | +13,578553527 % | +6,896309730 % |
| STCK · Acquisition et persistance | -17,620437226 % | -20,334087984 % | -19,107556973 % |
| STCK · Persistance | -13,059469831 % | -6,284617292 % | -8,261037252 % |
| STCK · Restauration | -35,042559237 % | -18,541732050 % | -23,145564677 % |
| SMLP · Session complète | -9,175924037 % | -14,547811181 % | -13,442301828 % |
| SMLP · Nouvelle décision | -9,672356381 % | -23,033180357 % | -15,199303961 % |
| SMLP · Service de continuation | +1,321402481 % | +9,934083804 % | +3,784460181 % |
| SMLP · Requête de continuation | -1,260496467 % | +6,721756376 % | +3,314888714 % |
| SMLP · Garde de continuation | +1,783961550 % | -10,784713244 % | -1,420117529 % |
| SMLP · Acquisition et persistance | -1,424028088 % | -15,832631958 % | -7,228246359 % |
| SMLP · Persistance | -12,611636399 % | -19,583207218 % | -15,938634586 % |
| SMLP · Restauration | +5,450508581 % | +2,036378876 % | +6,223865983 % |

Les dépassements du service et de la requête STCK sont donc présents **dans les deux cohortes**, pas uniquement dans le regroupement. L’agrégat est calculé directement sur toutes les observations conservées ; il n’est pas la moyenne des ratios de cohortes. La continuation SMLP de la cohorte 2 reste proche de la limite, à **+9,934083804 %** pour le service. Aucun de ces résultats n’est écarté.

## Pointes de latence : p95 conservés

Le p95 suit le rang empirique `ceil(0.95 × n)`, uniquement pour **n ≥ 20**. Avec huit durées de session par version, **aucun p95 de session n’est publié**. Les observations de phase au sein d’une même session sont corrélées. Les p95 ne sont pas des critères supplémentaires de clôture, mais leurs hausses restent visibles.

| Cas et phase | n par version | p95 A en ms | p95 B en ms | Variation du p95 |
| --- | ---: | ---: | ---: | ---: |
| STCK · Nouvelle décision | 48 | 479,672354000 | 392,366434000 | -18,201157368 % |
| STCK · Service de continuation | 32 | 11,184791000 | 15,736011000 | +40,691149258 % |
| STCK · Requête de continuation | 32 | 13,319492000 | 20,205342000 | +51,697542219 % |
| STCK · Garde de continuation | 32 | 0,351750000 | 0,418799000 | +19,061549396 % |
| STCK · Acquisition et persistance | 48 | 4188,997645000 | 3410,001426000 | -18,596243899 % |
| STCK · Persistance | 104 | 349,756850000 | 305,434501000 | -12,672331936 % |
| STCK · Restauration | 96 | 67,021856000 | 46,955240000 | -29,940406306 % |
| SMLP · Nouvelle décision | 72 | 800,527360000 | 892,998337000 | +11,551257536 % |
| SMLP · Service de continuation | 48 | 20,142849000 | 20,144627000 | +0,008826954 % |
| SMLP · Requête de continuation | 48 | 22,752867000 | 22,835316000 | +0,362367521 % |
| SMLP · Garde de continuation | 48 | 0,756828000 | 7,512366000 | +892,612059810 % |
| SMLP · Acquisition et persistance | 72 | 3146,677684000 | 2503,350697000 | -20,444641988 % |
| SMLP · Persistance | 152 | 290,631144000 | 276,021515000 | -5,026862847 % |
| SMLP · Restauration | 144 | 28,771164000 | 25,645527000 | -10,863783613 % |

La réserve de queue de distribution la plus marquée est **SMLP, garde de continuation** : le p95 passe de **0,756828 à 7,512366 ms**, soit **+892,612059810 %** ou environ **9,93 fois** la valeur de référence, avec 48 observations de chaque côté. Sa médiane baisse pourtant de 1,420117529 %. La médiane ne décrit donc pas cette hausse des pointes. Le maximum retenu augmente également de **0,856475 à 11,197428 ms**.

La seconde cohorte conserve le principal épisode : p95 de garde SMLP **0,587959 → 9,579839 ms**, soit **+1 529,337930034 %** ; la première cohorte est en baisse sur ce p95. Les données ne permettent pas d’attribuer cette hausse à une cause précise. Il faut la garder comme réserve diagnostique, sans la faire disparaître derrière la conformité de sa médiane.

Les autres hausses agrégées sont les p95 STCK de service **+40,691149258 %**, de requête **+51,697542219 %**, de garde **+19,061549396 %** ; côté SMLP, décision **+11,551257536 %**, service **+0,008826954 %**, requête **+0,362367521 %**. Les p95 de persistance et de restauration agrégés baissent pour les deux jeux. La seconde cohorte garde néanmoins une hausse locale du p95 de restauration SMLP, **24,631442 → 30,325930 ms**, soit **+23,118776400 %**. Ses p95 SMLP de service et de requête augmentent respectivement de **35,885565452 %** et **28,464302207 %**.

## Bruit, seuil et limites

La classification des deux dépassements agrégés est **`over_budget_with_noise_unresolved`**. Le bruit est **un qualificatif, jamais une exemption**. `noiseAllowanceAdded` vaut `false`, et le seuil reste exactement **0,1**. Les étendues relatives des médianes de session suivantes expliquent la qualification, sans devenir des intervalles de confiance :

| Mesure | Étendue relative A | Étendue relative B |
| --- | ---: | ---: |
| STCK · Service de continuation | 36,440205606 % | 62,244414026 % |
| STCK · Requête de continuation | 35,942300711 % | 57,805497827 % |
| STCK · Persistance | 15,932216377 % | 36,647329137 % |
| SMLP · Restauration | 18,862119945 % | 38,553227301 % |
| SMLP · Garde de continuation | 47,113683802 % | 26,300030479 % |

Ces mesures n’autorisent ni gain causal attribué à une seule modification, ni latence navigateur ou production, ni garantie de session longue. Elles excluent le moteur du jeu, le réseau et le rendu. L’inspection est réalisée après le rejeu, hors durée de session. Les phases sont imbriquées et ne s’additionnent pas. La vérification de Pause couvre l’accusé et l’arrivée à une frontière sûre, pas une préemption arbitraire de la recherche. La correspondance des métadonnées de travail ne vaut pas identité de tous les états privés.

Le [diagnostic instrumenté 0.41 → 0.42](../diagnostic/protocol.md) reste distinct, avec sa [réserve d’isolation](../diagnostic/isolation-deviation.json). Aucune session diagnostique ni historique n’entre dans cet agrégat. Aucune nouvelle fenêtre du même code n’a été sélectionnée pour remplacer ce résultat.

## Revue indépendante et preuves

La revue Python recalcule les distributions, médianes, p95, dispersions, ratios, statuts de cohortes et agrégat à partir des quatre rapports bruts. Elle vérifie l’ordre ABBA, les 32 sessions, les 400 actions, les empreintes et l’intégrité des entrées. **231/231 contrôles passent.** Son succès ne ferme aucun dépassement et ne certifie pas indépendamment l’isolation OS ou la causalité des latences.

| Pièce | SHA-256 |
| --- | --- |
| [window.json](window.json) | `d5a337c380d081e9940a6f4e326a16d4d56f74d28b25aec784f994e37fe2f34e` |
| [cohort1/comparison.json](cohort1/comparison.json) | `415f176b7761151f459efe50a391f017220e5006042ac126c50c50debe478b94` |
| [cohort2/comparison.json](cohort2/comparison.json) | `48bb4a6673efc32d22a8eb9d0413501653776da5e9f30f7d4a3b26928e636cc3` |
| [combined-comparison.json](combined-comparison.json) | `1491be326fccd34d2487be30fca912b9b7a56d4bef0647e13eb2312028011e02` |
| [consolidation-review.json](consolidation-review.json) | `8fb4789cc0b846b43e4783ddf835767817f1cfbec00278feae1b7fa97a8d7433` |

**Décision conservée : 3B ouvert à 14/16.** La prochaine correction doit localiser le surcoût commun du service et de la requête de continuation STCK, en conservant les baisses de persistance et les contrats. Les pointes de garde SMLP restent une réserve explicite à examiner. Une nouvelle source matériellement modifiée, gelée et validée devra satisfaire le même protocole avant de commencer 3C.
