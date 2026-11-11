# Lot 8A — accès conditionné par un motif

<!-- LOT8A_INTEGRATION_START -->

## Jalon composé 8A validé ; qualification finale encore ouverte

**5 606/5 606 tests passent dans 145 fichiers, sans échec, annulation, test ignoré ni cas `todo`. Les cinq contrôles séparés passent également : typage, audit des entrées, audit de migration, contrôle du diff et compilation.** Le [bilan de validation](integration-provisional-063-064-01/validation-summary.json) rattache ces résultats au [contrat déclaré avant exécution](integration-provisional-063-064-01/contract/validation-plan.json) ; les 1 786 fichiers originaux et toutes les entrées surveillées de source, de tests, de scripts et de compilation restent inchangés.

La [composition validée](integration-provisional-063-064-01/contract/composition-review.json) réunit `public_observed_binding` (5C), `selected_rigid` (6B) et `motif_access` (8A), dans la source `a9ef0c67ea4b85d8eb68f57fb144772e162dcf35`, issue des parents `7c10456a675f0e9a93089a0f679e96677ede03af` et `a01e6faf330d82fa220feac0c9ad4632bb75a9de`. Le [checkpoint déclaré avant les tests](integration-provisional-063-064-01/coordination/source-checkpoint-before-validation.json) est `30c9a8944f1ffd3b76df14a5d5515c3ae9520e3d`, vérifié à distance. Cette sauvegarde de source n’est pas une publication Site. Le [natif validé](integration-provisional-063-064-01/validation-summary.json) contient **324 fichiers**, digest `936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43`.

L’[audit courant des entrées](../v6-entry-point-progress.json) confirme **67/76 raccordées (88,2 %), neuf restantes** : `goal_access` **12/12**, `window_constraints` **21/21**, `surface` **10/10**, `factored_material_return` **24/33**. L’[inventaire courant](../v6-coverage.json) compte **209 composants vérifiés, 147 transferts partiels, 1 013 modules en attente et zéro module entièrement vérifié**. Aucun échec d’audit n’est signalé ; les **six portes de migration complète restent fausses**, selon le [bilan](integration-provisional-063-064-01/validation-summary.json).

La [preuve de composant sur cette composition](integration-provisional-063-064-01/component-proof.json) et sa [revue indépendante](integration-provisional-063-064-01/independent-proof-review.json) conservent la portée des comparaisons synthétiques et du moteur commun réel : acquisition sélectionnée, restauration, décision suivante, effet contraire et ablation. Les attentes de l’oracle historique sont réexercées dans les 145 fichiers ; aucun nouvel oracle original ni niveau officiel n’est exécuté. Ce résultat ne constitue pas une parité du caller entier. Le [jalon antérieur de 5 422 tests dans 138 fichiers](development/validation-summary.json) reste distinct, avec ses 312 fichiers natifs et 65/76 entrées.

Le [dernier constat de publication](integration-provisional-063-064-01/coordination/final-publication-observation.json) confirme toujours **Site 103 / native 0.62**, avec accès privé au propriétaire et renvoi à la preuve exacte du prédécesseur. **Les préparations 5C / 0.63 et 6B / 0.64 ne sont pas publiées ; 0.65 reste réservée. Aucun coût 8A ni publication 0.65 n’est acquis.** Le [plan prospectif de coût](integration-provisional-063-064-01/contract/cost-qualification-plan.json) conserve la tentative 5C bloquée avant mesure et impose la publication réelle de 0.64 comme référence de coût 8A.

La [suite déclarée](integration-provisional-063-064-01/validation-summary.json) est de réconcilier les publications effectives 0.63 puis 0.64, geler les entrées finales affectées, qualifier les preuves communes des trois propriétaires et les **11 régressions enregistrées**, puis les formes de travail hors chronométrage et la provenance des graphes. Le [protocole prospectif](integration-provisional-063-064-01/contract/cost-qualification-plan.json) prévoit **40 essais ABBA : 32 sessions mesurées/400 actions, plus 8 préchauffages/24 actions exclus**. La médiane des sessions complètes doit augmenter de **strictement moins de +10 % pour STCK et pour SMLP séparément** ; une phase au-delà de +10 % peut être acceptée si les deux critères globaux passent, en conservant tous les échantillons et diagnostics. Publication 0.65 seulement après acceptation ; **8B reste distinct et ouvert**, comme le précise le [bilan](integration-provisional-063-064-01/validation-summary.json).

<!-- LOT8A_INTEGRATION_END -->

## Jalon de développement antérieur conservé sur Site 103

### État historique du jalon sur Site 103

**Le jalon de développement est validé : 5 422/5 422 tests dans 138 fichiers et cinq contrôles passés.** Le [bilan vérifié](development/validation-summary.json) conserve les reçus, empreintes et limites de cette validation. Le candidat natif **0.65.0 est réservé**, sans publication ni qualification de coût de ce lot. La source de départ était le Site 101 / native 0.61.0 ; le développement intègre maintenant le **Site 103 / native 0.62**, commit `4afcbfe6a25bd3a88223be543e443bc53b9c8814`, effectivement déployé et [observé via Sites](coordination/published10b-site103.json). Le gel de développement comprend 312 fichiers natifs, digest `a6ea3e5e8140b14aa260485ebd4192429a86c4d3ec02075f14043f215cc798e1`.

Le gel final devra intégrer les publications effectives **5C / 0.63 puis 6B / 0.64** avant sa qualification et sa publication. Le périmètre est la seule entrée `motif_conditioned_access`, dans `factored_material_return`. **8B `parallel_branch_routing` reste à réaliser ; le lot 8 entier reste ouvert.**

## Comportement transféré

Le [contrat source](contract/source-contract.md), la [filiation complète](../lot8a-motif-access-lineage.md) et la [revue du delta après Site 103](contract/site103-integration-review.json) distinguent le comportement Python et les adaptations natives. Le propriétaire unique `MotifAccess` mesure l'interface, acquiert la relation entre commande et effet, propose un motif et réévalue le chemin après le retour réel. Sa position dans l'ordre source, ses alternatives, ses gardes courantes et sa restauration sont conservées.

Le moteur commun acquiert le retour sélectionné une seule fois, sous `common-observation-frontier/motif:{revision}`. Une restauration depuis ce magasin restitue la connaissance utile à la décision suivante. Un retour contraire change cette décision ; retirer seulement l'acquisition Motif empêche l'enchaînement appris. La règle source de symétrie supprime seulement son dernier recours quand une interface à motifs et un corps uniques sont mesurés. Les comportements Window, `currentExecution` et la conversion des échéances de la version 0.62 restent préservés.

## Preuves et portée

| Preuve | Résultat et portée |
| --- | --- |
| [Oracle original](contract/reference-oracle.json) | 33 cas géométriques, 17 scénarios et 100 opérations sur des scènes synthétiques indépendantes. Les 1 786 fichiers originaux sont vérifiés inchangés. Aucun jeu n'est exécuté. |
| [Première comparaison native](contract/reference-parity.json) | 182/182 tests passés sur l'implémentation initiale. Cette preuve historique précède le durcissement final de restauration et ne remplace pas les exécutions ultérieures, dont celle du [jalon composé](integration-provisional-063-064-01/validation-summary.json). |
| [Préflight du moteur après Site 103](development/kernel-post-site103.json) | 4/4 tests passés : parcours froid, retour contraire, ablation de l'acquisition et frontière de la règle de symétrie. Le typage [passe également](development/typecheck-post-site103.json), sur des entrées inchangées. |
| [Validation de développement déclarée](contract/development-validation-plan.json) | **5 422/5 422 tests dans 138 fichiers**, sans échec, annulation ou test ignoré, et entrées inchangées. Les [cinq contrôles séparés](development/validation-summary.json) passent : typage, entrées, migration, diff et compilation. Les quatre exclusions LKEY restent explicites. Les comparaisons originales Motif sont réexécutées sur le natif durci et intégré. |

Les populations ci-dessus se recouvrent ; elles ne sont pas additionnées. Les premiers diagnostics et échecs restent conservés : sonde de lecture de la mauvaise clé de stockage, deux erreurs TypeScript ensuite corrigées et contrôle historique d'index signalant des blancs hérités du prédécesseur. Le contrôle distinct du delta 8A contre Site 103 est passé. Aucun ancien échec n'est réétiqueté en succès.

L’audit du [jalon historique sur Site 103](development/validation-summary.json) confirme **65/76 entrées raccordées (85,5 %)**, dont **23/33** dans `factored_material_return`, et **200 composants vérifiés / 149 transferts partiels / 1 020 modules en attente**. Il ne signale aucune anomalie ; les six portes de migration complète restent `false`. La publication 0.62 de référence compte 64/76 entrées.

Le premier test d'annulation a été rapporté à 14/15, puis à 15/15 après agrandissement de sa scène synthétique pour atteindre le point de coopération. Aucun log brut de ces deux premiers essais n'a été persisté ; le bilan les qualifie comme observations de session. Le passage alors frais de 5 422 tests fournit la preuve d’acceptation de ce [jalon historique de développement sur Site 103](development/validation-summary.json).

## Limites explicites

La recherche de production borne le nombre d'états à **8 192** et la frontière à **16 384**. Une interruption, une échéance ou un dépassement produit un refus qualifié d'incomplet, sans route partielle ni impossibilité inventée. La conservation de chemins complets peut néanmoins coûter **O(S²)** en espace : ces bornes ne constituent pas une preuve de mémoire en octets ou de latence maximale pour toute géométrie.

Ces preuves établissent un comportement synthétique et une contribution dans le moteur commun. **Aucun niveau officiel ni campagne réelle 8A n'est revendiqué.** Une campagne de trois niveaux par entrée n'est pas obligatoire ; la contribution propre reste distincte d'une non-régression. La parité de l'appelant V6 entier et les six portes de migration complète restent ouvertes.

## Prochaine qualification

1. Intégrer les sources réellement publiées de 0.63 puis 0.64 et vérifier leurs invariants.
2. Geler ce candidat intégré ; exécuter les non-régressions et qualifications affectées sur ces octets.
3. Déclarer les formes de travail et la croissance du propriétaire avant toute mesure officielle.
4. Comparer le coût au prédécesseur réellement publié, dans une fenêtre coordonnée complète.
5. Publier 0.65 dans l'ordre convenu, puis actualiser sa preuve de livraison.

## Règle de coût

La variation de la médiane des **sessions complètes** doit rester **strictement inférieure à +10 % pour STCK et pour SMLP séparément**. Un dépassement par phase est recevable quand ces deux conditions globales sont satisfaites ; tous les échantillons, diagnostics et cohortes sont conservés. Aucun coût 0.61 ou 0.62 n'est présenté comme le coût de 8A, et aucun jeu ne compense l'autre.

## Cas fermé

**LKEY demeure définitivement fermé à 2 390,347106991 s cumulées** : aucun essai, rejeu, oracle, analyse de charge utile ou remise à zéro. Les quatre modules historiques qui chargent sa géométrie restent hors du périmètre frais.

Voir la [feuille de route actualisée](../v6-delivery-roadmap.md).
