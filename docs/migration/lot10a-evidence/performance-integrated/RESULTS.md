# Lot 10A : résultats du coût intégré 0.55.0 → 0.56.0

Le coût global est **accepté pour les deux jeux**, selon la règle déclarée avant mesure : la médiane de la session complète doit augmenter de **strictement moins de 10 % pour chaque jeu**. Les hausses observées sont **+0.387456853 % pour STCK** et **+0.136583513 % pour SMLP**. La [revue indépendante](owner-growth-review.json) passe **7 688 contrôles**, avec `accepted=true`, `globalStatus=accepted_under_predeclared_owner_cost_rule` et `inputsUnchanged=true`.

L’[agrégat qualifié](owner-growth-comparison.json) conserve **16/16 diagnostics de phase** dans le budget observé. Les deux comparaisons de cohorte conservent chacune **15/16** et le statut historique **`budget_review_required`**. Le refus réel de l’agrégateur strict, code **1**, reste un résultat distinct ; `historicalStrictPassed=false` dans la revue indépendante.

## Sources et fenêtre réellement mesurées

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence publiée | Site **88**, native **0.55.0**, commit `43ee01ba5469fd4fbffe10eb6a786fe99b1c35a7`, **291 fichiers natifs** | `ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b` |
| B : candidat | Native **0.56.0**, **294 fichiers natifs**, archive de **305 membres** | `be11e761de3c0f3c7d50d10da47be9e0d7b4fc9c5b7d5002cc9272ffce85645a` |

Les [gels A](../integrated-baseline/source-manifest.json) et [B](../integrated-final/source-manifest.json) sont ceux de la [déclaration](declaration.json). A est exécuté dans `/workspace/sites/sra-lot10a-baseline-site88-20261110` au commit exact publié ; B dans `/workspace/sites/sra-lot10a-20261110/.sites-checkout`. L’archive B conserve son commit de gel `19f3116c95e8e8ce99aff067de113ae23fc634d6` ; le HEAD relevé à la déclaration après intégration des publications est `367a6ecb742ef114b419b5003ef2bb70965e22a8`. Le digest et les fichiers gelés identifient les octets effectivement mesurés.

La [fenêtre réelle](window.json) du **11 novembre 2026** commence à **00:14:54.378751 UTC** et finit à **00:23:30.797609 UTC**. Les quatre séries et l’intégrité finale sont `passed`, avec un code de sortie 0 pour chaque série. Le [reçu d’isolation](coordinated-isolation.json) et la [readiness](readiness.json) lient les engagements de calme et les preuves préalables à cette fenêtre.

| Ordre | Série | Version | Sessions STCK | Sessions SMLP | Rapport brut |
| --- | --- | --- | --- | --- | --- |
| 1 | A1 / cohorte 1 | 0.55.0 | 4 | 4 | [A1](cohort1/baseline.json) |
| 2 | B1 / cohorte 1 | 0.56.0 | 4 | 4 | [B1](cohort1/after.json) |
| 3 | B2 / cohorte 2 | 0.56.0 | 4 | 4 | [B2](cohort2/after.json) |
| 4 | A2 / cohorte 2 | 0.55.0 | 4 | 4 | [A2](cohort2/baseline.json) |

## Méthode, effectifs et exclusions

Le [protocole](protocol.md), finalisé à **00:11:06.107443 UTC**, fixe deux traces publiques inchangées : **10 actions STCK** et **15 actions SMLP** par session mesurée. Le runtime recalcule chaque commande avant de recevoir son retour enregistré. Chaque session mesurée part d’un runtime neuf et d’une mémoire froide ; un worker distinct sert chaque jeu dans chaque série, tandis que le processus et le JIT sont conservés au sein de ce cas/série.

Les **32 sessions mesurées et leurs 400 actions sont toutes incluses** : huit sessions par jeu et par version. Les **huit chauffes de trois actions**, soit **24 actions**, sont les **seules exclusions**. Aucun échantillon mesuré, extrême ou cohorte n’est supprimé ; aucune marge de bruit n’est ajoutée et aucun coût de propriétaire n’est soustrait. Les chauffes restent dans les rapports bruts et dans la vérification structurelle.

L’acceptation réunit les huit durées complètes `session_elapsed` de chaque version pour chaque jeu. Elle compare `médiane(B) / médiane(A) − 1` au seuil strict de +10 %. Les ratios de cohortes ne sont pas moyennés, les jeux ne se compensent pas et les phases imbriquées ne sont pas additionnées. La médiane paire est la moyenne des deux valeurs centrales. Le p95 utilise le rang empirique `ceil(0.95 × n)` uniquement à partir de **20 observations** ; aucun p95 de session n’est annoncé pour huit observations.

## Résultat global par jeu

| Jeu | Sessions A / B | Médiane A (ms) | Médiane B (ms) | Hausse globale | Décision |
| --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10713.182301 | 10754.691259 | +0.387456853 % | Accepté, < +10 % |
| SMLP | 8 / 8 | 16364.226173 | 16386.577008 | +0.136583513 % | Accepté, < +10 % |

Les décimales affichées sont arrondies pour la lecture : six pour les durées en millisecondes et neuf pour les pourcentages globaux. Les JSON conservent toute la précision calculée. Les durées sont celles de ce rejeu contrôlé ; elles ne mesurent pas le réseau, le moteur de jeu ou le rendu navigateur.

## Huit phases par jeu : effectifs, médianes et dispersion

Les données ci-dessous viennent de l’[agrégat qualifié](owner-growth-comparison.json), recalculé indépendamment par la [revue Python](owner-growth-review.json). Les **16 lignes** gardent le résultat `within_observed_budget` et l’agrégat `phaseStatus=passed`. `n A / B` compte les observations chronométrées de la phase, pas des sessions indépendantes. Les observations d’une session sont corrélées ; min, max et p95 décrivent leur dispersion sans établir un intervalle de confiance.

`new_decision` mesure `plan` ; `known_prefix_service` le service `advance` du préfixe ; `known_prefix_request` la même requête avec transport worker et ordonnancement ; `known_prefix_guard` l’autorisation à un index supérieur à zéro ; `acquisition_and_persistence` mesure `seal`, `persistence` mesure `persistFamilies` et `restoration` mesure `restoreFamilies`. `session_elapsed` est la durée complète retenue comme critère global.

### STCK

| Phase | n A / B | Médiane A (ms) | Médiane B (ms) | Écart médian |
| --- | --- | --- | --- | --- |
| `session_elapsed` | 8 / 8 | 10713.182301 | 10754.691259 | +0.387457 % |
| `new_decision` | 48 / 48 | 337.508713 | 329.331243 | -2.422892 % |
| `known_prefix_service` | 32 / 32 | 9.389706 | 9.025781 | -3.875792 % |
| `known_prefix_request` | 32 / 32 | 11.297656 | 10.648307 | -5.747648 % |
| `known_prefix_guard` | 32 / 32 | 0.236479 | 0.205098 | -13.270100 % |
| `acquisition_and_persistence` | 48 / 48 | 847.698733 | 836.575673 | -1.312148 % |
| `persistence` | 104 / 104 | 191.944290 | 192.968680 | +0.533691 % |
| `restoration` | 96 / 96 | 18.089017 | 18.164959 | +0.419821 % |

| Phase | p95 A (ms) | p95 B (ms) | Min–max A (ms) | Min–max B (ms) |
| --- | --- | --- | --- | --- |
| `session_elapsed` | n. d. | n. d. | 10091.875776 – 11470.147488 | 9987.934965 – 11638.041137 |
| `new_decision` | 630.270715 | 647.832744 | 214.075944 – 666.304576 | 232.307711 – 707.119370 |
| `known_prefix_service` | 11.602356 | 13.486249 | 7.149310 – 19.140384 | 6.963925 – 13.971976 |
| `known_prefix_request` | 13.886514 | 15.345725 | 8.913325 – 21.156327 | 8.844623 – 15.518630 |
| `known_prefix_guard` | 0.379380 | 0.733634 | 0.083473 – 1.033286 | 0.084785 – 0.856585 |
| `acquisition_and_persistence` | 3905.808576 | 3884.485015 | 421.463849 – 3983.457410 | 434.115214 – 3969.754117 |
| `persistence` | 459.763484 | 465.843923 | 15.397752 – 555.014772 | 13.747664 – 604.765539 |
| `restoration` | 143.620092 | 139.443890 | 1.945173 – 197.999508 | 2.016699 – 184.042238 |

### SMLP

| Phase | n A / B | Médiane A (ms) | Médiane B (ms) | Écart médian |
| --- | --- | --- | --- | --- |
| `session_elapsed` | 8 / 8 | 16364.226173 | 16386.577008 | +0.136584 % |
| `new_decision` | 72 / 72 | 378.494196 | 403.091646 | +6.498765 % |
| `known_prefix_service` | 48 / 48 | 9.527918 | 10.119467 | +6.208592 % |
| `known_prefix_request` | 48 / 48 | 11.707536 | 12.296232 | +5.028351 % |
| `known_prefix_guard` | 48 / 48 | 0.340407 | 0.369060 | +8.417118 % |
| `acquisition_and_persistence` | 72 / 72 | 797.272336 | 807.284174 | +1.255761 % |
| `persistence` | 152 / 152 | 156.347402 | 155.893056 | -0.290601 % |
| `restoration` | 144 / 144 | 8.148490 | 7.831222 | -3.893574 % |

| Phase | p95 A (ms) | p95 B (ms) | Min–max A (ms) | Min–max B (ms) |
| --- | --- | --- | --- | --- |
| `session_elapsed` | n. d. | n. d. | 15642.865741 – 18337.823109 | 15548.781496 – 17584.046916 |
| `new_decision` | 897.836488 | 817.134381 | 238.355397 – 1018.245061 | 248.592409 – 934.695358 |
| `known_prefix_service` | 12.535509 | 13.877016 | 7.752570 – 13.064666 | 8.268893 – 15.368179 |
| `known_prefix_request` | 15.623305 | 17.176109 | 9.855767 – 16.045474 | 10.345305 – 22.614050 |
| `known_prefix_guard` | 0.465468 | 0.572685 | 0.188849 – 0.530603 | 0.209039 – 0.615960 |
| `acquisition_and_persistence` | 2598.799323 | 2667.845943 | 384.618092 – 2722.459169 | 388.918163 – 2944.834405 |
| `persistence` | 234.489747 | 231.647001 | 13.070866 – 299.587715 | 12.095705 – 297.059952 |
| `restoration` | 51.445824 | 53.043449 | 2.010399 – 92.142933 | 2.097929 – 73.689781 |

« n. d. » signifie p95 non publié, car l’effectif est inférieur à 20 ; ce n’est pas une durée nulle. Plusieurs queues augmentent malgré une médiane de phase plus faible : par exemple, le p95 de `known_prefix_guard` STCK passe de **0.379380 à 0.733634 ms**, celui de `known_prefix_service` STCK de **11.602356 à 13.486249 ms**. Ces valeurs défavorables restent dans le bilan et les reçus.

## Diagnostics des deux cohortes conservés

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json), produites par le comparateur historique inchangé, gardent chacune **15/16 diagnostics dans le budget** et **`budget_review_required`**. Les deux dépassements SMLP gardent exactement le résultat **`over_budget_with_noise_unresolved`**. L’acceptation globale n’efface aucun de ces statuts et n’utilise aucune tolérance de bruit supplémentaire.

| Cohorte | Jeu | Phase en dépassement | n A / B | Médiane A (ms) | Médiane B (ms) | Hausse |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | SMLP | `known_prefix_guard` | 24 / 24 | 0.347653 | 0.400887 | +15.312394829 % |
| 2 | SMLP | `acquisition_and_persistence` | 36 / 36 | 733.286465 | 835.855033 | +13.987516939 % |

Les médianes complètes par cohorte sont également conservées. Elles montrent la variation entre les deux passages ; le verdict utilise les huit sessions réunies de chaque version, et non une sélection parmi ces quatre lignes.

| Cohorte | Jeu | Sessions A / B | Médiane complète A (ms) | Médiane complète B (ms) | Écart |
| --- | --- | --- | --- | --- | --- |
| 1 | STCK | 4 / 4 | 10778.745743 | 11067.203865 | +2.676175214 % |
| 1 | SMLP | 4 / 4 | 16935.196029 | 16386.577008 | -3.239519753 % |
| 2 | STCK | 4 / 4 | 10535.492031 | 10356.692399 | -1.697117045 % |
| 2 | SMLP | 4 / 4 | 15824.834684 | 16365.292592 | +3.415251529 % |

## Refus strict et qualification structurelle préalable

L’[exécution réelle de l’agrégateur strict](aggregation-failure.json), de **00:23:51.598315 à 00:23:51.695517 UTC**, termine avec le **code 1**, l’erreur **`Within-cohort work metadata changed`**, des entrées inchangées et **aucun fichier `combined-comparison.json` produit**. Son [journal complet](aggregation-failure.log) est conservé. Ce contrôle reste en échec ; l’analyse complémentaire ne le reclasse pas en succès.

La [déclaration](declaration.json) avait prévu l’analyse complémentaire avant le chronométrage. Elle lie le propriétaire ajouté `public_axial_question`, son programme `v6.axial_question.choose`, les captures fonctionnelles et le [contrat fermé](owner-growth-contract.json). Les seules différences de travail admises sont les quatre chemins suivants :

- `observations[*].nodeCount`.
- `inspection[*].graphNodes`.
- `final.nodeCount`.
- `final.graphRevision`.

La [qualification des graphes](owner-structural-attribution.json) passe **64 contrôles** à **00:13:10.646 UTC** ; le [préflight statique](static-preflight.json) passe **77 contrôles** à **00:13:44.744590 UTC**. La readiness est finalisée à **00:14:27.795537 UTC**, avant le début de la fenêtre. Les attentes proviennent des quatre formes publiques STCK/SMLP, chauffe et session complète, capturées avant mesure ; elles ne sont pas ajustées aux temps observés.

L’agrégat et sa revue conservent **432 différences structurelles**, chauffes comprises, avec les valeurs A/B et les attentes de la fixture. Les métadonnées de comportement restent exactes entre versions et les signatures complètes de travail restent exactes au sein de chaque version. L’origine des fragments communs et l’ordre de leurs deltas sont vérifiés. Aucune formule générale de croissance ni aucun allègement rétrospectif de la règle n’est déduit de ces différences. Les durées brutes ne subissent aucune correction ou soustraction.

La revue indépendante termine à **00:24:05.921711 UTC** avec **7 688 contrôles**, **2/2 jeux acceptés**, `structuralProof=true` et `inputsUnchanged=true`. Sa décision porte sur la règle globale et la qualification structurelle déclarées ; elle conserve explicitement `historicalStrictPassed=false`.

## Conservation des captures et journaux

Le [reçu de transport exact](evidence-byte-transport.json) est la sortie réelle de l’opération **`verify`**. Les deux captures gzip sont conservées en **12 fragments**, de **900 000 octets maximum**. Les originaux restent présents localement et sont ignorés de Git ; les fragments et leurs manifests permettent de reconstruire les mêmes octets.

| Capture | Octets gzip | Fragments | SHA-256 |
| --- | --- | --- | --- |
| [Référence A](owner-graphs-baseline.json.gz.parts.json) | 5 028 205 | 6 | `22d6ae21086a27146efa56844b8c2fc56d582974d94f1dd61c4691bbcebc8e1a` |
| [Candidat B](owner-graphs-candidate.json.gz.parts.json) | 5 036 835 | 6 | `4ae9218f5821f34b2d85d338cfe9c1c6563493978b2f2f12fb4cd1c5336c7d40` |

Les **sept journaux `.log`** ont été ajoutés explicitement à Git avec leurs octets intacts, sans espace en fin de ligne : [A1](cohort1/baseline.log), [B1](cohort1/after.log), [B2](cohort2/after.log), [A2](cohort2/baseline.log), [comparaison 1](cohort1/comparison.log), [comparaison 2](cohort2/comparison.log) et [refus strict](aggregation-failure.log). Les quatre rapports bruts, le registre des sessions, les deux comparaisons, l’agrégat et la revue restent distincts.

## Portée et réserves

Cette fenêtre caractérise le chemin commun sur deux traces publiques fixées, sous les conditions de processus et de chauffe déclarées. Elle ne démontre pas un gain causal d’AxialQuestion, une contribution propre dans un jeu, une nouvelle réussite officielle, une amélioration du navigateur ou le coût d’un long historique de rotations Axial. La réserve POLA reste inchangée : 94 actions historiques, zéro niveau, horloge irrécupérable et aucun nouveau budget. La parité complète de l’appelant source reste ouverte.

Les mesures de Pause, d’inspection et de mémoire restent disponibles dans les quatre rapports bruts et les deux comparaisons de cohorte ; elles ne sont pas transformées en preuve navigateur. Les dix actions STCK correspondent à deux niveaux observés sur cette trace, même si le cas conserve une cible déclarée de trois niveaux. Aucun résultat de jeu ou de publication n’est attribué à la seule acceptation de coût.

Ce document rend les reçus existants lisibles. Il ne modifie aucun échantillon, statut historique, outil, test ou gate et n’exécute aucune nouvelle mesure.
