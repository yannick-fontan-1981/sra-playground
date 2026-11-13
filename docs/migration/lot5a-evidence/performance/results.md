# Lot 5A : résultats de coût de native 0.53.0

**Le coût est accepté selon le critère global déclaré : STCK +9,618464 %; SMLP +4,664979 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **10/16**, statut `budget_review_required`, avec **6 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 4669/4669 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds de préparation temporelle liée ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

### Correction de lecture après mesure

Le consolidateur gelé avant la fenêtre a refusé son propre dossier de coût, pourtant désigné dans la déclaration préalable. Cet [échec initial](owner-growth-analysis-initial-failure.json) est conservé. La [correction de chemin distincte](diagnostic/owner-cost-directory-correction-v1.json) est explicitement **postérieure à la mesure** : elle autorise uniquement le dossier exact déjà lié au contrat et à la fenêtre. Elle ne change aucun lecteur de chemin externe, aucune population, valeur brute ou formule. Les deux sorties nomment séparément les outils exécutés et ceux déclarés avant la fenêtre. Les outils d’origine, le contrat, les formes attendues, les populations, les données brutes, les calculs et le seuil restent inchangés. Cette réparation ne transforme aucun refus historique en réussite.

### Attribution complémentaire déclarée avant mesure

Le [supplément préalable](shared-fragment-premeasurement-supplement.json) conserve l’échec initial d’attribution et qualifie les seuls fragments immuables explicitement identifiés dont le nouveau propriétaire est le premier créateur. Leur valeur complète, leur adresse, les deux origines réelles, les racines consommatrices et le rattrapage des deltas sont conservés. Il ne change aucune population, durée, formule de coût ou limite globale.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 82 / native 0.52.0 ; commit `0ca36b0a6a358e1e89420753bbcec4a33f028e0a` ; 279 fichiers natifs | `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb` |
| B : candidat gelé | Native 0.53.0 ; 283 fichiers natifs ; archive de 294 fichiers | `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f` |

La [déclaration](declaration.json) finalisée le **2026-11-10 18:00:47 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de la préparation temporelle liée. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 18:29:50 UTC−03** au **2026-11-10 18:38:25 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.52.0 | 2026-11-10 18:29:50 UTC−03 | 2026-11-10 18:31:57 UTC−03 | passed |
| B1 | 0.53.0 | 2026-11-10 18:31:57 UTC−03 | 2026-11-10 18:34:12 UTC−03 | passed |
| B2 | 0.53.0 | 2026-11-10 18:34:12 UTC−03 | 2026-11-10 18:36:23 UTC−03 | passed |
| A2 | 0.52.0 | 2026-11-10 18:36:23 UTC−03 | 2026-11-10 18:38:25 UTC−03 | passed |

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
| STCK | 8 / 8 | 9872,156 | 10821,705 | +9,618464 % | 0,381536 | Accepté |
| SMLP | 8 / 8 | 16573,027 | 17346,155 | +4,664979 % | 5,335021 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 9872,156 | 10821,705 | +9,618464 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 292,029 | 358,444 | +22,742885 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 32 / 32 | 9,077 | 9,581 | +5,558884 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,886 | 11,265 | +3,479309 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,234411 | 0,239695 | +2,253947 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 809,863 | 859,237 | +6,096580 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 159,349 | 189,576 | +18,969258 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 96 / 96 | 8,631 | 17,210 | +99,401205 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 8 / 8 | 16573,027 | 17346,155 | +4,664979 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 384,160 | 432,596 | +12,608067 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,795 | 9,609 | −1,901668 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 12,224 | 11,822 | −3,288818 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,359641 | 0,343533 | −4,479050 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 914,748 | 841,631 | −7,993096 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 133,213 | 168,757 | +26,682402 % | `over_budget_with_noise_unresolved` |
| SMLP | `restoration` | 144 / 144 | 5,565 | 9,433 | +69,497043 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +22,742885 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +18,969258 %** (`over_budget_with_noise_unresolved`); **STCK `restoration` +99,401205 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +12,608067 %** (`over_budget_with_noise_unresolved`); **SMLP `persistence` +26,682402 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +69,497043 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9222,213 à 10301,172 | 10489,003 à 12062,864 | indisponible / indisponible | indisponible | 10,929312 % / 14,543555 % |
| STCK | `new_decision` | 176,409 à 532,899 | 217,704 à 729,201 | 454,305 / 644,906 | +41,954422 % | 22,087285 % / 42,239720 % |
| STCK | `known_prefix_service` | 7,177 à 18,914 | 7,750 à 15,348 | 16,343 / 13,752 | −15,852748 % | 19,353948 % / 48,685450 % |
| STCK | `known_prefix_request` | 8,771 à 21,081 | 9,358 à 16,938 | 18,100 / 16,543 | −8,600541 % | 17,165643 % / 45,955765 % |
| STCK | `known_prefix_guard` | 0,085286 à 0,956693 | 0,083163 à 0,701907 | 0,476644 / 0,535411 | +12,329328 % | 39,237871 % / 68,945974 % |
| STCK | `acquisition_and_persistence` | 387,245 à 3713,069 | 435,653 à 4546,814 | 3561,201 / 3678,274 | +3,287465 % | 23,172098 % / 11,314557 % |
| STCK | `persistence` | 13,033 à 378,233 | 13,924 à 570,237 | 322,988 / 483,330 | +49,643007 % | 17,607214 % / 31,757682 % |
| STCK | `restoration` | 1,762 à 53,111 | 2,109 à 161,973 | 47,214 / 138,309 | +192,941148 % | 39,535040 % / 19,481332 % |
| SMLP | `session_elapsed` | 15693,036 à 18072,850 | 15936,838 à 18195,950 | indisponible / indisponible | indisponible | 14,359561 % / 13,023703 % |
| SMLP | `new_decision` | 190,628 à 857,122 | 236,710 à 1015,093 | 820,733 / 883,749 | +7,678108 % | 29,101803 % / 43,548983 % |
| SMLP | `known_prefix_service` | 7,787 à 23,534 | 7,798 à 18,670 | 17,140 / 13,464 | −21,450805 % | 29,244667 % / 18,064022 % |
| SMLP | `known_prefix_request` | 9,885 à 26,284 | 9,799 à 21,048 | 19,500 / 16,282 | −16,503901 % | 26,043861 % / 19,361835 % |
| SMLP | `known_prefix_guard` | 0,187958 à 7,181 | 0,192124 à 0,805210 | 0,738160 / 0,579957 | −21,432074 % | 27,668008 % / 36,083714 % |
| SMLP | `acquisition_and_persistence` | 325,263 à 2827,434 | 385,594 à 3154,211 | 2617,875 / 2684,752 | +2,554623 % | 25,697540 % / 16,456914 % |
| SMLP | `persistence` | 14,704 à 295,135 | 12,131 à 695,745 | 249,662 / 261,376 | +4,691662 % | 30,171910 % / 24,340027 % |
| SMLP | `restoration` | 1,949 à 43,682 | 2,028 à 139,432 | 24,601 / 57,703 | +134,559502 % | 39,316983 % / 62,922449 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +41,954422 %**; **STCK `known_prefix_guard` +12,329328 %**; **STCK `persistence` +49,643007 %**; **STCK `restoration` +192,941148 %**; **SMLP `restoration` +134,559502 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 9894,764 / 10821,705 | +9,367996 % | 5/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17030,011 / 17915,779 | +5,201222 % | 5/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 9708,360 / 10841,658 | +11,673421 % | 4/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 15834,183 / 16543,327 | +4,478566 % | 5/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 9841,392194 | 2026-11-10 18:29:55 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 9222,212988 | 2026-11-10 18:30:06 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 10301,171631 | 2026-11-10 18:30:16 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 9948,136112 | 2026-11-10 18:30:27 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 16287,013481 | 2026-11-10 18:30:44 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 16859,040898 | 2026-11-10 18:31:02 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 18072,850328 | 2026-11-10 18:31:20 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 17200,980758 | 2026-11-10 18:31:39 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 10986,328935 | 2026-11-10 18:32:03 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 10578,380054 | 2026-11-10 18:32:15 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 10657,081540 | 2026-11-10 18:32:27 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 11086,986273 | 2026-11-10 18:32:39 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 16400,357083 | 2026-11-10 18:32:56 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 18195,949940 | 2026-11-10 18:33:14 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 17890,546144 | 2026-11-10 18:33:33 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 17941,012767 | 2026-11-10 18:33:53 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 11188,846869 | 2026-11-10 18:34:18 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 10489,003205 | 2026-11-10 18:34:30 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 10494,468170 | 2026-11-10 18:34:41 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 12062,863863 | 2026-11-10 18:34:53 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 17809,011743 | 2026-11-10 18:35:11 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16883,299137 | 2026-11-10 18:35:30 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 16203,354703 | 2026-11-10 18:35:49 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 15936,838165 | 2026-11-10 18:36:06 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 9513,800676 | 2026-11-10 18:36:28 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 9979,455368 | 2026-11-10 18:36:38 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 9902,918853 | 2026-11-10 18:36:49 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 9484,881580 | 2026-11-10 18:37:00 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 17345,914190 | 2026-11-10 18:37:16 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 15797,230304 | 2026-11-10 18:37:34 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 15871,134921 | 2026-11-10 18:37:51 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 15693,036317 | 2026-11-10 18:38:08 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 9894,764 | 10821,705 | +9,367996 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 292,029 | 373,668 | +27,955838 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,981 | 9,414 | +4,818216 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,886 | 11,091 | +1,884713 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,217982 | 0,230871 | +5,912874 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 798,959 | 857,575 | +7,336614 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 153,364 | 188,430 | +22,864788 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 48 / 48 | 8,845 | 17,069 | +92,978873 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 17030,011 | 17915,779 | +5,201222 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 389,859 | 449,139 | +15,205327 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,191 | 10,072 | −1,165079 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,577 | 12,472 | −0,833414 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,354408 | 0,371544 | +4,834816 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 926,591 | 874,708 | −5,599277 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 137,024 | 171,684 | +25,295059 % | `over_budget_with_noise_unresolved` |
| SMLP | `restoration` | 72 / 72 | 5,838 | 9,574 | +63,989572 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +27,955838 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +22,864788 %** (`over_budget_with_noise_unresolved`); **STCK `restoration` +92,978873 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +15,205327 %** (`over_budget_with_noise_unresolved`); **SMLP `persistence` +25,295059 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +63,989572 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9222,213 à 10301,172 | 10578,380 à 11086,986 | indisponible / indisponible | indisponible | 10,904339 % / 4,699871 % |
| STCK | `new_decision` | 176,409 à 475,625 | 263,194 à 686,262 | 454,305 / 644,906 | +41,954422 % | 10,389114 % / 31,114330 % |
| STCK | `known_prefix_service` | 7,177 à 16,343 | 7,750 à 11,159 | indisponible / indisponible | indisponible | 19,148264 % / 31,426595 % |
| STCK | `known_prefix_request` | 8,771 à 18,100 | 9,358 à 13,299 | indisponible / indisponible | indisponible | 16,804216 % / 30,544263 % |
| STCK | `known_prefix_guard` | 0,085286 à 0,956693 | 0,083163 à 0,535411 | indisponible / indisponible | indisponible | 22,100198 % / 66,474731 % |
| STCK | `acquisition_and_persistence` | 406,588 à 3713,069 | 473,925 à 3678,274 | 3561,201 / 3628,388 | +1,886640 % | 20,553430 % / 7,215646 % |
| STCK | `persistence` | 13,740 à 370,728 | 13,924 à 570,237 | 324,542 / 508,522 | +56,688968 % | 18,259706 % / 11,669460 % |
| STCK | `restoration` | 1,813 à 51,114 | 2,141 à 154,531 | 48,085 / 138,309 | +187,636053 % | 39,729683 % / 20,053834 % |
| SMLP | `session_elapsed` | 16287,013 à 18072,850 | 16400,357 à 18195,950 | indisponible / indisponible | indisponible | 10,486411 % / 10,022410 % |
| SMLP | `new_decision` | 211,134 à 857,122 | 268,902 à 952,809 | 821,890 / 883,749 | +7,526414 % | 24,931094 % / 29,370638 % |
| SMLP | `known_prefix_service` | 7,787 à 23,534 | 8,366 à 18,670 | 15,365 / 13,464 | −12,378074 % | 27,731894 % / 13,813326 % |
| SMLP | `known_prefix_request` | 10,040 à 26,284 | 10,605 à 21,048 | 18,220 / 16,246 | −10,832840 % | 24,755543 % / 15,825862 % |
| SMLP | `known_prefix_guard` | 0,201087 à 0,738160 | 0,196510 à 0,805210 | 0,514971 / 0,668918 | +29,894305 % | 23,788265 % / 12,288103 % |
| SMLP | `acquisition_and_persistence` | 360,106 à 2827,434 | 385,594 à 3154,211 | 2734,606 / 3055,057 | +11,718368 % | 20,868204 % / 15,492326 % |
| SMLP | `persistence` | 19,213 à 295,135 | 13,950 à 695,745 | 255,246 / 273,113 | +6,999844 % | 28,118565 % / 14,654780 % |
| SMLP | `restoration` | 2,042 à 35,294 | 2,301 à 139,432 | 24,601 / 65,478 | +166,164587 % | 10,228813 % / 60,562502 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +41,954422 %**; **STCK `persistence` +56,688968 %**; **STCK `restoration` +187,636053 %**; **SMLP `known_prefix_guard` +29,894305 %**; **SMLP `acquisition_and_persistence` +11,718368 %**; **SMLP `restoration` +166,164587 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 9708,360 | 10841,658 | +11,673421 % | `over_budget_with_noise_unresolved` |
| STCK | `new_decision` | 24 / 24 | 291,959 | 338,241 | +15,852099 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 9,180 | 9,993 | +8,859768 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,973 | 11,782 | +7,372139 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,254030 | 0,258522 | +1,768295 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 820,367 | 860,778 | +4,925968 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 160,185 | 195,674 | +22,154892 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 48 / 48 | 6,814 | 17,502 | +156,862944 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 15834,183 | 16543,327 | +4,478566 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 368,579 | 406,576 | +10,309100 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,707 | 9,474 | −2,397105 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,957 | 11,806 | −1,264840 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,385159 | 0,322702 | −16,215900 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 900,630 | 831,456 | −7,680543 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 131,171 | 162,618 | +23,974011 % | `over_budget_with_noise_unresolved` |
| SMLP | `restoration` | 72 / 72 | 5,194 | 8,319 | +60,175262 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `session_elapsed` +11,673421 %** (`over_budget_with_noise_unresolved`); **STCK `new_decision` +15,852099 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +22,154892 %** (`over_budget_with_noise_unresolved`); **STCK `restoration` +156,862944 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +10,309100 %** (`over_budget_with_noise_unresolved`); **SMLP `persistence` +23,974011 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +60,175262 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9484,882 à 9979,455 | 10489,003 à 12062,864 | indisponible / indisponible | indisponible | 5,094308 % / 14,516790 % |
| STCK | `new_decision` | 194,764 à 532,899 | 217,704 à 729,201 | 407,136 / 627,215 | +54,055399 % | 21,688400 % / 23,529545 % |
| STCK | `known_prefix_service` | 8,607 à 18,914 | 7,831 à 15,348 | indisponible / indisponible | indisponible | 6,946670 % / 43,631650 % |
| STCK | `known_prefix_request` | 10,338 à 21,081 | 9,388 à 16,938 | indisponible / indisponible | indisponible | 7,624106 % / 40,974776 % |
| STCK | `known_prefix_guard` | 0,086317 à 0,476644 | 0,088741 à 0,701907 | indisponible / indisponible | indisponible | 34,488859 % / 44,878446 % |
| STCK | `acquisition_and_persistence` | 387,245 à 3676,725 | 435,653 à 4546,814 | 3362,304 / 3887,727 | +15,626876 % | 21,392234 % / 11,256909 % |
| STCK | `persistence` | 13,033 à 378,233 | 14,021 à 497,737 | 318,173 / 465,486 | +46,299766 % | 9,024405 % / 32,267239 % |
| STCK | `restoration` | 1,762 à 53,111 | 2,109 à 161,973 | 45,361 / 137,720 | +203,610462 % | 22,139112 % / 6,752883 % |
| SMLP | `session_elapsed` | 15693,036 à 17345,914 | 15936,838 à 17809,012 | indisponible / indisponible | indisponible | 10,438669 % / 11,316790 % |
| SMLP | `new_decision` | 190,628 à 836,613 | 236,710 à 1015,093 | 820,733 / 920,078 | +12,104449 % | 12,227189 % / 35,788969 % |
| SMLP | `known_prefix_service` | 7,974 à 20,166 | 7,798 à 17,009 | 17,140 / 12,693 | −25,946301 % | 27,186518 % / 16,213890 % |
| SMLP | `known_prefix_request` | 9,885 à 22,607 | 9,799 à 19,264 | 19,500 / 16,282 | −16,503901 % | 25,175857 % / 14,971047 % |
| SMLP | `known_prefix_guard` | 0,187958 à 7,181 | 0,192124 à 0,529422 | 7,142 / 0,494621 | −93,074387 % | 9,444837 % / 40,487966 % |
| SMLP | `acquisition_and_persistence` | 325,263 à 2617,875 | 421,658 à 2668,921 | 2587,631 / 2553,881 | −1,304283 % | 24,148360 % / 14,818947 % |
| SMLP | `persistence` | 14,704 à 278,058 | 12,131 à 291,405 | 239,526 / 243,996 | +1,866408 % | 15,379832 % / 24,556505 % |
| SMLP | `restoration` | 1,949 à 43,682 | 2,028 à 115,658 | 29,460 / 51,715 | +75,542226 % | 42,745997 % / 16,755749 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +54,055399 %**; **STCK `acquisition_and_persistence` +15,626876 %**; **STCK `persistence` +46,299766 %**; **STCK `restoration` +203,610462 %**; **SMLP `new_decision` +12,104449 %**; **SMLP `restoration` +75,542226 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 186,878 / 206,376 | +10,433738 % | 154,668 à 251,947 / 187,114 à 270,960 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 330,392 / 380,866 | +15,277024 % | 281,988 à 511,459 / 351,890 à 458,954 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 209,768 / 263,432 | +25,582711 % | 194,333 à 247,395 / 215,011 à 297,127 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 370,223 / 442,608 | +19,551768 % | 327,935 à 435,895 / 380,162 à 518,879 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 166,276 / 198,282 | +19,248528 % | 158,872 à 224,897 / 181,170 à 242,174 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 298,039 / 366,621 | +23,011087 % | 278,104 à 398,689 / 323,994 à 427,058 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 202,796 / 215,275 | +6,153597 % | 180,805 à 235,672 / 190,649 à 244,124 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 379,497 / 391,763 | +3,232259 % | 316,540 à 408,966 / 350,990 à 436,777 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007151 / 0,013189 | +84,435743 % | 0,006310 à 0,424738 / 0,007361 à 0,040851 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 936,229 / 1017,998 | +8,733896 % | 876,389 à 1016,979 / 920,878 à 1055,236 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,012178 / 0,013104 | +7,603876 % | 0,009675 à 0,020971 / 0,011346 à 0,016574 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 715,479 / 876,406 | +22,492074 % | 664,324 à 840,977 / 848,478 à 914,573 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008432 / 0,007100 | −15,791034 % | 0,003164 à 0,015724 / 0,003746 à 0,017396 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1459,324 / 1517,616 | +3,994471 % | 1384,629 à 1554,314 / 1397,581 à 1541,992 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004872 / 0,007727 | +58,600165 % | 0,004546 à 0,025077 / 0,004106 à 0,020170 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 789,480 / 838,141 | +6,163753 % | 699,477 à 902,339 / 734,474 à 928,962 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,022929 / 0,011477 | −49,945484 % | 0,007341 à 0,044857 / 0,007481 à 0,038877 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 988,197 / 984,649 | −0,359051 % | 918,918 à 1057,846 / 966,381 à 1030,490 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,013680 / 0,014111 | +3,146815 % | 0,010225 à 0,016204 / 0,010285 à 0,017096 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 772,583 / 921,722 | +19,303881 % | 696,636 à 915,903 / 808,567 à 939,793 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012564 / 0,005589 | −55,517969 % | 0,004126 à 0,018758 / 0,002844 à 0,023294 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1486,295 / 1465,966 | −1,367782 % | 1356,180 à 1656,009 / 1285,691 à 1708,772 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005758 / 0,005007 | −13,034040 % | 0,004336 à 0,018847 / 0,003746 à 0,021792 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 685,218 / 742,973 | +8,428705 % | 621,337 à 833,973 / 681,792 à 774,574 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 312,498 | 134,448 à 542,458 |
| 1 | STCK | A | `rss` | 64 | 884,098 | 518,613 à 956,191 |
| 1 | SMLP | A | `heapUsed` | 96 | 287,258 | 116,825 à 639,576 |
| 1 | SMLP | A | `rss` | 96 | 1006,617 | 751,934 à 1077,547 |
| 1 | STCK | B | `heapUsed` | 64 | 279,400 | 102,357 à 555,503 |
| 1 | STCK | B | `rss` | 64 | 972,570 | 558,219 à 998,879 |
| 1 | SMLP | B | `heapUsed` | 96 | 292,296 | 127,725 à 697,902 |
| 1 | SMLP | B | `rss` | 96 | 996,252 | 837,238 à 1136,352 |
| 2 | STCK | A | `heapUsed` | 64 | 282,481 | 139,364 à 514,201 |
| 2 | STCK | A | `rss` | 64 | 850,176 | 520,793 à 936,199 |
| 2 | SMLP | A | `heapUsed` | 96 | 343,971 | 118,443 à 663,658 |
| 2 | SMLP | A | `rss` | 96 | 972,676 | 767,133 à 1102,469 |
| 2 | STCK | B | `heapUsed` | 64 | 295,336 | 142,296 à 597,504 |
| 2 | STCK | B | `rss` | 64 | 936,928 | 543,957 à 1024,949 |
| 2 | SMLP | B | `heapUsed` | 96 | 310,635 | 121,665 à 632,575 |
| 2 | SMLP | B | `rss` | 96 | 1046,871 | 762,367 à 1119,309 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `9dba35881a2ef113bdfb2b7a1477bf0f6514d774f933926a649f844798365651` |
| global-budget-policy.json | `424fc43a38f363a9d8e983b4810bbd23817c80f68b375f53397239dd836aad18` |
| owner-growth-comparison.json | `7340d02ad452a84ebcc24a334670f275d2871c34655225694dced2e100cd56f8` |
| owner-growth-review.json | `5419d66e691fd44a66c6398da917aec12e48fd4f104c79dc5f3041ff7dfebbef` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1555 | 437 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1579 | 435 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1561 | 435 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1572 | 442 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.53.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **6 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de WEAV, des politiques de phase encore partielles ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
