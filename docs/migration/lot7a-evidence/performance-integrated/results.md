# Lot 7A : résultats de coût de native 0.52.0

**Le coût est accepté selon le critère global déclaré : STCK +0,453255 %; SMLP −1,418017 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **16/16**, statut `passed`, avec **0 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 3866/3866 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds Workshop ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

### Correction de lecture après mesure

Le consolidateur gelé avant la fenêtre a ensuite échoué en lisant cinq empreintes de fichiers situés dans le checkout de référence. Cet [échec initial](diagnostic/consolidator-initial-path-failure.json) est conservé. La [correction E/S distincte](diagnostic/owner-cost-io-correction-v1.json) est explicitement **postérieure à la mesure** : elle accepte uniquement ces cinq chemins déjà inscrits dans l’attribution fonctionnelle, vérifie leur emplacement dans la référence gelée, leur taille et leur SHA-256, puis les revérifie en fin de calcul. Les deux sorties nomment séparément les outils exécutés et ceux déclarés avant la fenêtre. Les outils d’origine, le contrat, les formes attendues, les populations, les données brutes, les calculs et le seuil restent inchangés. Cette réparation ne transforme aucun refus historique en réussite.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 81 / native 0.51.0 ; commit `4dafc40c53ed4406ee7cd148e3e6995a2eb4185e` ; 273 fichiers natifs | `c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7` |
| B : candidat gelé | Native 0.52.0 ; 279 fichiers natifs ; archive de 290 fichiers | `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb` |

La [déclaration](declaration.json) finalisée le **2026-11-10 17:21:02 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de l’atelier à profils ordonnés. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 17:23:33 UTC−03** au **2026-11-10 17:31:52 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.51.0 | 2026-11-10 17:23:33 UTC−03 | 2026-11-10 17:25:39 UTC−03 | passed |
| B1 | 0.52.0 | 2026-11-10 17:25:39 UTC−03 | 2026-11-10 17:27:41 UTC−03 | passed |
| B2 | 0.52.0 | 2026-11-10 17:27:41 UTC−03 | 2026-11-10 17:29:47 UTC−03 | passed |
| A2 | 0.51.0 | 2026-11-10 17:29:47 UTC−03 | 2026-11-10 17:31:52 UTC−03 | passed |

| Engagement | Valeur conservée |
| --- | --- |
| Ordre | A1, B1, B2, A2 |
| Cohortes | 2 |
| Sessions mesurées | 32 |
| Actions mesurées | 400 |
| Chauffes exclues | 8 sessions / 24 actions |
| Sessions mesurées ou valeurs extrêmes exclues | 0 |
| Choix d’une cohorte favorable | Aucun |
| Tolérance de bruit ajoutée | Aucune |
| Revue statique | 65/65 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 9821,366 | 9865,881 | +0,453255 % | 9,546745 | Accepté |
| SMLP | 8 / 8 | 16545,186 | 16310,572 | −1,418017 % | 11,418017 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 9821,366 | 9865,881 | +0,453255 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 292,366 | 289,848 | −0,861369 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,994 | 9,130 | +1,513394 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 11,094 | 11,214 | +1,082113 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,242127 | 0,240536 | −0,657505 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 842,887 | 808,863 | −4,036559 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 166,359 | 162,145 | −2,533103 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 8,155 | 7,083 | −13,146043 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16545,186 | 16310,572 | −1,418017 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 385,708 | 367,755 | −4,654689 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,985 | 9,905 | −0,800514 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 12,547 | 12,392 | −1,233542 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,384032 | 0,372150 | −3,094269 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 887,558 | 913,965 | +2,975258 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 137,314 | 132,530 | −3,483608 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 5,705 | 5,421 | −4,981414 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9526,065 à 10738,423 | 9384,170 à 10293,910 | indisponible / indisponible | indisponible | 12,344088 % / 9,221069 % |
| STCK | `new_decision` | 172,720 à 458,386 | 175,680 à 589,487 | 447,191 / 494,302 | +10,534805 % | 29,790993 % / 16,133950 % |
| STCK | `known_prefix_service` | 7,224 à 26,205 | 7,253 à 32,290 | 19,806 / 19,834 | +0,144261 % | 43,947349 % / 41,632540 % |
| STCK | `known_prefix_request` | 9,037 à 28,451 | 8,980 à 34,529 | 21,825 / 21,817 | −0,036000 % | 43,633812 % / 39,100028 % |
| STCK | `known_prefix_guard` | 0,087680 à 1,110 | 0,084584 à 0,491796 | 0,599225 / 0,383987 | −35,919396 % | 34,814812 % / 39,084860 % |
| STCK | `acquisition_and_persistence` | 368,414 à 3763,885 | 369,504 à 3537,485 | 3608,518 / 3445,462 | −4,518625 % | 19,456869 % / 8,552198 % |
| STCK | `persistence` | 14,030 à 381,848 | 13,513 à 489,495 | 330,084 / 348,350 | +5,533726 % | 32,420091 % / 20,350012 % |
| STCK | `restoration` | 1,823 à 87,534 | 1,897 à 68,135 | 61,115 / 48,611 | −20,458755 % | 40,533084 % / 16,213264 % |
| SMLP | `session_elapsed` | 16238,480 à 17387,387 | 15564,654 à 17173,244 | indisponible / indisponible | indisponible | 6,944057 % / 9,862258 % |
| SMLP | `new_decision` | 206,330 à 928,160 | 196,416 à 1067,732 | 846,095 / 812,951 | −3,917340 % | 30,554492 % / 15,768347 % |
| SMLP | `known_prefix_service` | 8,076 à 22,592 | 7,192 à 19,766 | 21,550 / 17,322 | −19,621779 % | 18,713562 % / 47,623451 % |
| SMLP | `known_prefix_request` | 10,507 à 48,541 | 9,228 à 22,582 | 24,727 / 19,445 | −21,361074 % | 25,118339 % / 42,889486 % |
| SMLP | `known_prefix_guard` | 0,196380 à 9,803 | 0,189409 à 2,269 | 1,677 / 0,597423 | −64,384560 % | 34,476505 % / 48,902968 % |
| SMLP | `acquisition_and_persistence` | 311,571 à 2868,677 | 319,569 à 2829,678 | 2563,797 / 2573,125 | +0,363863 % | 33,015598 % / 29,849708 % |
| SMLP | `persistence` | 16,528 à 288,707 | 14,312 à 441,075 | 262,772 / 266,847 | +1,550592 % | 28,873855 % / 24,420740 % |
| SMLP | `restoration` | 1,922 à 34,549 | 1,886 à 89,349 | 21,773 / 32,730 | +50,326822 % | 55,196657 % / 32,708157 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +10,534805 %**; **SMLP `restoration` +50,326822 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10402,766 / 9874,881 | −5,074467 % | 8/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 16545,186 / 16310,572 | −1,418017 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 9653,437 / 9843,267 | +1,966449 % | 8/8 | passed |
| 2 | B2 puis A2 | SMLP | 16520,452 / 16559,837 | +0,238399 % | 8/8 | passed |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 9526,064703 | 2026-11-10 17:23:38 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 10183,526976 | 2026-11-10 17:23:48 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 10622,005084 | 2026-11-10 17:23:59 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 10738,422742 | 2026-11-10 17:24:11 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 17075,123067 | 2026-11-10 17:24:28 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 16604,385233 | 2026-11-10 17:24:46 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 16253,888480 | 2026-11-10 17:25:04 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 16485,985962 | 2026-11-10 17:25:21 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 9889,324889 | 2026-11-10 17:25:44 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 10293,909961 | 2026-11-10 17:25:55 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 9384,170192 | 2026-11-10 17:26:06 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 9860,437215 | 2026-11-10 17:26:16 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 15564,653759 | 2026-11-10 17:26:32 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 16546,945412 | 2026-11-10 17:26:49 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 16286,265515 | 2026-11-10 17:27:06 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 16334,878617 | 2026-11-10 17:27:24 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 9871,325602 | 2026-11-10 17:27:46 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 10127,234377 | 2026-11-10 17:27:57 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 9815,207469 | 2026-11-10 17:28:08 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 9752,009702 | 2026-11-10 17:28:19 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 17173,244482 | 2026-11-10 17:28:35 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16285,230148 | 2026-11-10 17:28:54 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 16834,443069 | 2026-11-10 17:29:11 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 16184,699974 | 2026-11-10 17:29:29 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 9981,524869 | 2026-11-10 17:29:53 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 9637,082113 | 2026-11-10 17:30:04 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 9661,206378 | 2026-11-10 17:30:14 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 9645,666927 | 2026-11-10 17:30:25 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 16313,478487 | 2026-11-10 17:30:40 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 16238,479780 | 2026-11-10 17:30:58 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 16727,425684 | 2026-11-10 17:31:15 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 17387,386901 | 2026-11-10 17:31:33 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10402,766 | 9874,881 | −5,074467 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 294,388 | 289,848 | −1,542250 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,181 | 8,904 | −3,016654 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,967 | 10,798 | −1,543890 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,254776 | 0,229188 | −10,043312 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 869,870 | 805,952 | −7,347967 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 174,536 | 154,781 | −11,318701 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 8,155 | 7,083 | −13,146043 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16545,186 | 16310,572 | −1,418017 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 376,373 | 369,826 | −1,739708 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,931 | 9,692 | −2,408267 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,282 | 11,905 | −3,070413 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,381724 | 0,369576 | −3,182408 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 859,073 | 865,792 | +0,782095 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 134,755 | 132,169 | −1,918935 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 4,909 | 5,504 | +12,133996 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +12,133996 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9526,065 à 10738,423 | 9384,170 à 10293,910 | indisponible / indisponible | indisponible | 11,654189 % / 9,212666 % |
| STCK | `new_decision` | 185,554 à 447,191 | 175,680 à 589,487 | 438,369 / 496,088 | +13,166697 % | 28,058464 % / 15,379163 % |
| STCK | `known_prefix_service` | 7,562 à 26,205 | 7,253 à 19,834 | indisponible / indisponible | indisponible | 44,962234 % / 24,992419 % |
| STCK | `known_prefix_request` | 9,290 à 28,451 | 8,980 à 21,817 | indisponible / indisponible | indisponible | 44,961001 % / 24,022661 % |
| STCK | `known_prefix_guard` | 0,093418 à 1,110 | 0,084584 à 0,383987 | indisponible / indisponible | indisponible | 22,371405 % / 29,101304 % |
| STCK | `acquisition_and_persistence` | 368,414 à 3763,885 | 369,504 à 3513,514 | 3655,823 / 3445,462 | −5,754132 % | 10,155822 % / 7,965523 % |
| STCK | `persistence` | 14,030 à 373,523 | 13,707 à 363,374 | 333,010 / 345,193 | +3,658465 % | 22,797818 % / 15,378417 % |
| STCK | `restoration` | 1,962 à 65,953 | 1,925 à 50,557 | 61,115 / 46,862 | −23,321821 % | 33,434834 % / 13,511163 % |
| SMLP | `session_elapsed` | 16253,888 à 17075,123 | 15564,654 à 16546,945 | indisponible / indisponible | indisponible | 4,963586 % / 6,022423 % |
| SMLP | `new_decision` | 206,330 à 917,180 | 196,416 à 909,058 | 846,095 / 851,473 | +0,635670 % | 29,917576 % / 9,770981 % |
| SMLP | `known_prefix_service` | 8,076 à 22,592 | 7,192 à 19,766 | 21,735 / 16,374 | −24,664703 % | 14,108401 % / 26,243202 % |
| SMLP | `known_prefix_request` | 10,721 à 48,541 | 9,228 à 22,582 | 25,142 / 18,731 | −25,497543 % | 25,390743 % / 25,374625 % |
| SMLP | `known_prefix_guard` | 0,196380 à 1,677 | 0,189409 à 2,269 | 1,000 / 0,597423 | −40,263554 % | 34,682583 % / 32,844313 % |
| SMLP | `acquisition_and_persistence` | 311,571 à 2868,677 | 322,437 à 2573,125 | 2656,629 / 2541,781 | −4,323054 % | 12,089108 % / 24,187953 % |
| SMLP | `persistence` | 16,528 à 284,492 | 15,075 à 441,075 | 247,949 / 259,509 | +4,662313 % | 23,360985 % / 11,606107 % |
| SMLP | `restoration` | 2,010 à 34,275 | 1,886 à 89,349 | 21,773 / 37,279 | +71,219378 % | 17,656640 % / 30,967431 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +13,166697 %**; **SMLP `restoration` +71,219378 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 9653,437 | 9843,267 | +1,966449 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 275,010 | 274,961 | −0,018001 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,965 | 9,357 | +4,369695 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 11,322 | 12,149 | +7,307249 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,226384 | 0,245763 | +8,559994 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 821,090 | 821,399 | +0,037607 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 156,294 | 163,199 | +4,418202 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 6,977 | 7,064 | +1,254914 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16520,452 | 16559,837 | +0,238399 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 389,255 | 366,501 | −5,845481 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,195 | 10,031 | −1,610258 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 13,144 | 12,421 | −5,496343 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,384032 | 0,374874 | −2,384824 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 985,512 | 950,347 | −3,568247 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 137,314 | 134,707 | −1,898319 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,879 | 5,399 | −8,172130 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9637,082 à 9981,525 | 9752,010 à 10127,234 | indisponible / indisponible | indisponible | 3,568084 % / 3,811993 % |
| STCK | `new_decision` | 172,720 à 458,386 | 190,086 à 494,302 | 455,457 / 490,470 | +7,687439 % | 19,121269 % / 9,396801 % |
| STCK | `known_prefix_service` | 7,224 à 19,806 | 7,736 à 32,290 | indisponible / indisponible | indisponible | 15,594500 % / 29,594126 % |
| STCK | `known_prefix_request` | 9,037 à 21,825 | 9,358 à 34,529 | indisponible / indisponible | indisponible | 20,000743 % / 25,355110 % |
| STCK | `known_prefix_guard` | 0,087680 à 0,599225 | 0,091976 à 0,491796 | indisponible / indisponible | indisponible | 30,689484 % / 23,021306 % |
| STCK | `acquisition_and_persistence` | 382,958 à 3495,297 | 382,756 à 3537,485 | 3331,798 / 3444,075 | +3,369858 % | 12,922808 % / 3,708597 % |
| STCK | `persistence` | 14,750 à 381,848 | 13,513 à 489,495 | 316,595 / 352,403 | +11,310329 % | 21,916206 % / 15,086464 % |
| STCK | `restoration` | 1,823 à 87,534 | 1,897 à 68,135 | 49,613 / 55,402 | +11,668157 % | 10,400031 % / 13,511808 % |
| SMLP | `session_elapsed` | 16238,480 à 17387,387 | 16184,700 à 17173,244 | indisponible / indisponible | indisponible | 6,954453 % / 5,969531 % |
| SMLP | `new_decision` | 221,107 à 928,160 | 206,654 à 1067,732 | 900,279 / 812,951 | −9,700090 % | 21,611150 % / 15,821956 % |
| SMLP | `known_prefix_service` | 8,440 à 21,550 | 8,489 à 18,839 | 17,469 / 17,322 | −0,843713 % | 13,618727 % / 38,052644 % |
| SMLP | `known_prefix_request` | 10,507 à 24,727 | 10,475 à 21,400 | 20,000 / 19,445 | −2,774955 % | 16,321999 % / 30,541360 % |
| SMLP | `known_prefix_guard` | 0,210320 à 9,803 | 0,190471 à 0,711380 | 7,608 / 0,591303 | −92,227446 % | 22,005080 % / 49,775364 % |
| SMLP | `acquisition_and_persistence` | 316,872 à 2636,776 | 319,569 à 2829,678 | 2563,797 / 2691,318 | +4,973915 % | 25,892782 % / 27,147946 % |
| SMLP | `persistence` | 20,207 à 288,707 | 14,312 à 304,596 | 268,528 / 271,755 | +1,201701 % | 23,238365 % / 24,026110 % |
| SMLP | `restoration` | 1,922 à 34,549 | 1,944 à 41,086 | 27,862 / 31,285 | +12,286215 % | 43,042715 % / 10,205055 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `persistence` +11,310329 %**; **STCK `restoration` +11,668157 %**; **SMLP `restoration` +12,286215 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 192,203 / 181,408 | −5,616530 % | 174,624 à 235,260 / 158,190 à 229,348 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 337,381 / 313,826 | −6,981741 % | 305,572 à 394,668 / 290,508 à 401,412 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 203,967 / 214,822 | +5,321902 % | 175,629 à 272,498 / 188,008 à 257,819 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 363,377 / 380,982 | +4,844873 % | 324,403 à 436,059 / 356,316 à 423,337 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 180,087 / 189,423 | +5,184179 % | 156,300 à 247,022 / 165,188 à 232,765 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 332,481 / 340,232 | +2,331017 % | 275,765 à 401,283 / 280,756 à 388,901 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 205,980 / 228,042 | +10,710684 % | 192,694 à 246,597 / 198,700 à 278,837 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 382,162 / 398,685 | +4,323589 % | 331,857 à 435,320 / 324,730 à 480,425 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012229 / 0,024621 | +101,341129 % | 0,007010 à 0,034181 / 0,010375 à 0,056333 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1022,719 / 980,845 | −4,094413 % | 943,962 à 1094,568 / 925,833 à 1127,842 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,019058 / 0,012378 | −35,048274 % | 0,011327 à 0,020300 / 0,010185 à 0,017195 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 809,901 / 812,473 | +0,317606 % | 753,032 à 947,405 / 799,538 à 823,034 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,006810 / 0,007917 | +16,255507 % | 0,003214 à 0,015463 / 0,002574 à 0,024055 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1454,918 / 1433,297 | −1,486085 % | 1384,833 à 1503,891 / 1322,240 à 1627,359 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,006349 / 0,012199 | +92,117490 % | 0,005878 à 0,020901 / 0,003655 à 0,023946 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 665,717 / 729,849 | +9,633402 % | 634,784 à 906,061 / 630,237 à 809,335 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,011111 / 0,010280 | −7,483238 % | 0,007902 à 0,052087 / 0,006860 à 0,063564 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1062,997 / 963,845 | −9,327609 % | 919,024 à 1131,365 / 918,612 à 1194,243 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,012539 / 0,015839 | +26,318938 % | 0,009845 à 0,018117 / 0,013079 à 0,020020 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 779,267 / 770,943 | −1,068127 % | 704,539 à 898,438 / 740,634 à 818,745 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,011572 / 0,014211 | +22,799741 % | 0,006209 à 0,016764 / 0,006330 à 0,114129 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1554,560 / 1481,814 | −4,679500 % | 1367,824 à 1580,331 / 1422,458 à 1752,247 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004937 / 0,007330 | +48,480859 % | 0,004186 à 0,019549 / 0,004016 à 0,031667 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 719,389 / 717,128 | −0,314343 % | 653,801 à 817,160 / 678,866 à 759,796 | indisponible / indisponible |

| Cohorte | Jeu | Version | Contexte Pause | Observations | Acquittements | Actions à la frontière sûre |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | `initial_planning` | 4 | 4 | 0 |
| 1 | STCK | A | `engaged_action` | 4 | 4 | 1 |
| 1 | SMLP | A | `initial_planning` | 4 | 4 | 0 |
| 1 | SMLP | A | `engaged_action` | 4 | 4 | 1 |
| 1 | STCK | B | `initial_planning` | 4 | 4 | 0 |
| 1 | STCK | B | `engaged_action` | 4 | 4 | 1 |
| 1 | SMLP | B | `initial_planning` | 4 | 4 | 0 |
| 1 | SMLP | B | `engaged_action` | 4 | 4 | 1 |
| 2 | STCK | A | `initial_planning` | 4 | 4 | 0 |
| 2 | STCK | A | `engaged_action` | 4 | 4 | 1 |
| 2 | SMLP | A | `initial_planning` | 4 | 4 | 0 |
| 2 | SMLP | A | `engaged_action` | 4 | 4 | 1 |
| 2 | STCK | B | `initial_planning` | 4 | 4 | 0 |
| 2 | STCK | B | `engaged_action` | 4 | 4 | 1 |
| 2 | SMLP | B | `initial_planning` | 4 | 4 | 0 |
| 2 | SMLP | B | `engaged_action` | 4 | 4 | 1 |

## Échantillons mémoire conservés

Les rapports bruts conservent chaque valeur de mémoire. Le tableau décrit leur médiane et leur étendue en Mio ; il n’ajoute aucun critère d’acceptation et ne démontre pas une stabilité pendant plusieurs heures.

| Cohorte | Jeu | Version | Mesure | Effectif | Médiane, Mio | Min à max, Mio |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | `heapUsed` | 64 | 268,016 | 101,282 à 533,632 |
| 1 | STCK | A | `rss` | 64 | 872,311 | 562,023 à 948,875 |
| 1 | SMLP | A | `heapUsed` | 96 | 336,245 | 132,635 à 642,381 |
| 1 | SMLP | A | `rss` | 96 | 1025,959 | 757,746 à 1104,543 |
| 1 | STCK | B | `heapUsed` | 64 | 284,468 | 98,205 à 518,824 |
| 1 | STCK | B | `rss` | 64 | 867,002 | 521,828 à 933,496 |
| 1 | SMLP | B | `heapUsed` | 96 | 271,350 | 123,395 à 572,160 |
| 1 | SMLP | B | `rss` | 96 | 975,879 | 815,293 à 1061,160 |
| 2 | STCK | A | `heapUsed` | 64 | 282,788 | 105,892 à 509,041 |
| 2 | STCK | A | `rss` | 64 | 862,062 | 523,281 à 929,941 |
| 2 | SMLP | A | `heapUsed` | 96 | 303,897 | 133,138 à 618,089 |
| 2 | SMLP | A | `rss` | 96 | 971,723 | 791,582 à 1054,254 |
| 2 | STCK | B | `heapUsed` | 64 | 275,874 | 89,105 à 581,818 |
| 2 | STCK | B | `rss` | 64 | 873,035 | 532,770 à 1000,773 |
| 2 | SMLP | B | `heapUsed` | 96 | 324,022 | 118,137 à 594,906 |
| 2 | SMLP | B | `rss` | 96 | 973,693 | 823,199 à 1042,988 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `ceeab7f6148871594857fc7638c5af5f5a1fddcee6cf29e69489d36d8926b7f0` |
| global-budget-policy.json | `7d1e6bc63875e7bd3b4f8e30dbc6ce9da2e8d668f8aa1bf4c76f8dbb23a891ec` |
| owner-growth-comparison.json | `279768930da02c8d68788bbd238c01a7b2c3092f84323ac9f0e77543c6eb2129` |
| owner-growth-review.json | `dde0cf688affab3160b135f007708350b62d46dcc2c5d02858bdc464e5db70a5` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1569 | 442 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1569 | 441 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1576 | 446 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1571 | 440 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.52.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **0 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de l’atelier, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
