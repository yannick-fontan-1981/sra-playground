# Quand expérimenter pour identifier le sujet contrôlé

## Première divergence sur SS06 L2

Le témoin v62 commence par une direction et observe un déplacement. À sa deuxième décision, son détecteur trouve une pièce candidate. Le moteur interroge alors les deux groupes SIC qui peuvent s’en charger. Le groupe de poursuite n’a aucune vérification en cours. Le groupe d’exploration demande une projection spatiale. L’aire que la pièce candidate devrait occuper après le mouvement diffère visuellement de celle qui a permis le premier déplacement. La famille ne soumet donc aucun clic à l’arbitre. SIC joue une autre direction.

Ce résultat réunit deux vérifications. Le rejeu des 218 décisions retrouve 45 états où la famille peut proposer un clic si on l’interroge sans exiger la projection, et zéro avec la projection stricte. Une exécution instrumentée du témoin confirme que les deux groupes ont été interrogés au coup 2. Au coup 179, un clic choisi pour une autre raison amorce une vérification passive. Le geste suivant ne confirme pas le changement de sujet. [Détecteur et mesure de la projection](../../../src/sic/marked-cursor-selection.ts) · [Rejeu du diagnostic](../../../scripts/locate-cursor-offer.mjs)

## Ce que déclare l’auteur

Les packs A et B utilisent tous deux SIC Fallback, une profondeur de 88, 1 000 nœuds, la stratégie `motion_contrast` et un minimum de deux résultats distincts. Un seul champ de la préférence d’information varie. En mode `shadow`, cette préférence n’autorise pas le nouveau test. En mode `active`, le groupe d’exploration peut proposer une expérience qui distingue deux sujets possibles, même si la surface d’arrivée du second est inconnue. Le test unitaire relève aussi le seuil à trois sur la même observation et vérifie que la proposition disparaît. [Pack A](controle-v63-shadow.json) · [Pack B](controle-v63-active.json) · [Test des déclarations](../../../tests/sic-marked-cursor-selection.test.ts)

Le langage SIC possédait déjà une primitive pour tester l’effet inconnu d’une commande (P05), un ordre de recherche et une préférence d’information. L’interface de jeu ne transmettait au chemin Fallback que les budgets, et son compilateur refusait la préférence. V63 transmet la déclaration existante à la famille. La nouvelle opération concrète consiste à reprendre une commande dont SIC a vu le premier sujet subir l’effet, à choisir lui-même une cible candidate et à prédire **quel sujet** bougera après sélection. Cette opération s’applique aussi à deux pièces sélectionnables placées sur des sols différents. Les couleurs, positions, commandes et preuves d’identité sont déterminées en partie. [Préférence d’information](../../../src/sic/information-preference.ts) · [Compilation du pack](../../../src/sic/active-recovery.ts) · [Passage au moteur](../../../src/main.ts)

## Ce que SIC décide et mesure

| Étape | Décision de SIC | Observation qui permet de poursuivre |
| --- | --- | --- |
| Explorer | Choisir un clic dont l’effet peut départager « la même pièce reste contrôlée » et « le contrôle passe à la pièce sélectionnée ». | Un moteur directionnel a déjà déplacé la première pièce. SIC conserve cette commande, le déplacement observé et sa référence dans le reçu. |
| Vérifier | Rejouer ce moteur sur la nouvelle disposition. | La pièce sélectionnée se déplace du vecteur observé et la première garde sa position. La marque visuelle seule ne valide pas la commande. |
| Utiliser | V64 conserve la position de la première pièce, actualise celle de la seconde et propose un déplacement supplémentaire. | Le reçu exige simultanément le nouveau déplacement et la conservation du premier placement. La suite est bornée à une réutilisation. |
| Gagner | Poursuivre jusqu’au changement de niveau. | Seul le compteur natif ou l’état officiel de victoire crédite le L2. |

Sur SS06, le pack actif sélectionne au coup 2, vérifie au coup 3 et utilise la commande au coup 4. Le pack témoin ne formule aucun de ces tests dans les 40 premières actions. Les essais partent de la même image. Le banc indépendant rejoue le mouvement seul, le clic choisi par SIC, et un clic de même durée sur l’ancien sujet. Après la première translation du second sujet, le banc vérifie également les effets de rendre le contrôle au premier ou de le laisser au second. Les commandes du banc n’entrent jamais dans le solveur. Le premier placement est conservé pendant le mouvement supplémentaire. Sa valeur pour l’objectif final demeure à établir. [Vérification physique indépendante](../../../scripts/verify-autonomous-control-tests.mjs)

Le gel v63 correspond à `497b0a5fe`. V64 correspond à `e537cc0f1`. Le jeu entier SS09 a été tenu à l’écart de la conception de ces deux versions. Ses résultats historiques sous v62 étaient connus. Les deux packs exportés sont identiques entre v63 et v64. Le moteur Custom 4 est `f0a1ff437`. Les temps d’exécution peuvent faire varier la longueur atteinte avant le plafond de 1 200 commandes. Le contrôle à 40 commandes compare exactement le même nombre de décisions.

## Qualification sur les jeux

| Jeu et configuration | Tests autonomes joués et suivis de leur commande de vérification | Sujet confirmé par SIC et par intervention native | Réutilisation voulue et premier placement préservé | Score officiel du L2 |
| --- | ---: | ---: | ---: | --- |
| SS06 · v62 figé | 0 | 0 | 0 | échec, 229 coups |
| SS06 · v64 témoin | 0 | 0 | 0 | échec, 132 coups |
| SS06 · v64 actif | 1 | 1 | 1 | échec, 139 coups |
| SS09 · v62 figé | 0 | 0 | 0 | échec, 159 coups |
| SS09 · v64 témoin | 0 | 0 | 0 | échec, 129 coups |
| SS09 · v64 actif | 4 | 0 | 0 | échec, 134 coups |

Le pack embarque la même règle et les mêmes paramètres sur SS09. Il fait choisir quatre expériences aux coups 6, 61, 71 et 117. Aucun de ces essais ne valide l’hypothèse de changement de sujet. L’initiative se transfère à un autre jeu et les résultats négatifs restent des résultats négatifs. Sur SS06, le premier placement conservé n’est pas encore choisi en fonction d’une condition de victoire. Les six essais du tableau s’arrêtent au budget de temps actif. [Scores et empreintes des rejeux](mesures-generalisations-manquantes.json)

Les campagnes qui commencent au L1 s’arrêtent au L1 sur SS06 (241 coups avec le pack actif, 205 avec le témoin) et sur SS09 (200 et 207 coups). Le L2 de ces deux jeux reste donc non atteint dans cette condition. Les trois victoires de campagne déjà connues sont reproduites avec le pack actif. SIC gagne SS01 en 36 puis 32 coups, SS03 en 47 puis 97, et SS04 en 49 puis 143.

Les 100 L1 sources sont gagnés sous v63 et sous v64. Le rejeu retrouve pour chacun la trajectoire de v62, notamment SKBN en 22 coups, SWCH en 25, KEYD en 35 et GABA en 49. Les essais supérieurs v64 gagnent CWSE L2 en 59 coups au plafond de 120 et KLOT L4 en 37 au plafond de 100. Les 479 tests de la suite SIC et du déplacement des pièces sélectionnées passent sur les deux gels, avec les fixtures de référence. La compilation TypeScript passe également.

## Transmission d’une condition sur SS05

En campagne v64 active, SIC gagne le L1 en 44 coups puis atteint sa limite de temps après 174 coups au L2. L’intervention sur le coup 40 du L1 conserve les quatre derniers gestes. L’omission et chacun des quatre remplacements font échouer cette suite. Le premier choix du L2 récupère **96 hypothèses** de composition de niveau précédent. Dix-huit mentionnent le geste contextuel, six l’emploient comme préparation et aucune de ces six préparations n’avait été confirmée pendant son apprentissage. Au L2, les trois décisions qui réemploient une loi locale rattachée au L1 ne font appel qu’à des directions.

Pour tester directement la condition manquante, le banc restaure chaque situation distincte où le dernier pas vers un contact hérité échoue et où le sujet reste en place. Sur les 13 situations de v64, le pas seul, le même pas répété et le geste contextuel suivi du pas échouent tous à produire le déplacement prévu ou une victoire. Sur v63, le même résultat se retrouve dans 12 situations. Les deux séries peuvent partager des préfixes. Le prochain test sur les sources doit faire varier la position relative du sujet et du mécanisme avant le geste. [Expérience depuis des états appariés](../../../scripts/compare-warm-blocked-contacts.mjs)
