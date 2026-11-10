# Preuves du lot 3H — CrossedPrefix, native 0.49

Le [rapport de livraison](../lot3h-crossed-prefix.md), la [filiation source](../lot3h-crossed-prefix-lineage.md) et la [feuille de route](../v6-delivery-roadmap.md) distinguent transfert technique, intégration, contribution en jeu, non-régression et coût. Le gel candidat contient **268 fichiers natifs**, avec une archive de **279 fichiers**, digest **`d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054`**. La référence est **Site 76 / native 0.48**, commit `fbbc3fb6b796c0ba359654da7234008767090e1f`.

## Identités et validation formelle

| Pièce | Portée vérifiée |
| --- | --- |
| [Provenance de la référence](baseline/provenance.json) et [inventaire 0.48](baseline/source-manifest.json) | Véritable checkout publié, digest `fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26`, 266 fichiers natifs |
| [Manifeste candidat](final/source-manifest.json), [archive](final/source-archive.json), [parties de l’archive](final/source-archive-parts.json) | Gel 0.49, 268 fichiers natifs et 279 fichiers d’archive |
| [Périmètre formel déclaré](formal-test-scope.json) et [tests](final/validation/delta-tests-run.json) | **2 782/2 782 tests dans 71 fichiers**, sans échec, annulation, test ignoré ni TODO |
| [Contrôles du projet](final/validation/checks-run.json) | **5/5**, compilation comprise ; sorties exactes conservées en gzip |
| [Rejeux publics](final/regressions/regression-summary.json) et [cas déclarés](recorded-regression-cases.json) | **4/4 cas, 68/68 contrôles**, CATR/RSWP/FOGW/VOIS, 159 actions et 88 préfixes |
| [Revue indépendante de l’intégration](diagnostic/shared-integration-review.json) | **20/20 contrôles de lecture**, propriétaire unique, emplacement du digest, dispatch, refus et limites explicites |

Le périmètre formel est le delta déclaré. Les rejeux restent des contrôles de non-régression, sans nouvelle victoire attribuée à CrossedPrefix. La revue statique ne remplace pas une exécution.

## Oracle indépendant et compatibilité publiée

La [fixture originale](../../../tests/fixtures/v6-crossed-prefix-reference.json.gz), son [générateur](../../../scripts/export-v6-crossed-prefix-reference.py) et le [reçu d’export](diagnostic/source-oracle-export.json) conservent **28 géométries, 7 mesures de contrôleurs, 35 helpers, 38 propositions, 34 gardes/liaisons, 17 acquisitions, 7 cas d’événements, 6 restaurations et 3 chaînes froides**. Ces ensembles ne constituent pas un total de tests natifs disjoints. Douze exceptions source sont conservées ; les **1 786 fichiers originaux** sont vérifiés avant et après. Aucun moteur, spécification, solution ou sortie native ne fournit les attentes.

Le [reçu de projection et d’intégration](diagnostic/projection-integration-targeted.json) conserve **81/81 tests de projection** et **24/24 tests d’intégration**, avec le premier résultat **78/79** et sa qualification de domaine à largeur nulle. La projection de production n’a pas changé pour masquer ce cas. Les deux véritables égalités du `Counter` ajoutées à l’oracle expliquent le passage de 79 à 81 cas.

Le [reçu final d’accès](diagnostic/crossed-prefix-access-final-targeted.json) conserve **111/111 tests**, source propre, données détenues, gardes, retours, budgets et atomicité. Il remplace, pour la fixture courante, le [reçu ciblé précédent](diagnostic/crossed-prefix-access-targeted.json), lui-même conservé avec ses journaux. Les premiers passages 109/109 et 110/110 restent archivés.

Les [onze checkpoints 0.48](../../../tests/fixtures/v6-crossed-prefix-legacy-checkpoints.json.gz), produits par le [générateur de compatibilité](../../../scripts/export-v6-crossed-prefix-legacy-checkpoints.mjs), comprennent FramedWindow et un journal CrossedPrefix minimal déjà accepté par la publication. Les fragments opaques sont conservés sans inventer leurs champs absents. Cette compatibilité porte sur le domaine vérifié ; le changement d’ordre UTF-16 vers les points de code Unicode peut modifier le digest d’un ancien journal artificiel contenant des chaînes d’action arbitraires hors BMP. Les actions du protocole et les onze checkpoints conservent leur digest.

## Contrôleur commun et contribution synthétique

La [preuve complète](final/crossed-prefix-common-loop.json.gz), produite par [prove-crossed-prefix-common-loop.mjs](../../../scripts/prove-crossed-prefix-common-loop.mjs), passe **23 groupes de contrôles** dans **trois sessions synthétiques froides**. Elle conserve les priorités et déclarations source, sans état appris injecté.

Les **17 retours** comprennent **10 commandes CrossedPrefix et 7 commandes CellPatch prioritaires**, toutes acquises une fois. Les offres concurrentes CellPatch reçoivent des retours synthétiques inchangés ; elles ne sont pas retirées pour forcer la sélection. Les trois branches couvrent une paire compatible, une absence d’effet puis un nouvel essai, et une réfutation suivie d’exploration commune. Trois retours invalides sont refusés sans mutation. Deux ablations de composant retirent chacune un événement effectivement acquis et changent l’action ou le refus au même contexte.

Les reçus comptent **zéro action, niveau ou victoire de jeu**. La preuve ne revendique ni une ablation du contrôleur complet ni la parité de tout l’appelant original. Les [probes initiaux](diagnostic/common-initial-probe.json), [de préambule](diagnostic/common-prelude-probe.json.gz) et [des chaînes](diagnostic/common-chains-probe.json.gz) restent des diagnostics de développement distincts de l’exécution finale gelée.

Le rapport de **1 610 258 octets**, SHA-256 `e46a4025d074fa6bf7dabf94f690bf4bcc8e15c6da5c64995f5d224fb5f25d18`, se reconstruit à partir de ses [deux parties](final/crossed-prefix-common-loop.json.gz.parts.json). Le [reçu de transport](final/common-loop-transport.json) vérifie les octets reconstruits. Le [journal exact](final/crossed-prefix-common-loop.log.gz) et son [reçu gzip](loop-log-transport.json) restent conservés sans relancer le producteur.

## WEAV : déclaration, résultat et attribution

<!-- WEAV_RESULT_START -->
**WEAV réussit trois niveaux en une session froide : 81 actions et 81 préfixes, avec arrivée naturelle au niveau 4.** Les frontières surviennent aux actions **27, 54 et 81**. La [résolution du cas](final/weav-resolution.json) conserve la campagne, l’attribution et l’horloge. Le temps actif est **243,552986 secondes** ; il ne remplace pas le temps cumulé de diagnostic.

Le scan initial porte sur **96 vues publiques**, avec une admission WEAV et zéro exception. La reprise conserve l’échec historique du lot 2B : **97 actions, aucun niveau, 474,037204 secondes déjà consommées**. Le cas se clôture le **10 novembre 2026 à 13:32:44 UTC−03**, après **803,745411 secondes supplémentaires**, soit **1 277,782615 secondes cumulées** et **1 122,217385 secondes restantes**. La [référence 0.48 fraîche](baseline-case-phase.json) est plafonnée aux huit actions annoncées et reste à zéro niveau ; cette référence bornée ne constitue pas un verdict complet d’impossibilité.

La [vérification source/native](diagnostic/weav-public-parity.json) passe **3 596/3 596 contrôles** : **82 observations publiques, 81 propositions et liaisons, 81 retours, 159 événements acquis** (81 états, 54 entrées d’axe et 24 paires), **163 restaurations source et 162 natives**. Le recalcul part à froid ; l’état capturé dans un plan ne sert jamais à amorcer la mémoire. Les deux retours réellement sans effet et leurs blocages sont conservés.

Les **324 ablations de composant** concordent entre source et natif : **191 changements d’action ou de refus**, **133 résultats négatifs ou inchangés**. Retirer les paires modifie 53 choix, les entrées d’axe 4, les états locaux 75 et le dernier retour acquis 59. Les 215 changements de projection de décision ne sont pas confondus avec les 191 changements d’action/refus. Cette preuve établit une contribution aux contextes rencontrés ; elle ne représente ni une ablation de l’appelant complet ni quatre campagnes alternatives.

Le [navigateur](final/browser/browser-qa.json) confirme **81 actions, trois niveaux et 81 plans**, après Pause à une action, action isolée puis reprises aux trois frontières naturelles. Les [observations d’interface](final/browser/weav-native049-browser-ax.json) conservent les compteurs successifs 1/0/1, 2/0/2, 27/1/27, 54/2/54 et 81/3/81. La [capture finale](final/browser/weav-native049-browser.png) montre le plateau du niveau 4 après navigation vers l’ancre PLAYGROUND ; cette navigation a réaffiché le panneau manuel, et les compteurs sont prouvés par la dernière observation enregistrée auparavant. Aucun saut de niveau ni action manuelle de jeu ne fournit le résultat.

Les originaux restent inchangés. La parité de toute la trajectoire propre sélectionnée ne clôt ni l’héritage complet ni l’ensemble de la migration.
<!-- WEAV_RESULT_END -->

## Coût officiel

<!-- COST_RESULT_START -->
**Le coût global 0.49 est accepté sur 2/2 jeux**, selon la [règle autorisée](performance/global-budget-policy.json) et la [décision finale](performance/global-budget-decision.json). **3H est clôturé dans son périmètre annoncé**, avec validation fonctionnelle, contribution propre WEAV, intégrité et coût acquis.

| Jeu | Médiane 0.48 fraîche | Médiane 0.49 | Variation globale |
| --- | ---: | ---: | ---: |
| STCK | 10646,177953 ms | 10468,810379 ms | **−1,666021 %** |
| SMLP | 17105,686086 ms | 17561,375825 ms | **+2,663966 %** |

La [fenêtre complète](performance/window.json) conserve **A1/B1/B2/A2**, **32 sessions mesurées et 400 actions**, sans exclusion de session mesurée ni de valeur extrême. Seules les huit chauffes déclarées, soit 24 actions, sont exclues. La médiane des huit sessions par jeu/version reste **strictement sous +10 % pour chacun des deux jeux**. Il n’y a ni compensation entre jeux, ni somme de phases imbriquées, ni moyenne des ratios des cohortes.

Le diagnostic agrégé conserve **15/16 critères**, avec **acquisition/persistance SMLP +15,162882 %**. Les cohortes restent **14/16 puis 12/16**. Le dépassement agrégé est accepté sous votre règle globale, tout en restant un dépassement dans le comparateur de phases inchangé. Les p95 agrégés augmentent notamment de **11,586919 % pour la persistance STCK**, **13,128495 % pour une nouvelle décision SMLP** et **21,013350 % pour la restauration SMLP**. Tous les diagnostics, effectifs, dispersions et résultats défavorables sont conservés dans le [rapport complet](performance/results.md).

La [revue arithmétique](performance/consolidation-review.json) passe **231/231 contrôles**. Ces mesures portent sur la boucle commune rejouant les retours publics ; elles excluent le moteur du jeu, le rendu du navigateur et le réseau de production. Elles ne garantissent pas le coût de toute future session ni la fermeture des réserves fonctionnelles.
<!-- COST_RESULT_END -->

## Conservation, reconstitution et réserves

Les états de référence, tests, journaux, refus, résultats défavorables et limites ne sont pas supprimés. Les archives de source conservent leur format propre ; les grands rapports `.json.gz` utilisent le transport exact par parties. Les commandes de restauration ne recalculent ni résultat de jeu ni coût :

```bash
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3h-evidence/final
python -B scripts/evidence-byte-parts.py verify docs/migration/lot3h-evidence
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3h-evidence
```

Le répertoire contient les manifestes nécessaires pour reconstruire les octets conservés. L’[index final](evidence-index.json), le [contrôle de publication](publication-preflight.json) et l’[intégrité de livraison](final/delivery-integrity.json) lient les documents et preuves de la livraison. Les grands rapports, y compris la comparaison source WEAV et la référence bornée, se reconstruisent depuis les parties conservées dans leurs répertoires respectifs.

La filiation et la revue conservent les limites suivantes : parents RepeatedLine/SupportedLine partiellement transférés ; comparaison d’intersection au pixel central ; identité du champ conservé non entièrement reconstruite ; garde propre distincte de l’authentification complète ; préfiltre géométrique sans préemption par pixel ; compatibilité Unicode limitée au domaine vérifié ; atomicité propre et de restauration distincte d’une transaction générale entre toutes les couches. La reprise WEAV garde son compteur cumulé. CWSE, SK48, FOGW et VOIS ne reçoivent aucune nouvelle tentative dans cette livraison.
