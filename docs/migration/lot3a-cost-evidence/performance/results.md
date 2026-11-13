# Correction du coût 3A : budget validé dans le périmètre annoncé

## Décision

**Les 16 médianes annoncées respectent le budget de +10 %.** La [comparaison agrégée](combined-comparison.json) porte le statut `passed`, avec `withinObservedBudget: 16` et `unresolved: []`. Elle compare une référence **0.36.0 fraîchement mesurée** à la correction **0.38.0 gelée**. La décision applique le [protocole préalable](protocol.md) et la [politique inchangée](comparison-policy.json).

Les deux cohortes gardent leurs résultats propres : la [cohorte 1](cohort1/comparison.json) passe **16/16**, tandis que la [cohorte 2](cohort2/comparison.json) conserve **deux dépassements STCK** et son statut `budget_review_required`. Les huit sessions par jeu et par version ont toutes été incluses dans le bilan final. La réussite agrégée ne requalifie pas la seconde cohorte en réussite individuelle.

La réserve de coût 3A peut être clôturée **dans ce périmètre de mesure**. Le [bilan historique du moteur 0.37](../../lot3a-evidence/performance/results.md), à **12/16** et quatre dépassements, reste inchangé et séparé. Ses sessions ne sont pas incorporées à la nouvelle comparaison.

## Fenêtre, sources et travail conservé

La [fenêtre d'exécution](window.json) s'est déroulée le **9 novembre 2026 de 20:43:49 à 20:53:47 (UTC−3)**. Les quatre processus se sont terminés avec le code de sortie zéro et le contrôle d'intégrité final est `passed`.

| Ordre exécuté | Cohorte | Version | Rapport conservé |
| --- | --- | --- | --- |
| **A1** | 1 | Référence 0.36.0 | [baseline.json](cohort1/baseline.json) |
| **B1** | 1 | Correction 0.38.0 | [after.json](cohort1/after.json) |
| **B2** | 2 | Même correction 0.38.0 | [after.json](cohort2/after.json) |
| **A2** | 2 | Même référence 0.36.0 | [baseline.json](cohort2/baseline.json) |

Cet ordre **ABBA était déclaré avant les mesures**. Chaque exécution mesure quatre sessions par jeu, dans l'ordre STCK puis SMLP. Le bilan réunit donc **huit sessions par jeu et par version**, soit **32 sessions mesurées** et **400 actions au total**, dont 200 par version. STCK fournit dix actions par session et SMLP quinze. Chaque session commence avec un nouveau runtime et une mémoire de connaissances froide. Chaque cas de chaque exécution possède son propre worker, utilisé pour une chauffe de trois actions puis les quatre sessions ; le processus et son JIT ne sont pas redémarrés entre toutes ces sessions.

Seules les chauffes déclarées sont exclues : deux sessions de chauffe par jeu et par version sur les deux cohortes. Aucun échantillon mesuré, valeur extrême ou session défavorable n'a été retiré. Aucun suivi supplémentaire choisi à partir du résultat n'a été exécuté.

| Source mesurée | Fichiers natifs | Digest SHA-256 de l'inventaire |
| --- | ---: | --- |
| Référence 0.36.0 | 242 | `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b` |
| Correction 0.38.0 | 245 | `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` |

Le runner, les déclarations source, les cas, leurs retours publics et les sources gelées sont vérifiés par empreinte. Les rapports de référence ont été recopiés sans modifier leurs octets. L'agrégateur reproduit exactement les métriques, distributions, dispersions, p95 et classifications de chaque comparaison d'origine avant de réunir leurs observations. Il vérifie aussi les métadonnées du travail réel : commandes, placement des phases, observations, compteurs, inspections et pauses. Les temps, dates absolues, RSS et heap ne sont pas assimilés à des identités métier.

## Les seize critères agrégés

Toutes les durées sont en **millisecondes**. L'effectif indiqué vaut **pour chaque version**. Les phases sont imbriquées et ne s'additionnent pas. La variation est `médiane_après / médiane_avant − 1`, calculée avant l'arrondi du tableau. Le budget s'applique aux médianes ; les p95 sont conservés comme description des queues de distribution.

### STCK

| Phase | Effectif | Médiane 0.36 | Médiane 0.38 | Variation | p95 0.36 | p95 0.38 | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Session de rejeu | 8 | 10 873,908 | 10 966,417 | **+0,851 %** | Non publié | Non publié | Respecté |
| Nouvelle décision | 48 | 312,367 | 301,218 | −3,569 % | 442,616 | 478,926 | Respecté |
| Service de continuation | 32 | 9,394 | 8,393 | −10,649 % | 23,857 | 10,895 | Respecté |
| Requête de continuation | 32 | 11,023 | 10,031 | −9,004 % | 25,560 | 12,956 | Respecté |
| Garde de continuation | 32 | 0,213066 | 0,212285 | −0,367 % | 0,948985 | 0,917888 | Respecté |
| Acquisition et persistance | 48 | 913,569 | 968,837 | **+6,050 %** | 4 008,996 | 4 055,470 | Respecté |
| Persistance | 104 | 177,891 | 170,384 | −4,220 % | 328,267 | 347,703 | Respecté |
| Restauration | 96 | 10,998 | 9,752 | −11,325 % | 65,388 | 59,822 | Respecté |

### SMLP

| Phase | Effectif | Médiane 0.36 | Médiane 0.38 | Variation | p95 0.36 | p95 0.38 | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Session de rejeu | 8 | 24 218,379 | 17 386,704 | **−28,209 %** | Non publié | Non publié | Respecté |
| Nouvelle décision | 72 | 416,476 | 358,415 | **−13,941 %** | 3 278,505 | 838,793 | Respecté |
| Service de continuation | 48 | 11,034 | 9,226 | **−16,386 %** | 18,264 | 14,125 | Respecté |
| Requête de continuation | 48 | 13,535 | 11,407 | −15,724 % | 20,608 | 17,756 | Respecté |
| Garde de continuation | 48 | 0,354072 | 0,333708 | −5,751 % | 0,691056 | 0,611384 | Respecté |
| Acquisition et persistance | 72 | 1 748,259 | 949,309 | **−45,700 %** | 2 990,282 | 2 925,350 | Respecté |
| Persistance | 152 | 147,334 | 144,904 | −1,649 % | 260,120 | 259,351 | Respecté |
| Restauration | 144 | 4,962 | 4,679 | −5,709 % | 26,550 | 23,704 | Respecté |

Les deux hausses de médiane agrégée sont conservées : **session STCK +0,851 %**, soit **+92,509 ms**, et **acquisition/persistance STCK +6,050 %**, soit **+55,268 ms**. Cette dernière est la plus forte hausse parmi les seize critères. Les p95 STCK augmentent pour la nouvelle décision (**+8,203 %**), l'acquisition/persistance (**+1,159 %**) et la persistance (**+5,921 %**). Ils ne deviennent pas des critères budgétés supplémentaires réussis.

Les minimums, maximums et étendues relatives des médianes par session restent dans le [JSON agrégé](combined-comparison.json). Par exemple, les durées de session STCK observées vont de **10 291,997 à 13 061,182 ms** en référence et de **10 404,476 à 12 148,935 ms** après correction. SMLP va de **23 806,812 à 24 921,631 ms** à **17 090,262 à 18 058,016 ms**. Ces étendues décrivent l'échantillon et ne constituent pas des intervalles de confiance.

## Dépassements de la seconde cohorte conservés

| Mesure STCK, cohorte 2 seule | Médiane 0.36 | Médiane 0.38 | Variation | Statut d'origine |
| --- | ---: | ---: | ---: | --- |
| Acquisition et persistance | 871,626 | 967,745 | **+11,028 %** | `over_budget_with_noise_unresolved` |
| Persistance | 150,471 | 170,384 | **+13,234 %** | `over_budget_with_noise_unresolved` |

La cohorte 2 reste à **14/16**, avec ces deux dépassements dans sa liste `unresolved`. Le bruit observé n'ajoute aucune tolérance. La décision finale utilise les distributions réunies des deux cohortes parce que cette règle était fixée dans le protocole avant le début de la fenêtre. Elle ne choisit pas la cohorte 1 et ne moyenne pas les ratios des cohortes. Le résultat de la cohorte 2 invite à conserver la prudence sur la stabilité des coûts locaux, même lorsque le bilan pré-déclaré satisfait son budget.

## Inspection et Pause : diagnostics séparés du budget

### Inspection

Trois inspections sont déclenchées **après la fin du rejeu** de chaque session mesurée, soit **24 observations par jeu et par version**. Elles sont exclues de `replayElapsedMs`. Les durées comprennent le service et, pour le total, le transport worker ; elles ne mesurent pas le rendu de l'inspecteur dans le navigateur.

| Cas | Service, médiane 0.36 | Service, médiane 0.38 | Total, médiane 0.36 | Total, médiane 0.38 | Total, p95 0.36 | Total, p95 0.38 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| STCK | 182,101 | 175,802 | 326,754 | **330,878** | 421,213 | 388,123 |
| SMLP | 198,217 | 192,630 | 354,848 | 347,134 | 448,028 | 384,973 |

La médiane totale d'inspection STCK augmente ; cette hausse reste visible et ne fait pas partie des seize critères annoncés.

### Pause

Le contrôleur reconnaît Pause pendant la planification initiale puis après engagement de la première action. Les arrêts sûrs conservent respectivement **zéro action exécutée avec ticket retenu**, puis **une action exécutée et acquise**. Chaque ligne possède **huit observations par version** ; aucun p95 n'est publié pour cet effectif.

| Cas et phase | Accusé de réception, médiane 0.36 | Accusé de réception, médiane 0.38 | Frontière sûre, médiane 0.36 | Frontière sûre, médiane 0.38 |
| --- | ---: | ---: | ---: | ---: |
| STCK, planification initiale | 0,007621 | 0,007536 | 975,051 | **1 078,797** |
| STCK, action engagée | 0,012834 | 0,012658 | 812,141 | **906,792** |
| SMLP, planification initiale | 0,007967 | 0,005749 | 3 976,328 | 1 446,329 |
| SMLP, action engagée | 0,004767 | 0,004562 | 2 023,749 | 722,922 |

Les deux attentes médianes de frontière sûre STCK augmentent. Ces durées restent des diagnostics hors des seize critères ; elles ne sont pas effacées par les gains SMLP. L'accusé de réception est le coût de l'appel synchrone du contrôleur, pas une mesure de réaction visuelle. La frontière sûre attend le travail engagé. Ces pauses se produisent à l'intérieur du rejeu et leurs temps ne doivent pas être ajoutés à celui de la session. Elles ne prouvent pas une préemption arbitraire pendant toute recherche.

## Interprétation et limites

La [filiation de la correction](../../lot3a-cost-lineage.md) décrit les trois changements : comptage périodique exact repris de V5, réduction d'allocations des composantes géométriques V6 et réutilisation de copies diagnostiques profondément immuables. La comparaison officielle mesure leur effet conjoint ; elle n'attribue pas chaque gain à une fonction isolée. Les profils diagnostiques et leur portée restent séparés de la décision budgétaire.

Les mesures concernent le runtime, le contrôleur et le transport natifs sur des retours publics enregistrés. Le moteur recalcule ses commandes et le rejeu vérifie leur égalité avant de fournir le retour suivant. Ce n'est ni une mesure du moteur de jeu réel, ni du réseau de production, ni du rendu du navigateur, ni une estimation des performances sur un autre ordinateur.

Les échantillons d'une même session sont corrélés. Les médianes réunissent toutes les observations annoncées ; les sessions ne sont pas remplacées par des échantillons indépendants supposés. Le p95 est le rang empirique `ceil(0,95 × n)` et reste absent sous vingt observations. L'ordre ABBA limite une dérive temporelle simple, mais ne rend pas identiques les états de GC, de JIT et d'ordonnancement. Huit sessions finies par jeu et par version ne démontrent pas la stabilité sur plusieurs heures.

La clôture du budget ne constitue pas une nouvelle réussite de jeu. Les preuves fonctionnelles, la conservation de RSWP, la vérification navigateur et l'intégrité de livraison conservent leurs propres reçus. La façade `observed_composition_services`, ses cinq autres branches et la migration globale V5/V6 gardent leurs périmètres ouverts.
