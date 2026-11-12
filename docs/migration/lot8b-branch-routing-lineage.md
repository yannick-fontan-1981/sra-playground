# Lot 8B : filiation de BranchRouting

## Sources et base de travail

Le transfert vise la capacité générique `parallel_branch_routing` du V6 épinglé **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Le propriétaire original est `BranchRouting`, créé comme `strategy_router.branches`. Le [contrat de transfert](lot8b-branch-routing.md) décrit les décisions, les gardes, l’état et les adaptations natives de calcul borné.

La reconnaissance préalable est conservée dans [preparation-20261111](lot8b-evidence/preparation-20261111/README.md). La présente lecture a été effectuée sur le commit de travail **`c87c132a0353a8c6138ad090495f98698ef7ca6f`**, après intégration du **Site 107 / native 0.66.0**, source publiée `4ff7bf45286a8a19d34401988adca587253ae41e`. Elle ne modifie pas les sources originales.

Les chemins ci-dessous sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/`.

| Source | Octets | SHA-256 |
| --- | ---: | --- |
| `laya_proto/common_branch_routing.py` | 12 911 | `b3f6a743e1ebdbf040a06a9c0d42b822c08ec28dff43cd2eb013ef41d0f27567` |
| `laya_proto/common_multiscale_constraints.py` | 16 566 | `01da7c7f636ed2039a364188c7f4fedb2c4c0a0e8bb6b2ba7f22b1c259eaaf12` |
| `morphology_policy/strategy.py` | 34 610 | `425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55` |
| `morphology_policy/strategy.drm` | 46 966 | `6e8aee941d56511273be79222b03c88d092cdc3ca1c295c91509b9cc93b15f44` |
| `laya_proto/common_frontier_runtime.py` | 97 217 | `bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064` |

Les trois helpers directement importés par le composant sont `digest`, `projection` et `rows_digest`. La construction indépendante des observations du corpus emploie le détecteur générique original ; ses imports et empreintes sont déclarés dans le [reçu original courant](lot8b-evidence/component-reference-03/execution.json). Les modules de jeu et les résultats natifs ne constituent pas des dépendances de l’oracle de composant.

## Chaîne de décision originale

`morphology_policy/strategy.py` importe `BranchRouting` et crée une instance propre. Le sous-type `parallel_branch_routing` appelle cette instance avec l’observation, les lignes de pixels, les commandes et le budget restant. Dans `strategy.drm`, l’entrée se trouve dans `factored_material_return`, après `motif_conditioned_access` et avant `conserved_band_transfer`.

La proposition est reconnue par la présence de **`branch_plan`**. Le caller commun sélectionne alors `strategy_router.branches` comme propriétaire de contrainte. Il utilise ses gardes avant/après, puis sa méthode `record` pour le retour physique sélectionné. La mémoire est écrite sous **`branches:<revision>`**, avec la référence de l’observation après action et la révision suivante. Le diagnostic de fin expose **`branch_routing.scored_witnesses`** depuis `passed` et **`branch_routing.observed_effects`** depuis `events`.

Cette filiation justifie un propriétaire direct unique. Elle ne justifie pas un second évaluateur de la même entrée ni un partage d’état avec MotifAccess. Le raccordement futur devra donc laisser `null` à la position correspondante de la liste des providers de matériau lorsque l’entrée est prise en charge directement par `branch_routing`.

## Correspondance prospective vers le natif

| Élément source | Cible native prévue | Qualification nécessaire |
| --- | --- | --- |
| `BranchRouting` | Classe `BranchRouting`, `id = familyId = branch_routing` | Parité directe sur le petit domaine complet du corpus. |
| `layout`, `bbox` | Fonctions du module `v6-branch-routing-geometry.ts` | Modèle, ordre, couleur active et boîtes identiques. |
| `read_state`, `observed_state` | Lecture de pose et affectation d’identité | Coupes, unicité, minimisation et ambiguïtés identiques après exploration complète. |
| `propagated` | Propagation des fronts et sorties | Ensemble visible et journal ordonné des sorties identiques. |
| `propose`, `bind`, `before`, `after`, `record` | Module `v6-branch-routing.ts` | Propositions et transitions complètes, références et effets inclus. |
| Attributs Python de l’instance | Snapshot `native.branch_routing.v1` | Représentation froide, passage d’époque, copie détachée et restauration atomique. |
| `digest` | `symbolicDigest` existant | Encodage JSON Python, ordre des tableaux et préfixe `C_branches_`. |
| `projection` | Helper natif de projection existant | Bornes inclusives converties en tranches, indices négatifs et coupes partielles. |
| `rows_digest` | Fonction pure de digest uint8, éventuellement `motifRowsDigest` | Forme et octets des projections sélectionnées non vides, sans état Motif partagé. |
| Sélection commune de `branch_plan` | Futur adaptateur `originalEventFamily` puis `subquestionFamily` | Attribution au seul propriétaire sélectionné, sous-question `material_access_subquestion`. |
| `branches:<revision>` | Futur mapping commun d’acquisition | Une acquisition du retour officiel, aucune duplication ou perte lors d’un calcul différé. |

Les deux nouveaux modules ne suffisent pas à ouvrir l’entrée dans le registre. Tant que le runtime ne les enregistre pas et que leur acquisition commune n’est pas qualifiée, **`parallel_branch_routing` reste non raccordé**. La constante du runtime publié demeure celle du prédécesseur 0.66.0 pendant cette étape de composant.

## Adaptations explicitement distinctes de la source

### Réduction des solutions en flux

La source accumule toutes les solutions puis appelle `min`. Le port peut conserver uniquement le meilleur triplet `(cost, starts, displacement)` en parcourant le même domaine, ce qui évite de retenir toutes les solutions. Cette adaptation conserve le résultat uniquement lorsque le domaine entier a été examiné. Elle ne permet pas de publier un minimum partiel lors d’une interruption.

### Produits cartésiens bornés et coopération

Le mode natif borné déclare au maximum 16 384 affectations d’identité et 65 536 placements, avec cession coopérative tous les 128 éléments sur le chemin asynchrone de proposition. La méthode de composant `record` reste synchrone et bornée, sans promesse de cession asynchrone pendant l’acquisition. Les bornes peuvent être réduites dans des cas de preuve séparés. La sortie signale l’incomplétude, sans conclusion d’impossibilité. Le mode exact direct reste réservé aux petites fixtures annoncées et ne constitue pas une promesse de performance générale.

Ces plafonds portent uniquement sur les deux produits cartésiens. Ils ne bornent pas le temps ou la mémoire de l’ensemble du composant : `layout` est synchrone et non coopératif, tandis que la préparation des options, les copies, les digests et l’historique conservé ont leur propre coût. Aucune garantie globale de latence, de mémoire ou de réactivité n’est déduite des seuls compteurs d’énumération.

La protection contre une mutation pendant une cession porte sur **l’état du propriétaire**. Elle ne détecte pas une modification externe de l’observation JSON pendant un `await`. Le futur raccordement doit donc remettre au composant un instantané d’entrée stable, avec des références attachées à ces mêmes données. La preuve de préservation d’une mutation du propriétaire ne vaut pas preuve d’isolation des objets d’entrée partagés.

L’acquisition `record` constitue une limite d’intégration à traiter explicitement : si la lecture d’identité bornée ne termine pas, `BranchRoutingIncomplete` est levée avant mutation de l’acquisition. La future boucle commune devra retenir le retour officiel non encore acquis et gérer son traitement différé. Ce point empêche de présenter le simple port de classe comme une clôture du transfert commun.

### Checkpoint

L’original ne possède pas de méthode de restauration indépendante. Le snapshot natif sérialise ses attributs sans inventer de contexte d’époque à froid. La validation atomique du snapshot est une extension native. Elle doit conserver les transitions source valides, y compris le modèle absent, les mouvements acquis dans une ancienne époque et les événements historiques dont le nombre de contributeurs diffère du modèle courant.

La validation de `restore()` porte sur la forme, la cohérence et les entiers sûrs. Elle ne borne pas encore `unit`, `limit` ou les coordonnées aux dimensions de la frontière publique. La preuve de ce jalon est donc limitée aux snapshots issus d’observations publiques du domaine déclaré, sans qualification d’un import arbitraire potentiellement immense. Cette limite devra être fermée par l’adaptateur de restauration commun avant tout raccordement au runtime.

## Provenance attendue du corpus

Le corpus initial annoncé comprend des rasters synthétiques indépendants et deux catégories clairement identifiées : des chaînes depuis froid avec retours/acquisitions originaux, et des états contrefactuels explicitement déclarés pour isoler une branche de la méthode. Un contrefactuel n’est pas décrit comme une méthode apprise.

Les fonctions et la classe Python originales produisent les valeurs de référence. La normalisation des tuples, ensembles et scalaires NumPy sert seulement à leur transport JSON. Elle doit être explicite et identique pour les comparaisons. Une partie native ne peut pas fournir une observation, un modèle, une clé apprise ou une sortie attendue à l’oracle.

Les scénarios positifs doivent être accompagnés de cas contraires : ambiguïté d’identité, changement de sélection, déplacement inattendu, absence de commande, égalité de coût, frontière d’époque et sorties hors champ. Le score positif éventuellement déclaré dans une fixture sert à tester la branche `official_boundary` du composant ; il ne prouve aucune réussite de niveau dans un jeu réel.

Les bornes et les refus de ressources disposent de leurs propres tests. Aucun résultat de parité complète sur un petit domaine n’est transformé en garantie de fermeture du domaine général ou de coût sous un budget global.

## Limites de preuve et suite

Le [bilan de composant](lot8b-evidence/component-stage-01/README.md) conserve les résultats acquis et leurs commandes, entrées et sorties exactes : 249 tests et sous-tests de référence, 17 tests de contrat et typage passés, sur 20 cas géométriques et 83 opérations originales. Cette preuve ne revendique encore aucune interaction de BranchRouting avec plusieurs autres propriétaires actifs dans un même épisode, aucun retour acquis par le runtime commun, aucune nouvelle réussite de jeu, aucune campagne de non-régression complète et aucun coût officiel 8B.

Après la preuve de composant, le raccordement devra qualifier les gardes courantes, l’acquisition sélectionnée, la restauration du runtime, les effets contraires et la gestion d’une acquisition différée. Suivront les régressions affectées, les graphes et le coût contre un prédécesseur réellement publié. Une future publication nécessitera sa version propre ; la publication 0.65 déjà accomplie ne vaut pas publication de 8B.

La règle de coût conservée est une augmentation de la médiane globale des sessions complètes strictement inférieure à 10 % pour STCK et pour SMLP séparément. Un dépassement de phase peut être accepté si les deux critères globaux passent. Les réserves de coût des publications prioritaires antérieures restent distinctes.

**LKEY demeure définitivement fermé.** Cette filiation ne lit aucun jeu, payload ou oracle de ce cas, et n’autorise ni nouvelle partie ni remise à zéro.
