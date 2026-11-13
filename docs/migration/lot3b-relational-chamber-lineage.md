# Lot 3B : filiation de la chambre relationnelle

## Périmètre du transfert

Ce sous-lot raccorde `chamber_relation_plan` à l'entrée commune `observed_composition_services`. Il réutilise la mesure V6 des chambres et des commandes miniatures, la mémoire des relations effectivement observées, puis le noyau fini V5 pour chercher une affectation compatible avec les cibles mesurées.

Les sources de référence sont les originaux inchangés du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, conservés sous `reference/v6/<commit>/source/`. La décision de production ne reçoit aucun identifiant de jeu, niveau préparé, rôle de couleur imposé, formule de force, spécification ou solution. Les tableaux de relations proviennent des observations publiques acquises.

Le présent document décrit les producteurs, consommateurs et limites du code. Les résultats d'une campagne, les preuves de contribution, la validation formelle et les coûts relèvent de leurs reçus de livraison distincts. Aucun résultat de jeu n'est déduit des cas synthétiques de composant décrits ici.

## Sources et propriétaires

| Source originale | Partie transférée | Consommateur TypeScript | Portée |
| --- | --- | --- | --- |
| V5 `capabilities/finite_relation_network.py` | `_indexed_combination` et `_network_domain` | [v5-finite-relation-domain.ts](../../src/logos-engine/v5-finite-relation-domain.ts), appelé par l'inversion de la chambre | Sous-ensemble du noyau, pas la façade complète du réseau fini |
| V6 `laya_proto/relational_chamber_projection.py` | Scène, projection des réglages et axes, points de commande propres à la couche | [v6-relational-chamber-observation.ts](../../src/logos-engine/v6-relational-chamber-observation.ts) | Grammaire géométrique source ; palette et valeurs mesurées |
| V6 `laya_proto/relational_chamber_access.py` | Apprentissage, prédiction, inversion, proposition, gardes, acquisition et digest de sa couche | [v6-relational-chamber-access.ts](../../src/logos-engine/v6-relational-chamber-access.ts) | Couche propre ; les ancêtres non transférés gardent leur statut ouvert |
| V6 `laya_proto/common_observed_compositions.py` | Entrée commune, enveloppe de proposition, liaison du point et restauration du journal transféré | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Deux branches sur les six de l'entrée observée |
| V6 `morphology_policy/strategy.drm` | Rang de l'entrée, question de contribution/expérience et bornes déclarées | Politique chargée par le runtime commun | Configuration source conservée ; aucune sélection par jeu |

Le propriétaire reste **`SharedSeriesConstraint`**, déjà enregistré dans la famille commune `public_occurrence_recall`. Sa couche `RelationalChamberMemory` possède `relation_memory` et `relation_events`. Le journal partagé détient les événements acquis, et la reconstruction des couches lit ce journal. Aucun deuxième agent, deuxième propriétaire d'acquisition ou journal de jeu parallèle n'autorise les actions.

## Chaîne de production et de consommation

### 1. Mesurer la scène courante

La projection réutilise les composantes géométriques communes. Elle cherche le cadre régulier, les chambres, leurs corps et cibles, puis les petits panneaux de commandes par paire. La couleur identifie une occurrence mesurée dans cette scène ; elle ne fournit pas une signification constante au moteur.

Les axes exprimés dans la scène conservent le sens des voisins, l'ordre des entrées et les contextes source `single_toward` ou `ordered_opposite`. Les positions sont rapportées au quantum observé. Ambiguïté de cadre, corps non unique, commandes dupliquées, voisin sans commande ou déplacement hors domaine entraînent les mêmes refus structurels que la source.

Les points de commande sont ajoutés au générateur transféré dans l'ordre **Chamber puis Panel**, avec déduplication exacte par identité et conservation de la première position de clé. Les générateurs des branches non transférées restent hors du périmètre revendiqué.

### 2. Construire une table révisable

`learnChamberRelations` indexe chaque axe par son contexte et le tuple ordonné des valeurs de ses commandes. Une première observation ajoute une ligne avec son témoin ; une confirmation ajoute un témoin distinct. Une valeur différente pour la même ligne ajoute une contradiction mémorisée et ne remplace pas silencieusement la première valeur.

Pendant la proposition, cet apprentissage porte sur une copie de la mémoire. Il ne publie aucun événement et n'acquiert pas le retour à l'avance. L'acquisition de l'action réelle reprend la mémoire détenue, apprend la scène précédente et, lorsque la portée reste comparable, apprend la scène suivante.

La proposition vérifie les contradictions des contextes présents. Une contradiction acquise suspend la résolution avec `shared_relation_rows_contradicted`. Les essais de commande contredits alimentent `failed`, et les essais déjà refusés ne sont pas répétés dans le même contexte mesuré.

### 3. Inverser les relations avec le noyau V5

`inverseChamberRelations` construit les variables source depuis les valeurs observées des commandes et des lignes conservées. Le consommateur source exige deux valeurs distinctes et au plus **12 variables de commande**. Les sorties ciblées utilisent `'-1'`, `'0'`, `'1'` et sont fixées aux cibles mesurées. Les modèles portent des tables **partielles et déterministes**, construites à partir des seules lignes acquises.

Le noyau énumère les affectations et les alternatives dans l'ordre source. Une portée partage une alternative de modèle entre tous ses composants. Une même ligne inconnue déterministe partage aussi sa valeur de sortie : les composants ne peuvent lui attribuer des valeurs incompatibles indépendamment. Les ports répétés référencent la même variable ; ils ne créent pas de nouvelles variables libres.

Une ligne absente d'une table partielle reste possible et apparaît dans `unknown_rows`. Une ligne absente d'une table complète refuse l'affectation. Les contraintes sur les sorties et les relations connues sont vérifiées sans interprétation du nom du modèle.

Les budgets source sont conservés : **4 096 affectations énumérées**, **65 536 vérifications de relation** dans la configuration de chambre. Le compteur d'états porte sur les affectations examinées, y compris celles éliminées par les exigences, et non sur les seuls résultats retenus. Avant une affectation, la source réserve le nombre complet de composants pour le contrôle de budget. Un arrêt borné conserve son indice de reprise et n'est pas déclaré complet.

Le module TypeScript ne transfère pas les opérations de mesure de câblage, propagation inverse récursive, discrimination, compilation, succession, comparaison ou résultat de famille de toute la façade V5. Il attend les contrats de références chaînes déjà construits par son consommateur. La validation globale Pydantic de la requête complète n'est pas présentée comme transférée.

Le domaine numérique natif exige des entiers sûrs pour les indices, budgets et le produit des tailles de domaines. Un dépassement est refusé explicitement. Le consommateur de chambre, avec douze variables binaires, sorties fixées et une alternative par contexte, reste à **4 096 combinaisons** et respecte cette limite.

### 4. Proposer une expérience ou une contribution conditionnelle

Les candidats conservent le classement source : nombre de lignes inconnues, nombre de commandes à changer, puis ordre lexical des références modifiées. Le budget d'actions restant influe sur le candidat retenu. Le préfixe est borné à seize commandes et à la limite courante.

Une transition de commande déjà observée et une projection suivante connue permettent une contribution conditionnelle. Dès qu'un changement de commande ou une ligne nécessaire demeure inconnu, le préfixe devient une expérience et s'arrête après cette commande. Le retour réel décidera si la transition et la prédiction sont confirmées.

La proposition conserve son `memory`, les compteurs de domaine, le candidat, les commandes, prédictions et changements, ainsi que l'époque, le score, la référence d'observation et le digest des pixels. L'enveloppe commune garde OP18, les références de preuves, la composition et la question source.

### 5. Revalider et acquérir une seule fois

Avant la première action, la garde vérifie le contenu du plan, son identité, ses commandes, l'époque, le score, le contrôle disponible, la scène, le digest du raster et la référence d'observation. Une continuation exige la projection prédite précédente. La commande doit encore viser le même contrôle, au même point, avec l'ancienne valeur et son support courant.

Après l'action, la prédiction est comparée au retour observé. Une frontière, une portée changée ou une projection inconnue ferme le préfixe. L'acquisition conserve distinctement une frontière officielle et un effet dans la même portée ; elle n'apprend pas une loi de commande à partir d'une frontière.

Une modification isolée du contrôle attendu confirme la transition observée. Toute autre modification enregistre le contre-exemple. L'événement `observed_chamber_relations` contient la mémoire révisée et le détail du retour ; sa couche l'acquiert une fois, puis le propriétaire commun le conserve dans son journal.

## Ordre d'héritage conservé

| Opération | Ordre des couches transférées concernées | Raison source |
| --- | --- | --- |
| Proposition | Panel, puis Chamber, puis les ancêtres transférés | `PanelServiceAccess` hérite de `RelationalChamberAccess` et délègue lorsque sa propre scène/configuration ne s'applique pas |
| Gardes avant/après | Panel si son plan est vrai au sens Python, puis Chamber si sa clé est présente | Les deux sources utilisent volontairement des conditions différentes ; une clé Chamber présente mais invalide ne doit pas basculer sur un ancêtre |
| Acquisition | Ancêtres, support, Chamber, puis Panel | Chaque couche source appelle d'abord son ancêtre avant d'acquérir son événement propre |
| Digest de la fermeture native | Ancêtres transférés, Chamber, puis Panel | Même ordre de composition des couches détenues, avec l'exception de compatibilité native décrite ci-dessous |
| Restauration | Journal commun, routage de chaque événement vers son propriétaire | Reconstruction complète avant remplacement des couches courantes |

Une proposition mêlant plusieurs clés ne peut donc pas faire passer Chamber devant un plan Panel valide. Inversement, un plan Panel vide délègue suivant la vérité Python. Pour Chamber, une clé vide avec une identité non correspondante doit produire le refus source de la garde, sans être assimilée à une absence de branche.

## Identité des coordonnées flottantes Python

La source calcule les centres par `/ 2`. Même lorsque le centre vaut mathématiquement un entier, Python conserve un flottant et son JSON contient par exemple `25.0`. Le quantum calculé à partir de ces centres porte également cette provenance. Sérialiser simplement le nombre JavaScript `25` changerait le digest de scène, puis celui de la proposition.

La projection native encode donc explicitement les **champs géométriques typés** `center`, `body`, `target` et `quantum` avec la convention Python existante `programPythonFloat`. L'identité du layout et `relationalChamberPlanIdentity` emploient cet encodage sur les chemins concernés. Les références d'axes, valeurs de commandes, points de clic, tableaux de relations et autres champs gardent leur représentation propre.

Cette correction ne normalise pas les attentes Python et ne change pas le digest entier commun. Elle rend explicite une distinction de type numérique perdue dans une simple représentation JSON JavaScript. Les fixtures conservent les digests originaux pour détecter cette différence.

## Conservation, certification et restauration

La couche Chamber participe au certificat de travail par **identité d'objet, révision et témoin structurel**. Une acquisition, un remplacement de couche, une modification directe de sa mémoire ou de sa liste d'événements invalide la réutilisation du checkpoint. La seule égalité d'une référence de checkpoint n'autorise pas à ignorer une mémoire de travail modifiée.

`nativeState()` conserve une valeur détachée et immuable. L'API publique `state()` restitue une copie indépendante. `restoreNative()` ne saute la reconstruction que pour une valeur déjà acceptée ou un checkpoint certifié dont les témoins sont toujours courants. L'API publique `restore()` reconstruit et vérifie systématiquement le journal.

La restauration construit d'abord des couches temporaires. Un événement Chamber va au seul réducteur Chamber, un événement Panel au seul réducteur Panel, et les autres acquis restent affectés à leurs propriétaires existants. Le digest reconstruit doit correspondre au checkpoint avant que les copies temporaires remplacent l'état courant. Un rejet laisse les couches antérieures intactes.

Pour conserver les checkpoints antérieurs, chaque nouvelle couche n'entre dans le digest natif qu'après son premier événement. Un ancien checkpoint Panel reste donc restaurable lorsque Chamber n'avait encore aucun acquis. Après restauration de cet ancien checkpoint, les événements Chamber plus récents ne subsistent pas. Ce digest conditionnel est une **enveloppe native de migration**, distincte du digest complet de toute la chaîne d'héritage Python.

## Preuves de composant et statut du registre

Le noyau V5 est vérifié par [export-v5-finite-relation-domain-reference.py](../../scripts/export-v5-finite-relation-domain-reference.py) et [v5-finite-relation-domain.test.ts](../../tests/v5-finite-relation-domain.test.ts). L'export appelle directement les originaux et vérifie les **1 786 fichiers de référence avant et après**. Il contient **40 cas de domaine** et **24 combinaisons indexées**. Le contrôle ciblé passe **43 tests**, incluant les cas source et le refus numérique natif qualifié.

La projection et la couche d'accès disposent de leur [exporteur source](../../scripts/export-v6-relational-chamber-parity.py), de [tests de parité](../../tests/v6-relational-chamber.test.ts) et de [tests d'intégration commune](../../tests/v6-relational-chamber-integration.test.ts). Ils distinguent les scènes initiales publiques des retours de composant contrôlés, puis vérifient les enveloppes, gardes, réducteurs et restaurations. Leurs effectifs et leur résultat formel doivent être lus dans le reçu de validation de la livraison.

Les statuts appropriés restent distincts :

- **Noyau V5 : `partial_transfer`**, car seules les deux fonctions consommées sont transférées, avec leur domaine natif explicite.
- **Projection de chambre : `component_verified`** lorsque ses preuves source, y compris les identités numériques, passent ; ce statut ne qualifie pas l'ensemble du caller.
- **Accès de chambre : `partial_transfer`**, même avec sa couche propre vérifiée, puisque sa chaîne héritée complète et ses générateurs de points ne sont pas tous transférés.
- **Façade observée : `partial_transfer`, deux branches sur six**. `exposed_reception_plan`, `rooted_line_plan`, `reception_service_plan` et `reference_population_plan` restent ouverts.

Le compteur des entrées complètement raccordées reste **50/76**. Le raccord d'une deuxième branche de l'entrée observée ne transforme pas cette entrée entière en transfert complet. La parité globale V5/V6, la couverture des autres familles et les conditions de stabilité de sessions longues restent des travaux séparés.
