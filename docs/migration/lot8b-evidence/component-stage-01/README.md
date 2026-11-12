# Lot 8B : preuve du composant BranchRouting

## Résultat acquis

**Le composant TypeScript est porté et qualifié sur le petit domaine indépendant déclaré.** Le commit de code `f8624e40839de891a33251b1c13b775ec213eb34` contient le port, le corpus original et les contrôles. Sa [sauvegarde distante vérifiée](checkpoint-component-push-02.json) est distincte d’une publication du Site. Le [bilan machine](validation-summary.json) relie les empreintes, commandes et limites ; la [revue indépendante](source-review.json) vérifie la provenance des états et la cohérence des reçus sans relancer les tests.

La base est **Site 107 / native 0.66.0**, source publiée `4ff7bf45286a8a19d34401988adca587253ae41e`, réconciliée au commit `c87c132a0353a8c6138ad090495f98698ef7ca6f`. Les [preuves de cette base](../base107-20261112/publication-observation.json) conservent le déploiement réussi et l’accès privé au propriétaire. Les deux nouveaux modules restent isolés : aucun raccordement au runtime commun, modification du registre ou incrément de version ne fait partie de ce jalon. Le compteur publié reste **68/76, huit entrées ouvertes**.

## Contrôles effectivement exécutés

| Preuve | Résultat | Portée exacte |
| --- | --- | --- |
| [Génération originale 03](../component-reference-03/execution.json) | PASS ; 37 observations, 20 géométries, 12 scénarios, 83 opérations | Petits rasters construits indépendamment, réponses produites par le Python original. Les 1 786 fichiers originaux sont identiques avant et après. |
| [Référence native 02](reference-02/receipt.json) | **249/249 tests et sous-tests passés** | Comparaison des propositions, liaisons, gardes, retours et états complets ; deux modes natifs, exact et borné complet. |
| [Contrats natifs 01](contract-01/receipt.json) | **17/17 passés** | Limites positives et plafonds, refus d’un optimum partiel, interruption, échéance, coopération, concurrence, acquisition et restauration. |
| [Typage 01](typecheck-01/receipt.json) | **PASS** | `tsc --noEmit` après les corrections du port. |

Les trois contrôles natifs réussis conservent des inventaires avant/après identiques. Le bilan vérifie à nouveau leurs empreintes contre les fichiers sauvegardés, sans réexécuter la suite. Les nombres ne s’additionnent pas en une population de jeux ou de scénarios : **83 opérations originales distinctes sont comparées dans chacun des deux modes natifs**. Les 249 comprennent les tests parents et sous-tests de Node. Les 17 contrats utilisent de petits modèles génériques explicitement contrefactuels, indépendants de l’oracle original. Aucun résultat de cette table ne constitue une mesure officielle de performance.

Les cinq scénarios froids commencent avec le constructeur original, dont deux chaînes principales acquièrent effectivement les quatre commandes. Quatre autres scénarios reprennent exactement un état produit par une acquisition originale. Trois contrefactuels déclarés modifient uniquement `motion` depuis un tel état. Ils ne sont pas présentés comme de nouveaux apprentissages. La [référence 03](../component-reference-03/README.md) détaille ces origines.

## Comportements conservés et adaptations

Le propriétaire `branch_routing` conserve les modes `calibrate`, `select`, `move` et `propagate`, les identités minimales non ambiguës, l’ordre cartésien des placements, les gardes sur les poses actuelles et le retour anticipé lors d’une hausse du score officiel. Les comparaisons couvrent notamment les divisions entières Python hors phase, les projections négatives ou tronquées, le tri Unicode, les digests complets, les retours contraires et les transitions d’époque.

Le mode natif borné plafonne les affectations d’identité à **16 384** et les placements à **65 536**, avec cession coopérative tous les **128 éléments** sur le chemin de proposition. Les limites sont réductibles, strictement positives et ne peuvent dépasser ces plafonds. Une solution déjà trouvée reste retenue tant que le domaine n’est pas complètement examiné. Une recherche incomplète produit un refus `unknown`, attaché à l’observation et à l’état du propriétaire, sans autorité d’exécution.

Les snapshots et événements retournés sont détachés. Les corruptions testées sont rejetées avant mutation de l’état restauré. Les événements d’une ancienne époque peuvent concerner un autre nombre de barres que le modèle actuel. Ces propriétés ne qualifient pas encore la restauration du runtime commun.

## Tentatives conservées

L’[index original](../component-reference-03/attempt-index.json) conserve les trois tentatives : la première a échoué sur la construction d’une scène à trois barres ; la deuxième a passé ; la troisième a renforcé les cas de déplacement contraire et de coupe partielle, avec 37 observations au lieu de 35. Les sources, journaux et anciennes références restent disponibles à leurs chemins déclarés.

La [première tentative native](reference-01/receipt.json) a échoué au chargement, avant toute comparaison : une propriété de paramètre TypeScript n’était pas prise en charge par le mode Node utilisé. La correction déclare explicitement les champs de `Work`. La seconde tentative passe sur les nouveaux octets ; la première n’est ni effacée ni requalifiée en réussite. La durée des commandes figure dans les reçus pour leur traçabilité, sans valeur de benchmark officiel.

## Limites à fermer avant raccordement

1. **Retour officiel différé.** `record` est synchrone et borné. Une identité incomplète lève `BranchRoutingIncomplete` avant toute mutation de cette acquisition. Le caller commun devra conserver le retour officiel encore non acquis et empêcher sa perte, sa duplication ou sa transformation en réfutation physique.
2. **Entrées stables.** La garde coopérative protège l’état du propriétaire. Elle ne garantit pas l’immuabilité de l’observation JSON pendant un `await`. Le caller doit fournir un instantané stable et conserver le lien entre ses données et ses références.
3. **Frontière des snapshots.** La restauration actuelle vérifie la forme, la cohérence et les entiers sûrs. Elle ne plafonne pas encore `unit`, `limit`, les coordonnées ou leurs produits aux dimensions publiques autorisées. Le jalon concerne les snapshots du domaine déclaré ; la frontière de restauration commune doit fermer cette limite avant raccordement.
4. **Coût général.** Les deux plafonds bornent les produits cartésiens. Le scan `layout`, la préparation des options, les copies, les digests et l’historique ont leur propre coût ; aucune garantie générale de latence ou de mémoire n’est déduite de ces compteurs.

Le [contrat](../../lot8b-branch-routing.md) et la [filiation](../../lot8b-branch-routing-lineage.md) conservent les détails et la position source : après `motif_conditioned_access`, avant `conserved_band_transfer`, avec un propriétaire unique et l’acquisition `branches:<revision>`. La prochaine étape ferme les limites ci-dessus et qualifie ce parcours dans le caller commun, avec effets contraires et ablations, avant d’ouvrir l’entrée au registre.

## Travail courant, coût et suite

Le développement, les tests fonctionnels, les commits et les push ont eu lieu dans le checkout et la branche propres au lot, **sans verrou global**. Aucun fichier de verrou détenu n’a été supprimé. Cette étape n’a exécuté aucun jeu, rejeu, dispatch officiel, benchmark ou déploiement. **LKEY demeure définitivement fermé.**

La qualification officielle ultérieure compare le candidat au prédécesseur réellement publié. La médiane de la session complète doit augmenter de **strictement moins de 10 % pour STCK et pour SMLP séparément**. Une phase peut dépasser 10 % si les deux critères globaux passent, sans compensation entre jeux ni suppression d’échantillons. Le coût officiel 8B reste **non mesuré et non accepté**. Une exclusivité courte sera réservée aux mesures officielles et à la publication.

La [feuille de route actualisée](../../v6-delivery-roadmap.md) distingue le composant terminé, le raccordement commun à réaliser, les qualifications fonctionnelles et de coût, puis la publication propre de 8B. Aucun nouveau numéro de version n’est réservé par ce jalon.
