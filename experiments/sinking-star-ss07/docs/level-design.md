# Conception des huit niveaux SS07

Version **0.1.1 / HTML v2**. Les cartes et leurs parcours sont enregistrés dans `reference/level1-design.json` à `level8-design.json`. Chaque salle contient un Marchand, un Voleur et deux destinations. Les solutions ci-dessous sont des témoins d’auteur, sans garantie d’optimalité.

| Niveau | Titre | Actions | Poussées Marchand | Tractions Voleur | Reflets | Appuis créés |
|---|---|---:|---:|---:|---:|---:|
| 1 | L’atelier du pas de côté | 59 | 4 | 2 | 2 | 2 |
| 2 | Les lacunes du miroir | 59 | 1 | 14 | 8 | 1 |
| 3 | Partir sans reprendre | 29 | 1 | 1 | 3 | 0 |
| 4 | Les quatre appuis | 94 | 8 | 7 | 3 | 4 |
| 5 | La presse des deux rives | 77 | 10 | 4 | 2 | 2 |
| 6 | Le poids de la sentinelle | 54 | 4 | 2 | 2 | 1 |
| 7 | La forteresse des deux sceaux | 88 | 4 | 2 | 3 | 1 |
| 8 | Le pont qu’on ne rend pas | 136 | 20 | 6 | 2 | 3 |

Les actions incluent les changements de personnage. « Appuis créés » compte les caisses immergées pendant le parcours, pas les appuis initiaux ni les plateformes hydrauliques.

## 1 — L’atelier du pas de côté

Le Voleur extrait la caisse de son alcôve et la lâche par un pas de côté. Le Marchand la pousse dans l’eau pour créer le premier appui. Un bouton commande une presse latérale distante qui fabrique le second. Le duo rejoint le miroir ; le Voleur le retire de la rive, prépare son approche puis traverse par reflet sans l’entraîner. Le Marchand utilise le même passage pour occuper la seconde cible.

Les neuf acquis suivis par l’interface sont : marcher, sélectionner, pousser avec le Marchand, tirer avec le Voleur, déplacer le miroir, construire un appui, commander une porte, activer le reflet et occuper les deux destinations. Ils correspondent à des changements observables dans les pixels.

Les contrôles de nécessité isolent quatre mécanismes : désactiver les poussées du Marchand, les tractions du Voleur, les presses ou la création d’appuis rend les recherches terminées insolubles. Pour le reflet, la preuve est topologique : même en ouvrant toutes les portes et en ignorant les objets mobiles, un chemin vers une cible traverse au moins trois cases d’eau. Deux caisses seulement sont disponibles, sans appui initial ni plateforme hydraulique ; les seuls pas cardinaux ne suffisent donc pas. La recherche sans reflet ayant atteint sa limite n’est pas interprétée comme une preuve. Voir `reference/level1-necessity.json`.

## 2 — Les lacunes du miroir

Adaptation de **Heroes and Mirrors 4, `holes`**. Les trous imposent de déplacer le miroir puis de quitter son axe par reflet à plusieurs reprises. Le parcours du Voleur reprend les 53 commandes de la source sur une reconstruction 2D des cases parcourues. Le Marchand et sa caisse préparent l’accès complémentaire et la seconde destination. Les frontières non parcourues sont adaptées ; aucune équivalence complète de la carte source n’est revendiquée.

## 3 — Partir sans reprendre

Adaptation de **Heroes and Mirrors 5, `double_break`**. Le Marchand règle le miroir supérieur et libère l’accès du Voleur. Celui-ci tire le second miroir sur un bouton. Repartir à pied reprendrait ce poids ; un reflet permet de quitter l’axe sans déplacer le miroir. Deux portes croisées organisent un secours réciproque avant l’arrivée finale. Le problème est compact : sa difficulté repose sur l’ordre et la forme du départ, pas sur la longueur du trajet.

## 4 — Les quatre appuis

Adaptation de **Heroes and Mirrors 6, `drop_tool`**. Les cinq îlots et les quatre caisses exigent plusieurs alignements. Le Voleur extrait les caisses accessibles par un seul côté ; le Marchand déplace le miroir et complète la dernière traversée. Trois caisses deviennent des appuis par reflet, la dernière par poussée directe. La géométrie source, trop grande pour la grille, est recomposée en 20 × 16.

## 5 — La presse des deux rives

Adaptation de principe de **Heroes and Light 2**. La file initiale de deux caisses est inaccessible à une poussée simple. En tirant le miroir sur le bouton, le Voleur déclenche une presse horizontale qui libère la caisse extérieure. Le Marchand construit le premier appui ; le Voleur ramène ensuite le miroir et libère la presse. La seconde caisse prolonge le pont. Replacé sur son axe utile, le miroir donne accès à l’îlot des deux destinations.

La carte est originale : les six caisses et la cascade de la référence deviennent deux caisses, une presse et deux rives. Le parcours comporte une poussée de presse, deux appuis créés et deux voyages de héros par reflet.

## 6 — Le poids de la sentinelle

Adaptation de principe de **Heroes and Mirrors 7**. Les héros déplacent le miroir dans deux sens pour déposer le monstre sur un bouton éloigné. Il maintient alors la porte pendant la sortie. La caisse finale doit franchir un virage : le Voleur la tire hors du cul-de-sac et libère son axe, puis le Marchand la pousse dans l’eau. Le monstre reste vivant sur son bouton ; la résolution ne comporte aucun combat.

## 7 — La forteresse des deux sceaux

Création originale. Un premier appui permet au Marchand d’atteindre la forteresse. Une caisse envoyée par reflet sur le premier sceau libère le Voleur. Le Voleur tire un miroir inaccessible à la poussée sur le second sceau ; la presse rapproche deux monstres qui s’éliminent dans une même phase de combat.

Le Voleur est alors dans une alcôve. Lors de son départ par reflet, le Marchand doit prendre temporairement la place de la caisse sur le premier sceau pour maintenir ouverte la porte du palier. Le Voleur quitte le rayon ; le Marchand restaure ensuite la caisse et les deux héros rejoignent la sortie. Le scénario sans relève provoque bien l’écrasement du Voleur, et Undo restaure l’état précédent. Ce contrefactuel vérifie le mécanisme dans cette situation précise, sans établir l’unicité globale de la solution.

## 8 — Le pont qu’on ne rend pas

Création originale. Le Voleur extrait les deux premières caisses, puis maintient un bouton situé dans un coude qui ne peut pas être chargé avec une caisse. Trois plateformes forment ainsi un pont provisoire. Le Marchand traverse, commande la presse de l’autre rive et récupère la troisième caisse.

Il charge les trois plateformes, de la plus éloignée à la plus proche. Lorsque le Voleur quitte le bouton, leur retrait immerge les trois caisses : le pont devient permanent. Le duo franchit alors la traversée, puis les **deux appuis déjà présents** donnent accès au miroir final. Le Voleur le retire depuis le côté accessible et les deux héros atteignent le dernier îlot par reflet.

Le témoin comprend trois plateformes hydrauliques, trois nouveaux appuis issus de leur retrait, deux appuis initiaux, une presse et deux reflets de héros. Ces quantités décrivent des éléments distincts.

## Portée de la validation

Les huit replays complets vérifient une arrivée des deux héros sans action bloquée ni mort. Ils totalisent **596 actions / 1 754 images** dans la session publique. Les 73 tests de règles couvrent notamment la traction, les reflets, les presses, les circuits, l’eau, le combat et Undo. La validation ne prétend ni que chaque objet est nécessaire dans toute stratégie possible, ni que le SRA a résolu les salles de façon autonome.
