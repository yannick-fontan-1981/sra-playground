# Lot 7B : résultats de coût de native 0.55.0

**Le coût est accepté selon le critère global déclaré : STCK −2,227459 %; SMLP +0,724394 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **16/16**, statut `passed`, avec **0 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 3927/3927 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds Symbols ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

### Lecture des entrées baseline déclarée avant mesure

Les deux outils déclarés avant la fenêtre comprennent le lecteur des chemins absolus de l’attribution. Chaque entrée externe doit correspondre exactement à une empreinte du reçu de capture baseline pré-déclaré ; son chemin réel doit rester dans le checkout gelé lié à la fenêtre. La taille et le SHA-256 sont vérifiés à la lecture puis en fin de calcul. Les lecteurs généraux de rapports restent locaux. Les sorties identifient ces mêmes outils, sans variante de correction après mesure. Les données brutes, les formes attendues, les populations, les calculs et le seuil restent ceux déclarés.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 87 / native 0.54.0 ; commit `dd355400264b50942486559b8ca56ee6dfc6a3cc` ; 286 fichiers natifs | `f25d56d1c63dc929b01bb31b3898b84cecc69e6e412d535c0d122170ea401ce9` |
| B : candidat gelé | Native 0.55.0 ; 291 fichiers natifs ; archive de 302 fichiers | `ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b` |

La [déclaration](declaration.json) finalisée le **2026-11-10 20:19:28 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des transactions symboliques. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 20:32:46 UTC−03** au **2026-11-10 20:41:23 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.54.0 | 2026-11-10 20:32:46 UTC−03 | 2026-11-10 20:34:58 UTC−03 | passed |
| B1 | 0.55.0 | 2026-11-10 20:34:58 UTC−03 | 2026-11-10 20:37:07 UTC−03 | passed |
| B2 | 0.55.0 | 2026-11-10 20:37:07 UTC−03 | 2026-11-10 20:39:16 UTC−03 | passed |
| A2 | 0.54.0 | 2026-11-10 20:39:16 UTC−03 | 2026-11-10 20:41:22 UTC−03 | passed |

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
| STCK | 8 / 8 | 10885,500 | 10643,030 | −2,227459 % | 12,227459 | Accepté |
| SMLP | 8 / 8 | 16007,482 | 16123,439 | +0,724394 % | 9,275606 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10885,500 | 10643,030 | −2,227459 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 345,076 | 342,965 | −0,611803 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,449 | 8,230 | −2,589362 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,093 | 9,867 | −2,237869 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,207201 | 0,211218 | +1,938697 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 844,752 | 832,233 | −1,481961 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 199,428 | 189,076 | −5,191212 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 17,512 | 17,746 | +1,333202 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16007,482 | 16123,439 | +0,724394 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 377,009 | 399,955 | +6,086214 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,334 | 9,440 | +1,138307 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,799 | 11,966 | +1,417022 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,339752 | 0,338425 | −0,390726 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 770,231 | 805,349 | +4,559388 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 147,734 | 148,352 | +0,418328 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 8,185 | 7,414 | −9,424255 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10328,154 à 12162,627 | 10288,780 à 11407,668 | indisponible / indisponible | indisponible | 16,852451 % / 10,512873 % |
| STCK | `new_decision` | 224,003 à 761,937 | 235,736 à 707,709 | 635,688 / 648,429 | +2,004274 % | 29,411857 % / 31,740714 % |
| STCK | `known_prefix_service` | 7,298 à 18,678 | 7,338 à 17,405 | 11,980 / 12,087 | +0,891694 % | 44,291047 % / 36,982032 % |
| STCK | `known_prefix_request` | 8,865 à 20,420 | 8,849 à 19,064 | 14,002 / 13,995 | −0,052791 % | 40,700217 % / 34,177523 % |
| STCK | `known_prefix_guard` | 0,084866 à 1,240 | 0,078507 à 0,367492 | 0,513919 / 0,366201 | −28,743440 % | 52,296362 % / 55,146934 % |
| STCK | `acquisition_and_persistence` | 434,183 à 3841,768 | 442,341 à 3949,487 | 3748,585 / 3770,416 | +0,582376 % | 18,058197 % / 7,664523 % |
| STCK | `persistence` | 15,880 à 673,328 | 14,422 à 654,594 | 490,561 / 494,791 | +0,862108 % | 23,864295 % / 14,026863 % |
| STCK | `restoration` | 2,047 à 220,439 | 2,145 à 199,287 | 143,143 / 139,741 | −2,376710 % | 12,332303 % / 27,760512 % |
| SMLP | `session_elapsed` | 15823,994 à 16432,792 | 15701,993 à 17847,689 | indisponible / indisponible | indisponible | 3,803204 % / 13,307933 % |
| SMLP | `new_decision` | 238,234 à 852,371 | 229,172 à 1133,505 | 798,330 / 764,120 | −4,285166 % | 16,121925 % / 18,049678 % |
| SMLP | `known_prefix_service` | 7,725 à 13,550 | 7,351 à 18,400 | 12,597 / 14,646 | +16,264866 % | 25,181996 % / 40,434561 % |
| SMLP | `known_prefix_request` | 9,726 à 16,075 | 9,222 à 20,799 | 15,559 / 17,052 | +9,593212 % | 20,531949 % / 36,665167 % |
| SMLP | `known_prefix_guard` | 0,192435 à 0,769567 | 0,185334 à 1,073 | 0,581028 / 0,654497 | +12,644657 % | 30,634951 % / 39,222720 % |
| SMLP | `acquisition_and_persistence` | 384,598 à 2891,568 | 385,854 à 3097,709 | 2460,831 / 2781,156 | +13,016930 % | 16,249796 % / 25,409617 % |
| SMLP | `persistence` | 13,584 à 311,804 | 13,419 à 557,550 | 250,918 / 271,917 | +8,368857 % | 12,783957 % / 18,166844 % |
| SMLP | `restoration` | 2,113 à 159,927 | 2,077 à 144,398 | 54,159 / 57,510 | +6,187011 % | 43,708921 % / 29,801467 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_service` +16,264866 %**; **SMLP `known_prefix_guard` +12,644657 %**; **SMLP `acquisition_and_persistence` +13,016930 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 11005,131 / 10554,157 | −4,097849 % | 7/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 16145,849 / 16123,439 | −0,138793 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10711,502 / 10713,763 | +0,021111 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 15903,651 / 16315,927 | +2,592335 % | 7/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 12162,627188 | 2026-11-10 20:32:54 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 11119,594654 | 2026-11-10 20:33:07 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 10890,666533 | 2026-11-10 20:33:20 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 10723,068456 | 2026-11-10 20:33:32 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 16217,731730 | 2026-11-10 20:33:48 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 16204,552683 | 2026-11-10 20:34:06 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 16087,144658 | 2026-11-10 20:34:23 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 15889,088935 | 2026-11-10 20:34:40 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 10288,779652 | 2026-11-10 20:35:03 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 10361,016388 | 2026-11-10 20:35:14 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 10747,297616 | 2026-11-10 20:35:26 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 11407,667835 | 2026-11-10 20:35:38 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 17847,689099 | 2026-11-10 20:35:56 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 16094,191988 | 2026-11-10 20:36:15 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 15957,466241 | 2026-11-10 20:36:32 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 16152,686730 | 2026-11-10 20:36:50 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 10899,609124 | 2026-11-10 20:37:12 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 10538,762269 | 2026-11-10 20:37:24 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 10888,764129 | 2026-11-10 20:37:36 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 10371,598189 | 2026-11-10 20:37:48 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 16032,852722 | 2026-11-10 20:38:05 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16599,001384 | 2026-11-10 20:38:22 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 15701,992566 | 2026-11-10 20:38:40 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 17334,779259 | 2026-11-10 20:38:57 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 10880,333555 | 2026-11-10 20:39:21 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 10900,588900 | 2026-11-10 20:39:33 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 10542,670178 | 2026-11-10 20:39:45 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 10328,153624 | 2026-11-10 20:39:57 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 15927,819448 | 2026-11-10 20:40:14 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 15879,482734 | 2026-11-10 20:40:31 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 16432,791767 | 2026-11-10 20:40:48 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 15823,994493 | 2026-11-10 20:41:05 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11005,131 | 10554,157 | −4,097849 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 371,725 | 339,775 | −8,594928 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,189 | 8,490 | +3,675405 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 9,864 | 10,163 | +3,027118 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,185048 | 0,210242 | +13,614846 % | `over_budget_with_noise_unresolved` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 938,606 | 825,054 | −12,097979 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 210,808 | 191,293 | −9,257072 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,653 | 17,483 | −0,965565 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16145,849 | 16123,439 | −0,138793 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 405,553 | 399,865 | −1,402758 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,134 | 9,589 | +4,983329 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,612 | 12,221 | +5,245271 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,327694 | 0,333662 | +1,821208 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 770,231 | 784,404 | +1,840008 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 146,935 | 147,063 | +0,086987 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,038 | 7,505 | +6,625424 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `known_prefix_guard` +13,614846 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10723,068 à 12162,627 | 10288,780 à 11407,668 | indisponible / indisponible | indisponible | 13,080796 % / 10,601398 % |
| STCK | `new_decision` | 224,003 à 761,937 | 235,736 à 707,709 | 678,886 / 689,840 | +1,613536 % | 21,522161 % / 30,551584 % |
| STCK | `known_prefix_service` | 7,298 à 18,678 | 7,370 à 11,135 | indisponible / indisponible | indisponible | 44,585457 % / 34,983885 % |
| STCK | `known_prefix_request` | 8,865 à 20,420 | 8,959 à 13,139 | indisponible / indisponible | indisponible | 41,223337 % / 33,778026 % |
| STCK | `known_prefix_guard` | 0,084866 à 0,513919 | 0,078507 à 0,336547 | indisponible / indisponible | indisponible | 58,784921 % / 34,121691 % |
| STCK | `acquisition_and_persistence` | 446,728 à 3841,768 | 449,908 à 3949,487 | 3669,406 / 3873,042 | +5,549553 % | 9,630652 % / 6,162361 % |
| STCK | `persistence` | 15,880 à 673,328 | 14,585 à 616,664 | 544,416 / 503,454 | −7,524102 % | 6,464226 % / 10,965503 % |
| STCK | `restoration` | 2,157 à 174,476 | 2,192 à 168,691 | 143,143 / 139,741 | −2,376710 % | 11,614162 % / 7,060183 % |
| SMLP | `session_elapsed` | 15889,089 à 16217,732 | 15957,466 à 17847,689 | indisponible / indisponible | indisponible | 2,035463 % / 11,723447 % |
| SMLP | `new_decision` | 254,061 à 798,330 | 254,946 à 757,624 | 756,482 / 755,322 | −0,153360 % | 3,555464 % / 11,622993 % |
| SMLP | `known_prefix_service` | 7,725 à 13,123 | 7,351 à 18,124 | 10,732 / 14,646 | +36,474983 % | 19,275984 % / 33,939484 % |
| SMLP | `known_prefix_request` | 9,788 à 16,035 | 9,222 à 20,231 | 13,803 / 17,052 | +23,537497 % | 20,520387 % / 31,513820 % |
| SMLP | `known_prefix_guard` | 0,192435 à 0,618333 | 0,188349 à 0,654497 | 0,506818 / 0,526978 | +3,977759 % | 29,403695 % / 35,212097 % |
| SMLP | `acquisition_and_persistence` | 384,598 à 2891,568 | 406,056 à 3097,709 | 2724,904 / 2844,774 | +4,399047 % | 9,546929 % / 10,756549 % |
| SMLP | `persistence` | 13,584 à 311,804 | 13,419 à 530,796 | 275,141 / 280,092 | +1,799644 % | 8,796641 % / 12,112177 % |
| SMLP | `restoration` | 2,135 à 85,427 | 2,077 à 64,481 | 54,283 / 57,510 | +5,943248 % | 13,045851 % / 27,334390 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_service` +36,474983 %**; **SMLP `known_prefix_request` +23,537497 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10711,502 | 10713,763 | +0,021111 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 330,733 | 346,877 | +4,881340 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,733 | 8,128 | −6,930251 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,449 | 9,812 | −6,093628 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,224636 | 0,215969 | −3,858456 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 838,894 | 846,207 | +0,871721 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 183,796 | 189,076 | +2,872631 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,461 | 17,801 | +1,949745 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 15903,651 | 16315,927 | +2,592335 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 357,834 | 411,596 | +15,024264 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,523 | 9,310 | −2,233507 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,863 | 11,677 | −1,565453 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,361299 | 0,338425 | −6,331183 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 777,854 | 827,746 | +6,414051 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 152,836 | 149,147 | −2,413582 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 8,185 | 7,414 | −9,424255 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `new_decision` +15,024264 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10328,154 à 10900,589 | 10371,598 à 10899,609 | indisponible / indisponible | indisponible | 5,344118 % / 4,928342 % |
| STCK | `new_decision` | 233,686 à 635,688 | 240,714 à 648,429 | 607,998 / 622,893 | +2,449848 % | 19,088112 % / 20,659989 % |
| STCK | `known_prefix_service` | 7,449 à 11,980 | 7,338 à 17,405 | indisponible / indisponible | indisponible | 18,523692 % / 12,827944 % |
| STCK | `known_prefix_request` | 9,237 à 13,781 | 8,849 à 19,064 | indisponible / indisponible | indisponible | 17,384337 % / 7,901972 % |
| STCK | `known_prefix_guard` | 0,088772 à 1,240 | 0,082372 à 0,367492 | indisponible / indisponible | indisponible | 20,814917 % / 55,146934 % |
| STCK | `acquisition_and_persistence` | 434,183 à 3759,003 | 442,341 à 3770,416 | 3748,585 / 3630,789 | −3,142424 % | 7,672562 % / 7,458074 % |
| STCK | `persistence` | 15,934 à 637,398 | 14,422 à 654,594 | 461,824 / 494,791 | +7,138337 % | 8,075620 % / 10,765569 % |
| STCK | `restoration` | 2,047 à 220,439 | 2,145 à 199,287 | 133,413 / 139,039 | +4,216834 % | 10,538828 % / 28,288825 % |
| SMLP | `session_elapsed` | 15823,994 à 16432,792 | 15701,993 à 17334,779 | indisponible / indisponible | indisponible | 3,828035 % / 10,007318 % |
| SMLP | `new_decision` | 238,234 à 852,371 | 229,172 à 1133,505 | 822,822 / 968,678 | +17,726267 % | 9,509011 % / 17,303612 % |
| SMLP | `known_prefix_service` | 7,728 à 13,550 | 7,622 à 18,400 | 12,597 / 13,354 | +6,006601 % | 25,181996 % / 30,769395 % |
| SMLP | `known_prefix_request` | 9,726 à 16,075 | 9,634 à 20,799 | 15,559 / 16,413 | +5,484984 % | 19,532946 % / 27,974415 % |
| SMLP | `known_prefix_guard` | 0,230700 à 0,769567 | 0,185334 à 1,073 | 0,581028 / 0,802926 | +38,190586 % | 11,604659 % / 39,264000 % |
| SMLP | `acquisition_and_persistence` | 397,228 à 2460,831 | 385,854 à 2905,428 | 2419,345 / 2588,478 | +6,990870 % | 14,091552 % / 24,720570 % |
| SMLP | `persistence` | 13,617 à 306,721 | 13,874 à 557,550 | 238,524 / 235,702 | −1,182879 % | 12,638654 % / 16,320560 % |
| SMLP | `restoration` | 2,113 à 159,927 | 2,272 à 144,398 | 54,159 / 58,143 | +7,356166 % | 35,932427 % / 8,553833 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `new_decision` +17,726267 %**; **SMLP `known_prefix_guard` +38,190586 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 209,301 / 202,207 | −3,389050 % | 186,113 à 288,999 / 183,918 à 235,135 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 385,973 / 357,069 | −7,488721 % | 323,100 à 466,614 / 317,158 à 399,985 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 211,650 / 219,037 | +3,490137 % | 195,694 à 286,076 / 202,241 à 253,428 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 383,639 / 392,397 | +2,282973 % | 352,061 à 469,681 / 365,450 à 464,396 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 202,130 / 195,976 | −3,044625 % | 181,016 à 280,005 / 184,207 à 264,874 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 360,358 / 360,845 | +0,135107 % | 323,267 à 483,676 / 320,535 à 454,367 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 215,770 / 238,381 | +10,479027 % | 205,611 à 250,789 / 202,855 à 272,375 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 387,406 / 415,573 | +7,270695 % | 356,540 à 413,261 / 346,224 à 452,801 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,028447 / 0,011943 | −58,017400 % | 0,015373 à 0,060699 / 0,007301 à 0,108240 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1054,964 / 961,021 | −8,904884 % | 931,295 à 1679,322 / 860,394 à 1078,516 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,014291 / 0,013565 | −5,076622 % | 0,009484 à 0,017786 / 0,010255 à 0,017005 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 983,218 / 838,150 | −14,754410 % | 849,592 à 1187,255 / 779,382 à 845,632 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007466 / 0,009999 | +33,924864 % | 0,004686 à 0,014221 / 0,003475 à 0,056012 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1327,298 / 1356,782 | +2,221380 % | 1266,579 à 1438,783 / 1324,695 à 1385,618 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005903 / 0,004852 | −17,811468 % | 0,004697 à 0,019860 / 0,004437 à 0,020300 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 718,591 / 784,704 | +9,200368 % | 660,450 à 738,811 / 699,216 à 901,521 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,013665 / 0,009114 | −33,310161 % | 0,013080 à 0,088661 / 0,007301 à 0,043203 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1081,708 / 973,372 | −10,015285 % | 916,409 à 1268,955 / 896,005 à 1108,151 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,027286 / 0,013155 | −51,789412 % | 0,009083 à 0,058998 / 0,010966 à 0,019829 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 869,645 / 879,294 | +1,109488 % | 823,449 à 953,630 / 851,405 à 910,922 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007150 / 0,009569 | +33,822810 % | 0,002594 à 0,015683 / 0,004527 à 0,047380 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1424,016 / 1623,271 | +13,992504 % | 1404,839 à 1584,613 / 1402,961 à 2008,098 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004927 / 0,006039 | +22,559367 % | 0,004386 à 0,022033 / 0,005138 à 0,022493 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 772,327 / 776,638 | +0,558280 % | 664,685 à 860,694 / 733,216 à 1026,155 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 314,951 | 106,798 à 580,611 |
| 1 | STCK | A | `rss` | 64 | 917,904 | 541,777 à 1016,371 |
| 1 | SMLP | A | `heapUsed` | 96 | 313,192 | 122,914 à 687,751 |
| 1 | SMLP | A | `rss` | 96 | 1076,621 | 769,113 à 1159,656 |
| 1 | STCK | B | `heapUsed` | 64 | 293,727 | 103,349 à 517,493 |
| 1 | STCK | B | `rss` | 64 | 952,312 | 547,836 à 991,121 |
| 1 | SMLP | B | `heapUsed` | 96 | 321,448 | 131,818 à 628,364 |
| 1 | SMLP | B | `rss` | 96 | 989,484 | 829,031 à 1119,922 |
| 2 | STCK | A | `heapUsed` | 64 | 292,754 | 99,039 à 532,488 |
| 2 | STCK | A | `rss` | 64 | 894,262 | 547,020 à 1024,461 |
| 2 | SMLP | A | `heapUsed` | 96 | 323,846 | 132,642 à 627,958 |
| 2 | SMLP | A | `rss` | 96 | 1011,762 | 800,766 à 1098,117 |
| 2 | STCK | B | `heapUsed` | 64 | 310,131 | 104,825 à 566,771 |
| 2 | STCK | B | `rss` | 64 | 983,516 | 567,562 à 1069,324 |
| 2 | SMLP | B | `heapUsed` | 96 | 299,918 | 95,863 à 627,422 |
| 2 | SMLP | B | `rss` | 96 | 982,867 | 775,559 à 1092,246 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. Les deux générateurs exécutés sont exactement ceux déclarés avant la fenêtre, avec leur lecteur borné des entrées baseline. Cette provenance ne remplace pas les vérifications chronologiques. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `64c9c29a8909489fca2d618adf36493328698040e29978831772e48423b800db` |
| global-budget-policy.json | `39bf54571a29ac15309470418c2b647cbee74e517a4554b545c99ec60926290f` |
| owner-growth-comparison.json | `943e1738e3a286c470e61193858eb6bc7864f966d884774f555d8372240174cc` |
| owner-growth-review.json | `dbf8d901d4cb681d41fd45d8083836190c8a15026e655bff89c010dff829946e` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1581 | 446 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1573 | 442 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1579 | 437 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1582 | 443 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.55.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **0 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle des transactions symboliques, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
