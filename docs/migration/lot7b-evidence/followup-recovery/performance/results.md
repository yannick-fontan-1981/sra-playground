# Lot 7B : résultats de coût de native 0.61.0

**Le coût est accepté selon le critère global déclaré : STCK +5,918585 %; SMLP +1,304421 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **16/16**, statut `passed`, avec **0 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 97 / native 0.60.0 ; commit `98336fba4e696a51c90ff7f7b37b8bdf95f34847` ; 306 fichiers natifs | `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229` |
| B : candidat gelé | Native 0.61.0 ; 306 fichiers natifs ; archive de 317 fichiers | `f8d5097ab63a1c7464479afc5772724ee26578916a4f22a643a5f08f65c27279` |

La [déclaration](declaration.json) finalisée le **2026-11-11 10:53:17 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des transactions symboliques. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-11 11:17:29 UTC−03** au **2026-11-11 11:26:42 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.60.0 | 2026-11-11 11:17:29 UTC−03 | 2026-11-11 11:19:52 UTC−03 | passed |
| B1 | 0.61.0 | 2026-11-11 11:19:52 UTC−03 | 2026-11-11 11:22:11 UTC−03 | passed |
| B2 | 0.61.0 | 2026-11-11 11:22:11 UTC−03 | 2026-11-11 11:24:30 UTC−03 | passed |
| A2 | 0.60.0 | 2026-11-11 11:24:30 UTC−03 | 2026-11-11 11:26:42 UTC−03 | passed |

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
| STCK | 8 / 8 | 11263,783 | 11930,440 | +5,918585 % | 4,081415 | Accepté |
| SMLP | 8 / 8 | 17008,792 | 17230,659 | +1,304421 % | 8,695579 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 11263,783 | 11930,440 | +5,918585 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 360,938 | 364,857 | +1,085702 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 9,676 | 8,918 | −7,838056 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 11,423 | 10,637 | −6,878687 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,243813 | 0,219902 | −9,807311 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 895,031 | 918,539 | +2,626589 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 203,630 | 205,636 | +0,985200 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 26,632 | 29,103 | +9,279056 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 17008,792 | 17230,659 | +1,304421 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 420,006 | 414,340 | −1,349114 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,475 | 9,643 | +1,772236 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,840 | 12,353 | +4,332727 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,352271 | 0,348210 | −1,152946 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 813,502 | 843,507 | +3,688331 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 155,672 | 155,032 | −0,411736 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 9,133 | 9,302 | +1,846655 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10859,376 à 12283,400 | 10580,664 à 12785,569 | indisponible / indisponible | indisponible | 12,642501 % / 18,481342 % |
| STCK | `new_decision` | 229,589 à 831,680 | 245,812 à 823,588 | 787,176 / 765,456 | −2,759262 % | 18,536916 % / 40,769053 % |
| STCK | `known_prefix_service` | 7,279 à 28,738 | 6,925 à 15,822 | 25,315 / 13,579 | −46,358627 % | 91,126792 % / 45,090597 % |
| STCK | `known_prefix_request` | 9,211 à 33,028 | 8,373 à 17,928 | 27,314 / 17,558 | −35,717237 % | 70,127040 % / 46,800762 % |
| STCK | `known_prefix_guard` | 0,084848 à 8,915 | 0,078188 à 7,871 | 0,996112 / 1,084 | +8,812563 % | 63,652427 % / 42,040603 % |
| STCK | `acquisition_and_persistence` | 460,660 à 4291,509 | 417,757 à 4501,744 | 4016,162 / 4273,877 | +6,416943 % | 22,702311 % / 22,772623 % |
| STCK | `persistence` | 16,463 à 555,163 | 14,202 à 670,358 | 486,571 / 504,747 | +3,735575 % | 29,592337 % / 58,357268 % |
| STCK | `restoration` | 2,244 à 186,686 | 2,309 à 241,666 | 142,499 / 164,739 | +15,606740 % | 62,105543 % / 87,725322 % |
| SMLP | `session_elapsed` | 16387,387 à 18175,158 | 15962,618 à 18405,754 | indisponible / indisponible | indisponible | 10,510865 % / 14,179003 % |
| SMLP | `new_decision` | 235,821 à 940,386 | 229,943 à 1046,959 | 767,796 / 852,939 | +11,089284 % | 40,323515 % / 28,369069 % |
| SMLP | `known_prefix_service` | 6,644 à 26,434 | 7,507 à 17,544 | 21,209 / 16,202 | −23,611647 % | 43,182448 % / 32,309073 % |
| SMLP | `known_prefix_request` | 8,619 à 29,072 | 9,368 à 19,834 | 28,361 / 18,417 | −35,060414 % | 41,333487 % / 27,669426 % |
| SMLP | `known_prefix_guard` | 0,184789 à 1,113 | 0,189085 à 7,961 | 0,647998 / 0,742930 | +14,650045 % | 44,466674 % / 62,176055 % |
| SMLP | `acquisition_and_persistence` | 384,365 à 3835,937 | 393,746 à 3089,926 | 2969,057 / 2860,502 | −3,656213 % | 21,884740 % / 29,709719 % |
| SMLP | `persistence` | 13,181 à 326,267 | 12,307 à 346,300 | 256,887 / 251,415 | −2,130055 % | 21,877711 % / 10,834583 % |
| SMLP | `restoration` | 2,144 à 64,387 | 2,123 à 107,685 | 51,324 / 50,187 | −2,215285 % | 23,807754 % / 50,994284 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +15,606740 %**; **SMLP `new_decision` +11,089284 %**; **SMLP `known_prefix_guard` +14,650045 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 12180,473 / 12351,726 | +1,405959 % | 8/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17947,015 / 17391,053 | −3,097797 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 11077,336 / 11681,919 | +5,457841 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16543,959 / 17179,216 | +3,839813 % | 5/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 12201,516187 | 2026-11-11 11:17:36 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 12283,400373 | 2026-11-11 11:17:50 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 10998,505511 | 2026-11-11 11:18:04 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 12159,430780 | 2026-11-11 11:18:16 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 18081,937082 | 2026-11-11 11:18:35 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 18175,157917 | 2026-11-11 11:18:55 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 17812,093014 | 2026-11-11 11:19:14 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 17056,163705 | 2026-11-11 11:19:33 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 10887,144316 | 2026-11-11 11:19:58 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 12542,080009 | 2026-11-11 11:20:10 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 12161,371919 | 2026-11-11 11:20:24 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 12785,569424 | 2026-11-11 11:20:37 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 17595,036889 | 2026-11-11 11:20:57 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 17856,132253 | 2026-11-11 11:21:16 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 15962,618245 | 2026-11-11 11:21:35 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 17187,069062 | 2026-11-11 11:21:52 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 11699,507771 | 2026-11-11 11:22:17 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 12436,606069 | 2026-11-11 11:22:30 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 10580,664059 | 2026-11-11 11:22:43 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 11664,330160 | 2026-11-11 11:22:55 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 17274,248251 | 2026-11-11 11:23:15 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 17084,183294 | 2026-11-11 11:23:33 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 17003,936151 | 2026-11-11 11:23:52 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 18405,753906 | 2026-11-11 11:24:10 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 11437,351136 | 2026-11-11 11:24:36 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 11064,455823 | 2026-11-11 11:24:49 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 10859,376414 | 2026-11-11 11:25:01 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 11090,215395 | 2026-11-11 11:25:13 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 16387,386782 | 2026-11-11 11:25:30 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 16961,421023 | 2026-11-11 11:25:48 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 16633,251838 | 2026-11-11 11:26:06 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 16454,665466 | 2026-11-11 11:26:24 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 12180,473 | 12351,726 | +1,405959 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 366,649 | 372,859 | +1,693721 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,793 | 9,091 | +3,385650 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,702 | 11,018 | +2,950061 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,232791 | 0,219902 | −5,537144 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 938,573 | 929,600 | −0,955942 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 206,852 | 220,582 | +6,637353 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 26,890 | 18,425 | −31,479149 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17947,015 | 17391,053 | −3,097797 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 420,006 | 417,079 | −0,696833 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,859 | 8,904 | −9,693524 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,494 | 11,254 | −9,924736 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,355786 | 0,294214 | −17,306165 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 833,272 | 802,045 | −3,747535 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 159,496 | 155,923 | −2,240134 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 8,200 | 9,259 | +12,905976 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +12,905976 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10998,506 à 12283,400 | 10887,144 à 12785,569 | indisponible / indisponible | indisponible | 10,548809 % / 15,369715 % |
| STCK | `new_decision` | 243,998 à 831,680 | 250,198 à 809,735 | 798,081 / 765,456 | −4,087906 % | 18,359190 % / 38,644096 % |
| STCK | `known_prefix_service` | 7,279 à 16,949 | 7,737 à 13,579 | indisponible / indisponible | indisponible | 37,831154 % / 24,818526 % |
| STCK | `known_prefix_request` | 9,211 à 19,007 | 9,878 à 17,928 | indisponible / indisponible | indisponible | 33,838211 % / 27,591923 % |
| STCK | `known_prefix_guard` | 0,084848 à 8,915 | 0,096836 à 1,084 | indisponible / indisponible | indisponible | 62,170981 % / 30,370366 % |
| STCK | `acquisition_and_persistence` | 472,948 à 4291,509 | 482,490 à 4501,744 | 4016,162 / 4160,466 | +3,593079 % | 20,760347 % / 20,565704 % |
| STCK | `persistence` | 16,463 à 548,498 | 14,202 à 670,358 | 490,730 / 561,326 | +14,385949 % | 28,558983 % / 48,163579 % |
| STCK | `restoration` | 2,272 à 165,618 | 2,385 à 200,566 | 133,227 / 153,696 | +15,364470 % | 56,399340 % / 12,343267 % |
| SMLP | `session_elapsed` | 17056,164 à 18175,158 | 15962,618 à 17856,132 | indisponible / indisponible | indisponible | 6,234988 % / 10,887863 % |
| SMLP | `new_decision` | 235,821 à 940,386 | 229,943 à 1046,959 | 907,990 / 830,392 | −8,546134 % | 26,112004 % / 27,383039 % |
| SMLP | `known_prefix_service` | 6,644 à 22,578 | 7,811 à 16,430 | 21,209 / 16,202 | −23,611647 % | 38,955349 % / 19,809509 % |
| SMLP | `known_prefix_request` | 8,619 à 28,681 | 9,772 à 18,888 | 28,361 / 18,417 | −35,060414 % | 37,817343 % / 15,392510 % |
| SMLP | `known_prefix_guard` | 0,190007 à 1,113 | 0,189085 à 7,961 | 0,502448 / 0,988701 | +96,776781 % | 20,937532 % / 68,015250 % |
| SMLP | `acquisition_and_persistence` | 399,107 à 3835,937 | 417,835 à 3089,926 | 3009,707 / 3007,045 | −0,088445 % | 15,557929 % / 13,034467 % |
| SMLP | `persistence` | 13,181 à 326,267 | 12,307 à 346,300 | 272,777 / 244,663 | −10,306393 % | 20,911421 % / 10,834583 % |
| SMLP | `restoration` | 2,144 à 64,387 | 2,579 à 60,347 | 52,656 / 46,816 | −11,091689 % | 10,942042 % / 53,222536 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `persistence` +14,385949 %**; **STCK `restoration` +15,364470 %**; **SMLP `known_prefix_guard` +96,776781 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11077,336 | 11681,919 | +5,457841 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 348,139 | 341,030 | −2,041887 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 10,175 | 8,308 | −18,341715 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 12,696 | 10,015 | −21,121053 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,246792 | 0,218239 | −11,569662 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 881,407 | 899,589 | +2,062868 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 193,757 | 195,004 | +0,643546 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 21,013 | 31,582 | +50,299402 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 16543,959 | 17179,216 | +3,839813 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 409,332 | 414,340 | +1,223509 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 8,873 | 10,488 | +18,203364 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,451 | 12,745 | +11,296129 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,326968 | 0,356368 | +8,991386 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 793,014 | 901,646 | +13,698573 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 76 / 76 | 155,169 | 152,502 | −1,718456 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 9,133 | 9,302 | +1,846655 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +50,299402 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +18,203364 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_request` +11,296129 %** (`over_budget_with_noise_unresolved`); **SMLP `acquisition_and_persistence` +13,698573 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10859,376 à 11437,351 | 10580,664 à 12436,606 | indisponible / indisponible | indisponible | 5,217633 % / 15,887304 % |
| STCK | `new_decision` | 229,589 à 787,176 | 245,812 à 823,588 | 637,490 / 717,502 | +12,551127 % | 16,490852 % / 32,254496 % |
| STCK | `known_prefix_service` | 7,994 à 28,738 | 6,925 à 15,822 | indisponible / indisponible | indisponible | 76,893237 % / 38,156951 % |
| STCK | `known_prefix_request` | 9,698 à 33,028 | 8,373 à 17,558 | indisponible / indisponible | indisponible | 62,917234 % / 39,295398 % |
| STCK | `known_prefix_guard` | 0,098368 à 0,996112 | 0,078188 à 7,871 | indisponible / indisponible | indisponible | 27,676734 % / 42,191428 % |
| STCK | `acquisition_and_persistence` | 460,660 à 4138,449 | 417,757 à 4359,058 | 3682,172 / 4273,877 | +16,069446 % | 15,941673 % / 21,005994 % |
| STCK | `persistence` | 16,494 à 555,163 | 14,604 à 581,913 | 459,485 / 478,023 | +4,034507 % | 26,220750 % / 18,781913 % |
| STCK | `restoration` | 2,244 à 186,686 | 2,309 à 241,666 | 142,499 / 164,739 | +15,606740 % | 44,285964 % / 84,527897 % |
| SMLP | `session_elapsed` | 16387,387 à 16961,421 | 17003,936 à 18405,754 | indisponible / indisponible | indisponible | 3,469751 % / 8,159964 % |
| SMLP | `new_decision` | 251,713 à 765,094 | 248,622 à 936,568 | 731,426 / 862,096 | +17,865187 % | 29,917417 % / 16,683316 % |
| SMLP | `known_prefix_service` | 7,021 à 26,434 | 7,507 à 17,544 | 12,823 / 13,723 | +7,013086 % | 26,083570 % / 24,418087 % |
| SMLP | `known_prefix_request` | 8,926 à 29,072 | 9,368 à 19,834 | 15,914 / 16,651 | +4,632029 % | 25,970919 % / 17,534793 % |
| SMLP | `known_prefix_guard` | 0,184789 à 0,780860 | 0,200722 à 0,742930 | 0,647998 / 0,577261 | −10,916237 % | 44,466674 % / 30,401298 % |
| SMLP | `acquisition_and_persistence` | 384,365 à 2984,422 | 393,746 à 2873,286 | 2844,773 / 2756,375 | −3,107371 % | 22,450144 % / 27,143594 % |
| SMLP | `persistence` | 18,634 à 273,550 | 12,406 à 302,258 | 252,841 / 254,906 | +0,816583 % | 6,036769 % / 5,752626 % |
| SMLP | `restoration` | 2,156 à 63,148 | 2,123 à 107,685 | 51,038 / 57,697 | +13,046416 % | 14,818511 % / 36,517206 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +12,551127 %**; **STCK `acquisition_and_persistence` +16,069446 %**; **STCK `restoration` +15,606740 %**; **SMLP `new_decision` +17,865187 %**; **SMLP `restoration` +13,046416 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 223,309 / 231,319 | +3,587123 % | 194,703 à 360,744 / 198,637 à 394,046 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 408,757 / 425,696 | +4,143836 % | 347,879 à 630,599 / 375,290 à 597,238 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 246,383 / 231,657 | −5,976927 % | 204,363 à 356,970 / 203,647 à 375,495 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 454,045 / 419,700 | −7,564301 % | 357,411 à 604,389 / 344,404 à 556,440 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 212,511 / 217,587 | +2,388702 % | 188,290 à 288,222 / 195,136 à 323,065 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 409,454 / 425,943 | +4,027056 % | 354,188 à 492,256 / 371,704 à 577,577 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 232,698 / 234,809 | +0,907107 % | 208,384 à 273,299 / 203,851 à 313,954 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 404,250 / 425,696 | +5,305069 % | 355,421 à 510,615 / 370,194 à 545,246 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,009365 / 0,011052 | +18,020183 % | 0,005449 à 0,213052 / 0,007862 à 0,038228 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1188,801 / 1081,737 | −9,006089 % | 1066,909 à 1342,140 / 968,567 à 1271,843 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,016680 / 0,013120 | −21,345283 % | 0,013250 à 0,032969 / 0,010246 à 0,016354 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 1025,169 / 998,922 | −2,560245 % | 900,442 à 1224,991 / 885,671 à 1076,689 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007221 / 0,007842 | +8,599917 % | 0,003035 à 0,015143 / 0,002895 à 0,023675 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1535,779 / 1595,554 | +3,892123 % | 1456,759 à 1788,284 / 1340,048 à 1795,459 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005879 / 0,013069 | +122,308215 % | 0,004156 à 0,020871 / 0,005819 à 0,032429 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 772,460 / 773,428 | +0,125258 % | 688,803 à 854,543 / 740,581 à 801,979 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008594 / 0,013174 | +53,307733 % | 0,006981 à 0,054683 / 0,008963 à 0,032069 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1015,755 / 1042,757 | +2,658351 % | 942,607 à 1128,169 / 916,010 à 1138,299 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,011332 / 0,013440 | +18,602188 % | 0,009114 à 0,017927 / 0,012369 à 0,015824 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 943,742 / 964,509 | +2,200417 % | 893,873 à 1106,554 / 798,583 à 1109,424 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,006199 / 0,009118 | +47,096306 % | 0,004687 à 0,021562 / 0,004307 à 0,019810 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1458,909 / 1551,991 | +6,380289 % | 1351,890 à 1596,948 / 1516,733 à 1591,701 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005398 / 0,006189 | +14,662838 % | 0,004006 à 0,025028 / 0,004006 à 0,023105 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 671,170 / 726,914 | +8,305598 % | 655,594 à 736,195 / 698,099 à 911,722 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 321,104 | 104,436 à 586,456 |
| 1 | STCK | A | `rss` | 64 | 942,994 | 552,582 à 1022,090 |
| 1 | SMLP | A | `heapUsed` | 96 | 288,794 | 135,418 à 581,043 |
| 1 | SMLP | A | `rss` | 96 | 975,820 | 788,691 à 1067,371 |
| 1 | STCK | B | `heapUsed` | 64 | 331,620 | 103,010 à 541,488 |
| 1 | STCK | B | `rss` | 64 | 956,096 | 597,625 à 1030,965 |
| 1 | SMLP | B | `heapUsed` | 96 | 334,183 | 116,209 à 588,036 |
| 1 | SMLP | B | `rss` | 96 | 995,668 | 793,758 à 1148,418 |
| 2 | STCK | A | `heapUsed` | 64 | 289,113 | 117,227 à 579,427 |
| 2 | STCK | A | `rss` | 64 | 932,281 | 542,457 à 1005,309 |
| 2 | SMLP | A | `heapUsed` | 96 | 299,937 | 147,522 à 614,595 |
| 2 | SMLP | A | `rss` | 96 | 1054,783 | 777,875 à 1098,078 |
| 2 | STCK | B | `heapUsed` | 64 | 304,456 | 107,043 à 604,402 |
| 2 | STCK | B | `rss` | 64 | 966,855 | 536,301 à 1046,836 |
| 2 | SMLP | B | `heapUsed` | 96 | 301,344 | 132,377 à 594,174 |
| 2 | SMLP | B | `rss` | 96 | 1019,225 | 817,727 à 1098,891 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `f8042743a42a93769de12e804d0b3590d844f94c5013cb4f54cf05772698ad14` |
| global-budget-policy.json | `9733f5de2329c08ec91c85d32144fb60ab72fa499cd3cddd8532093fc119b545` |
| combined-comparison.json | `9c3d8073d02ac7d09a1924e9622613eba03c0ffe7095a995eeae56a711796c7e` |
| consolidation-review.json | `a7ed4865f82094731d20f9eac0c83972a5b6438685c0c04f8fff8faece009482` |
| global-budget-decision.json | `026e04bba6980b390731e4b165055eb2763f071f774948c70f444b7e6f9b0d68` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1583 | 449 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1597 | 453 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1587 | 450 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1581 | 451 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.61.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **0 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle des transactions symboliques, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
