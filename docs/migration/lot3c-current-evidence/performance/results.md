# Lot 3C : résultat officiel des coûts de 0.44

**Accepté selon la règle globale autorisée : 2/2 jeux.** La médiane de session complète évolue de **+1,540821 % pour STCK** et **−0,378796 % pour SMLP**. Chaque variation reste strictement inférieure à +10 %. Le classement du comparateur historique reste **14/16, `budget_review_required`** : les nouvelles décisions STCK (**+15,102315 %**) et les gardes de continuation STCK (**+15,178145 %**) dépassent son seuil de phase. Ces deux observations sont conservées et acceptées sous la règle globale préalablement autorisée.

La [décision globale](global-budget-decision.json), l’[agrégat des phases](combined-comparison.json) et la [revue arithmétique indépendante](consolidation-review.json) sont des reçus distincts. La revue arithmétique passe **231/231 contrôles**. Aucun statut de phase, échantillon ou résultat défavorable n’est réécrit.

## Sources, calendrier et effectifs

| Rôle | Révision mesurée | Digest natif |
| --- | --- | --- |
| A, référence fraîche | Publication Site 71 / native 0.43.0 ; commit `e9fd144112b05a65af5c88e9f05c541f43ed8ed7` | `3e88aa12214fd3d4a4feb8d63b946123b8394cb4a0cbd0a156cc059c37f7b46c` |
| B, correction gelée | Native 0.44.0 ; 251 fichiers natifs, archive de 262 fichiers | `e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255` |

Le [protocole](protocol.md) et la [déclaration](declaration.json) sont finalisés à **2026-11-10T07:19:43.023423+00:00**, avant la [fenêtre](window.json), commencée à **2026-11-10T07:29:48.848718+00:00** et terminée à **2026-11-10T07:38:11.008267+00:00**. Les quatre séries s’achèvent dans l’ordre **A1, B1, B2, A2**. Leur intégrité finale est `passed`. Les inventaires natifs, outils, cas, traces et politiques restent liés à leurs empreintes. La référence 0.43 est remesurée dans cette fenêtre ; aucun temps historique n’est recyclé.

Les **32 sessions mesurées et 400 actions** sont toutes incluses : huit sessions par jeu et par version, dix actions par session STCK et quinze par session SMLP, soit 200 actions pour A et 200 pour B. Les seules exclusions sont **huit chauffes préalables de trois actions, 24 actions**. Aucune session mesurée ni valeur extrême n’est exclue. Les métadonnées de travail, les déclarations et l’environnement statique correspondent. Le [reçu de préparation](readiness.json) consigne la fin des calculs fonctionnels et l’arrêt du preview avant le lancement.

## Coût global, calculé séparément par jeu

| Jeu | Sessions par version | Médiane A, 0.43 fraîche (ms) | Médiane B, 0.44 (ms) | Variation globale | Décision |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK | 8 | 9839,2616785 | 9990,867087500003 | **+1,540820988 %** | Accepté, strictement sous +10 % |
| SMLP | 8 | 16722,475821499997 | 16659,131670000002 | **−0,378796490 %** | Accepté, strictement sous +10 % |

Les deux médianes de cette table reprennent toutes les décimales des reçus ; les pourcentages sont arrondis à neuf décimales. Le reviewer applique le seuil strict aux nombres conservés, sans arrondir pour décider. Il réunit les huit durées A et les huit durées B de chaque jeu avant de calculer `médiane(B) / médiane(A) − 1`. Une baisse sur SMLP ne compense donc pas une hausse sur STCK. Les phases imbriquées ne sont pas additionnées, et les ratios de cohorte ne sont pas moyennés.

Ces résultats établissent l’acceptation de coût de cette fenêtre. Ils ne démontrent pas la cause d’une variation ni une accélération indépendante de la machine. Huit durées par jeu/version ne permettent pas de publier un p95 de session selon le minimum préalablement fixé de vingt échantillons.

## Les 16 mesures historiques restent visibles

Les effectifs sont indiqués **par version**. Les valeurs de cette table sont arrondies à six décimales ; les distributions complètes et les nombres conservés figurent dans l’[agrégat](combined-comparison.json). Le classement de phase historique utilise sa limite inchangée à +10 %. La décision d’acceptation de coût demeure celle des sessions complètes, ci-dessus.

| Jeu | Mesure | n | Médiane A (ms) | Médiane B (ms) | Variation | Diagnostic historique |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| STCK | Session complète | 8 | 9839,261678 | 9990,867088 | +1,540821 % | Dans le seuil |
| STCK | Nouvelle décision | 48 | 298,361261 | 343,420717 | +15,102315 % | **Dépassement avec dispersion conservé** |
| STCK | Service de continuation connue | 32 | 8,485393 | 9,309898 | +9,716751 % | Dans le seuil |
| STCK | Requête de continuation connue | 32 | 10,268967 | 11,153078 | +8,609537 % | Dans le seuil |
| STCK | Garde de continuation connue | 32 | 0,197943 | 0,227987 | +15,178145 % | **Dépassement avec dispersion conservé** |
| STCK | Acquisition avec persistance | 48 | 819,746414 | 829,908284 | +1,239636 % | Dans le seuil |
| STCK | Persistance | 104 | 153,322820 | 163,747043 | +6,798872 % | Dans le seuil |
| STCK | Restauration | 96 | 7,393860 | 7,484836 | +1,230413 % | Dans le seuil |
| SMLP | Session complète | 8 | 16722,475821 | 16659,131670 | −0,378796 % | Dans le seuil |
| SMLP | Nouvelle décision | 72 | 359,058097 | 367,378462 | +2,317275 % | Dans le seuil |
| SMLP | Service de continuation connue | 48 | 11,708712 | 10,344480 | −11,651431 % | Dans le seuil |
| SMLP | Requête de continuation connue | 48 | 14,313676 | 12,971524 | −9,376707 % | Dans le seuil |
| SMLP | Garde de continuation connue | 48 | 0,391293 | 0,382660 | −2,206275 % | Dans le seuil |
| SMLP | Acquisition avec persistance | 72 | 888,692410 | 911,364844 | +2,551213 % | Dans le seuil |
| SMLP | Persistance | 152 | 133,856912 | 135,537573 | +1,255565 % | Dans le seuil |
| SMLP | Restauration | 144 | 5,430380 | 5,348740 | −1,503394 % | Dans le seuil |

Les deux dépassements STCK gardent le statut exact **`over_budget_with_noise_unresolved`**. La médiane de nouvelle décision augmente de **298,361261 à 343,420717 ms**, soit environ **45,059456 ms**. Celle de garde augmente de **0,197943 à 0,227987 ms**, soit environ **0,030044 ms**. La garde est comprise dans d’autres phases ; ces durées ne doivent pas être cumulées pour reconstituer la session.

| Dépassement STCK | Étendue relative des médianes par session A | Étendue relative des médianes par session B |
| --- | ---: | ---: |
| Nouvelle décision | 42,150361 % | 22,564134 % |
| Garde de continuation connue | 60,505667 % | 73,379076 % |

La dispersion reste descriptive. Elle n’est ni une explication démontrée de la hausse, ni une autorisation d’ajouter une tolérance au seuil. Le changement d’acceptation vient exclusivement de la règle globale explicitement autorisée avant la fenêtre.

## p95 disponibles et observations défavorables

Le p95 utilise le rang empirique `ceil(0,95 × n)`, uniquement pour `n ≥ 20`. Toutes les valeurs disponibles dans l’agrégat sont publiées ci-dessous ; **« hausse » désigne une observation défavorable conservée**, sans critère supplémentaire d’acceptation. Les n sont ceux de la table précédente.

| Jeu | Mesure | p95 A (ms) | p95 B (ms) | Variation du p95 | Observation |
| --- | --- | ---: | ---: | ---: | --- |
| STCK | Nouvelle décision | 447,351196 | 503,671024 | +12,589623 % | **Hausse conservée** |
| STCK | Service de continuation connue | 15,298075 | 18,423541 | +20,430453 % | **Hausse conservée** |
| STCK | Requête de continuation connue | 18,612415 | 20,673655 | +11,074544 % | **Hausse conservée** |
| STCK | Garde de continuation connue | 1,084832 | 0,992936 | −8,470989 % | Baisse observée |
| STCK | Acquisition avec persistance | 3519,487873 | 3509,114845 | −0,294731 % | Baisse observée |
| STCK | Persistance | 331,953147 | 333,042326 | +0,328112 % | **Hausse conservée** |
| STCK | Restauration | 56,020973 | 51,485556 | −8,095927 % | Baisse observée |
| SMLP | Nouvelle décision | 801,920013 | 803,313033 | +0,173711 % | **Hausse conservée** |
| SMLP | Service de continuation connue | 25,370559 | 22,391959 | −11,740380 % | Baisse observée |
| SMLP | Requête de continuation connue | 27,710575 | 24,653865 | −11,030843 % | Baisse observée |
| SMLP | Garde de continuation connue | 9,976115 | 7,951474 | −20,294884 % | Baisse observée |
| SMLP | Acquisition avec persistance | 2581,210712 | 2648,988244 | +2,625804 % | **Hausse conservée** |
| SMLP | Persistance | 255,290274 | 263,000848 | +3,020316 % | **Hausse conservée** |
| SMLP | Restauration | 27,648912 | 27,106826 | −1,960605 % | Baisse observée |

Les pointes STCK les plus défavorables de l’agrégat concernent le **service de continuation (+20,430453 %)**, la **nouvelle décision (+12,589623 %)** et la **requête de continuation (+11,074544 %)**. Le p95 de garde STCK diminue alors que sa médiane augmente : les deux observations restent visibles, sans substitution de l’une à l’autre.

Les p95 défavorables propres aux cohortes sont aussi conservés, même lorsqu’ils ne se retrouvent pas comme hausse dans l’agrégat :

| Cohorte | Jeu | Mesure | n par version | p95 A (ms) | p95 B (ms) | Variation |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | STCK | Persistance | 52 | 335,428702 | 345,355974 | +2,959577 % |
| 1 | SMLP | Acquisition avec persistance | 36 | 2581,210712 | 2648,988244 | +2,625804 % |
| 1 | SMLP | Persistance | 76 | 255,290274 | 262,518167 | +2,831245 % |
| 1 | SMLP | Restauration | 72 | 27,648912 | 32,065561 | +15,974043 % |
| 2 | STCK | Nouvelle décision | 24 | 400,012663 | 503,671024 | +25,913770 % |
| 2 | STCK | Acquisition avec persistance | 24 | 3391,888114 | 3430,224515 | +1,130238 % |
| 2 | STCK | Persistance | 52 | 313,314439 | 332,146614 | +6,010631 % |
| 2 | SMLP | Nouvelle décision | 36 | 778,137648 | 788,341072 | +1,311262 % |
| 2 | SMLP | Acquisition avec persistance | 36 | 2614,673067 | 2951,869275 | +12,896305 % |

En particulier, la restauration SMLP de cohorte 1 conserve un p95 **+15,974043 %**, alors que son p95 agrégé diminue. La nouvelle décision STCK de cohorte 2 conserve **+25,913770 %**. Les p95 STCK des continuations et gardes ne sont pas publiables dans chaque cohorte prise séparément, où ils n’ont que seize observations ; ils le deviennent après réunion des trente-deux observations des deux cohortes. Les échantillons d’une même session sont corrélés. Aucun intervalle de confiance, correction de bruit ou exclusion de valeur extrême n’est ajouté.

## Cohortes et contrôle indépendant

| Comparaison | Classement historique des 16 mesures | Global STCK | Global SMLP | Dépassements conservés |
| --- | --- | ---: | ---: | --- |
| [Cohorte 1](cohort1/comparison.json) | 16/16, `passed` | +0,320340 % | −1,181720 % | Aucun |
| [Cohorte 2](cohort2/comparison.json) | 14/16, `budget_review_required` | +4,236916 % | +3,506193 % | STCK nouvelle décision +26,507773 % ; STCK garde de continuation connue +17,939640 % |
| [Agrégat](combined-comparison.json) | 14/16, `budget_review_required` | +1,540821 % | −0,378796 % | STCK nouvelle décision +15,102315 % ; STCK garde +15,178145 % |

La cohorte 1 conserve **16/16**, la cohorte 2 **14/16**. Leurs quatre rapports bruts et leurs deux comparaisons sont tous retenus. Aucun choix de cohorte favorable n’intervient dans la décision globale. Les résultats globaux de cohorte sont descriptifs ; le critère préalablement déclaré porte sur les médianes réunies par jeu.

La [revue Python indépendante](consolidation-review.json) passe **231/231 contrôles** : elle vérifie les quatre rapports, les comparaisons, les empreintes, les effectifs, l’ordre, les exclusions, les médianes, les p95 et les calculs conservés. Son statut arithmétique `passed` laisse son `budgetStatus` à **`budget_review_required`**, avec 14/16. Le [reviewer global](global-budget-decision.json) exige ce reçu exact, vérifie la déclaration antérieure à la fenêtre et la multiplicité des lignes du registre complet, puis recalcule les médianes globales et applique séparément le seuil strict. Les outils, le protocole et les politiques sont inchangés après le lancement.

## Décision et portée

**Le coût de native 0.44 est accepté sous la règle globale autorisée**, avec maintien des deux dépassements STCK et de toutes les observations défavorables. Le [reçu de préparation](readiness.json) conserve séparément les validations fonctionnelles et l’objectif CWSE non atteint. Cette acceptation de coût ne clôture donc pas, à elle seule, le lot 3C ni les limites fonctionnelles ou de transfert de source. Les nouvelles régressions CATR/RSWP strictes à 34/34 ne réécrivent pas non plus l’ancien résultat 0.43 à 32/34.

Ce budget mesure le moteur natif, le service et le contrôleur sur des retours publics enregistrés identiques. Il exclut moteur de jeu live, rendu navigateur et réseau de production. Il ne prouve ni latence live, ni stabilité sur plusieurs heures, ni cause des variations, ni parité complète V5/V6. Les fenêtres antérieures restent conservées avec leurs propres sources, protocoles et décisions ; elles ne sont pas mélangées à cette comparaison 0.44 contre 0.43 fraîche.
