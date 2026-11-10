# Lot 3E : résultats de coût de native 0.46

**Le coût est accepté selon le critère global déclaré avant la fenêtre : STCK +4,992188 %, SMLP +0,144738 %. Les deux jeux restent strictement sous +10 %.** La [décision globale](global-budget-decision.json) conserve le diagnostic de phases **13/16**, statut `budget_review_required`, et ses trois dépassements STCK. La [revue indépendante](consolidation-review.json) passe **231/231 contrôles**.

La marge agrégée est de **5,007812 points** pour STCK et **9,855262 points** pour SMLP. La seconde cohorte STCK atteint toutefois **+9,823661 %**, soit seulement **0,176339 point** sous le seuil. Cette variation est intégralement conservée. Le critère porte sur les huit sessions réunies par jeu et version ; les deux cohortes restent détaillées ci-dessous.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 73 / native 0.45.0 ; commit `79e8fb89521b2d0fa8907e79467f24e7cf8a2b4e` | `5b5e59e14e4d417d92cacd6e79d21b6e8e833d715c8d05df2b74806bb09b40f3` |
| B : candidat gelé | Native 0.46.0 ; 260 fichiers natifs, archive de 271 fichiers | `5adf58cb9bd0802dd083812e7591c53cb786410ad23c14a29814d870ef67276c` |

Le [protocole](protocol.md), la [déclaration](declaration.json) finalisée le **10 novembre 2026 à 12:40:45 UTC**, la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) précèdent la fenêtre. Les cas, la politique de phases et les sept outils conservés restent byte-identiques à leur référence. Les temps historiques de 0.45 n’entrent pas dans les nouveaux échantillons.

Les retours publics STCK10 et SMLP15 sont identiques entre A et B. Chaque commande est recalculée avant de recevoir le retour enregistré. Le parcours STCK conservé termine deux niveaux, celui de SMLP trois. Ce sont des mesures de la boucle native commune ; la contribution propre de ReceptionService est documentée dans ses preuves distinctes. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors de cette mesure.

## Exécution et intégrité

La [fenêtre officielle](window.json) s’est déroulée le **10 novembre 2026 de 12:58:58 à 13:07:44 UTC**. Les quatre séries et l’intégrité finale ont le statut `passed`. Les reçus techniques conservent leurs horodatages UTC d’origine.

| Série | Source | Début UTC | Fin UTC | Résultat |
| --- | --- | --- | --- | --- |
| A1 | 0.45.0 | 12:58:58 | 13:01:05 | passed |
| B1 | 0.46.0 | 13:01:05 | 13:03:18 | passed |
| B2 | 0.46.0 | 13:03:18 | 13:05:32 | passed |
| A2 | 0.45.0 | 13:05:32 | 13:07:44 | passed |

| Élément | Résultat conservé |
| --- | --- |
| Ordre | A1, B1, B2, A2 |
| Cohortes | 2 |
| Sessions mesurées | 32 ; huit par jeu et version |
| Actions mesurées | 400 ; 200 pour A et 200 pour B |
| Chauffes exclues | 8 sessions, 24 actions |
| Sessions mesurées ou valeurs extrêmes exclues | 0 |
| Revue arithmétique | 231/231, passée |
| Intégrité finale | Inventaires, traces, cas, protocole et outils surveillés inchangés |

Chaque série mesure STCK puis SMLP. Chaque cas/série utilise un worker distinct, une chauffe de trois actions puis quatre sessions à mémoire froide ; le processus et son JIT restent présents pendant ce cas/série. La fenêtre ne contient aucun incident de mesure ni série incomplète. Le [reçu de readiness](readiness.json) lie les preuves achevées et l’isolation déclarée, dont l’arrêt de la prévisualisation. Le [préflight statique](static-preflight.json) a vérifié 48/48 contrats de fichiers, archive, protocole et dépendances ; il laisse explicitement l’isolation finale au reçu de readiness.

Le premier [contrôle statique](static-preflight-initial-link-assumption.json) exigeait un lien symbolique pour Pyodide. La reprise vérifie les copies de douze fichiers et 18 339 702 octets par leurs empreintes individuelles, sans changer les dépendances ni les entrées mesurées. Le premier reçu et son générateur restent conservés.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. Ces métadonnées et l’ordre ABBA décrivent la fenêtre ; les états GC, JIT et d’ordonnancement peuvent varier entre sessions.

## Critère global par jeu

La [décision globale](global-budget-decision.json) relit toutes les durées conservées après vérification de la revue de consolidation. La formule est `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une valeur exactement égale à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné, et les phases imbriquées ne sont pas additionnées.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Critère strict < +10 % |
| --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 9759,223 | 10246,422 | +4,992188 % | Accepté |
| SMLP | 8 / 8 | 17294,480 | 17319,512 | +0,144738 % | Accepté |

Le statut est **`accepted_under_user_global_rule`**, accepté **2/2**. Les durées affichées sont arrondies à trois décimales en millisecondes, six pour les valeurs inférieures à 1 ms ; les variations sont affichées à six décimales. L’acceptation utilise les valeurs intégrales des reçus.

## Les seize diagnostics agrégés

Sources : [agrégat](combined-comparison.json) et [revue indépendante](consolidation-review.json). « Dans le seuil » reproduit `within_observed_budget`. Tous les dépassements de cette fenêtre portent la classification historique `over_budget_with_noise_unresolved` ; cette qualification ne relève pas le seuil. Le coût est accepté par le critère global distinct.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 9759,223 | 10246,422 | +4,992188 % | Dans le seuil |
| STCK | `new_decision` | 48 / 48 | 315,444 | 326,189 | +3,406284 % | Dans le seuil |
| STCK | `known_prefix_service` | 32 / 32 | 8,496 | 9,777 | +15,072714 % | **Dépassement conservé** |
| STCK | `known_prefix_request` | 32 / 32 | 10,343 | 11,677 | +12,903517 % | **Dépassement conservé** |
| STCK | `known_prefix_guard` | 32 / 32 | 0,221603 | 0,250606 | +13,088074 % | **Dépassement conservé** |
| STCK | `acquisition_and_persistence` | 48 / 48 | 818,382 | 900,049 | +9,979165 % | Dans le seuil |
| STCK | `persistence` | 104 / 104 | 161,332 | 171,649 | +6,395213 % | Dans le seuil |
| STCK | `restoration` | 96 / 96 | 7,498 | 7,903 | +5,397276 % | Dans le seuil |
| SMLP | `session_elapsed` | 8 / 8 | 17294,480 | 17319,512 | +0,144738 % | Dans le seuil |
| SMLP | `new_decision` | 72 / 72 | 379,531 | 371,676 | −2,069819 % | Dans le seuil |
| SMLP | `known_prefix_service` | 48 / 48 | 10,641 | 10,956 | +2,968254 % | Dans le seuil |
| SMLP | `known_prefix_request` | 48 / 48 | 13,438 | 13,693 | +1,903550 % | Dans le seuil |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,408674 | 0,407121 | −0,379888 % | Dans le seuil |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 939,587 | 865,659 | −7,868148 % | Dans le seuil |
| SMLP | `persistence` | 152 / 152 | 141,798 | 144,353 | +1,802307 % | Dans le seuil |
| SMLP | `restoration` | 144 / 144 | 5,884 | 5,931 | +0,804080 % | Dans le seuil |

Les trois dépassements agrégés portent sur STCK : **service de préfixe +15,072714 %**, **requête de préfixe +12,903517 %**, **garde +13,088074 %**. STCK conserve cinq diagnostics dans le seuil sur huit et SMLP huit sur huit, soit **13/16**. Le seuil de phases historique n’est pas réécrit.

### Dispersion et p95 agrégés

Les intervalles montrent toutes les observations retenues, du minimum au maximum. L’étendue relative des médianes de session est `(maximum − minimum) / médiane` des médianes par session. Les observations au sein d’une session sont corrélées ; ces étendues décrivent la dispersion sans constituer un intervalle de confiance. Le p95 emploie le rang empirique `ceil(0,95 × n)` et reste indisponible sous vingt observations, notamment pour les durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9577,932 à 10780,432 | 9642,466 à 12577,288 | indisponible / indisponible | indisponible | 12,321676 % / 28,642402 % |
| STCK | `new_decision` | 183,162 à 521,216 | 166,163 à 592,566 | 496,522 / 501,417 | +0,985967 % | 37,326046 % / 27,520746 % |
| STCK | `known_prefix_service` | 7,369 à 13,000 | 7,485 à 15,512 | 11,061 / 14,440 | +30,544209 % | 40,387472 % / 34,462517 % |
| STCK | `known_prefix_request` | 8,878 à 14,932 | 9,065 à 21,451 | 13,272 / 17,469 | +31,623978 % | 39,306885 % / 37,746539 % |
| STCK | `known_prefix_guard` | 0,084384 à 0,505587 | 0,082432 à 0,757949 | 0,281756 / 0,431597 | +53,181121 % | 39,899027 % / 56,807298 % |
| STCK | `acquisition_and_persistence` | 357,099 à 3750,501 | 376,723 à 4308,470 | 3441,339 / 3539,687 | +2,857817 % | 22,577987 % / 36,087098 % |
| STCK | `persistence` | 16,074 à 457,430 | 14,739 à 423,128 | 314,080 / 337,941 | +7,596874 % | 28,791332 % / 38,616833 % |
| STCK | `restoration` | 1,698 à 87,796 | 1,992 à 86,644 | 47,469 / 49,561 | +4,408132 % | 35,192286 % / 50,215138 % |
| SMLP | `session_elapsed` | 16638,806 à 18643,544 | 16750,040 à 18651,613 | indisponible / indisponible | indisponible | 11,591775 % / 10,979369 % |
| SMLP | `new_decision` | 189,278 à 1193,373 | 197,235 à 922,411 | 891,905 / 839,827 | −5,838953 % | 25,293185 % / 21,828827 % |
| SMLP | `known_prefix_service` | 8,455 à 31,459 | 8,614 à 28,087 | 19,247 / 24,353 | +26,526906 % | 21,278865 % / 35,713171 % |
| SMLP | `known_prefix_request` | 10,668 à 34,516 | 10,635 à 30,471 | 22,128 / 27,289 | +23,327151 % | 21,901879 % / 43,681501 % |
| SMLP | `known_prefix_guard` | 0,192404 à 11,339 | 0,194588 à 11,318 | 9,344 / 10,460 | +11,939789 % | 39,573365 % / 45,211834 % |
| SMLP | `acquisition_and_persistence` | 335,099 à 3011,657 | 304,762 à 3051,085 | 2712,411 / 2773,994 | +2,270404 % | 36,243576 % / 24,755260 % |
| SMLP | `persistence` | 20,638 à 329,299 | 19,267 à 418,200 | 281,506 / 289,927 | +2,991350 % | 35,791088 % / 26,286090 % |
| SMLP | `restoration` | 1,924 à 50,761 | 1,749 à 46,839 | 24,686 / 32,606 | +32,080376 % | 31,404104 % / 35,930036 % |

Les hausses de p95 supérieures à +10 % restent visibles : **STCK `known_prefix_service` +30,544209 %**; **STCK `known_prefix_request` +31,623978 %**; **STCK `known_prefix_guard` +53,181121 %**; **SMLP `known_prefix_service` +26,526906 %**; **SMLP `known_prefix_request` +23,327151 %**; **SMLP `known_prefix_guard` +11,939789 %**; **SMLP `restoration` +32,080376 %**. Leur cause ne peut pas être attribuée à partir de ces seules mesures.

## Deux cohortes conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et de [cohorte 2](cohort2/comparison.json) restent toutes deux au statut `budget_review_required`. La première conserve **7/16** diagnostics dans le seuil, la seconde **14/16**. Leurs quatre variations globales restent sous +10 %, avec des variations distinctes que l’agrégation ne masque pas.

| Cohorte | Ordre | Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Diagnostics dans le seuil |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 4 / 4 | 9589,387 | 10110,845 | +5,437867 % | 2/8 |
| 1 | A1 puis B1 | SMLP | 4 / 4 | 17142,618 | 18607,361 | +8,544449 % | 5/8 |
| 2 | B2 puis A2 | STCK | 4 / 4 | 10564,821 | 11602,674 | +9,823661 % | 6/8 |
| 2 | B2 puis A2 | SMLP | 4 / 4 | 17691,889 | 16993,863 | −3,945461 % | 8/8 |

Les trente-deux diagnostics de cohorte et leurs distributions figurent intégralement dans les deux sections suivantes. Le classement de chaque ligne reste celui de son comparateur d’origine.

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 9589,387 | 10110,845 | +5,437867 % | Dans le seuil |
| STCK | `new_decision` | 24 / 24 | 266,877 | 341,745 | +28,053376 % | **Dépassement conservé** |
| STCK | `known_prefix_service` | 16 / 16 | 8,402 | 9,815 | +16,820700 % | **Dépassement conservé** |
| STCK | `known_prefix_request` | 16 / 16 | 10,313 | 11,656 | +13,023402 % | **Dépassement conservé** |
| STCK | `known_prefix_guard` | 16 / 16 | 0,220020 | 0,250606 | +13,901464 % | **Dépassement conservé** |
| STCK | `acquisition_and_persistence` | 24 / 24 | 742,048 | 835,004 | +12,526960 % | **Dépassement conservé** |
| STCK | `persistence` | 52 / 52 | 150,494 | 169,413 | +12,571235 % | **Dépassement conservé** |
| STCK | `restoration` | 48 / 48 | 7,546 | 7,559 | +0,179397 % | Dans le seuil |
| SMLP | `session_elapsed` | 4 / 4 | 17142,618 | 18607,361 | +8,544449 % | Dans le seuil |
| SMLP | `new_decision` | 36 / 36 | 367,183 | 400,152 | +8,979081 % | Dans le seuil |
| SMLP | `known_prefix_service` | 24 / 24 | 10,602 | 11,771 | +11,026124 % | **Dépassement conservé** |
| SMLP | `known_prefix_request` | 24 / 24 | 13,087 | 14,501 | +10,803194 % | **Dépassement conservé** |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,409555 | 0,407121 | −0,594304 % | Dans le seuil |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 904,269 | 903,846 | −0,046799 % | Dans le seuil |
| SMLP | `persistence` | 76 / 76 | 141,186 | 151,638 | +7,402958 % | Dans le seuil |
| SMLP | `restoration` | 72 / 72 | 5,404 | 6,917 | +28,002982 % | **Dépassement conservé** |

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9577,932 à 9916,459 | 9817,269 à 10362,291 | indisponible / indisponible | indisponible | 3,530223 % / 5,390467 % |
| STCK | `new_decision` | 183,162 à 499,476 | 166,163 à 501,417 | 433,062 / 483,821 | +11,721011 % | 12,686130 % / 24,482192 % |
| STCK | `known_prefix_service` | 7,666 à 9,721 | 8,156 à 15,512 | indisponible / indisponible | indisponible | 12,657349 % / 31,608352 % |
| STCK | `known_prefix_request` | 9,555 à 11,342 | 9,759 à 21,451 | indisponible / indisponible | indisponible | 9,697794 % / 34,418261 % |
| STCK | `known_prefix_guard` | 0,085196 à 0,281756 | 0,082432 à 0,323468 | indisponible / indisponible | indisponible | 14,445948 % / 32,907012 % |
| STCK | `acquisition_and_persistence` | 420,043 à 3660,419 | 376,723 à 3536,667 | 3441,339 / 3500,985 | +1,733209 % | 5,525676 % / 18,966024 % |
| STCK | `persistence` | 16,074 à 339,734 | 15,132 à 337,941 | 310,680 / 310,224 | −0,146832 % | 13,874508 % / 26,649791 % |
| STCK | `restoration` | 1,698 à 63,024 | 1,992 à 66,644 | 46,980 / 48,702 | +3,665172 % | 37,443216 % / 22,894125 % |
| SMLP | `session_elapsed` | 16756,101 à 18362,100 | 16773,710 à 18651,613 | indisponible / indisponible | indisponible | 9,368454 % / 10,092259 % |
| SMLP | `new_decision` | 189,278 à 929,597 | 201,214 à 912,335 | 917,340 / 829,175 | −9,610906 % | 26,858802 % / 16,582683 % |
| SMLP | `known_prefix_service` | 8,455 à 31,459 | 8,821 à 28,087 | 24,113 / 24,353 | +0,993330 % | 21,572782 % / 34,193465 % |
| SMLP | `known_prefix_request` | 10,668 à 34,516 | 10,962 à 30,471 | 27,038 / 27,289 | +0,930897 % | 22,065264 % / 30,756454 % |
| SMLP | `known_prefix_guard` | 0,192404 à 11,339 | 0,223871 à 8,485 | 11,065 / 0,608479 | −94,500645 % | 40,107520 % / 24,768647 % |
| SMLP | `acquisition_and_persistence` | 370,596 à 2924,748 | 414,895 à 3051,085 | 2712,411 / 2708,084 | −0,159537 % | 18,536622 % / 23,686628 % |
| SMLP | `persistence` | 20,638 à 329,299 | 19,448 à 418,200 | 286,355 / 309,697 | +8,151088 % | 30,864989 % / 22,748012 % |
| SMLP | `restoration` | 2,424 à 50,761 | 1,902 à 46,839 | 24,686 / 35,468 | +43,676263 % | 31,772471 % / 23,702925 % |

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10564,821 | 11602,674 | +9,823661 % | Dans le seuil |
| STCK | `new_decision` | 24 / 24 | 337,241 | 295,286 | −12,440604 % | Dans le seuil |
| STCK | `known_prefix_service` | 16 / 16 | 8,848 | 9,690 | +9,516433 % | Dans le seuil |
| STCK | `known_prefix_request` | 16 / 16 | 10,919 | 12,090 | +10,723804 % | **Dépassement conservé** |
| STCK | `known_prefix_guard` | 16 / 16 | 0,236294 | 0,236554 | +0,110032 % | Dans le seuil |
| STCK | `acquisition_and_persistence` | 24 / 24 | 844,814 | 1012,563 | +19,856430 % | **Dépassement conservé** |
| STCK | `persistence` | 52 / 52 | 165,856 | 180,985 | +9,121743 % | Dans le seuil |
| STCK | `restoration` | 48 / 48 | 7,480 | 7,903 | +5,647875 % | Dans le seuil |
| SMLP | `session_elapsed` | 4 / 4 | 17691,889 | 16993,863 | −3,945461 % | Dans le seuil |
| SMLP | `new_decision` | 36 / 36 | 379,758 | 349,902 | −7,861828 % | Dans le seuil |
| SMLP | `known_prefix_service` | 24 / 24 | 11,021 | 10,749 | −2,460820 % | Dans le seuil |
| SMLP | `known_prefix_request` | 24 / 24 | 13,724 | 13,220 | −3,672783 % | Dans le seuil |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,403006 | 0,414522 | +2,857653 % | Dans le seuil |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 1034,446 | 851,335 | −17,701337 % | Dans le seuil |
| SMLP | `persistence` | 76 / 76 | 141,798 | 137,113 | −3,304032 % | Dans le seuil |
| SMLP | `restoration` | 72 / 72 | 5,931 | 5,665 | −4,491373 % | Dans le seuil |

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9601,988 à 10780,432 | 9642,466 à 12577,288 | indisponible / indisponible | indisponible | 11,154414 % / 25,294355 % |
| STCK | `new_decision` | 187,511 à 521,216 | 168,286 à 592,566 | 496,522 / 519,124 | +4,552151 % | 19,624032 % / 27,088848 % |
| STCK | `known_prefix_service` | 7,369 à 13,000 | 7,485 à 14,440 | indisponible / indisponible | indisponible | 38,011212 % / 33,759206 % |
| STCK | `known_prefix_request` | 8,878 à 14,932 | 9,065 à 17,271 | indisponible / indisponible | indisponible | 36,944807 % / 33,433029 % |
| STCK | `known_prefix_guard` | 0,084384 à 0,505587 | 0,091605 à 0,757949 | indisponible / indisponible | indisponible | 37,713170 % / 53,622399 % |
| STCK | `acquisition_and_persistence` | 357,099 à 3750,501 | 377,452 à 4308,470 | 3381,289 / 3894,402 | +15,175073 % | 15,727949 % / 29,898572 % |
| STCK | `persistence` | 16,158 à 457,430 | 14,739 à 423,128 | 341,337 / 383,801 | +12,440404 % | 18,584229 % / 37,629189 % |
| STCK | `restoration` | 1,919 à 87,796 | 2,241 à 86,644 | 51,919 / 51,215 | −1,356571 % | 29,514493 % / 44,288219 % |
| SMLP | `session_elapsed` | 16638,806 à 18643,544 | 16750,040 à 17611,298 | indisponible / indisponible | indisponible | 11,331392 % / 5,068055 % |
| SMLP | `new_decision` | 194,192 à 1193,373 | 197,235 à 922,411 | 891,905 / 908,642 | +1,876524 % | 7,689371 % / 5,028104 % |
| SMLP | `known_prefix_service` | 8,953 à 17,809 | 8,614 à 26,130 | 17,674 / 24,018 | +35,891321 % | 18,218757 % / 20,736468 % |
| SMLP | `known_prefix_request` | 10,935 à 20,551 | 10,635 à 29,350 | 19,714 / 26,920 | +36,551287 % | 15,124544 % / 44,129034 % |
| SMLP | `known_prefix_guard` | 0,220246 à 9,344 | 0,194588 à 11,318 | 0,769867 / 10,907 | +1316,707561 % | 28,036808 % / 42,785263 % |
| SMLP | `acquisition_and_persistence` | 335,099 à 3011,657 | 304,762 à 2916,819 | 2722,678 / 2778,724 | +2,058504 % | 32,503698 % / 5,187016 % |
| SMLP | `persistence` | 20,818 à 321,254 | 19,267 à 280,558 | 274,503 / 270,103 | −1,603074 % | 24,860947 % / 15,067543 % |
| SMLP | `restoration` | 1,924 à 38,381 | 1,749 à 41,947 | 26,344 / 29,361 | +11,450569 % | 19,815287 % / 9,707822 % |

La première cohorte conserve notamment STCK `new_decision` **+28,053376 %**, `acquisition_and_persistence` **+12,526960 %**, `persistence` **+12,571235 %** et SMLP `restoration` **+28,002982 %**. La seconde conserve STCK `acquisition_and_persistence` **+19,856430 %**. Ces résultats défavorables font partie de l’agrégat ; aucune session n’a été retirée et aucun suivi favorable n’a été sélectionné.

## Inspection et Pause conservées

Les comparaisons de cohorte conservent aussi l’inspection et la Pause. Ces observations sont hors des seize diagnostics de coût. L’inspection inclut le service et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Chaque cohorte comporte douze observations par jeu/version, donc aucun p95 à cette échelle.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 182,073 / 192,506 | +5,730274 % | 165,789 à 251,573 / 166,859 à 214,927 |
| 1 | STCK | `endToEnd` | 12 / 12 | 326,006 / 339,623 | +4,176957 % | 291,724 à 406,542 / 300,397 à 393,600 |
| 1 | SMLP | `nativeService` | 12 / 12 | 209,399 / 252,159 | +20,419991 % | 197,026 à 291,477 / 213,657 à 347,076 |
| 1 | SMLP | `endToEnd` | 12 / 12 | 392,581 / 437,646 | +11,479205 % | 329,996 à 506,042 / 369,704 à 565,474 |
| 2 | STCK | `nativeService` | 12 / 12 | 196,795 / 206,339 | +4,849528 % | 168,914 à 265,728 / 165,894 à 263,449 |
| 2 | STCK | `endToEnd` | 12 / 12 | 358,219 / 371,645 | +3,747871 % | 305,876 à 443,080 / 293,690 à 452,396 |
| 2 | SMLP | `nativeService` | 12 / 12 | 216,568 / 244,805 | +13,038513 % | 183,477 à 298,030 / 196,564 à 295,029 |
| 2 | SMLP | `endToEnd` | 12 / 12 | 376,430 / 418,905 | +11,283434 % | 342,656 à 474,368 / 340,883 à 502,463 |

La Pause est observée pendant la planification initiale et à la première action engagée, avec quatre observations par contexte/jeu/version/cohorte. Toutes sont acquittées et atteignent la frontière sûre attendue : zéro action pour la première, une action pour la seconde. La latence jusqu’à cette frontière inclut le travail en cours ; elle ne démontre pas l’interruption de toute recherche arbitrairement longue. Aucun p95 n’est défini pour quatre observations.

| Cohorte | Jeu | Contexte | Acquittement médian A / B, ms | Acquittement max A / B, ms | Frontière sûre médiane A / B, ms | Variation frontière | Frontière sûre min à max A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | 0,013199 / 0,009630 | 0,038216 / 0,039038 | 1037,158 / 985,137 | −5,015728 % | 880,833 à 1199,314 / 961,128 à 1053,818 |
| 1 | STCK | `engaged_action` | 0,015328 / 0,013926 | 0,019799 / 0,015603 | 735,623 / 790,089 | +7,404021 % | 662,020 à 749,543 / 762,078 à 985,157 |
| 1 | SMLP | `initial_planning` | 0,009244 / 0,007702 | 0,044476 / 0,016204 | 1658,891 / 1555,533 | −6,230532 % | 1490,607 à 1765,804 / 1506,780 à 1767,752 |
| 1 | SMLP | `engaged_action` | 0,013380 / 0,006404 | 0,020891 / 0,021892 | 752,644 / 809,313 | +7,529307 % | 611,436 à 801,320 / 691,473 à 962,327 |
| 2 | STCK | `initial_planning` | 0,010070 / 0,013860 | 0,046989 / 0,047640 | 1037,608 / 1235,420 | +19,064148 % | 1001,193 à 1216,732 / 978,082 à 1391,492 |
| 2 | STCK | `engaged_action` | 0,013710 / 0,013705 | 0,017576 / 0,015744 | 835,938 / 1017,080 | +21,669363 % | 771,513 à 863,417 / 787,609 à 1122,775 |
| 2 | SMLP | `initial_planning` | 0,008692 / 0,010125 | 0,014972 / 0,034461 | 1616,239 / 1494,976 | −7,502805 % | 1424,123 à 1966,797 / 1446,363 à 1585,435 |
| 2 | SMLP | `engaged_action` | 0,008673 / 0,004827 | 0,021322 / 0,022974 | 735,320 / 695,500 | −5,415296 % | 660,505 à 923,592 / 672,395 à 764,952 |

Les hausses d’inspection et les délais de Pause défavorables restent conservés au même titre que les phases. Les rapports bruts de sessions gardent également les échantillons mémoire et les valeurs de chaque session ; cette fenêtre finie ne certifie pas la stabilité sur plusieurs heures.

## Reproductibilité et transport des journaux

La revue [consolidation-review.json](consolidation-review.json) recalcule indépendamment les distributions, ratios et classements de cohorte et agrégés depuis les quatre rapports. Ses **231 contrôles** lient aussi les empreintes et les effectifs. Le [reçu global](global-budget-decision.json) vérifie ensuite la déclaration antérieure, la revue passée et chaque durée de session.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `119dee907a5e0c386258e16addb48e9f23927b1356aade6ce2ed01e041033366` |
| global-budget-policy.json | `2b29897c49907e30ff57fd359f1c4600180cf23c68177d873b73eaf701de7550` |
| combined-comparison.json | `72d25a8c4c3a56987a67bdd41ca78a5028bacfb67321a8409878ac62914868c7` |
| consolidation-review.json | `008e371642dc0120c825db7fa2bd394e2b8fbeba8aa095a5dbe94e0ce6af6e8a` |
| global-budget-decision.json | `ff55f921d98d75c9256ac4af71a8eff3119eb8ac943016139afb1f353d3d31b8` |

Les quatre journaux originaux sont conservés et compressés sans perte avec `mtime=0`. Le [reçu de transport](log-transport.json) vérifie les empreintes des originaux contre la fenêtre, l’égalité exacte après décompression et l’absence de modification des originaux.

| Série | Rapport de sessions | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1567 | 436 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1567 | 435 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1553 | 430 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1563 | 438 |

Transport : **6250 octets originaux**, **1739 octets gzip**. Aucun contenu n’est filtré ou réécrit.

## Décision de coût et portée fonctionnelle

**Le coût de native 0.46 est accepté sur STCK et SMLP selon la règle globale autorisée.** Les trois dépassements de phase agrégés, les onze dépassements cumulés des diagnostics de cohorte, toutes les dispersions et les hausses de p95 restent publiés. Aucun seuil n’a été relevé et aucune observation mesurée n’a été exclue.

Cette acceptation s’ajoute aux preuves fonctionnelles liées par la [readiness](readiness.json). Les résultats de la [campagne FOGW](../final/fogw-resolution.json), les [contrats source et adaptations](../diagnostic/fogw-public-parity.json), la [contribution](../final/fogw-reception-session/reception-service-contribution.json.gz), les [régressions CATR/RSWP](../final/regressions/regression-summary.json) et le [navigateur](../final/browser/browser-qa.json) gardent leurs propres périmètres. La parité complète de l’appelant original et la revalidation spécifique du changement de requête restent qualifiées séparément ; le critère de coût ne tranche pas ces questions.
