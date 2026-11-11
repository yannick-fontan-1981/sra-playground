# Lot 6A : résultats de coût de native 0.60.0

**Le coût est accepté selon le critère global déclaré : STCK +6,094357 %; SMLP +3,262812 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **11/16**, statut `budget_review_required`, avec **5 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 17890/17890 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds PreviewPacking ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

### Lecture des entrées baseline déclarée avant mesure

Les deux outils déclarés avant la fenêtre comprennent le lecteur des chemins absolus de l’attribution. Chaque entrée externe doit correspondre exactement à une empreinte du reçu de capture baseline pré-déclaré ; son chemin réel doit rester dans le checkout gelé lié à la fenêtre. La taille et le SHA-256 sont vérifiés à la lecture puis en fin de calcul. Les lecteurs généraux de rapports restent locaux. Les sorties identifient ces mêmes outils, sans variante de correction après mesure. Les données brutes, les formes attendues, les populations, les calculs et le seuil restent ceux déclarés.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 95 / native 0.58.0 ; commit `3a70463039768f7114edae7d94d7dd33b7f36aa8` ; 302 fichiers natifs | `099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4` |
| B : candidat gelé | Native 0.60.0 ; 306 fichiers natifs ; archive de 322 fichiers | `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229` |

La [déclaration](declaration.json) finalisée le **2026-11-11 09:18:26 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de PreviewPacking. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-11 10:21:43 UTC−03** au **2026-11-11 10:30:47 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.58.0 | 2026-11-11 10:21:43 UTC−03 | 2026-11-11 10:23:58 UTC−03 | passed |
| B1 | 0.60.0 | 2026-11-11 10:23:58 UTC−03 | 2026-11-11 10:26:16 UTC−03 | passed |
| B2 | 0.60.0 | 2026-11-11 10:26:16 UTC−03 | 2026-11-11 10:28:34 UTC−03 | passed |
| A2 | 0.58.0 | 2026-11-11 10:28:34 UTC−03 | 2026-11-11 10:30:47 UTC−03 | passed |

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
| Revue statique | 68/68 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10953,833 | 11621,399 | +6,094357 % | 3,905643 | Accepté |
| SMLP | 8 / 8 | 16915,813 | 17467,744 | +3,262812 % | 6,737188 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10953,833 | 11621,399 | +6,094357 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 334,840 | 385,001 | +14,980671 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 32 / 32 | 8,211 | 8,719 | +6,177249 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,021 | 10,708 | +6,856583 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,225290 | 0,213358 | −5,296495 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 864,447 | 970,985 | +12,324410 % | `over_budget_with_noise_unresolved` |
| STCK | `persistence` | 104 / 104 | 188,983 | 193,990 | +2,649530 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 16,804 | 17,894 | +6,483756 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16915,813 | 17467,744 | +3,262812 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 420,022 | 472,286 | +12,443161 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 48 / 48 | 8,939 | 9,972 | +11,550136 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,156 | 12,571 | +12,686196 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,341180 | 0,372953 | +9,312666 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 821,745 | 836,462 | +1,790857 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 151,225 | 152,386 | +0,767414 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 9,230 | 9,795 | +6,119265 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +14,980671 %** (`over_budget_with_noise_unresolved`); **STCK `acquisition_and_persistence` +12,324410 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +12,443161 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +11,550136 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_request` +12,686196 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10730,918 à 11444,886 | 11399,383 à 13284,412 | indisponible / indisponible | indisponible | 6,517979 % / 16,220330 % |
| STCK | `new_decision` | 222,276 à 790,635 | 219,602 à 868,679 | 686,716 / 736,926 | +7,311639 % | 16,519888 % / 41,278869 % |
| STCK | `known_prefix_service` | 6,711 à 23,587 | 7,590 à 34,307 | 16,718 / 19,426 | +16,195250 % | 74,969334 % / 31,618844 % |
| STCK | `known_prefix_request` | 8,135 à 25,806 | 9,307 à 45,408 | 19,051 / 21,195 | +11,252691 % | 68,446336 % / 31,018976 % |
| STCK | `known_prefix_guard` | 0,080071 à 8,626 | 0,079450 à 0,949704 | 0,489058 / 0,594798 | +21,621157 % | 71,597760 % / 64,372894 % |
| STCK | `acquisition_and_persistence` | 425,159 à 3907,402 | 426,060 à 4368,736 | 3813,394 / 4207,596 | +10,337320 % | 15,487029 % / 19,135567 % |
| STCK | `persistence` | 15,319 à 615,856 | 15,345 à 595,213 | 473,000 / 536,293 | +13,381178 % | 22,538666 % / 35,768171 % |
| STCK | `restoration` | 2,108 à 245,519 | 2,244 à 231,923 | 148,425 / 147,816 | −0,410528 % | 35,969207 % / 33,116376 % |
| SMLP | `session_elapsed` | 16690,020 à 17781,594 | 16660,179 à 17963,166 | indisponible / indisponible | indisponible | 6,452979 % / 7,459390 % |
| SMLP | `new_decision` | 227,007 à 1016,708 | 225,232 à 914,354 | 877,637 / 844,090 | −3,822371 % | 41,694743 % / 33,240802 % |
| SMLP | `known_prefix_service` | 7,388 à 16,118 | 7,664 à 18,385 | 12,658 / 15,670 | +23,788370 % | 15,441262 % / 35,380321 % |
| SMLP | `known_prefix_request` | 9,563 à 19,445 | 9,686 à 24,843 | 15,441 / 18,825 | +21,921763 % | 12,580076 % / 33,938989 % |
| SMLP | `known_prefix_guard` | 0,191419 à 0,568338 | 0,203708 à 1,009 | 0,502228 / 0,593216 | +18,116871 % | 20,381607 % / 37,339813 % |
| SMLP | `acquisition_and_persistence` | 382,788 à 2997,766 | 405,663 à 3458,147 | 2782,111 / 2857,377 | +2,705364 % | 11,559259 % / 30,774728 % |
| SMLP | `persistence` | 12,864 à 387,495 | 12,610 à 388,560 | 263,589 / 301,892 | +14,531182 % | 19,304631 % / 18,262006 % |
| SMLP | `restoration` | 2,080 à 68,089 | 2,476 à 75,181 | 52,181 / 51,978 | −0,388372 % | 51,988505 % / 60,027519 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_service` +16,195250 %**; **STCK `known_prefix_request` +11,252691 %**; **STCK `known_prefix_guard` +21,621157 %**; **STCK `acquisition_and_persistence` +10,337320 %**; **STCK `persistence` +13,381178 %**; **SMLP `known_prefix_service` +23,788370 %**; **SMLP `known_prefix_request` +21,921763 %**; **SMLP `known_prefix_guard` +18,116871 %**; **SMLP `persistence` +14,531182 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 11018,118 / 11974,234 | +8,677668 % | 6/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17028,666 / 17013,663 | −0,088104 % | 5/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10831,002 / 11581,701 | +6,931026 % | 6/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16888,807 / 17738,578 | +5,031565 % | 3/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 11192,112405 | 2026-11-11 10:21:49 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 11026,964911 | 2026-11-11 10:22:02 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 11009,271323 | 2026-11-11 10:22:14 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 10853,819294 | 2026-11-11 10:22:26 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 16922,458839 | 2026-11-11 10:22:44 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 16880,321328 | 2026-11-11 10:23:02 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 17670,384715 | 2026-11-11 10:23:20 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 17134,873766 | 2026-11-11 10:23:39 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 12255,608331 | 2026-11-11 10:24:03 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 11692,859380 | 2026-11-11 10:24:17 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 13284,412323 | 2026-11-11 10:24:30 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 11399,383076 | 2026-11-11 10:24:45 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 16660,179163 | 2026-11-11 10:25:03 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 17281,304692 | 2026-11-11 10:25:20 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 17753,286377 | 2026-11-11 10:25:39 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 16746,022014 | 2026-11-11 10:25:58 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 11644,166315 | 2026-11-11 10:26:22 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 11564,771707 | 2026-11-11 10:26:35 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 11598,630874 | 2026-11-11 10:26:48 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 11504,320729 | 2026-11-11 10:27:00 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 17822,972784 | 2026-11-11 10:27:18 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16684,119282 | 2026-11-11 10:27:37 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 17963,166288 | 2026-11-11 10:27:55 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 17654,183032 | 2026-11-11 10:28:15 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 11444,886180 | 2026-11-11 10:28:39 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 10730,917665 | 2026-11-11 10:28:52 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 10898,394504 | 2026-11-11 10:29:04 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 10763,609041 | 2026-11-11 10:29:16 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 16868,446734 | 2026-11-11 10:29:33 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 16690,019850 | 2026-11-11 10:29:51 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 16909,166526 | 2026-11-11 10:30:09 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 17781,593667 | 2026-11-11 10:30:27 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11018,118 | 11974,234 | +8,677668 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 341,807 | 400,360 | +17,130656 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,211 | 8,615 | +4,918659 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,431 | 10,776 | +3,301265 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,249556 | 0,213358 | −14,505132 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 904,624 | 989,601 | +9,393625 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 192,450 | 213,803 | +11,095312 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 48 / 48 | 16,804 | 17,894 | +6,483756 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17028,666 | 17013,663 | −0,088104 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 435,607 | 454,941 | +4,438384 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,102 | 10,609 | +16,552401 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,592 | 13,009 | +12,228162 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,345362 | 0,372367 | +7,819632 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 831,561 | 781,466 | −6,024227 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 152,712 | 156,085 | +2,209179 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 9,673 | 10,864 | +12,306657 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +17,130656 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +11,095312 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +16,552401 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_request` +12,228162 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +12,306657 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10853,819 à 11192,112 | 11399,383 à 13284,412 | indisponible / indisponible | indisponible | 3,070335 % / 15,742379 % |
| STCK | `new_decision` | 222,276 à 722,941 | 219,602 à 868,679 | 686,716 / 736,926 | +7,311639 % | 13,334662 % / 25,417751 % |
| STCK | `known_prefix_service` | 7,504 à 23,587 | 7,590 à 19,426 | indisponible / indisponible | indisponible | 74,143638 % / 25,137721 % |
| STCK | `known_prefix_request` | 8,997 à 25,806 | 9,307 à 21,195 | indisponible / indisponible | indisponible | 65,237229 % / 19,863444 % |
| STCK | `known_prefix_guard` | 0,088914 à 0,489058 | 0,085469 à 0,463210 | indisponible / indisponible | indisponible | 68,044399 % / 46,442172 % |
| STCK | `acquisition_and_persistence` | 438,473 à 3907,402 | 426,060 à 4368,736 | 3860,575 / 4321,408 | +11,936907 % | 7,940489 % / 18,694585 % |
| STCK | `persistence` | 15,319 à 513,672 | 15,901 à 595,213 | 471,146 / 542,952 | +15,240670 % | 7,834610 % / 33,049703 % |
| STCK | `restoration` | 2,342 à 245,519 | 2,244 à 231,923 | 155,451 / 165,431 | +6,420095 % | 33,115379 % / 30,928023 % |
| SMLP | `session_elapsed` | 16880,321 à 17670,385 | 16660,179 à 17753,286 | indisponible / indisponible | indisponible | 4,639608 % / 6,424879 % |
| SMLP | `new_decision` | 231,819 à 1016,708 | 225,232 à 812,637 | 877,637 / 798,792 | −8,983749 % | 22,183589 % / 36,943504 % |
| SMLP | `known_prefix_service` | 7,562 à 12,658 | 7,664 à 18,385 | 11,620 / 15,670 | +34,855280 % | 10,697666 % / 30,461319 % |
| SMLP | `known_prefix_request` | 9,605 à 15,441 | 9,686 à 24,843 | 14,326 / 23,499 | +64,032033 % | 10,376837 % / 29,193511 % |
| SMLP | `known_prefix_guard` | 0,191419 à 0,507648 | 0,206792 à 1,009 | 0,488299 / 0,736131 | +50,754149 % | 15,100357 % / 28,624501 % |
| SMLP | `acquisition_and_persistence` | 470,837 à 2827,121 | 443,151 à 3458,147 | 2800,484 / 2981,627 | +6,468297 % | 4,946925 % / 15,650642 % |
| SMLP | `persistence` | 13,082 à 352,144 | 12,610 à 344,175 | 247,859 / 294,499 | +18,816716 % | 14,068961 % / 10,651162 % |
| SMLP | `restoration` | 2,195 à 56,086 | 2,706 à 75,181 | 51,459 / 59,877 | +16,358966 % | 42,263718 % / 54,859428 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `acquisition_and_persistence` +11,936907 %**; **STCK `persistence` +15,240670 %**; **SMLP `known_prefix_service` +34,855280 %**; **SMLP `known_prefix_request` +64,032033 %**; **SMLP `known_prefix_guard` +50,754149 %**; **SMLP `persistence` +18,816716 %**; **SMLP `restoration` +16,358966 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10831,002 | 11581,701 | +6,931026 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 315,451 | 373,031 | +18,253177 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,176 | 8,918 | +9,076143 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 9,901 | 10,651 | +7,574370 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,201940 | 0,209146 | +3,568387 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 855,306 | 944,018 | +10,371879 % | `over_budget_with_noise_unresolved` |
| STCK | `persistence` | 52 / 52 | 182,269 | 193,503 | +6,163251 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,087 | 18,325 | +7,247404 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16888,807 | 17738,578 | +5,031565 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 387,996 | 472,327 | +21,734932 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 24 / 24 | 8,678 | 9,767 | +12,551709 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 24 / 24 | 10,870 | 12,088 | +11,210226 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,326793 | 0,383896 | +17,473573 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 814,400 | 849,234 | +4,277276 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 145,517 | 150,204 | +3,221061 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,396 | 9,156 | +23,796757 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +18,253177 %** (`over_budget_with_noise_unresolved`); **STCK `acquisition_and_persistence` +10,371879 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +21,734932 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +12,551709 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_request` +11,210226 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +17,473573 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +23,796757 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10730,918 à 11444,886 | 11504,321 à 11644,166 | indisponible / indisponible | indisponible | 6,591897 % / 1,207470 % |
| STCK | `new_decision` | 227,282 à 790,635 | 257,031 à 756,497 | 645,886 / 660,333 | +2,236764 % | 15,151488 % / 41,278869 % |
| STCK | `known_prefix_service` | 6,711 à 16,718 | 7,743 à 34,307 | indisponible / indisponible | indisponible | 14,610446 % / 30,629229 % |
| STCK | `known_prefix_request` | 8,135 à 18,611 | 9,412 à 45,408 | indisponible / indisponible | indisponible | 12,796937 % / 31,395776 % |
| STCK | `known_prefix_guard` | 0,080071 à 8,626 | 0,079450 à 0,949704 | indisponible / indisponible | indisponible | 34,590711 % / 62,289884 % |
| STCK | `acquisition_and_persistence` | 425,159 à 3813,394 | 465,034 à 4207,596 | 3711,696 / 3945,415 | +6,296831 % | 16,281881 % / 10,096742 % |
| STCK | `persistence` | 15,997 à 615,856 | 15,345 à 590,746 | 524,204 / 456,302 | −12,953445 % | 23,362058 % / 5,892414 % |
| STCK | `restoration` | 2,108 à 157,168 | 2,285 à 161,480 | 142,863 / 136,390 | −4,531369 % | 16,067990 % / 32,113532 % |
| SMLP | `session_elapsed` | 16690,020 à 17781,594 | 16684,119 à 17963,166 | indisponible / indisponible | indisponible | 6,463298 % / 7,210539 % |
| SMLP | `new_decision` | 227,007 à 951,432 | 248,610 à 914,354 | 886,840 / 879,434 | −0,835175 % | 41,714928 % / 17,918872 % |
| SMLP | `known_prefix_service` | 7,388 à 16,118 | 8,145 à 16,289 | 12,906 / 12,805 | −0,784940 % | 5,464158 % / 19,914739 % |
| SMLP | `known_prefix_request` | 9,563 à 19,445 | 10,053 à 18,825 | 16,186 / 16,752 | +3,502140 % | 3,610414 % / 21,935113 % |
| SMLP | `known_prefix_guard` | 0,193542 à 0,568338 | 0,203708 à 0,593216 | 0,502228 / 0,584793 | +16,439744 % | 16,086896 % / 27,437498 % |
| SMLP | `acquisition_and_persistence` | 382,788 à 2997,766 | 405,663 à 2928,345 | 2774,288 / 2857,377 | +2,994997 % | 11,663513 % / 15,769641 % |
| SMLP | `persistence` | 12,864 à 387,495 | 13,386 à 388,560 | 297,745 / 330,956 | +11,154281 % | 15,524547 % / 18,262006 % |
| SMLP | `restoration` | 2,080 à 68,089 | 2,476 à 53,135 | 53,653 / 49,218 | −8,265576 % | 19,917243 % / 44,358234 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_guard` +16,439744 %**; **SMLP `persistence` +11,154281 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 203,318 / 214,317 | +5,409609 % | 176,407 à 243,790 / 180,072 à 423,454 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 372,243 / 410,296 | +10,222610 % | 330,305 à 499,080 / 319,145 à 645,129 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 237,698 / 220,570 | −7,205870 % | 200,133 à 334,623 / 201,447 à 241,959 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 414,401 / 394,322 | −4,845402 % | 367,441 à 517,357 / 343,766 à 424,508 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 199,915 / 207,120 | +3,604014 % | 185,066 à 263,357 / 183,896 à 270,208 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 366,227 / 377,668 | +3,124026 % | 320,963 à 523,266 / 334,235 à 491,189 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 232,507 / 237,185 | +2,011866 % | 196,279 à 277,939 / 200,709 à 326,235 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 407,468 / 415,216 | +1,901602 % | 363,720 à 439,681 / 358,696 à 544,381 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,009359 / 0,009654 | +3,157389 % | 0,009023 à 0,158229 / 0,006420 à 0,043175 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1028,147 / 1171,199 | +13,913552 % | 882,462 à 1123,918 / 1052,812 à 1451,565 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,010976 / 0,023571 | +114,736027 % | 0,007411 à 0,017907 / 0,008993 à 0,042074 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 961,726 / 1024,159 | +6,491778 % | 872,433 à 1082,506 / 871,282 à 1152,500 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,013250 / 0,008153 | −38,474020 % | 0,005138 à 0,035624 / 0,004446 à 0,015313 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1542,221 / 1494,951 | −3,065050 % | 1508,310 à 1559,218 / 1382,276 à 1522,670 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015248 / 0,005989 | −60,722718 % | 0,006089 à 0,038929 / 0,003676 à 0,017136 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 760,599 / 712,623 | −6,307624 % | 674,467 à 870,072 / 637,425 à 872,741 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008914 / 0,010180 | +14,207987 % | 0,006630 à 0,035814 / 0,007802 à 0,040381 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1032,773 / 1159,784 | +12,297968 % | 986,900 à 1147,520 / 1065,064 à 1266,150 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,011107 / 0,014092 | +26,870442 % | 0,009004 à 0,015433 / 0,009514 à 0,016815 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 856,679 / 956,772 | +11,683933 % | 851,507 à 1014,107 / 891,099 à 1098,346 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,005463 / 0,011071 | +102,663372 % | 0,002524 à 0,015363 / 0,005388 à 0,072710 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1534,644 / 1578,899 | +2,883781 % | 1401,999 à 1692,796 / 1355,494 à 1682,724 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,006300 / 0,006815 | +8,191126 % | 0,004146 à 0,018688 / 0,004637 à 0,020301 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 703,256 / 752,074 | +6,941669 % | 689,239 à 712,567 / 685,430 à 944,590 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 282,412 | 138,995 à 519,464 |
| 1 | STCK | A | `rss` | 64 | 934,547 | 550,832 à 1019,363 |
| 1 | SMLP | A | `heapUsed` | 96 | 300,757 | 129,579 à 649,425 |
| 1 | SMLP | A | `rss` | 96 | 1004,305 | 792,855 à 1087,805 |
| 1 | STCK | B | `heapUsed` | 64 | 293,265 | 106,134 à 595,553 |
| 1 | STCK | B | `rss` | 64 | 898,703 | 575,566 à 1040,844 |
| 1 | SMLP | B | `heapUsed` | 96 | 287,957 | 134,474 à 545,898 |
| 1 | SMLP | B | `rss` | 96 | 984,158 | 849,340 à 1053,254 |
| 2 | STCK | A | `heapUsed` | 64 | 324,567 | 127,577 à 543,012 |
| 2 | STCK | A | `rss` | 64 | 950,945 | 542,723 à 1032,242 |
| 2 | SMLP | A | `heapUsed` | 96 | 315,203 | 144,436 à 647,523 |
| 2 | SMLP | A | `rss` | 96 | 1030,500 | 787,688 à 1127,344 |
| 2 | STCK | B | `heapUsed` | 64 | 291,261 | 100,425 à 527,089 |
| 2 | STCK | B | `rss` | 64 | 927,271 | 576,875 à 1008,477 |
| 2 | SMLP | B | `heapUsed` | 96 | 322,735 | 129,944 à 619,551 |
| 2 | SMLP | B | `rss` | 96 | 1000,312 | 779,117 à 1088,512 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. Les deux générateurs exécutés sont exactement ceux déclarés avant la fenêtre, avec leur lecteur borné des entrées baseline. Cette provenance ne remplace pas les vérifications chronologiques. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `4f845314b71ded4a715c6fc8e213f2e7a89a551d7489b7847a9786d5d86ff87d` |
| global-budget-policy.json | `6873f6f5e1cba0be18e4fa4929d99be58382b5120eee5ac85c24c2fca0d8ecbf` |
| owner-growth-comparison.json | `0dc9c889b77e8db42b7d5d29e7b23617dc5ab9fc7f1bdeb53b9666c03e1777b0` |
| owner-growth-review.json | `602ee9e8245be12d6a06fd94a9c763318fb740b73f1c35f1c4a5a295ca774be3` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1568 | 438 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1585 | 450 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1573 | 442 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1574 | 442 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.60.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **5 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de PreviewPacking, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
