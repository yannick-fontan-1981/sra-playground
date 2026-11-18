# Sources et adaptations

SS05 est une adaptation indépendante en grille ARC. Aucun sprite ou son du jeu commercial n’est inclus. Les URL et les empreintes des données consultées sont conservées dans `reference/source-provenance.json`.

## Règles de la Barde

La transcription communautaire exécutable de [Joric](https://github.com/joric/ootss/blob/main/scripts/ootss.pz) est la source précise du carré de chant de 5 × 5 cases, de l’ancrage des objets bloqués et du déplacement des blocs immergés. Le [guide Heroes 3: Bard, Druid](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) fournit les correspondances des salles, mais sa description verbale de « ligne » ne suffit pas à déterminer la portée.

SS05 emploie un seul Barde, des miroirs fixes et des portes posées au sol. Il immobilise l’appui sous le Barde et celui sur lequel il entre pendant ce pas. Il applique les déplacements de manière simultanée et refuse les copies multiples du personnage. Ces choix sont documentés comme adaptations, sans revendiquer une reproduction complète des règles commerciales.

## Cartes 2 à 4

Les trois cartes sont transcrites depuis les grilles `heroes3_3_v2`, `heroes3_1_v3` et `heroes3_2_v4` du fichier PuzzleScript. Elles correspondent respectivement aux énigmes 12, 10 et 11 de Heroes 3. Les murs, passages, objets et positions sont conservés, avec conversion des symboles et centrage dans la grille ARC.

Les parcours directionnels d’origine viennent de [data/solutions.json](https://github.com/joric/ootss/blob/main/data/solutions.json). Les trois parcours se rejouent intégralement dans SS05 : 59, 51 et 87 actions, sans blocage ni décès. La validation compare les cartes et les parcours aux références archivées.

## Cartes 5 et 6

Les salles `detachment` et `reattachment` correspondent aux [énigmes 1 et 2 de Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/). Leur géométrie provient de l’[export des objets de niveaux](https://github.com/chenyuyang712/OSS-puzzlewiki/blob/main/data/levels_layout.json.gz), vérifié avec les captures [detachment](https://github.com/joric/ootss_tileset/blob/main/images/levels/detachment.webp) et [reattachment](https://github.com/joric/ootss_tileset/blob/main/images/levels/reattachment.webp).

Le décodage associe un enregistrement d’asset `u` au prochain enregistrement de position `p`. Toutes les variantes de parquet sont comptées comme sol. Les plateformes sont conservées, les portes en hauteur deviennent des portes sur sol, et une bordure d’eau est ajoutée pour empêcher le cadrage serré de créer des murs artificiels autour des îlots.

L5 conserve la logique consistant à abandonner une caisse sur son bouton en quittant sa portée par reflet. L6 déplace le deuxième bouton vers le bas à droite de l’îlot central, afin d’exiger une nouvelle position relative du Barde et de la caisse. Ses huit activations de miroir produisent une chorégraphie différente de L5. Les témoins SS05 de 31 et 26 actions sont des parcours adaptés ; ils ne sont pas présentés comme les vidéos originales.

## Cartes originales

L1, L7 et L8 sont des créations SS05. Leurs mécanismes combinent les règles de chant, d’eau, de miroir et de porte-presse utilisées dans la série. Aucune identité avec une énigme commerciale précise n’est revendiquée. L8 permet plusieurs solutions, dont une qui construit davantage d’appuis pour contourner le deuxième miroir ; cette liberté est conservée.
