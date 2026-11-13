# Lot 3D : résultats de coût de native 0.45

**Le coût est accepté sous le critère global déclaré avant la fenêtre : STCK +9,609248 %, SMLP −2,535940 %, soit deux jeux sur deux strictement sous +10 %.** La [décision globale](global-budget-decision.json) conserve les quatre dépassements de phase et ne modifie pas le diagnostic historique : **12 critères sur 16**, statut `budget_review_required`. La [revue indépendante de consolidation](consolidation-review.json) passe **231 contrôles sur 231**.

La marge globale STCK est seulement de **0,390752 point de pourcentage**. Sa deuxième cohorte affiche **+15,844198 %** sur la durée de session et reste intégralement incluse. Le critère préalablement déclaré porte sur les huit sessions réunies par jeu et par version ; il n’exige pas que chaque cohorte passe séparément. Ce résultat est une acceptation sur cette fenêtre finie, pas une garantie de marge durable.

## Sources et portée

| Rôle | Source | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 72 / native 0.44.0 ; commit `a39997bffdca1ce080879d967d3f5eb95a88d544` | `e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255` |
| B : candidat gelé | Native 0.45.0 | `5b5e59e14e4d417d92cacd6e79d21b6e8e833d715c8d05df2b74806bb09b40f3` |

Le [protocole](protocol.md), la [déclaration](declaration.json) finalisée le 10 novembre 2026 à 08:48:53 UTC, la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique diagnostique de phases](comparison-policy.json) précèdent la fenêtre. Les cas, la politique de phases et les outils conservés restent inchangés ; les mesures historiques de 0.44 ne sont pas réutilisées comme échantillons.

La comparaison porte sur la boucle native avec les retours publics STCK10 et SMLP15. Elle exclut le moteur du jeu, le réseau de production et le rendu navigateur. Les commandes sont recalculées avant réception du retour enregistré. Elle ne démontre ni une contribution propre de RootedLine sur ces parcours, ni une réussite de jeu, ni l’équivalence du programme original complet.

## Exécution et intégrité

La [fenêtre officielle](window.json) s’est déroulée le **10 novembre 2026 de 08:59:23 à 09:08:06 UTC**. Ses quatre séries ont terminé avec le statut `passed` ; son intégrité finale est `passed`.

| Série | Source | Début UTC | Fin UTC | Résultat |
| --- | --- | --- | --- | --- |
| A1 | 0.44.0 | 08:59:23 | 09:01:29 | passed |
| B1 | 0.45.0 | 09:01:29 | 09:03:36 | passed |
| B2 | 0.45.0 | 09:03:36 | 09:05:50 | passed |
| A2 | 0.44.0 | 09:05:51 | 09:08:06 | passed |

| Élément | Résultat conservé |
| --- | --- |
| Ordre | A1, B1, B2, A2 |
| Cohortes | 2 |
| Sessions mesurées | 32 ; huit par jeu et par version |
| Actions mesurées | 400 ; 200 pour A et 200 pour B |
| Chauffes exclues | 8 sessions, 24 actions |
| Sessions mesurées ou valeurs extrêmes exclues | 0 |
| Revue de consolidation | 231/231, passée |
| Intégrité finale | Inventaires, traces, cas, protocole et outils surveillés inchangés |

Les rapports conservés et la revue ne signalent aucun incident de mesure ni série incomplète. Chaque série mesure STCK puis SMLP. Chaque cas/série utilise un worker distinct, une chauffe de trois actions puis quatre sessions à mémoire froide ; le processus et son JIT restent présents au sein de ce cas/série. Le [reçu de préparation finale](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [préflight statique](static-preflight.json) a confirmé les sources, traces, dépendances et l’arrêt de la prévisualisation.

L’environnement consigné est Node v24.22.1 sous Linux 6.18.57, processeur AMD EPYC 9V74 et neuf processeurs logiques exposés. Ces métadonnées, l’ordre ABBA et l’isolation déclarée n’établissent pas une identité des états GC, JIT ou d’ordonnancement entre sessions.

## Critère global par jeu

Les valeurs ci-dessous viennent du [reviewer global](global-budget-decision.json), qui relit toutes les durées de session conservées après validation du reçu de consolidation :

`variation globale = médiane(B) / médiane(A) − 1`

Chaque jeu doit rester strictement sous +10 %. Les jeux ne se compensent pas ; les ratios de cohortes ne sont pas moyennés et les phases imbriquées ne sont pas additionnées.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Critère strict < +10 % |
| --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 9947,562 | 10903,448 | +9,609248 % | Accepté |
| SMLP | 8 / 8 | 17185,212 | 16749,406 | −2,535940 % | Accepté |

Le reçu porte le statut **`accepted_under_user_global_rule`**, accepté **2/2**, sans retrait de session ni compensation entre jeux. Cette décision est distincte du comparateur historique de phases, dont les statuts sont conservés.

Les durées affichées sont arrondies à trois décimales en millisecondes, six pour les valeurs inférieures à 1 ms. Les variations sont calculées sur les valeurs intégrales conservées, puis affichées à six décimales. L’arrondi de présentation ne décide pas de l’acceptation.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json), contrôlée par la [revue de consolidation](consolidation-review.json). « Dans le seuil » correspond exactement à `within_observed_budget` ; « Dépassement conservé » correspond à `over_budget_with_noise_unresolved`.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic historique |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 9947,562 | 10903,448 | +9,609248 % | Dans le seuil |
| STCK | `new_decision` | 48 / 48 | 319,552 | 311,652 | −2,472053 % | Dans le seuil |
| STCK | `known_prefix_service` | 32 / 32 | 8,404 | 10,493 | +24,858250 % | **Dépassement conservé** |
| STCK | `known_prefix_request` | 32 / 32 | 10,077 | 12,669 | +25,726153 % | **Dépassement conservé** |
| STCK | `known_prefix_guard` | 32 / 32 | 0,216875 | 0,262342 | +20,964611 % | **Dépassement conservé** |
| STCK | `acquisition_and_persistence` | 48 / 48 | 856,965 | 868,067 | +1,295488 % | Dans le seuil |
| STCK | `persistence` | 104 / 104 | 159,151 | 171,755 | +7,919097 % | Dans le seuil |
| STCK | `restoration` | 96 / 96 | 7,533 | 8,563 | +13,672589 % | **Dépassement conservé** |
| SMLP | `session_elapsed` | 8 / 8 | 17185,212 | 16749,406 | −2,535940 % | Dans le seuil |
| SMLP | `new_decision` | 72 / 72 | 374,591 | 349,531 | −6,690060 % | Dans le seuil |
| SMLP | `known_prefix_service` | 48 / 48 | 12,570 | 10,497 | −16,493581 % | Dans le seuil |
| SMLP | `known_prefix_request` | 48 / 48 | 15,368 | 12,929 | −15,873958 % | Dans le seuil |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,419019 | 0,346892 | −17,213301 % | Dans le seuil |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 923,976 | 940,581 | +1,797164 % | Dans le seuil |
| SMLP | `persistence` | 152 / 152 | 144,308 | 132,607 | −8,108370 % | Dans le seuil |
| SMLP | `restoration` | 144 / 144 | 5,906 | 5,483 | −7,173563 % | Dans le seuil |

Le comparateur conserve **4/8 diagnostics dans le seuil pour STCK**, **8/8 pour SMLP**, soit **12/16**. Les quatre dépassements sont STCK : service de préfixe **+24,858250 %**, requête de préfixe **+25,726153 %**, garde **+20,964611 %**, restauration **+13,672589 %**. Leur classification de bruit ne relève pas le seuil et ne résout pas leur diagnostic historique ; leur acceptation dans ce lot découle exclusivement de la règle globale distincte autorisée avant la mesure.

## Cohortes conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et de [cohorte 2](cohort2/comparison.json) conservent toutes leurs sorties. Leurs statuts sont tous deux `budget_review_required`, avec respectivement **13/16** et **10/16** diagnostics dans le seuil.

| Cohorte | Ordre | Jeu | Sessions A / B | Médiane de session A, ms | Médiane de session B, ms | Variation de session | Diagnostics dans le seuil |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 4 / 4 | 10089,546 | 10091,883 | +0,023160 % | 5/8 |
| 1 | A1 puis B1 | SMLP | 4 / 4 | 16381,823 | 16526,954 | +0,885925 % | 8/8 |
| 2 | B2 puis A2 | STCK | 4 / 4 | 9769,420 | 11317,307 | +15,844198 % | 2/8 |
| 2 | B2 puis A2 | SMLP | 4 / 4 | 19033,249 | 17525,907 | −7,919519 % | 8/8 |

**La cohorte 2 STCK est défavorable : +15,844198 % sur la session, six diagnostics sur huit au-dessus du seuil historique.** Ses médianes passent de 9 769,420 ms à 11 317,307 ms. La cohorte 1 STCK est à +0,023160 %. Toutes les sessions des deux cohortes sont incluses dans la médiane globale STCK de +9,609248 % ; aucune cohorte n’a été sélectionnée pour remplacer l’ensemble.

Les variations de tous les diagnostics par cohorte sont conservées ci-dessous. Le gras signale un dépassement du seuil historique ; il ne crée pas un nouveau critère d’acceptation.

| Jeu | Mesure | Variation cohorte 1 | Variation cohorte 2 |
| --- | --- | --- | --- |
| STCK | `session_elapsed` | +0,023160 % | **+15,844198 %** |
| STCK | `new_decision` | −10,462058 % | +2,141503 % |
| STCK | `known_prefix_service` | **+11,780132 %** | **+31,287662 %** |
| STCK | `known_prefix_request` | **+11,325520 %** | **+30,523192 %** |
| STCK | `known_prefix_guard` | **+14,128405 %** | **+23,033258 %** |
| STCK | `acquisition_and_persistence` | −4,000208 % | **+13,853650 %** |
| STCK | `persistence` | −1,500775 % | +7,738619 % |
| STCK | `restoration` | +1,032719 % | **+18,438000 %** |
| SMLP | `session_elapsed` | +0,885925 % | −7,919519 % |
| SMLP | `new_decision` | −7,494873 % | −6,413948 % |
| SMLP | `known_prefix_service` | −10,063449 % | −18,025158 % |
| SMLP | `known_prefix_request` | −5,425265 % | −18,176963 % |
| SMLP | `known_prefix_guard` | −18,915514 % | −10,396762 % |
| SMLP | `acquisition_and_persistence` | +3,933688 % | −5,871827 % |
| SMLP | `persistence` | +1,991949 % | −9,568228 % |
| SMLP | `restoration` | +0,601976 % | −14,091222 % |

## Dispersion et p95 agrégés

Les statistiques suivantes reprennent les distributions de la [comparaison agrégée](combined-comparison.json). Le p95 est disponible uniquement à partir de vingt observations, au rang empirique `ceil(0.95 × n)`. Les sessions ont huit observations par version : aucun p95 de session n’est publié. La variation du p95 présentée ici est `p95(B) / p95(A) − 1` ; elle est descriptive et n’ajoute pas de critère d’acceptation.

| Jeu | Mesure | p95 A, ms | p95 B, ms | Variation du p95 | Min–max A, ms | Min–max B, ms |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | Non disponible | Non disponible | Non disponible | 9550,023 à 10945,134 | 9523,660 à 11738,647 |
| STCK | `new_decision` | 434,701 | 557,250 | +28,191695 % | 159,830 à 543,359 | 184,642 à 578,006 |
| STCK | `known_prefix_service` | 11,312 | 12,066 | +6,664543 % | 7,470 à 17,443 | 7,830 à 12,282 |
| STCK | `known_prefix_request` | 13,555 | 14,269 | +5,270189 % | 9,158 à 19,378 | 9,283 à 14,303 |
| STCK | `known_prefix_guard` | 0,341434 | 0,428143 | +25,395538 % | 0,084876 à 0,354825 | 0,084555 à 0,479197 |
| STCK | `acquisition_and_persistence` | 3537,569 | 3922,090 | +10,869634 % | 370,878 à 4337,135 | 386,815 à 4203,447 |
| STCK | `persistence` | 329,078 | 348,065 | +5,769741 % | 13,624 à 407,965 | 15,388 à 458,681 |
| STCK | `restoration` | 52,140 | 66,345 | +27,243729 % | 1,908 à 58,970 | 1,797 à 69,862 |
| SMLP | `session_elapsed` | Non disponible | Non disponible | Non disponible | 16027,963 à 20110,686 | 15916,766 à 18370,386 |
| SMLP | `new_decision` | 868,783 | 855,916 | −1,480976 % | 191,901 à 1159,309 | 198,144 à 1031,430 |
| SMLP | `known_prefix_service` | 25,411 | 19,031 | −25,107425 % | 8,245 à 42,964 | 7,516 à 23,127 |
| SMLP | `known_prefix_request` | 29,011 | 21,928 | −24,415724 % | 10,420 à 45,671 | 9,468 à 26,078 |
| SMLP | `known_prefix_guard` | 11,283 | 0,622610 | −94,481883 % | 0,193036 à 17,268 | 0,190381 à 8,277 |
| SMLP | `acquisition_and_persistence` | 2725,315 | 2627,724 | −3,580908 % | 295,144 à 3287,007 | 301,381 à 2823,258 |
| SMLP | `persistence` | 257,054 | 271,790 | +5,732924 % | 16,550 à 396,004 | 19,027 à 602,083 |
| SMLP | `restoration` | 25,878 | 26,795 | +3,542619 % | 1,916 à 78,377 | 1,748 à 87,658 |

Les pointes défavorables restent visibles : le p95 STCK de nouvelle décision augmente de **+28,191695 %** malgré une médiane en baisse ; ceux de restauration, de garde et d’acquisition/persistance augmentent respectivement de **+27,243729 %**, **+25,395538 %** et **+10,869634 %**. Pour SMLP, les p95 de persistance et de restauration augmentent de **+5,732924 %** et **+3,542619 %** alors que leurs médianes baissent. Le maximum SMLP de persistance passe de **396,004 à 602,083 ms** ; celui de restauration de **78,377 à 87,658 ms**.

Les observations de phase à l’intérieur d’une même session sont corrélées. La dispersion n’est pas un intervalle de confiance et aucune tolérance supplémentaire n’est ajoutée au seuil. Ces distributions n’établissent pas la cause des variations.

### P95 disponibles dans chaque cohorte

Les p95 de cohorte ne sont pas moyennés pour produire le p95 agrégé. Les cellules « Non disponible » correspondent aux effectifs inférieurs à vingt, notamment quatre sessions par jeu/version et seize services, requêtes ou gardes STCK par cohorte. Les effectifs sont ceux de chaque version dans la cohorte.

#### Cohorte 1

| Jeu | Mesure | Effectif A / B | p95 A, ms | p95 B, ms | Variation du p95 |
| --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | Non disponible | Non disponible | Non disponible |
| STCK | `new_decision` | 24 / 24 | 419,937 | 503,490 | +19,896355 % |
| STCK | `known_prefix_service` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `known_prefix_request` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `known_prefix_guard` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `acquisition_and_persistence` | 24 / 24 | 3537,569 | 3500,873 | −1,037324 % |
| STCK | `persistence` | 52 / 52 | 329,078 | 348,065 | +5,769741 % |
| STCK | `restoration` | 48 / 48 | 52,140 | 69,554 | +33,398105 % |
| SMLP | `session_elapsed` | 4 / 4 | Non disponible | Non disponible | Non disponible |
| SMLP | `new_decision` | 36 / 36 | 839,405 | 835,368 | −0,480941 % |
| SMLP | `known_prefix_service` | 24 / 24 | 23,343 | 17,373 | −25,575536 % |
| SMLP | `known_prefix_request` | 24 / 24 | 26,306 | 19,546 | −25,698246 % |
| SMLP | `known_prefix_guard` | 24 / 24 | 8,137 | 8,155 | +0,224246 % |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 2474,149 | 2627,724 | +6,207162 % |
| SMLP | `persistence` | 76 / 76 | 250,524 | 264,947 | +5,757155 % |
| SMLP | `restoration` | 72 / 72 | 25,878 | 26,795 | +3,542619 % |

#### Cohorte 2

| Jeu | Mesure | Effectif A / B | p95 A, ms | p95 B, ms | Variation du p95 |
| --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | Non disponible | Non disponible | Non disponible |
| STCK | `new_decision` | 24 / 24 | 434,701 | 557,250 | +28,191695 % |
| STCK | `known_prefix_service` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `known_prefix_request` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `known_prefix_guard` | 16 / 16 | Non disponible | Non disponible | Non disponible |
| STCK | `acquisition_and_persistence` | 24 / 24 | 3306,920 | 3922,090 | +18,602505 % |
| STCK | `persistence` | 52 / 52 | 360,190 | 397,193 | +10,273254 % |
| STCK | `restoration` | 48 / 48 | 44,942 | 46,282 | +2,982973 % |
| SMLP | `session_elapsed` | 4 / 4 | Non disponible | Non disponible | Non disponible |
| SMLP | `new_decision` | 36 / 36 | 1084,355 | 927,732 | −14,443880 % |
| SMLP | `known_prefix_service` | 24 / 24 | 25,932 | 19,508 | −24,771588 % |
| SMLP | `known_prefix_request` | 24 / 24 | 32,390 | 21,928 | −32,300987 % |
| SMLP | `known_prefix_guard` | 24 / 24 | 12,733 | 0,477926 | −96,246440 % |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 3272,240 | 2698,108 | −17,545528 % |
| SMLP | `persistence` | 76 / 76 | 278,988 | 275,668 | −1,189935 % |
| SMLP | `restoration` | 72 / 72 | 36,578 | 27,337 | −25,264304 % |

Les variations défavorables de p95 restent présentes même lorsqu’elles ne se retrouvent pas dans l’agrégat. Par exemple, le p95 de garde SMLP de la cohorte 1 passe de 8,137 à 8,155 ms, tandis que celui de la cohorte 2 baisse fortement. La baisse du p95 agrégé ne retire ni le premier constat ni ses observations.

## Articulation avec la validation fonctionnelle

Les [reçus de validation finale](../final/revalidation/validation/delta-tests-run.json) et de [contrôles et compilation](../final/revalidation/validation/checks-run.json) conservent **1 724/1 724 tests sur 50 fichiers** et **5/5 contrôles de projet et compilation**. Les [régressions CATR/RSWP](../final/regressions/regression-summary.json) passent **34/34**. Le premier reçu de 1 722/1 724 reste conservé : deux attentes de métadonnées de couverture ont été corrigées, sans changement du natif, comme documenté dans la [réconciliation des attentes](../final/test-expectation-reconciliation.json).

La [résolution qualifiée SK48](../final/sk48-resolution.json) constate **12 actions, aucun niveau achevé et cinq préfixes**, avec un arrêt `frontier_unknown` après la réfutation du modèle conditionnel. Les **126/126 comparaisons source** de la couche propre concordent sur les propositions, retours, gardes, états, digests et refus terminal. Les contrôles acquis et la réfutation contribuent aux décisions, mais l’objectif de trois niveaux demeure non atteint. Le coût accepté sur STCK/SMLP ne clôture donc pas cet objectif et ne prouve pas une loi physique universelle ni la parité du programme original complet.

## Preuves conservées

- [Déclaration préalable](declaration.json), [protocole](protocol.md), [politique globale](global-budget-policy.json), [préflight statique](static-preflight.json) et [préparation finale](readiness.json).
- [Fenêtre et intégrité finale](window.json).
- Rapports bruts : [A1](cohort1/baseline.json), [B1](cohort1/after.json), [B2](cohort2/after.json), [A2](cohort2/baseline.json).
- [Comparaison cohorte 1](cohort1/comparison.json), [comparaison cohorte 2](cohort2/comparison.json), [comparaison agrégée](combined-comparison.json).
- [Revue indépendante, 231 contrôles](consolidation-review.json), puis [décision globale distincte](global-budget-decision.json).

Les rapports bruts, comparateurs et diagnostics historiques ne sont pas réécrits par cette synthèse. Aucune mesure supplémentaire n’a été lancée après la fenêtre pour modifier le résultat.

