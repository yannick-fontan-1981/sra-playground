# Lot 8B : version finale 0.67 et qualification de ses entrées

Le candidat final porte **0.67.0**, avec **69/76 entrées raccordées (90,8 %), dont 26/33 matérielles**. Sa référence reste la source réellement publiée dans **Site 107 / native 0.66.0**, commit `4ff7bf45286a8a19d34401988adca587253ae41e`. Ce dossier clôt la préparation fonctionnelle de la version finale ; la mesure officielle et la publication ont leurs étapes distinctes.

## Source finale et réutilisation des preuves

La [réservation](version-reservation.json) est visible dans le statut propre et la coordination partagée, sans verrou global. Elle sera revérifiée pendant la publication. Le commit `0f45ad517b9df98563bc03b79ee73dd3be10e362` fixe le seul changement de production depuis le candidat qualifié : le littéral `NATIVE_V6_IMPLEMENTATION`, de 0.66.0 à 0.67.0. Les **330 autres fichiers natifs sont identiques** ; la substitution inverse restitue exactement l'ancien runtime.

Le [manifeste final](candidate-native.json) contient 331 fichiers, digest canonique `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`. Le [manifeste publié](baseline-native.json) contient 329 fichiers, digest `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316`. La [réconciliation des entrées historiques](historical-input-reconciliation.json) vérifie 2 467 entrées communes sur l'union de 2 468, avec 2 466 identiques et une différence de version déclarée. Une entrée du cas fermé est exclue de tout nouvel accès individuel ; la comparaison Git agrégée ne montre aucun changement de son domaine. Les 42 entrées de régression restent exactes, dont onze archives conservées sous forme de parties opaques vérifiées.

Les **524 tests et sous-tests sur 23 modules** et les **11 régressions / 187 projections** conservent leurs résultats historiques et leurs limites. Ils ne sont pas présentés comme de nouvelles exécutions sous 0.67. Le nouveau numéro change le digest de la factory, les origines et chaînes de graphes, ainsi que les identités d'autorisation : les preuves sensibles à cette identité sont renouvelées.

## Contrôles réellement renouvelés

Le [plan initial](functional-execution-plan.json) fige **2 885 fichiers d'entrée** avant les commandes. Huit groupes de contrôle réussissent, avec entrées inchangées et processus enfants terminés : inventaire des fabriques, capture du candidat, lecture appariée, capture des chaînes BranchRouting, lecture de ces chaînes, audit des entrées, audit de migration, puis build incluant TypeScript.

| Contrôle | Résultat |
| --- | --- |
| Fabriques réelles A/B | 61 propriétaires publiés, 62 dans le candidat ; seul `branch_routing` est ajouté et les 28 programmes de familles sont préservés. |
| Formes du candidat | Quatre sessions froides, 31 commandes ; capture A historique exacte réutilisée. STCK10 conserve deux niveaux pour une cible de trois ; SMLP15 en conserve trois. |
| [Lecture appariée finale](work-qualify-02/graph-review.json) | 64 contrôles, 58 points, 22 312 différences attribuées, zéro différence inexpliquée. |
| [Chaînes BranchRouting finales](branch-qualify-01/graph-review.json) | Cinq chaînes, 26 retours, 23 acquisitions source réussies, une ablation et deux retours incomplets. |
| Graphes des chaînes | 64 points, 3 772 deltas et 51 appels réels de restauration. |
| Audit des entrées | 69/76, dont 26/33 matérielles. |
| Audit de migration | 215 composants vérifiés, 147 transferts partiels, 1 007 modules en attente, zéro complètement vérifié ; six portes globales fausses et aucun échec d'inventaire. |
| [Build final](build-manifest.json) | 74 fichiers statiques ; worker 0.67 avec BranchRouting, sans ancien littéral 0.66. |

La [première lecture appariée](work-qualify-01/receipt.json) est conservée au statut `failed`. Elle s'arrête avant les formes, car un second contrôle de générateur exige encore le générateur B pour le préflight de A. L'[amendement](paired-reader-amendment.json), le [diff limité](paired-reader-v2.diff), sa [revue indépendante](paired-reader-amendment-independent-review.json) et le [plan02](paired-reader-execution-plan-02.json) sont déclarés avant la nouvelle lecture. Le générateur de chaque ligne doit correspondre au reçu de son rôle, déjà lié à son empreinte exacte. Les captures ne sont pas régénérées, aucun contrôle sémantique n'est supprimé et l'échec reste conservé.

Les [outils fonctionnels](../tools/final-functional/README.md), leurs filiations et leurs [revues statiques](functional-tools-independent-review.json) sont conservés. La [revue finale des résultats](final-functional-independent-review.json) et la [synthèse de validation](validation-summary.json) lient les résultats effectivement produits. Les journaux bruts ignorés `output.raw.log` sont uniquement des doubles exacts des journaux `output.log.gz` conservés.

## Limites et suite

Les formes restent `preparedOnly: true`, `officialPerformanceEligible: false`, `strictCommonGraphParity: false`. Leurs temps de commande sont des traces d'exécution, sans valeur de mesure officielle. Elles n'établissent pas d'acquisition positive BranchRouting ; la preuve synthétique séparée qualifie `NativeV6Runtime`, pas la façade publique 64 × 64, ses tickets ou le transport worker. Les trois questions finales autorisées sans retour, l'ablation et les deux retours incomplets restent explicitement distingués. Aucun nouveau jeu gagné, aucune nouvelle campagne de jeu et aucune parité complète du caller ne sont revendiqués.

La prochaine étape applique le [protocole officiel préparé](../tools/final-cost/README.md), après déclaration et gel de ses entrées : ABBA, 32 sessions mesurées, 400 actions, huit chauffes conservées séparément. La médiane de session complète doit augmenter de **strictement moins de +10 % pour STCK et pour SMLP séparément**. Une phase peut dépasser +10 % si les deux globaux passent ; tous les échantillons restent conservés, sans compensation entre jeux.

La préparation, les contrôles fonctionnels, les commits et les sauvegardes de branche restent sans verrou global ni attente d'un autre lot. La mesure officielle et la publication utilisent seulement leur exclusivité courte, avec libération du descripteur propre et sans suppression du fichier de verrou. **LKEY reste définitivement fermé.**
