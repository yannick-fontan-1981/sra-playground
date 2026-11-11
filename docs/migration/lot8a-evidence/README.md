# Lot 8A : accès conditionné par un motif

<!-- LOT8A_INTEGRATION_START -->

## Lot 8A : preuves communes et régressions qualifiées sur la composition préparée

**Les trois preuves communes sont vérifiées et les 11 régressions enregistrées sont qualifiées, avec 187/187 contrôles. Les quatre formes de travail sont capturées sur chacun des deux rôles puis qualifiées hors chronométrage.** Le [bilan courant réconcilié](integration-published-063-01/summary.json) distingue ces résultats préparatoires de la future qualification contre le véritable 0.64 publié.

Le candidat conserve **324 fichiers natifs**, digest `936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43`. La [composition 5C + 6B + 8A](integration-provisional-063-064-01/contract/composition-review.json) et le [gel validé](integration-provisional-063-064-01/validation-summary.json) restent inchangés : **5 606/5 606 tests dans 145 fichiers**, aucun échec, annulation, cas ignoré ni `todo`, et cinq contrôles passés (typage, audit des entrées, audit de migration, diff, compilation). Ces résultats restent attachés à leur exécution déclarée ; ils ne sont pas présentés comme une nouvelle relance des tests. Les enveloppes fonctionnelles récentes vérifient les mêmes entrées gelées, dont les **1 786 fichiers originaux**.

L’[audit du candidat](../v6-entry-point-progress.json) conserve **67/76 entrées raccordées (88,2 %), neuf restantes** : `goal_access` 12/12, `window_constraints` 21/21, `surface` 10/10 et `factored_material_return` 24/33. L’[inventaire](../v6-coverage.json) conserve 209 composants vérifiés, 147 transferts partiels, 1 013 modules en attente, zéro module entièrement vérifié et aucun échec d’audit. Les **six portes de migration complète restent fausses**.

### Preuves acquises sur le même natif

| Périmètre | Résultat établi | Portée |
| --- | --- | --- |
| Binding 5C | **6 818/6 818 comparaisons originales**, quatre scénarios | Positif, réfutation, ambiguïté et frontière ; états, mémoire, acquisition et restauration. |
| Motif 8A | **20/20 contrôles** du parcours commun | Acquisition sélectionnée et restitution depuis la mémoire commune ; les preuves contraires et d’ablation restent liées à la suite validée. |
| SelectedRigid 6B | **56 événements comparés sans différence**, 22 ablations, dont sept changent l’action ou le refus | Cinq retours physiques et trois préfixes ; observation terminale conservée sans acquisition inventée. |
| Régressions enregistrées | **11/11 cas, 187/187 contrôles** | Dix réussites de la série02, puis WEAV03 ; mêmes traces, même comparateur, mêmes octets natifs. |

La [revue commune](qualification-provisional-02/review/common-integrity-review.json) conserve les limites des scénarios synthétiques distincts. La [réconciliation des régressions](qualification-provisional-02/reconciliation-recorded-regressions.json) et sa [revue indépendante](qualification-provisional-02/review/recorded-regression-reconciliation-review.json) vérifient onze identifiants distincts. Ces populations ne sont pas additionnées aux 5 606 tests. Elles n’établissent ni la parité de l’appelant complet ni une nouvelle réussite de jeu réel.

Deux corrections d’outillage rendent les rapports complets disponibles. VOIS termine 78 actions et trois niveaux après passage à l’écriture JSON/gzip par flux. WEAV termine **81 actions, 81 préfixes et trois niveaux** après libération des gros objets de référence avant l’import du moteur, puis séparation des durées de vie de la prévalidation, du moteur et du comparateur. Le **plafond d’old space V8 reste 1 536 MiB** ; le RSS total observé peut le dépasser. Aucun état natif, budget du moteur ou champ du rapport n’est supprimé. La série02 reste conservée au statut `failed`, 10/11 et 170/187 ; la réussite finale est une réconciliation de tentatives, sans réécriture de cet échec. L’interruption antérieure, les diagnostics et les refus de préparation sont conservés.

### Formes de travail et graphes préparatoires

Le parent préparé est le commit **`a01e6faf330d82fa220feac0c9ad4632bb75a9de`**, 322 fichiers natifs, digest `fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886`. Son checkout séparé contient les déclarations exactes de cette source, dont le [JSON matérialisé après l’échec du premier inventaire](qualification-provisional-02/work-forms-01/baseline-support-materialization.json). Il reste **non publié**. L’inventaire et les deux captures utilisent le même HEAD candidat `7c8f43365a277406e95c898165d01a7bf6e19772`.

Les [captures complètes et formes qualifiées](qualification-provisional-02/work-forms-01/work-forms.json) couvrent **huit sessions / 62 actions** : STCK sur trois puis dix actions, SMLP sur trois puis quinze, pour chaque rôle. Les formes complètes conservent trois inspections terminales. L’[inventaire des propriétaires](qualification-provisional-02/work-forms-01/owner-inventory.json) confirme l’ajout du seul `motif_access`, sans retrait de propriétaire ni ajout/retrait de programme installé. Binding et SelectedRigid sont observés dans les deux rôles, Motif dans le candidat.

La [qualification des graphes](qualification-provisional-02/work-forms-01/owner-graph-attribution.json) passe **64 contrôles sur 58 points appariés**. Les **21 956 différences brutes** sont toutes conservées dans le journal : 20 893 différences d’identifiant de source validées par leur Kernel propre, 1 055 différences d’horodatage `created` rattachées à l’horloge source et à leurs véritables intervalles d’appel, et huit ajouts des deux nœuds Motif sur les quatre formes. **Zéro différence ne reste sans attribution.** Les valeurs privées et fragments ne sont pas masqués ; les horloges ne sont pas remplacées.

La [revue indépendante de cette qualification](qualification-provisional-02/review/work-form-qualification-review.json) en précise la portée. Les sorties restent volontairement **`preparedOnly: true`, `officialPerformanceEligible: false` et `strictCommonGraphParity: false`**. Elles ne deviennent pas une preuve de coût ou une autorisation de publication par le seul passage des contrôles.

### Publication, coût et travail courant

Le [constat Sites 104](integration-published-063-01/publication-observation.json) confirme **native 0.63 publiée**, source `bc53ddf36f0379be24cfc0667f8f8d6fdd650032`, déploiement `succeeded`, accès privé au propriétaire et révision 3. Cette [publication prioritaire 5C](../lot5c-evidence/recovery/publication-063-priority/authorization.json) conserve explicitement un **coût officiel non mesuré et non accepté** pour STCK et SMLP. Cette exception ne s’étend pas à 8A. **Le véritable 0.63 est réconcilié dans la branche 8A ; 0.64 et 0.65 restent non publiées au constat de cette étape.** Le [bilan de réconciliation](integration-published-063-01/summary.json) vérifie que les fichiers natifs, de tests, de scripts, de compilation et originaux restent exactement ceux du gel qualifié. Les sauvegardes de `lot8a-motif-checkpoint-20261111` demeurent distinctes d’une publication du Site.

Le développement, les tests fonctionnels, les commits et les push continuent **sans verrou global et sans attendre les publications des autres lots**, conformément à la [politique courante](qualification-provisional-01/contract/current-work-lock-policy.json). Une exclusivité courte reste réservée aux mesures officielles et à la publication. Aucun verrou global n’a été acquis pour les présentes qualifications ; aucun fichier de verrou détenu n’a été supprimé.

Le [protocole officiel prospectif](integration-provisional-063-064-01/contract/cost-qualification-plan.json) prévoit 40 essais ABBA : **32 sessions mesurées / 400 actions, plus huit préchauffages / 24 actions exclus**. Le critère reste la médiane des **sessions complètes strictement sous +10 % pour STCK et pour SMLP séparément**. Une phase au-dessus de +10 % est recevable lorsque les deux critères globaux passent. Tous les échantillons, diagnostics et cohortes restent conservés, sans compensation entre jeux. Aucune mesure officielle 8A n’a été exécutée ici.

### Feuille de route actualisée

| Étape | État établi | Prochaine action |
| --- | --- | --- |
| 10B / 0.62 | Publié, Site 103 ; réserve HPDL partielle conservée | Conserver le prédécesseur exact et ses limites. |
| 5C / 0.63 | **Publié prioritairement dans Site 104 ; coût officiel non mesuré et non accepté** | Conserver cette réserve et ses preuves ; la qualification future du coût garde son critère global. |
| 6B / 0.64 | Préparation sauvegardée, non publiée au constat de cette étape | Intégrer le 0.63 désormais publié, puis fermer la qualification finale et le coût avant sa publication. |
| **8A / 0.65** | **0.63 publié réconcilié ; natif validé, preuves communes, 11 régressions et formes/graphes préparatoires qualifiés** | Réconcilier le véritable 0.64 publié, vérifier les différences avec le gel préparé et renouveler les qualifications affectées ; mesure officielle puis publication après acceptation. |
| **8B** | `parallel_branch_routing` reste ouvert ; [préparation source établie](../lot8b-evidence/preparation-20261111/README.md) | Écrire le contrat de transfert et le corpus original indépendant, puis porter le propriétaire et ses dépendances consommées, sans attendre la publication pour ce travail courant. |
| 6C / 6D | `observed_rigid_cargo` et `shared_settlement` ouverts | Transférer puis qualifier leurs capacités dans leurs propres périmètres. |
| Lot 9 | `chart_navigation`, `region_intervention`, `joint_channels` ouverts | Traiter navigation, régions et canaux ; conserver `discrete_network` hors du compteur 76. |
| 10C / 10D / 10E | La coordination signale le jalon fonctionnel 10C sauvegardé et une préparation source 10D ; 10E reste ouvert | Poursuivre ces branches sans verrou courant ; réconcilier leurs prédécesseurs réels avant qualification finale et publication. |
| Lot 11 | Consolidation ouverte ; six portes globales encore fausses | Parité commune complète, graphes, restauration, sessions longues, coûts et lisibilité. |

Les états des autres fils sont issus d’une [observation de coordination](qualification-provisional-02/coordination/lanes-observation-02.json), pas d’une nouvelle certification de leurs preuves dans ce lot. **LKEY reste définitivement fermé**, sans nouveau jeu, rejeu, oracle ou remise à zéro. Les sections historiques suivantes conservent leurs propres dates, gels et limites.

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

1. Conserver la [réconciliation du 0.63 réellement publié](integration-published-063-01/summary.json), puis intégrer le véritable 0.64 publié et vérifier les différences avec le parent préparé.
2. Geler ce candidat intégré ; exécuter les non-régressions et qualifications affectées sur ces octets.
3. Déclarer les formes de travail et la croissance du propriétaire avant toute mesure officielle.
4. Comparer le coût au prédécesseur réellement publié, dans une fenêtre coordonnée complète.
5. Publier 0.65 dans l'ordre convenu, puis actualiser sa preuve de livraison.

## Règle de coût

La variation de la médiane des **sessions complètes** doit rester **strictement inférieure à +10 % pour STCK et pour SMLP séparément**. Un dépassement par phase est recevable quand ces deux conditions globales sont satisfaites ; tous les échantillons, diagnostics et cohortes sont conservés. Aucun coût 0.61 ou 0.62 n'est présenté comme le coût de 8A, et aucun jeu ne compense l'autre.

## Cas fermé

**LKEY demeure définitivement fermé à 2 390,347106991 s cumulées** : aucun essai, rejeu, oracle, analyse de charge utile ou remise à zéro. Les quatre modules historiques qui chargent sa géométrie restent hors du périmètre frais.

Voir la [feuille de route actualisée](../v6-delivery-roadmap.md).
