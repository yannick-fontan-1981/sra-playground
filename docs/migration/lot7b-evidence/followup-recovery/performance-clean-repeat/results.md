# Lot 7B : résultats de coût de native 0.61.0

**Le coût est accepté selon le critère global déclaré : STCK −2,924030 %; SMLP +0,009074 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **14/16**, statut `budget_review_required`, avec **2 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 97 / native 0.60.0 ; commit `98336fba4e696a51c90ff7f7b37b8bdf95f34847` ; 306 fichiers natifs | `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229` |
| B : candidat gelé | Native 0.61.0 ; 306 fichiers natifs ; archive de 317 fichiers | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |

La [déclaration](declaration.json) finalisée le **2026-11-11 12:04:22 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des transactions symboliques. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-11 12:22:07 UTC−03** au **2026-11-11 12:31:04 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.60.0 | 2026-11-11 12:22:07 UTC−03 | 2026-11-11 12:24:24 UTC−03 | passed |
| B1 | 0.61.0 | 2026-11-11 12:24:24 UTC−03 | 2026-11-11 12:26:36 UTC−03 | passed |
| B2 | 0.61.0 | 2026-11-11 12:26:36 UTC−03 | 2026-11-11 12:28:49 UTC−03 | passed |
| A2 | 0.60.0 | 2026-11-11 12:28:49 UTC−03 | 2026-11-11 12:31:04 UTC−03 | passed |

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
| Revue statique | 54/54 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 11303,262 | 10972,751 | −2,924030 % | 12,924030 | Accepté |
| SMLP | 8 / 8 | 16919,639 | 16921,174 | +0,009074 % | 9,990926 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 11303,262 | 10972,751 | −2,924030 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 353,392 | 353,608 | +0,061020 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,673 | 7,949 | −8,353506 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,472 | 9,803 | −6,382708 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,217068 | 0,203321 | −6,332808 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 871,603 | 860,347 | −1,291495 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 201,172 | 186,249 | −7,418012 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 19,405 | 23,166 | +19,386244 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 8 / 8 | 16919,639 | 16921,174 | +0,009074 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 408,363 | 404,471 | −0,952995 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,451 | 9,349 | −1,079829 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,976 | 12,083 | +0,894445 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,368903 | 0,326458 | −11,505615 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 825,177 | 818,020 | −0,867278 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 147,620 | 157,795 | +6,892473 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 8,156 | 9,569 | +17,331942 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +19,386244 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +17,331942 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10926,966 à 12588,581 | 10410,677 à 11335,612 | indisponible / indisponible | indisponible | 14,700312 % / 8,429384 % |
| STCK | `new_decision` | 221,855 à 824,592 | 236,456 à 854,780 | 687,222 / 615,315 | −10,463460 % | 51,568232 % / 22,716077 % |
| STCK | `known_prefix_service` | 7,062 à 22,693 | 6,925 à 15,699 | 17,427 / 11,576 | −33,574819 % | 51,140936 % / 14,358629 % |
| STCK | `known_prefix_request` | 8,643 à 24,581 | 8,422 à 17,790 | 19,044 / 13,656 | −28,294167 % | 45,858103 % / 13,805215 % |
| STCK | `known_prefix_guard` | 0,074833 à 0,400355 | 0,077106 à 0,380505 | 0,329397 / 0,323960 | −1,650592 % | 64,928642 % / 42,381731 % |
| STCK | `acquisition_and_persistence` | 421,979 à 4279,060 | 417,932 à 3859,326 | 4020,986 / 3816,717 | −5,080052 % | 26,095559 % / 9,106159 % |
| STCK | `persistence` | 14,356 à 563,176 | 15,096 à 552,404 | 491,776 / 480,446 | −2,303997 % | 29,876706 % / 25,864895 % |
| STCK | `restoration` | 2,179 à 203,523 | 2,273 à 193,672 | 163,101 / 150,470 | −7,744332 % | 22,423433 % / 39,954013 % |
| SMLP | `session_elapsed` | 16430,303 à 18211,456 | 16031,505 à 17826,746 | indisponible / indisponible | indisponible | 10,527136 % / 10,609436 % |
| SMLP | `new_decision` | 233,638 à 1131,006 | 235,456 à 1016,503 | 857,224 / 820,572 | −4,275624 % | 26,332353 % / 22,612173 % |
| SMLP | `known_prefix_service` | 7,699 à 101,412 | 7,303 à 21,585 | 17,321 / 15,466 | −10,705128 % | 45,086082 % / 22,177528 % |
| SMLP | `known_prefix_request` | 9,940 à 111,153 | 9,402 à 24,644 | 21,527 / 17,828 | −17,185950 % | 36,819089 % / 16,394519 % |
| SMLP | `known_prefix_guard` | 0,192301 à 2,305 | 0,190968 à 10,006 | 1,016 / 0,677643 | −33,308499 % | 118,368173 % / 41,189239 % |
| SMLP | `acquisition_and_persistence` | 363,283 à 3109,187 | 380,560 à 3029,582 | 2951,546 / 2778,087 | −5,876881 % | 23,854538 % / 16,794822 % |
| SMLP | `persistence` | 12,929 à 648,986 | 12,465 à 511,289 | 320,705 / 252,015 | −21,418375 % | 15,877372 % / 12,499169 % |
| SMLP | `restoration` | 2,128 à 113,530 | 2,189 à 108,676 | 54,945 / 50,797 | −7,548329 % | 22,307698 % / 53,634914 % |

Aucune hausse de p95 calculable supérieure à +10 % dans cet ensemble ; les p95 indisponibles restent signalés.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 11468,169 / 10693,555 | −6,754464 % | 7/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 16788,470 / 16640,849 | −0,879300 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 11189,275 / 11192,042 | +0,024737 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 17095,192 / 16969,799 | −0,733503 % | 7/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 10926,966081 | 2026-11-11 12:22:14 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 11218,015155 | 2026-11-11 12:22:26 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 11718,321874 | 2026-11-11 12:22:39 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 12588,580918 | 2026-11-11 12:22:52 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 16878,592927 | 2026-11-11 12:23:10 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 16698,347120 | 2026-11-11 12:23:29 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 17904,207443 | 2026-11-11 12:23:47 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 16630,312104 | 2026-11-11 12:24:06 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 10631,282923 | 2026-11-11 12:24:30 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 10410,676618 | 2026-11-11 12:24:42 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 11280,448760 | 2026-11-11 12:24:54 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 10755,827560 | 2026-11-11 12:25:06 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 16402,471208 | 2026-11-11 12:25:23 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 16031,504554 | 2026-11-11 12:25:41 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 16879,226702 | 2026-11-11 12:25:58 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 17826,745755 | 2026-11-11 12:26:16 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 10750,476349 | 2026-11-11 12:26:41 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 11335,612001 | 2026-11-11 12:26:54 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 11194,409495 | 2026-11-11 12:27:06 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 11189,675289 | 2026-11-11 12:27:18 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 16477,051652 | 2026-11-11 12:27:36 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16963,122294 | 2026-11-11 12:27:54 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 16976,475287 | 2026-11-11 12:28:12 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 17050,897223 | 2026-11-11 12:28:30 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 10984,811090 | 2026-11-11 12:28:54 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 11442,314681 | 2026-11-11 12:29:06 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 11388,509249 | 2026-11-11 12:29:19 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 10990,039769 | 2026-11-11 12:29:32 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 18211,456392 | 2026-11-11 12:29:50 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 16960,685528 | 2026-11-11 12:30:10 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 17229,699413 | 2026-11-11 12:30:28 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 16430,303024 | 2026-11-11 12:30:46 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11468,169 | 10693,555 | −6,754464 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 400,091 | 328,188 | −17,971862 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,771 | 7,998 | −8,814868 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,492 | 9,745 | −7,122656 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,223272 | 0,222527 | −0,334121 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 867,888 | 846,326 | −2,484445 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 206,452 | 186,249 | −9,786108 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 19,405 | 23,166 | +19,386244 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 16788,470 | 16640,849 | −0,879300 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 431,893 | 414,745 | −3,970607 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,895 | 9,763 | −1,324535 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,287 | 12,255 | −0,258947 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,377431 | 0,338582 | −10,293021 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 845,644 | 809,800 | −4,238705 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 153,699 | 158,267 | +2,972034 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,167 | 8,625 | +20,346903 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +19,386244 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +20,346903 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10926,966 à 12588,581 | 10410,677 à 11280,449 | indisponible / indisponible | indisponible | 14,488929 % / 8,133611 % |
| STCK | `new_decision` | 234,704 à 824,592 | 238,424 à 615,315 | 785,504 / 594,943 | −24,259636 % | 38,312730 % / 24,747676 % |
| STCK | `known_prefix_service` | 7,062 à 22,693 | 6,963 à 11,576 | indisponible / indisponible | indisponible | 41,229537 % / 9,231249 % |
| STCK | `known_prefix_request` | 8,643 à 24,581 | 8,667 à 13,656 | indisponible / indisponible | indisponible | 37,030891 % / 8,081664 % |
| STCK | `known_prefix_guard` | 0,089255 à 0,300133 | 0,082094 à 0,323960 | indisponible / indisponible | indisponible | 37,449501 % / 36,873427 % |
| STCK | `acquisition_and_persistence` | 456,996 à 4138,451 | 433,863 à 3859,326 | 4020,986 / 3758,747 | −6,521762 % | 25,562960 % / 4,129132 % |
| STCK | `persistence` | 14,356 à 563,176 | 15,096 à 552,404 | 547,803 / 474,727 | −13,339697 % | 18,534970 % / 14,116201 % |
| STCK | `restoration` | 2,332 à 203,523 | 2,348 à 157,324 | 183,134 / 149,377 | −18,432653 % | 16,417752 % / 40,294827 % |
| SMLP | `session_elapsed` | 16630,312 à 17904,207 | 16031,505 à 17826,746 | indisponible / indisponible | indisponible | 7,587918 % / 10,788159 % |
| SMLP | `new_decision` | 246,945 à 1131,006 | 235,456 à 1016,503 | 791,972 / 761,274 | −3,876162 % | 19,914972 % / 18,663717 % |
| SMLP | `known_prefix_service` | 8,214 à 36,152 | 7,303 à 21,585 | 17,321 / 15,481 | −10,622624 % | 26,621641 % / 16,580677 % |
| SMLP | `known_prefix_request` | 10,176 à 47,683 | 9,402 à 24,644 | 21,527 / 18,125 | −15,806367 % | 21,092665 % / 15,727757 % |
| SMLP | `known_prefix_guard` | 0,193593 à 2,186 | 0,190968 à 10,006 | 1,016 / 6,319 | +521,871279 % | 94,077442 % / 33,981687 % |
| SMLP | `acquisition_and_persistence` | 452,743 à 3105,826 | 380,560 à 2853,358 | 2956,481 / 2778,087 | −6,033989 % | 13,824997 % / 11,000880 % |
| SMLP | `persistence` | 13,235 à 648,986 | 12,465 à 511,289 | 259,289 / 284,948 | +9,895972 % | 11,662232 % / 12,153644 % |
| SMLP | `restoration` | 2,502 à 113,530 | 2,201 à 108,676 | 62,814 / 54,535 | −13,180151 % | 10,678789 % / 26,417550 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_guard` +521,871279 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11189,275 | 11192,042 | +0,024737 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 336,482 | 362,121 | +7,619602 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,471 | 7,913 | −6,589452 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,152 | 9,924 | −2,245704 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,208951 | 0,198616 | −4,946375 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 895,707 | 894,745 | −0,107401 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 191,699 | 186,658 | −2,629950 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,403 | 18,847 | +8,296523 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17095,192 | 16969,799 | −0,733503 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 386,889 | 391,668 | +1,235207 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 8,936 | 9,198 | +2,935852 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,455 | 11,728 | +2,376931 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,328941 | 0,326458 | −0,754847 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 799,767 | 828,212 | +3,556685 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 146,661 | 156,936 | +7,006085 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 8,156 | 10,775 | +32,116928 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +32,116928 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10984,811 à 11442,315 | 10750,476 à 11335,612 | indisponible / indisponible | indisponible | 4,088769 % / 5,228140 % |
| STCK | `new_decision` | 221,855 à 687,222 | 236,456 à 854,780 | 672,317 / 763,911 | +13,623690 % | 18,052620 % / 6,829718 % |
| STCK | `known_prefix_service` | 7,390 à 17,427 | 6,925 à 15,699 | indisponible / indisponible | indisponible | 40,932602 % / 14,238184 % |
| STCK | `known_prefix_request` | 8,996 à 19,044 | 8,422 à 17,790 | indisponible / indisponible | indisponible | 37,655107 % / 13,626938 % |
| STCK | `known_prefix_guard` | 0,074833 à 0,400355 | 0,077106 à 0,380505 | indisponible / indisponible | indisponible | 65,019822 % / 18,273235 % |
| STCK | `acquisition_and_persistence` | 421,979 à 4279,060 | 417,932 à 3827,724 | 3829,412 / 3816,717 | −0,331499 % | 8,089537 % / 4,725736 % |
| STCK | `persistence` | 16,859 à 536,394 | 15,417 à 536,228 | 456,976 / 504,314 | +10,359066 % | 26,630077 % / 22,767595 % |
| STCK | `restoration` | 2,179 à 166,555 | 2,273 à 193,672 | 151,829 / 150,470 | −0,895537 % | 8,225479 % / 16,099549 % |
| SMLP | `session_elapsed` | 16430,303 à 18211,456 | 16477,052 à 17050,897 | indisponible / indisponible | indisponible | 10,419031 % / 3,381570 % |
| SMLP | `new_decision` | 233,638 à 989,032 | 249,521 à 988,037 | 955,847 / 871,905 | −8,781935 % | 11,092935 % / 22,160415 % |
| SMLP | `known_prefix_service` | 7,699 à 101,412 | 8,113 à 12,865 | 13,820 / 11,843 | −14,305074 % | 48,523849 % / 11,359688 % |
| SMLP | `known_prefix_request` | 9,940 à 111,153 | 9,991 à 15,522 | 17,127 / 14,695 | −14,194778 % | 39,553536 % / 8,631893 % |
| SMLP | `known_prefix_guard` | 0,192301 à 2,305 | 0,198810 à 0,582951 | 0,607317 / 0,471022 | −22,442151 % | 58,858833 % / 19,847906 % |
| SMLP | `acquisition_and_persistence` | 363,283 à 3109,187 | 386,771 à 3029,582 | 2951,546 / 2829,278 | −4,142520 % | 16,795632 % / 11,958668 % |
| SMLP | `persistence` | 12,929 à 602,149 | 13,510 à 271,298 | 321,369 / 238,073 | −25,919223 % | 15,884793 % / 11,206764 % |
| SMLP | `restoration` | 2,128 à 105,093 | 2,189 à 58,857 | 54,945 / 50,444 | −8,191877 % | 22,814698 % / 44,995691 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +13,623690 %**; **STCK `persistence` +10,359066 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 203,174 / 208,126 | +2,437798 % | 181,739 à 313,447 / 182,354 à 284,459 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 393,062 / 397,954 | +1,244568 % | 332,112 à 542,012 / 326,954 à 560,175 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 244,081 / 213,085 | −12,699056 % | 209,606 à 329,018 / 195,660 à 317,811 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 418,243 / 374,323 | −10,501207 % | 369,799 à 541,578 / 347,263 à 534,425 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 215,594 / 214,762 | −0,386115 % | 184,421 à 273,850 / 179,830 à 270,080 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 393,212 / 394,162 | +0,241623 % | 342,579 à 508,115 / 335,186 à 489,274 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 232,268 / 219,882 | −5,332249 % | 201,395 à 290,529 / 204,267 à 302,538 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 402,083 / 385,664 | −4,083279 % | 347,251 à 497,210 / 351,027 à 481,068 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012303 / 0,011086 | −9,891494 % | 0,011507 à 0,043926 / 0,008162 à 0,407577 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1214,792 / 1107,199 | −8,856963 % | 1014,466 à 1354,825 / 911,368 à 1227,521 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,012850 / 0,013065 | +1,677108 % | 0,009133 à 0,019860 / 0,010466 à 0,017367 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 901,295 / 843,005 | −6,467391 % | 834,823 à 1244,155 / 806,833 à 975,568 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008944 / 0,008322 | −6,943590 % | 0,005217 à 0,014933 / 0,003475 à 0,015003 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1449,489 / 1373,052 | −5,273369 % | 1379,154 à 1570,350 / 1277,488 à 1961,868 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004873 / 0,006846 | +40,492560 % | 0,003976 à 0,017266 / 0,006020 à 0,034432 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 757,970 / 745,319 | −1,669083 % | 669,174 à 816,108 / 704,960 à 825,229 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008527 / 0,015733 | +84,503078 % | 0,007020 à 0,036365 / 0,006671 à 0,060402 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1110,172 / 1254,201 | +12,973580 % | 1021,227 à 1210,787 / 1216,247 à 1330,865 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,012709 / 0,012885 | +1,376923 % | 0,010045 à 0,019930 / 0,009324 à 0,017407 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 890,120 / 882,794 | −0,823064 % | 852,871 à 942,040 / 812,689 à 983,519 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008793 / 0,007581 | −13,788594 % | 0,002423 à 0,017356 / 0,002704 à 0,037607 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1562,708 / 1579,778 | +1,092283 % | 1390,273 à 1648,839 / 1391,466 à 1677,572 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,006139 / 0,004728 | −22,992344 % | 0,005218 à 0,024167 / 0,003456 à 0,016705 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 744,162 / 766,679 | +3,025812 % | 669,400 à 858,510 / 709,491 à 876,596 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 273,020 | 109,157 à 567,571 |
| 1 | STCK | A | `rss` | 64 | 944,312 | 553,430 à 1016,125 |
| 1 | SMLP | A | `heapUsed` | 96 | 315,782 | 133,617 à 642,262 |
| 1 | SMLP | A | `rss` | 96 | 981,619 | 822,734 à 1089,742 |
| 1 | STCK | B | `heapUsed` | 64 | 293,711 | 106,585 à 532,507 |
| 1 | STCK | B | `rss` | 64 | 934,262 | 562,910 à 1039,734 |
| 1 | SMLP | B | `heapUsed` | 96 | 317,401 | 97,707 à 642,114 |
| 1 | SMLP | B | `rss` | 96 | 1013,453 | 803,020 à 1078,719 |
| 2 | STCK | A | `heapUsed` | 64 | 303,196 | 132,458 à 530,885 |
| 2 | STCK | A | `rss` | 64 | 963,713 | 532,082 à 1045,777 |
| 2 | SMLP | A | `heapUsed` | 96 | 280,298 | 115,444 à 553,080 |
| 2 | SMLP | A | `rss` | 96 | 1009,053 | 867,570 à 1093,797 |
| 2 | STCK | B | `heapUsed` | 64 | 275,088 | 100,771 à 581,089 |
| 2 | STCK | B | `rss` | 64 | 935,336 | 551,793 à 1040,680 |
| 2 | SMLP | B | `heapUsed` | 96 | 294,528 | 112,298 à 556,130 |
| 2 | SMLP | B | `rss` | 96 | 986,369 | 839,594 à 1092,891 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `727a4956837421892edfd1f04c649cef4004d0128d056150b3cbd560735e3132` |
| global-budget-policy.json | `1b1115a4789e60b481843d57fd0afa240c6c9ae81e4619d04248f025f43e4fb8` |
| combined-comparison.json | `813b57946f57508bf3dcf373611823722fc638d4af98f7340aa0ab2b34346dfc` |
| consolidation-review.json | `7ec48a45f97707855a1d122991038ae9d3498cb4794da8e25726be76cc46748e` |
| global-budget-decision.json | `83d8f9d82e24e6652176d193b4ce0e53730d8f5b30b1896fa9e373f057d198d8` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1613 | 469 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1592 | 459 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1599 | 460 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1607 | 466 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.61.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **2 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle des transactions symboliques, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
