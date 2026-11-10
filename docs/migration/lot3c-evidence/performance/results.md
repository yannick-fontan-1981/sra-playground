# Lot 3C : résultat officiel des coûts de 0.43

**Accepté selon la règle globale autorisée : 2/2 jeux.** La médiane de session complète évolue de **+0,199134 % pour STCK** et **−0,254060 % pour SMLP**, donc reste strictement sous +10 % dans chaque cas. Le résultat du comparateur historique reste **15/16, `budget_review_required`** ; la requête de continuation STCK à **+11,602583 %** est conservée et acceptée comme dépassement de phase sous le critère global.

La [décision globale](global-budget-decision.json), l'[agrégat](combined-comparison.json) et la [revue arithmétique indépendante](consolidation-review.json) sont des reçus distincts. Aucun résultat historique de phase n'est remplacé.

## Protocole et identité de la fenêtre

La [déclaration](declaration.json) et le [protocole](protocol.md) sont finalisés avant la [fenêtre](window.json), commencée à **2026-11-10T05:27:15.586432+00:00**. A est la publication70/native0.42 (`2de70025`), fraîchement remesurée ; B est le gel0.43 (`3e88aa12`). L'ordre est **A1, B1, B2, A2**. Les codes, outils, cas et politiques sont inchangés pendant la mesure.

Les **32 sessions mesurées et 400 actions** sont toutes incluses : huit sessions par jeu/version, dix actions STCK et quinze actions SMLP par session. Les seules exclusions sont les **huit chauffes préalables, 24 actions**. Les métadonnées de travail et l'environnement statique correspondent. Le [reçu de préparation](readiness.json) confirme l'arrêt du preview et la fin des tests, builds, campagnes, rejeux et diagnostics avant le départ. Seule la rédaction légère a continué.

## Critère global, par jeu

| Jeu | Sessions par version | Médiane 0.42 fraîche | Médiane 0.43 | Variation | Décision |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK | 8 | 9699,381706 ms | 9718,696494 ms | **+0,199134 %** | Accepté, strictement sous +10 % |
| SMLP | 8 | 16264,753197 ms | 16223,430970 ms | **−0,254060 %** | Accepté, strictement sous +10 % |

Ces valeurs proches de zéro ne constituent pas une preuve d'accélération causale. Elles établissent l'acceptation dans cette fenêtre et sous ce protocole. Les huit sessions par version ne suffisent pas à publier un p95 de session ; aucune somme de phases imbriquées ni moyenne des ratios de cohortes ne remplace ces médianes.

## Toutes les mesures de phase conservées

Le classement dans cette table est celui du comparateur historique à +10 %. Il est diagnostique ; la décision de clôture du coût est celle des sessions complètes ci-dessus. Les effectifs sont indiqués par version.

| Jeu | Mesure | n | Médiane A (ms) | Médiane B (ms) | Variation | Diagnostic historique |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| STCK | Session complète | 8 | 9699,381706 | 9718,696494 | +0,199134 % | Dans le seuil |
| STCK | Nouvelle décision | 48 | 323,825622 | 274,877457 | −15,115594 % | Dans le seuil |
| STCK | Service de continuation connue | 32 | 8,748336 | 9,598232 | +9,714951 % | Dans le seuil |
| STCK | Requête de continuation connue | 32 | 10,454120 | 11,667068 | +11,602583 % | **Dépassement conservé** |
| STCK | Garde de continuation connue | 32 | 0,220095 | 0,237732 | +8,013376 % | Dans le seuil |
| STCK | Acquisition avec persistance | 48 | 770,954241 | 799,837563 | +3,746438 % | Dans le seuil |
| STCK | Persistance | 104 | 154,476204 | 157,649181 | +2,054023 % | Dans le seuil |
| STCK | Restauration | 96 | 7,702702 | 7,299628 | −5,232897 % | Dans le seuil |
| SMLP | Session complète | 8 | 16264,753197 | 16223,430970 | −0,254060 % | Dans le seuil |
| SMLP | Nouvelle décision | 72 | 329,563796 | 346,314312 | +5,082632 % | Dans le seuil |
| SMLP | Service de continuation connue | 48 | 10,604834 | 10,010450 | −5,604840 % | Dans le seuil |
| SMLP | Requête de continuation connue | 48 | 13,012481 | 12,370286 | −4,935220 % | Dans le seuil |
| SMLP | Garde de continuation connue | 48 | 0,362897 | 0,357143 | −1,585438 % | Dans le seuil |
| SMLP | Acquisition avec persistance | 72 | 931,192024 | 883,052945 | −5,169619 % | Dans le seuil |
| SMLP | Persistance | 152 | 135,468418 | 135,636291 | +0,123921 % | Dans le seuil |
| SMLP | Restauration | 144 | 5,321425 | 5,251427 | −1,315390 % | Dans le seuil |

La requête STCK passe de **10,454120 à 11,667068 ms** en médiane. Le service correspondant, inclus dans cette requête, évolue de **+9,714951 %**. Ils ne sont pas additionnés. Le transport et l'ordonnancement font partie de la requête ; cette différence ne prouve pas à elle seule la cause de la hausse.

## Pointes de latence et dispersion

| Jeu | Mesure | p95 A | p95 B |
| --- | --- | ---: | ---: |
| STCK | Nouvelle décision | 453,978460 ms | 437,847327 ms |
| STCK | Service de continuation connue | 10,316962 ms | 15,095680 ms |
| STCK | Requête de continuation connue | 12,180009 ms | 17,015036 ms |
| STCK | Garde de continuation connue | 0,312131 ms | 0,395504 ms |
| STCK | Acquisition avec persistance | 3349,276013 ms | 3525,190816 ms |
| STCK | Persistance | 314,095736 ms | 335,431372 ms |
| STCK | Restauration | 52,334177 ms | 52,717689 ms |
| SMLP | Nouvelle décision | 815,772896 ms | 799,021903 ms |
| SMLP | Service de continuation connue | 22,330167 ms | 19,806920 ms |
| SMLP | Requête de continuation connue | 25,244762 ms | 22,910028 ms |
| SMLP | Garde de continuation connue | 8,240782 ms | 8,768346 ms |
| SMLP | Acquisition avec persistance | 2557,382481 ms | 2591,094441 ms |
| SMLP | Persistance | 276,173682 ms | 289,679079 ms |
| SMLP | Restauration | 29,114221 ms | 34,872477 ms |

Les pointes défavorables restent visibles, notamment la requête STCK **12,180009 → 17,015036 ms**, le service STCK **10,316962 → 15,095680 ms** et la restauration SMLP **29,114221 → 34,872477 ms**. Les distributions complètes, minima, maxima et étendues relatives des médianes par session figurent dans l'agrégat. Les échantillons d'une même session sont corrélés ; aucun intervalle de confiance ou supplément de budget pour le bruit n'est ajouté.

## Cohortes et revue indépendante

| Cohorte | Ancien classement de phases | Résultats hors seuil conservés |
| --- | --- | --- |
| 1 | 13/16, `budget_review_required` | STCK Service de continuation connue +26,922148 %; STCK Requête de continuation connue +28,297993 %; STCK Garde de continuation connue +29,302277 % |
| 2 | 16/16, `passed` | Aucun |

La première cohorte conserve **13/16**, la seconde **16/16**. L'agrégat conserve toutes leurs sessions, y compris celles de la cohorte défavorable, et donne **15/16** selon le classement historique. La [revue Python indépendante](consolidation-review.json) passe **231/231 contrôles** sur les quatre rapports bruts, les effectifs, médianes, p95, exclusions et empreintes. Le nouveau reviewer global exige ce reçu, vérifie le protocole antérieur à la fenêtre et recalcule séparément les deux médianes globales.

## Décision et limites

Le **coût de 0.43 est accepté** sous la règle préalablement autorisée. Cela ne clôture pas la limite fonctionnelle de 3C : la campagne CWSE reste à deux niveaux, avec refus au troisième, et les régressions strictes conservent 32/34 avec leur qualification séparée d'extension vide. La correction du rattachement de preuve courante reste prioritaire avant 3D.

Le budget porte sur les mêmes retours publics enregistrés, sans moteur de jeu, rendu navigateur ou réseau de production dans le chronométrage. Il ne prouve pas la latence live, la cause des variations, une stabilité sur plusieurs heures ou la parité complète V5/V6. Les gains globaux de l'ancienne fenêtre 0.42 contre 0.38 ne sont pas mélangés à cette comparaison 0.43 contre 0.42 fraîche.
