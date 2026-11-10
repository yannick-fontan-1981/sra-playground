# Preuves du lot 3I — RecurrentSeries, native 0.50

Le [rapport](../lot3i-recurrent-series.md) et la [filiation source](../lot3i-recurrent-series-lineage.md) distinguent les contrats propres RepeatedLine/SupportedLine, leur intégration, la contribution CONN, les régressions et le coût. **Les cinq rejeux passent 85/85 contrôles après récupération WEAV et l’intégrité du gel et des preuves est vérifiée. Le lot 3I est clôturé dans son périmètre annoncé ; son coût global est accepté sur les deux jeux.** Cet index décrit uniquement le gel 0.50 ; une préparation isolée 4A ne constitue pas une livraison publiée.

## Identité et validation formelle

| Pièce | Résultat ou portée |
| --- | --- |
| [Provenance publiée](baseline/provenance.json), [manifeste de référence](baseline/source-manifest.json) | **Site 78 / native 0.49.0**, commit `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, **268 fichiers natifs**, digest `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054` |
| [Manifeste candidat](final/source-manifest.json), [archive](final/source-archive.json), [parties de l’archive](final/source-archive-parts.json) | **0.50.0**, **270 fichiers natifs / 281 fichiers d’archive**, digest `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87` |
| [Périmètre déclaré](formal-test-scope.json), [reçu des tests](final/validation/delta-tests-run.json), [journal](final/validation/delta-tests-output.log.gz) | **3 225/3 225 tests dans 76 fichiers**, sans échec, annulation, test ignoré ni TODO ; entrées source/tests inchangées |
| [Contrôles du projet](final/validation/checks-run.json), [résolution de l’audit](final/validation/migration-audit-resolution.json) | **5/5**, compilation comprise ; le premier audit précédait l’achèvement de la filiation et son journal reste conservé ; la résolution ne conserve aucune failure |
| [Revue indépendante de l’intégration](diagnostic/shared-integration-review.json) | **23/23 contrôles de lecture**, sans problème bloquant ; ce nombre ne s’ajoute pas aux tests exécutés |

L’archive porte le SHA-256 **`0584411aa31fb00c60d523e8eafd7b51394a182ac75b06f49206c8375def6fed`**. Les résultats formels couvrent le delta affecté déclaré. Le gel raccorde **54/76 entrées**, sans entrée partielle, avec **22 restantes**, **6/6 branches observées** et **37 workflows compilés**. L’audit résolu compte **163 composants vérifiés, 141 transferts partiels, 1 065 modules en attente et zéro module entièrement vérifié** ; les six portes de migration complète et `fullV6Parity` restent faux.

## Oracle indépendant et checkpoints publiés

La [fixture source](../../../tests/fixtures/v6-recurrent-series-reference.json.gz), son [générateur](../../../scripts/export-v6-recurrent-series-reference.py) et le [reçu d’export](diagnostic/source-oracle-export.json) conservent 19 mesures de champs, 7 ensembles de points, 12 extensions, 4 layouts, 26 helpers, **52 propositions, 50 gardes, 19 acquisitions, 8 paquets, 13 réductions, 12 restaurations, 34 cas d’adaptateur et une chaîne froide**. Les **28 exceptions source** restent visibles. Ces groupes ne sont pas un total de tests natifs disjoints.

Les **1 786 fichiers originaux**, commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, sont vérifiés avant et après. Aucune exécution native, lecture de moteur, spécification ou solution de jeu ne fournit les résultats attendus. La filiation précise les alias et l’appelant descendant effectivement consommés ; la parité de toutes ses couches reste partielle.

Les [19 checkpoints publiés 0.49](../../../tests/fixtures/v6-recurrent-series-legacy-checkpoints.json.gz), produits par le [générateur de compatibilité](../../../scripts/export-v6-recurrent-series-legacy-checkpoints.mjs), vérifient les deux emplacements historiques de digest et les autres couches déjà acquises. Le propriétaire propre trie les clés selon les points de code Unicode Python ; les checkpoints partagés gardent le tri UTF-16 historique. Les identifiants produits sont hexadécimaux ASCII et concordent sous les deux ordres. Les clés opaques BMP/hors BMP artificielles conservent leur qualification séparée.

## Boucle commune contrôlée

La [preuve intégrée](final/recurrent-series-common-loop.json.gz), produite par le [script déclaré](../../../scripts/prove-recurrent-series-common-loop.mjs), passe **18 groupes de contrôles dans deux sessions synthétiques froides** : un essai Repeated confirmé et un essai réfuté. Les priorités et offres concurrentes restent présentes. La liaison courante, WHY/ACT, le retour public contrôlé, l’acquisition, la persistance Kernel, la restauration froide et le choix suivant sont vérifiés.

Deux ablations retirent chacune un essai déjà acquis et changent l’action suivante ou le refus. Ces sessions ne comptent **aucune action ni réussite en jeu**, ne forcent pas les clics passifs Supported et ne prouvent pas un contrefactuel de l’appelant complet. Le [périmètre final](final/recurrent-series-validation-scope.json) sépare cette preuve de la contribution réelle CONN.

## CONN : résultat, contribution et navigateur

<!-- CONN_RESULT_START -->
La [résolution CONN](final/conn-resolution.json) confirme **21 actions, trois niveaux, 21 préfixes, arrivée au niveau 4**, dans une session froide commune. L’arrêt est `target_levels_completed` avec état `NOT_FINISHED` : la cible annoncée est atteinte, sans revendication de victoire sur tout le jeu. Le [scan initial déclaré](diagnostic/initial-public-scan-plan.json) examine 95 vues admissibles et trouve une admission froide. La [sélection du cas](conn-selection.json) fixe la cible et l’horloge. La [référence fraîche 0.49](baseline-case-phase.json) s’arrête à sa borne annoncée de **huit actions, zéro niveau et sept préfixes**, sans conclure à une incapacité complète.

La [comparaison indépendante](diagnostic/conn-public-parity.json) et son [reçu source](diagnostic/conn-public-source-parity.json.gz) passent **1 361 contrôles** : **14 préfixes propres sélectionnés** (cinq Repeated, neuf Supported), **21 retours réels**, **34 événements propres** et **35 restaurations**. Les mémoires partent à froid, sans état de proposition capturé injecté. Les sept autres actions sont des choix de l’appelant commun ; leurs retours restent présentés aux couches d’acquisition concernées.

Les **84 ablations de composant** sont exécutées : **33 changements d’action/refus**, **51 résultats négatifs ou inchangés**. Les **35 changements de projection de décision** constituent un compteur distinct. Les interventions retirent seulement des événements antérieurs acquis. La trajectoire propre sélectionnée et l’acquisition de tous les retours sont vérifiées ; la parité et l’ablation de l’appelant hérité complet restent hors de cette preuve.

La [campagne](final/conn-recurrent-series-session/conn-campaign.json.gz), le [journal public](final/conn-recurrent-series-session/conn-actual-public-journal.jsonl.gz), la [trace](final/conn-recurrent-series-session/conn-public-trace.json.gz) et le [reçu d’exécution](final/conn-recurrent-series-session/execution-conn.json) conservent les résultats bruts. Le [navigateur](final/browser/browser-qa.json) confirme séparément **21 actions / trois niveaux / 21 plans**, après Pause, une action isolée et reprise. La [capture finale](final/browser/conn-browser-final.png), son [état accessible](final/browser/conn-browser-final.txt) et les [observations successives](final/browser/conn-browser-observations.json) conservent les compteurs, sans action manuelle de jeu ni saut de niveau.

L’horloge CONN se termine à **1 014,763812 secondes cumulées**, avec **1 385,236188 secondes restantes** sur 2 400. Elle inclut scan, référence, candidat, comparaisons, ablations, navigateur et revue, sans pause ni remise à zéro. Tout diagnostic futur reprendra cette valeur. Les horloges antérieures, dont **WEAV 1 277,782615 secondes**, restent inchangées ; les rejeux de livraison ne constituent pas une nouvelle campagne.
<!-- CONN_RESULT_END -->

## Rejeux et récupération WEAV

Les [cinq cas déclarés](recorded-regression-cases.json) et le [résumé consolidé](final/regressions/regression-summary.json) donnent **5/5 cas et 85/85 contrôles**, préservant **240 actions, 169 préfixes, 245 paquets publics complets et quinze frontières naturelles**. Le [résumé initial interrompu](final/regressions/regression-summary-interrupted.json) garde son résultat **4/5, 68/85**. Les réussites CATR, RSWP, FOGW et VOIS sont réutilisées à l’identique ; WEAV ajoute 81 actions/81 préfixes et dix-sept comparaisons. Le comparateur historique vérifie dix-sept projections déclarées, sans établir l’identité de tous les payloads ou de tout l’appelant source.

| Tentative WEAV conservée | Observation acquise |
| --- | --- |
| [Première exécution](final/regressions/weav-049-execution.json), [journal](final/regressions/weav-049-output.log.gz), [résumé interrompu](final/regressions/regression-summary-interrupted.json) | **SIGKILL, code −9**, après 67 actions journalisées ; aucun rapport final ni comparaison complète ; cause non établie |
| [Reprise isolée déclarée](weav-recovery-plan.json), [exécution](final/weav-retry/regressions/weav-049-isolated-execution.json), [journal](final/weav-retry/regressions/weav-049-isolated-output.log.gz), [résumé](final/weav-retry/regressions/regression-summary.json) | **Code −6**, épuisement explicite du heap Node à **768 Mio** ; aucun résultat final des dix-sept comparaisons |
| [Troisième invocation interrompue](final/weav-memory-retry/interruption-observation.json) | Identifiant de processus devenu indisponible et verrou libre ; aucun rapport final, statut de sortie ou journal Node achevé retenu ; **cause non établie** |

Le [nouveau plan mémoire/hôte](weav-memory-recovery-plan.json) et ses [entrées immuables](weav-memory-recovery-cases.json) portent sur **81 commandes et 82 paquets publics attendus**, avec les dix-sept comparaisons historiques inchangées. La borne de heap passe à **1 536 Mio pour ce rejeu seulement**. La racine complète de la référence est libérée avant l’import du harnais ; la prévalidation et la comparaison Python utilisent des processus distincts sans chevauchement avec le rejeu Node. Le [précontrôle](final/weav-memory-retry/preflight.json) et le [reçu de préparation de l’hôte](final/weav-memory-retry/regressions/weav-049-memory-efficient-host-preparation.json) vérifient les entrées et la collecte de cette racine, sans valoir réussite du rejeu.

<!-- WEAV_RECOVERY_RESULT_START -->
**La quatrième invocation WEAV réussit : code 0, 81 actions, 81 préfixes et 17/17 contrôles.** Le [plan avec journal persistant](weav-streamlog-recovery-plan.json), le [reçu d’exécution](final/weav-memory-retry-v2/regressions/weav-049-streamlog-execution.json), la [comparaison achevée](final/weav-memory-retry-v2/regressions/weav-049-streamlog-comparison.json), le [résumé isolé](final/weav-memory-retry-v2/regressions/regression-summary.json) et la [consolidation finale](regression-recovery.json) lient ce résultat au gel 0.50 et aux entrées publiques inchangées.

Le [reçu de préparation final](final/weav-memory-retry-v2/regressions/weav-049-streamlog-host-preparation.json) constate la libération de la racine complète de référence avant l’import du harnais inchangé. Le driver conserve le [journal brut](final/weav-memory-retry-v2/regressions/weav-049-streamlog-output.raw.log.gz) et les observations du processus pendant l’exécution ; la comparaison historique démarre après la sortie du processus natif. Le code, les tests, les assertions du harnais, les retours publics, les commandes attendues et les dix-sept contrôles du comparateur restent inchangés.

Le rapport WEAV intégral porte **10 802 096 octets gzip**, SHA-256 **`1943593c0961d8b49d059e34d58dd96269926ab8a24b5fc294c6bbc516cd8985`** ; son [manifeste de treize parties exactes](final/weav-memory-retry-v2/regressions/weav-049-streamlog-replay.json.gz.parts.json) conserve son identité. Les deux échecs précédents, la troisième invocation incomplète et les quatre réussites initiales restent dans le bilan. Les digests natifs avant/après restent **`e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`**.
<!-- WEAV_RECOVERY_RESULT_END -->

La récupération modifie l’organisation de l’hôte de preuve, sans changement des budgets de production ou de l’environnement officiel de coût. Ces échecs et interruptions instrumentés n’établissent ni une incapacité en jeu ni, à eux seuls, une fuite du moteur en production.

## Protocole et coût officiel

La [déclaration](performance/declaration.json), le [protocole](performance/protocol.md), les [cas](performance/cases.json), la [politique globale](performance/global-budget-policy.json) et la [politique de phases](performance/comparison-policy.json) fixent **A1/B1/B2/A2, 32 sessions mesurées et 400 actions** contre une référence 0.49 fraîche. Seules huit chauffes déclarées, soit 24 actions, sont exclues. Les sessions mesurées et résultats défavorables restent tous inclus.

Pour **chaque jeu séparément**, la hausse de médiane groupée des huit sessions complètes par version doit être **strictement inférieure à +10 %** ; l’égalité échoue. Les dépassements de phase peuvent être acceptés sous cette condition et restent publiés avec leurs diagnostics et p95 disponibles. Les jeux ne se compensent pas, les phases imbriquées ne s’additionnent pas et les ratios de cohortes ne sont pas moyennés.

Le [précontrôle statique](performance/static-preflight.json) passe **52/52**, la [revue indépendante des entrées et du gel](diagnostic/cost-protocol-review.json) **56/56**, et le [contrôle de protocole](performance/protocol-check.json) passe sans mesure. Ces reçus ne certifient pas la disponibilité fonctionnelle finale ou l’isolation d’une fenêtre exécutée. L’[accusé de coordination](performance/other-lane-quiet-acknowledgement.json) réserve le créneau partagé à 3I ; les travaux 4A non publiés ne contribuent à aucun résultat de cette livraison.

<!-- COST_RESULT_START -->
**Coût officiel accepté sur les deux jeux : STCK −1,421099 %; SMLP +2,192594 %.** La [décision globale](performance/global-budget-decision.json), le [rapport complet](performance/results.md) et la [revue indépendante](performance/consolidation-review.json) conservent les 32 sessions / 400 actions et les **231/231 contrôles**. Le [reçu de disponibilité](performance/readiness.json) précède la [fenêtre complète](performance/window.json).

| Jeu | Référence 0.49, ms | Natif 0.50, ms | Variation globale | Budget strict < +10 % |
| --- | ---: | ---: | ---: | --- |
| STCK | 11 041,932 | 10 885,016 | −1,421099 % | Accepté |
| SMLP | 17 831,742 | 18 222,719 | +2,192594 % | Accepté |

Le classement historique reste **16/16 diagnostics historiques** ; cohorte 1 **16/16**; cohorte 2 **9/16**. Dépassements agrégés : aucun dépassement agrégé de médiane. Hausses de p95 calculables supérieures à +10 % : STCK `known_prefix_guard` **+204,948804 %**; STCK `persistence` **+10,556619 %**; STCK `restoration` **+31,388401 %**. Les journaux complets sont conservés par le [reçu de transport](performance/log-transport.json).

Une cohorte prise séparément conserve un dépassement global : cohorte 2, STCK **+11,480161 %**. La règle préannoncée porte sur les huit sessions par version et par jeu, toutes cohortes regroupées ; cette réserve de cohorte reste visible sans modifier le seuil.
<!-- COST_RESULT_END -->

## Conservation, transport et publication

Les sources gelées, attentes originales, journaux, refus et résultats défavorables restent conservés. Les parties de l’archive source identifient leurs octets ; les preuves `.json.gz` conservent leur contenu intégral. Les scripts de [transport](../../../scripts/evidence-byte-parts.py), de [conservation des journaux](record-log-transport.py) et de [vérification de publication](verify-publication-inputs.py) sont des outils de livraison, pas des preuves d’exécution réussie par leur seule présence.

Le [reçu d’intégrité](final/delivery-integrity.json) passe sur **270 fichiers natifs, 281 fichiers d’archive, 619 entrées source/tests, 335 entrées de build et 22 entrées d’exécution des régressions**, avec **1 786 originaux inchangés**. **Six rapports, quarante parties et 32 899 809 octets** sont reconstruits à l’identique dans un répertoire initialement vide, puis comparés aux originaux conservés. Cette vérification de transport ne relance aucun test, build, jeu ou comparaison source et ne décide pas du coût.

<!-- PUBLICATION_RESULT_START -->
Le [précontrôle final](publication-preflight.json) lie les résultats réels au gel et aux documents finalisés. L’[index des empreintes](evidence-index.json) recense les pièces retenues, les nouvelles sources, les tests et les outils de preuve, avec toutes les tentatives WEAV. La publication privée Sites associe l’archive de l’application au commit intégral synchronisé ; son identifiant effectif de version et son commit sont portés par les métadonnées Sites, séparément des empreintes natives de ce dossier.
<!-- PUBLICATION_RESULT_END -->

Les réserves conservées comprennent le préfiltre géométrique sans préemption interne, les bornes numériques et de recherche retournant `unknown`, la distinction entre atomicité propre et transaction générale, les hypothèses conditionnelles de support/score/alternance, la compatibilité Unicode qualifiée et la parité partielle de l’appelant hérité. La prochaine entrée planifiée reste `observed_feedback_sequence` ; aucun travail 4A n’est présenté ici comme livré.
