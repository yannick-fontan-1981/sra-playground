# SS09 L2 entre dans le diagnostic de SIC

SS09 peut orienter le développement de SIC, à froid et après le L1. Les huit jeux déjà gagnés servent à vérifier que l’extension conserve les acquis. Une victoire future sur SS09 sera comptée comme la résolution autonome d’un jeu étudié. Le transfert vers un autre jeu demande une mesure distincte.

## La première décision qui manquait

Au premier coup du L2 à froid, le témoin v96 désigne lui-même une seconde silhouette et clique. La marque passe d’un sujet à l’autre. Le premier mouvement de vérification modifie la forme du sujet sélectionné sans déplacer son centre. L’image a changé, donc le témoin ne passe pas par sa règle de réessai sur image identique. Il rend le verdict `cursor_control_unconfirmed` et laisse l’exploration générale choisir le coup suivant.

Depuis l’image précédant le clic, le banc a joué séparément chacune des cinq commandes sans clic et après le clic, dans dix branches du moteur public. Vers la droite, la silhouette du premier sujet se translate exactement de trois pixels sans clic pendant que la seconde reste à sa place. Avec le clic, les rôles s’inversent et la distance est encore de trois pixels. Cette expérience établit quel contrôle était disponible dès l’entrée.

## Les configurations et les décisions qu’elles produisent

L’auteur choisit si SIC peut prolonger une expérience après un changement de pose et quelles observations suffisent à confirmer un déplacement. SIC choisit le clic, la silhouette, le geste et les commandes suivantes dans la partie. Les deux nouvelles règles s’appuient sur les pixels des sujets désignés au moment du clic.

| Candidat figé | Coups 1 à 4 depuis la même image | Décision expliquée par le reçu |
| --- | --- | --- |
| v96, `f60fd7661` | Clic, haut, haut, bas | Au coup 2, la vérification se termine. Le coup 3 provient de l’exploration générale. |
| v97, `1ac77158e` | Clic, haut, bas, gauche | Aux coups 2 et 3, les quantités d’encre du sujet et de sa marque persistent sur la même case. SIC essaie une direction encore inexplorée. Au coup 4, sa vérification reste indéterminée. |
| v98, `bfa0552a7` | Clic, haut, bas, gauche | Au coup 4, SIC retrouve le motif marqué sur une seule case adjacente et vérifie que le premier sujet a gardé sa place. Au coup 5, v97 reclique, v98 essaie une direction. |

Les essais courts ont chacun un plafond de huit commandes. Le premier changement de commande entre v96 et v97 intervient au coup 3. Entre v97 et v98, les quatre premières commandes et leurs images sont identiques, mais l’interprétation du quatrième retour diffère. Le nouveau reçu est `new_cursor_moved_while_previous_cursor_stayed`. Un rejeu indépendant suit les centres par la distribution des couleurs. Le sujet sélectionné reste en place aux coups 2 et 3 puis se déplace de trois pixels vers la gauche au coup 4. Les pixels propres au premier sujet gardent leur position aux trois coups.

## Quelle capacité viser ensuite

L’expérience suivante cherchait une préparation qui rende une direction efficace pour le second sujet. En conservant les deux centres, les préparations de un à trois gestes ont donné respectivement un, deux et trois groupes d’états comparables. Aucune commande n’a déplacé le second sujet dans un bras tout en le laissant immobile dans l’autre. En déplaçant d’abord le premier sujet, puis en sélectionnant le second à la même place, le banc a examiné 4, 10, 14 et 18 états distincts aux profondeurs 1 à 4. Il n’a trouvé aucun contraste de ce type parmi les centres qu’il pouvait suivre sans ambiguïté.

Le résultat change quand on mesure les deux caisses. Depuis la même image, le banc a cliqué sur le premier sujet ou sur le second, puis a joué la même commande. Les deux préparations coûtent exactement un clic. Une troisième branche joue la commande immédiatement. Le tableau compte les caisses ayant quitté leur case et réapparu sur une autre.

| Commande commune | Sans clic | Clic sur le premier sujet | Clic sur le second sujet |
| --- | ---: | ---: | ---: |
| Gauche | 0 | 0 | 1 |
| Droite | 0 | 0 | 2 |
| Haut, bas ou action 5 | 0 | 0 | 0 |

Après sélection du second sujet, la commande vers la gauche **change le vecteur entre les caisses**. Vers la droite, les deux caisses se décalent ensemble d’une case et le vecteur est conservé. Le rejeu des 280 commandes de SIC relève 38 transitions qui déplacent au moins une des deux caisses. Au coup 4, SIC explique dans son reçu le déplacement du sujet marqué. La mesure du mouvement de la caisse vient du banc. Le prochain test pour l’agent est de choisir entre ces effets en fonction d’une disposition qu’il veut obtenir. [Expérience sur les objets](../../../scripts/compare-selection-object-effects.mjs)

## Une expérience qui gagne, et deux préparations qui font échouer sa suite

Le banc peut restaurer un état et essayer les branches séparément dans le moteur officiel. En recherchant d’abord une occupation des deux repères par les caisses, puis les deux arrivées, il a essayé 454 transitions à la frontière de recherche et distingué 181 images. Les restaurations et les commandes servant à reproduire les préfixes entraînent des appels supplémentaires au moteur. La branche gagnante contient **26 commandes**, dont deux clics. Un nouveau chargement au L2 suivi des 26 commandes crédite officiellement le niveau.

La première caisse occupe son repère au coup 3. Le banc change de sujet au coup 4. Les deux repères sont occupés par des caisses au coup 10. Les sujets peuvent alors finir le niveau au coup 26. Deux comparaisons gardent la même durée et exactement la même suite après le clic testé.

| Préparation de remplacement | Première différence dans les positions des caisses | Résultat après 26 commandes |
| --- | ---: | --- |
| Au coup 1, cliquer sur le sujet déjà sélectionné | Coup 2 | Échec |
| Au coup 4, cliquer sur le sujet déjà sélectionné | Coup 7 | Échec |

Une hypothèse peut se formuler à partir de la partie autonome de v98. Sur 118 observations évaluables d’un déplacement d’une case du second sujet et de l’une des deux caisses, 80 déplacements de caisse sont observés. Une portée maximale de deux cases sur chaque axe, combinée à la liberté de la case d’arrivée, explique les 118 retours. L’hypothèse d’une portée illimitée commet huit erreurs. Ces observations couvrent 28 configurations relatives distinctes et les exemples positifs ont tous un écart maximal de deux cases. L’effet à une case reste à départager pour ce sujet. Pour le premier sujet, les 42 observations évaluables de la branche gagnante comprennent une poussée par contact. L’agent n’a pas encore choisi la relève du coup 4 à partir de ces capacités. [Recherche et contre-épreuves](../../../scripts/search-maintained-coverage.mjs)

## Résultats autonomes au même budget

Chaque partie complète utilise le moteur `f0a1ff437`, un maximum de 1 200 commandes et le même plafond de temps actif. Le temps actif est la limite atteinte dans chacune des six parties. Les durées par décision diffèrent, d’où des nombres de commandes différents. La première divergence de politique est mesurée séparément à plafond commun de huit commandes, sur le binaire v98 avec chacun des trois packs.

| Pack | L2 à froid | Campagne commencée au L1 |
| --- | --- | --- |
| v96 | Échec en 341 commandes | L1 inachevé en 418 commandes |
| v97 | Échec en 271 commandes | L1 inachevé en 340 commandes |
| v98 | Échec en 280 commandes | L1 inachevé en 268 commandes |

Le rejeu indépendant confirme les scores. Le total autonome reste **8 jeux Custom 4 sur 11**. V98 conserve les huit victoires avec les mêmes nombres de coups au L2. Ses 100 trajectoires des L1 sources sont identiques à v95 et gagnantes. CWSE L2 et KLOT L4 passent à froid en 59 et 37 commandes. Les 519 tests automatisés et le contrôle TypeScript passent.

[Mesures, scores officiels et contrôles](mesures-selection-ss09-v98.json) · [Comparaison avec et sans sélection](../../../scripts/compare-marked-control-probes.mjs) · [Comparaison des préparations](../../../scripts/compare-marked-preparations.mjs)
