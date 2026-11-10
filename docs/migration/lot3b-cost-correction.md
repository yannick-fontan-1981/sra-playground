# Lot 3B : correction générique du coût de restauration

## État et objectif

**La correction actuelle Logos Engine 0.40.0, gel `final-v3` / `391a279`, est validée fonctionnellement, mais son budget officiel reste non conforme : `budget_review_required`, 14/16 médianes.** Les deux dépassements concernent SMLP : **acquisition et persistance +11,641662058 %**, **restauration +14,988511609 %**. La restauration STCK est dans le seuil agrégé à **+4,218399745 %**. La dispersion ne compense aucun dépassement ; **3B reste ouvert et 3C attend sa clôture**. Le [bilan officiel complet](lot3b-cost-evidence/performance-v2/results.md) conserve les deux cohortes échouées, les 32 sessions et les 400 actions. Sa [revue indépendante](lot3b-cost-evidence/performance-v2/consolidation-review.json) passe **231 vérifications** et confirme le même échec du budget.

Le gel actuel, digest **`391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`**, possède **1 322/1 322 tests réussis dans 35 fichiers**, les contrôles du projet et **34/34 régressions CATR/RSWP** réussis. CATR est confirmé en **12 actions, trois niveaux et huit plans**, en campagne froide et dans le navigateur sur les sources gelées. Les quatre diagnostics normaux v2 passent six contrôles exacts par cas, avec différences d'effectifs et de témoins et `strictFinalEquality: false` conservés. Ces preuves fonctionnelles ne valident pas le budget ; les résultats mixtes de durée restent visibles. Aucun numéro ni succès de publication n'est anticipé dans ce bilan.

Le **premier essai de correction**, gel `f0ba`, reste conservé comme résultat distinct : **14/16**, restauration STCK **+66,160 %** et SMLP **+21,511 %**, avec **1 272/1 272 tests dans 33 fichiers**, 34/34 régressions et CATR 12/3/8 acquis sur cette ancienne source. Sa [consolidation](lot3b-cost-evidence/performance/results.md), ses deux cohortes échouées, sa revue de 231 contrôles et tous ses reçus restent intacts. La nouvelle correction modifie quatre fichiers natifs et dispose d'un protocole distinct avec une référence 0.38 entièrement remesurée ; aucun ancien échantillon n'est fusionné avec elle.

La base fonctionnelle est la **publication 67**, moteur **0.39.0**, commit `81b937373b80e8c92c36856da0ec46b37db38956`. Le [lot 3B fonctionnel](lot3b-relational-chamber.md) a raccordé `chamber_relation_plan`, conservé les contrats V5/V6 et réussi les trois premiers niveaux de **CATR en douze actions et huit préfixes**, dans une session. Ces résultats historiques restent acquis avec leur portée.

Le [budget officiel 0.39](lot3b-evidence/performance/combined-comparison.json) reste **`budget_review_required`, 15/16**. La médiane de restauration STCK est passée de **9,104383 à 10,8056025 ms**, soit **+18,6857198 %**, au-dessus du seuil +10 %. La première cohorte a conservé 15/16, la seconde 16/16 ; l'agrégat annoncé incluait toutes les sessions et demeure non conforme. La baisse du temps de session et la dispersion n'annulent pas ce dépassement.

La correction vise le chemin commun de restauration. Elle doit conserver les identités, révisions, invalidations, gardes, acquisitions uniques, anciens checkpoints et transactions de restauration. Les logiques source V5/V6 et les décisions génériques restent le cadre de référence ; aucun identifiant de jeu, parcours attendu ou solution n'est introduit.

## Diagnostic initial disponible

Le [rejeu instrumenté initial STCK10](lot3b-cost-evidence/diagnostic/stck-before.json.gz) utilise la version 0.39 publiée, dont les sources restent inchangées pendant l'exécution. Il acquiert **dix actions**, termine **deux niveaux**, atteint naturellement le niveau 3 et conserve **seize requêtes**. Il constitue un diagnostic borné, pas une nouvelle réussite de trois niveaux.

| Mesure initiale | Appels | Total | Médiane |
| --- | ---: | ---: | ---: |
| `runtime.restoreFamilies` | 12 | 265,733325 ms | 11,882283 ms |
| Restauration native de l'inventaire observé | 12 | 75,487201 ms | 3,882912 ms |
| Restauration native de la série commune | 22 | 61,520154 ms | 0,1683405 ms |

Ces phases s'imbriquent et ne s'additionnent pas. Elles localisent du travail à examiner ; **elles n'attribuent pas à Chamber la cause du dépassement historique**. Le diagnostic complet, ses limites et les règles de comparaison figurent dans [diagnostic/results.md](lot3b-cost-evidence/diagnostic/results.md).

## Transformations du premier essai corrigé

Le périmètre du gel `f0ba` comporte un [témoin exact d'état de travail mutable](../../src/logos-engine/v6-native-working-witness.ts), la réutilisation sous preuve d'une restauration de l'[inventaire observé](../../src/logos-engine/v6-observed-inventory.ts) et la suppression d'une seconde validation du même témoin de [série commune](../../src/logos-engine/v6-shared-series.ts) dans un même chemin. Ces transformations conservent les refus de réutilisation, l'invalidation sur mutation et le repli vers la restauration complète. Leurs validations fonctionnelles ne suffisent pas à établir une amélioration de coût : l'essai officiel décrit ci-dessous échoue sur la restauration des deux cas.

Les originaux V5/V6 restent inchangés. L'optimisation porte sur du travail de l'enveloppe native ; elle ne supprime aucune connaissance, contre-exemple ou obligation de contrôle. La validation formelle du périmètre affecté est réussie sur le gel corrigé ; elle ne représente pas l'ensemble de la suite historique ni une parité globale.

## Premier gel conservé et correction du cas supplémentaire

Le [reçu du gel préliminaire](lot3b-cost-evidence/diagnostic/preliminary-freeze.json) conserve le digest natif `55192314213367a8c35e579b8cba17a022146359e1a76efcc1ae9caf5f6ce9cc`, **249 fichiers natifs**, une archive de **260 fichiers** et la [validation de 1 270/1 270 tests dans 33 fichiers](lot3b-cost-evidence/final/validation/delta-tests-run.json). Ces octets et ce succès restent inchangés dans `final/` ; ils identifient la première correction, pas la source finale à livrer.

La dernière relecture a trouvé un cas adverse concret : un `Map` dont le prototype est entièrement détaché, avec un itérateur hérité dépendant d'une fermeture mutable, peut échapper à une détection par `instanceof Map`. Le témoin ne doit pas certifier cet état comme entièrement suivi. L'[exécution ciblée avant correction](lot3b-cost-evidence/diagnostic/detached-iterator-before.json) reproduit **un test échoué**, avec les sources préliminaires inchangées et le TAP complet conservé. La correction classe les itérables hérités hors tableau comme non suivis, sans déclencher leurs getters, puis conserve le chemin source de repli. L'[exécution après correction](lot3b-cost-evidence/diagnostic/detached-iterator-after.json) passe **232/232 tests dans cinq fichiers**, dont exactement le cas qui échouait. Ce contrôle ciblé reste distinct de la nouvelle validation formelle complète.

Le [gel 0.40.0 de ce premier essai officiel](lot3b-cost-evidence/final-v2/source-manifest.json) contient **249 fichiers natifs**, digest **`f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`**, et une [archive de 260 fichiers](lot3b-cost-evidence/final-v2/source-archive.json). Les 33 fichiers du périmètre formel ont été entièrement réexécutés sur ce gel : **1 272/1 272 tests réussis**, sans échec, skip ou annulation. Le [protocole officiel](lot3b-cost-evidence/performance/protocol.md) conserve un amendement daté avant toute mesure, portant sur ce nouveau chemin de source gelée ; paramètres, ordre, seuil et exclusions restent inchangés. Le dossier `final-v2/` et tous ses reçus sont conservés après le résultat de coût non conforme ; ils ne désigneront pas la correction suivante.

## Vérifications acquises sur le premier essai `f0ba`

| Contrôle | État actuel |
| --- | --- |
| Sources et archive corrigées | **249 fichiers natifs, archive de 260 fichiers**, gel corrigé dans `final-v2/` ; premier gel conservé dans `final/` |
| Cas adverse d'itérateur hérité | Un échec reproduit avant correction ; **232/232 tests ciblés dans cinq fichiers après correction**, dont le même cas |
| Tests des contrats affectés et de leurs intégrations | **1 272/1 272 tests, 33 fichiers**, sources et entrées inchangées ; [reçu formel](lot3b-cost-evidence/final-v2/validation/delta-tests-run.json). Les **1 270/1 270** du premier gel restent rattachés à leur ancienne source |
| Typecheck, audits, contrôle du diff et build | **Réussis** sur le gel `f0ba` ; [reçu](lot3b-cost-evidence/final-v2/validation/checks-run.json) |
| Diagnostic STCK10 après correction | **Sept contrôles limités réussis**, dix commandes, quatre états propres, seize requêtes et effectifs exacts ; `strictFinalEquality: false` conservé ; [comparaison](lot3b-cost-evidence/diagnostic/scoped-behavior.json) |
| Régressions CATR et RSWP | **Deux cas réussis, 34/34 contrôles**, entrées et sources inchangées ; [résumé](lot3b-cost-evidence/final-v2/regressions/regression-summary.json) |
| CATR live | **12 actions, trois niveaux, huit préfixes, une session**, arrivée naturelle au niveau 4 ; [exécution froide](lot3b-cost-evidence/final-v2/catr-cost-session/execution-catr.json) |
| Navigateur | **12 actions, trois niveaux, huit plans**, pauses à zéro et cinq actions, reprise du préfixe partiel ; prévisualisation Vite des sources gelées, [reçu](lot3b-cost-evidence/final-v2/browser/browser-verification.json) |
| Coût officiel du gel `f0ba` | **Non conforme, `budget_review_required`, 14/16** ; restauration STCK **+66,160 %**, SMLP **+21,511 %** ; [agrégat](lot3b-cost-evidence/performance/combined-comparison.json) |
| Revue indépendante de la consolidation | **231 vérifications réussies**, 32 sessions uniques et 400 actions ; elle confirme l'arithmétique et conserve l'échec du budget ; [reçu](lot3b-cost-evidence/performance/consolidation-review.json) |

La prévalidation en lecture seule du [manifeste des régressions](lot3b-cost-evidence/recorded-regression-cases.json) est réussie. Les deux références totalisent **31 commandes, 33 paquets publics complets, 336 images avec animations, 19 préfixes, 50 requêtes et six frontières naturelles**. Cette prévalidation a exécuté **zéro rejeu** et ne valide pas le moteur corrigé.

Les deux rejeux froids ont maintenant terminé. CATR conserve **12 actions, trois niveaux, huit préfixes** ; RSWP conserve **19 actions, trois niveaux, onze préfixes**. Chacun garde une session et arrive naturellement au niveau 4 en `NOT_FINISHED`. Les **17 contrôles historiques par jeu**, soit **34/34**, sont réussis sans modification du comparateur, sur les 31 commandes, 33 paquets et 336 images annoncés. Les références 0.39 possèdent déjà les champs Chamber. L'ancien échec strict RSWP 0.38 → 0.39 à **16/17** et sa qualification séparée restent conservés ; cette nouvelle réussite compare d'autres versions et ne les efface pas.

La [campagne CATR live corrigée](lot3b-cost-evidence/final-v2/catr-cost-session/execution-catr.json) utilise le même gel natif et l'hôte opaque. Elle confirme les trois premiers niveaux dans une mémoire froide et une seule session, sans état appris importé ni saut de niveau. Son état final reste `NOT_FINISHED` au niveau 4. Cette confirmation de la réussite antérieure ne constitue pas une nouvelle capacité de jeu et sa durée ne fournit pas un ratio de performance officiel.

Le [contrôle navigateur](lot3b-cost-evidence/final-v2/browser/browser-verification.json) utilise la prévisualisation Vite des **sources TypeScript gelées**. Il confirme une pause initiale à zéro action, la conservation d'un préfixe partiellement exécuté à deux actions, une pause à **cinq actions, un niveau et trois plans**, puis les frontières naturelles **3/1/2**, **7/2/5** et **12/3/8** en actions/niveaux/plans. La même session est conservée, sans action manuelle de jeu, reset ou saut de niveau, et l'inspecteur reste fermé. La [capture finale](lot3b-cost-evidence/final-v2/browser/catr-browser.png) conserve l'arrivée au niveau 4. Ce contrôle de sources est distinct du build de production : il ne constitue pas un test du fichier worker compilé dans `dist`. Le preview est arrêté avant la fenêtre de coût isolée.

Le [comparateur des profils inchangé](lot3b-cost-evidence/diagnostic/scoped-behavior.json) retourne `scoped_behavior_identical` : **sept contrôles vrais**, dont les dix commandes, les quatre états de propriétaires retenus, les champs annoncés des seize requêtes et les effectifs d'appels exacts. Aucune différence d'effectif n'a donc été qualifiée séparément. Le champ **`strictFinalEquality` reste `false`** ; les rapports conservent durées, provenance et identités de graphe. Ce résultat ne représente ni une identité du graphe ou snapshot entier ni une décision de coût.

Le profileur remplace les méthodes de projection des familles, dont `state`, pour les observer. Cette personnalisation **désactive la réutilisation certifiée de l'inventaire** et conserve la validation complète. Le profil corrigé vérifie donc ce chemin instrumenté de repli ; il ne mesure pas le gain d'un succès du cache de l'inventaire. La durée du rejeu instrumenté monte de **12 017,787 à 14 351,903 ms** et la médiane de `runtime.restoreFamilies` de **11,882283 à 13,759925 ms**. Ces hausses restent au bilan, sans attribution causale complète. Le runner officiel n'enveloppe que les méthodes du runtime, pas ces projections de famille : il mesure le chemin courant avec leurs identités intactes. Le code de production n'admet pas spécialement le profileur.

## Résultat officiel de coût : premier essai conservé

Le [protocole préalable](lot3b-cost-evidence/performance/protocol.md) compare **0.38.0 fraîche** à la correction **0.40.0 gelée `f0ba`**. Le [manifeste de référence](lot3b-cost-evidence/base/source-manifest.json) conserve **245 fichiers natifs**, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`.

La [fenêtre officielle](lot3b-cost-evidence/performance/window.json) s'est terminée le **10 novembre 2026**, de **01:23:37,298776 à 01:32:40,293060 UTC**. Deux cohortes de quatre sessions par jeu/version sont exécutées dans l'ordre **A1, B1, B2, A2**, soit **huit sessions par jeu/version, 32 sessions mesurées et 400 actions**. STCK conserve dix actions par session et SMLP quinze. Les seules exclusions sont les huit sessions de chauffe de trois actions préalablement annoncées, soit 24 actions. Sources, entrées et travail comparé restent identiques dans le périmètre vérifié ; toutes les sessions et les deux cohortes restent au bilan.

La clôture exige **16/16 médianes au plus à +10 %**, un statut agrégé `passed` et aucune métrique non résolue. L'[agrégat](lot3b-cost-evidence/performance/combined-comparison.json) conserve **14/16**, statut **`budget_review_required`**. Les variations sont les suivantes ; chaque cellule est un critère distinct du budget.

| Phase | STCK, variation de médiane | SMLP, variation de médiane |
| --- | ---: | ---: |
| Session complète | −0,113 % | −0,357 % |
| Nouvelle décision | −3,564 % | +3,465 % |
| Service de continuation | +1,504 % | −13,893 % |
| Requête de continuation avec transport | +0,529 % | −9,962 % |
| Garde de continuation | −3,080 % | −5,706 % |
| Acquisition et persistance | +3,409 % | −2,085 % |
| Persistance | +0,816 % | −1,204 % |
| Restauration | **+66,160 %, non résolu** | **+21,511 %, non résolu** |

La médiane STCK passe de **9,5947665 à 15,9426585 ms**, sur **96 restaurations par version**. Celle de SMLP passe de **4,716928 à 5,731593 ms**, sur **144 restaurations par version**. Les deux métriques sont `over_budget_with_noise_unresolved`. La baisse du temps de session ne les compense pas et la dispersion ne crée aucune tolérance supplémentaire.

La première cohorte reste **14/16**, avec dépassement de la nouvelle décision STCK et de la restauration SMLP. La seconde reste **13/16**, avec dépassement de la restauration STCK et des phases acquisition/persistance et restauration SMLP. Les distributions regroupées déterminent l'agrégat annoncé ; ni les cohortes ni leurs échecs ne sont supprimés. La [revue indépendante](lot3b-cost-evidence/performance/consolidation-review.json) reproduit les calculs sur les **32 sessions uniques et 400 actions**, passe **231 contrôles** et confirme le même échec du budget. Le [rapport de coût complet](lot3b-cost-evidence/performance/results.md) conserve les seize médianes, p95, dispersions, résultats par cohorte, pauses et inspections.

La cause précise des hausses n'est pas établie par la comparaison. Le diagnostic de famille instrumenté exerce le repli de l'inventaire et ne permet pas d'attribuer ces hausses au cache ou à Chamber. Aucun seuil, comparateur ni résultat de cette fenêtre n'est corrigé a posteriori. Une correction concrète supplémentaire du chemin commun doit précéder un nouveau gel et un nouveau protocole distinct ; une nouvelle mesure favorable du même code ne remplace pas cet échec.

Le coût du jeu, du réseau de production, du rendu navigateur et de l'inspection après rejeu reste distinct. Les phases imbriquées ne s'additionnent pas. Ces sessions bornées ne prouvent pas une stabilité sur plusieurs heures.

## Correction actuelle `final-v3` : validation fonctionnelle acquise, coût non conforme

Le [nouveau manifeste](lot3b-cost-evidence/final-v3/source-manifest.json) conserve **249 fichiers natifs**, digest **`391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`**, et une [archive de 260 fichiers](lot3b-cost-evidence/final-v3/source-archive.json). Par rapport à `f0ba`, les octets de `v6-native-owned.ts`, `v6-native-working-witness.ts`, `v6-observed-inventory.ts` et `v6-shared-series.ts` ont changé. Le numéro 0.40.0 commun aux deux corrections ne suffit donc pas à identifier les résultats ; chaque reçu doit être rattaché à son digest. Aucun reçu de `final-v2/` n'est transféré au nouveau gel.

Le périmètre formel élargi à **35 fichiers de tests** a été entièrement réexécuté sur la source `391a279` : **1 322/1 322 tests réussis**. Les contrôles du projet, régressions CATR/RSWP et confirmations de jeu disposent maintenant de leurs propres reçus. Les résultats antérieurs cités plus haut restent attachés à `f0ba` ; les nouvelles preuves ci-dessous portent explicitement sur `391a279`.

| Contrôle du nouveau gel | Résultat acquis |
| --- | --- |
| Suite formelle des contrats affectés | **1 322/1 322 tests dans 35 fichiers** ; [reçu](lot3b-cost-evidence/final-v3/validation/delta-tests-run.json) |
| Typecheck, audits, contrôle du diff et build | **Réussis** ; [reçu](lot3b-cost-evidence/final-v3/validation/checks-run.json) |
| Régressions froides CATR/RSWP | **Deux cas, 34/34 contrôles** ; [résumé](lot3b-cost-evidence/final-v3/regressions/regression-summary.json) |
| Nouvelle campagne froide CATR | **12 actions, trois niveaux, huit plans**, une session ; [exécution](lot3b-cost-evidence/final-v3/catr-cost-v3-session/execution-catr.json) |
| Navigateur sur les sources gelées | **12 actions, trois niveaux, huit plans**, pauses à zéro et cinq actions, reprise du préfixe partiel à deux actions ; [reçu](lot3b-cost-evidence/final-v3/browser/browser-verification.json) |
| Coût officiel `performance-v2` | **Non conforme, 14/16**, acquisition/persistance SMLP **+11,642 %**, restauration SMLP **+14,989 %** ; [agrégat](lot3b-cost-evidence/performance-v2/combined-comparison.json) |
| Revue indépendante du nouveau coût | **231 vérifications passées**, 32 sessions uniques et 400 actions ; l'échec du budget reste confirmé ; [reçu](lot3b-cost-evidence/performance-v2/consolidation-review.json) |

Le navigateur a vérifié la **prévisualisation Vite des sources TypeScript gelées**, dans la même session et sans action manuelle de jeu, reset ou saut de niveau. Les frontières naturelles sont **3/1/2**, **7/2/5** et **12/3/8** en actions/niveaux/plans, avec arrivée au niveau 4. La [capture finale](lot3b-cost-evidence/final-v3/browser/catr-browser.png) conserve ce résultat. Cette vérification de sources est distincte du test du worker compilé dans `dist` ; elle établit trois niveaux terminés, pas la victoire complète du jeu. Le preview est arrêté avant le début de la fenêtre officielle.

Un [diagnostic normal v2 préalable](lot3b-cost-evidence/diagnostic/normal-path-v2-protocol.md) fixe quatre sessions : STCK10 puis SMLP15 sur la source `f0ba` reconstituée dans un checkout isolé, puis STCK10 et SMLP15 sur `391a279`. Le générateur est identique dans les deux checkouts et conserve aussi l'identité de `restore` pour les familles qui ont `restoreNative`. Cette précaution permet de conserver les nouveaux gardes de production sans les désactiver pour le profileur. Les deux premiers profils exploratoires, dont le générateur observait `restore`, restent archivés avec leur instrumentation réelle ; ils ne servent pas de référence à la série v2.

Le [comparateur générique](../../scripts/compare-native-restoration-paths.mjs) exige six contrôles de comportement exacts : générateur, entrées, cas, commandes, quatre états propres et champs de requête annoncés. Il conserve séparément tous les écarts d'effectifs, résultats de témoins et durées, car cette nouvelle correction peut précisément éviter du travail. Il conserve aussi la valeur réelle de `strictFinalEquality`. Ses résultats ne revendiquent ni identité du graphe entier ni acceptation du budget. L'ancien comparateur et ses sept critères restent inchangés pour la première série instrumentée.

Les quatre sessions v2 sont terminées dans l'ordre annoncé, avec sources inchangées et copies avant identiques. Les comparaisons [STCK](lot3b-cost-evidence/diagnostic/normal-path-v2-comparison-stck.json) et [SMLP](lot3b-cost-evidence/diagnostic/normal-path-v2-comparison-smlp.json) donnent toutes deux **`scoped_behavior_identical`, six contrôles vrais**, et conservent **`strictFinalEquality: false`** et **`witnessResultsExact: false`**. STCK conserve dix actions, deux niveaux et seize requêtes ; SMLP quinze actions, trois niveaux et vingt-quatre requêtes. Les huit méthodes source de restauration gardent leur identité dans les quatre profils.

Les captures du témoin Inventory passent de **14 à 13 sur STCK**, de **21 à 19 sur SMLP** ; les vérifications Shared passent de **66 à 59** et de **54 à 42**. Les autres effectifs agrégés demeurent égaux, tandis que le placement de certaines captures passe de `advance` à `resume`. Toutes les différences sont détaillées dans [le bilan diagnostique](lot3b-cost-evidence/diagnostic/results.md). La médiane instrumentée de `restoreFamilies` monte sur STCK de **12,3023335 à 15,3987935 ms**, et descend sur SMLP de **8,059371 à 6,465182 ms**. Ces observations mixtes n'établissent ni amélioration globale ni conformité au budget officiel.

Le [nouvel essai officiel `performance-v2`](lot3b-cost-evidence/performance-v2/protocol.md), déclaré avant mesure le **10 novembre 2026 à 02:06:31 UTC**, compare une nouvelle référence 0.38 au gel `391a279`. Les cas et la politique sont copiés exactement : **deux cohortes, ordre A1/B1/B2/A2, huit sessions par cas/version, 32 sessions et 400 actions**, mêmes chauffes et seuil **+10 % sur chacune des seize médianes**. Aucun échantillon ancien n'est réutilisé, aucune tolérance n'est ajoutée, aucun résultat de la fenêtre précédente n'est retiré.

La [fenêtre effective](lot3b-cost-evidence/performance-v2/window.json) s'est déroulée le **10 novembre 2026, de 02:14:55,244567 à 02:24:16,686977 UTC**, après l'achèvement des validations, campagnes et diagnostics et l'arrêt du preview. Les quatre exécutions ont terminé avec code 0 et intégrité vérifiée. Leur statut technique `passed` n'accepte pas le budget. Après la fin de la fenêtre, les deux comparateurs de cohortes, l'agrégateur et la revue indépendante déclarés ont été exécutés successivement, sans nouvelle mesure.

| Phase du nouvel agrégat | STCK, variation de médiane | SMLP, variation de médiane |
| --- | ---: | ---: |
| Session complète | +2,133 % | +2,301 % |
| Nouvelle décision | +1,606 % | −3,365 % |
| Service de continuation | −4,625 % | −10,862 % |
| Requête de continuation avec transport | −3,536 % | −9,066 % |
| Garde de continuation | +3,544 % | −0,431 % |
| Acquisition et persistance | +4,370 % | **+11,642 %, non résolu** |
| Persistance | −4,688 % | +7,012 % |
| Restauration | +4,218 % | **+14,989 %, non résolu** |

Sur SMLP, la médiane d'acquisition/persistance passe de **987,2867115 à 1 102,223294 ms**, sur **72 échantillons par version**, et la restauration de **4,871004 à 5,601095 ms**, sur **144 échantillons par version**. Les deux dépassements restent **`over_budget_with_noise_unresolved`**. La restauration STCK passe de **11,0582455 à 11,5247265 ms**, sur **96 échantillons par version**, et respecte le seuil de cet agrégat. Cela ne compense pas SMLP et ne constitue pas une mesure isolée du gain entre les deux corrections, puisque chaque fenêtre possède sa propre référence fraîche.

La première cohorte reste **14/16**, avec restauration STCK **+10,266 %** et SMLP **+22,777 %**. La seconde reste **13/16**, avec garde de continuation STCK **+11,078 %**, acquisition/persistance SMLP **+12,112 %** et restauration SMLP **+13,801 %**. Toutes les sessions et les deux cohortes restent au bilan. La [revue indépendante](lot3b-cost-evidence/performance-v2/consolidation-review.json) reproduit les distributions et décisions, passe **231 vérifications**, confirme **32 sessions uniques et 400 actions** et conserve `budgetStatus: budget_review_required`. Le [rapport complet](lot3b-cost-evidence/performance-v2/results.md) présente les médianes absolues, p95, dispersions, pauses, inspections et limites.

Les résultats établissent une correction fonctionnellement validée avec **deux réserves de coût SMLP non résolues**. Ils ne prouvent pas la cause complète de ces dépassements. Aucun changement du seuil, aucune tolérance liée au bruit, aucune suppression d'échantillon ni nouvelle mesure favorable du même code ne remplace cette conclusion.

## Couverture et suite

Cette correction n'ajoute pas une entrée ni une nouvelle branche de stratégie. L'état fonctionnel 0.39 conserve **50/76 entrées complètes**, **deux branches sur six** pour `observed_composition_services`, Panel et Chamber, et **37 workflows compilés**. La migration globale reste ouverte.

**3B reste ouvert : les validations fonctionnelles sont acquises, mais le gel actuel conserve deux dépassements de coût SMLP.** La prochaine correction devra traiter l'acquisition/persistance et la restauration en conservant les obligations V5/V6, puis établir sa propre preuve sur une source réellement modifiée, avec gel et protocole annoncés avant mesure. Les deux essais échoués restent conservés. La branche **3C, `exposed_reception_plan`**, attend la clôture de cette exigence ; elle n'est pas prête à démarrer sur la seule base des tests ou du CATR réussi. La [feuille de route](v6-delivery-roadmap.md) conserve les onze lots et les sous-lots 2A/2B/2C ; elle est actualisée séparément avec ces résultats.
