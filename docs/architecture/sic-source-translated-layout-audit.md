# Déplacer une disposition et éprouver la capacité qu’elle accorde

Cette étude sur les traces des 100 jeux et 18 niveaux supérieurs distingue trois quantités. La première est l’emplacement affiché d’un indicateur après une commande. La deuxième est la destination réelle d’un sujet après l’action suivante. La troisième est le changement du déplacement que cette action produit depuis son point de départ.

## Déplacement de l’indicateur

Une famille de rotations et de réflexions du plan a été confrontée aux configurations observées avant chaque essai. À centre fixe, la nouvelle position de l’indicateur et les deux autres positions prévues sont exactes dans 16 essais sur 16 sur AR25 et FITE L1. Les 12 essais sur CATR L2 et L3 échouent. Aucun de ces essais n’établit qu’une commande ultérieure permet au sujet d’occuper la nouvelle position de l’indicateur.

Une projection distincte apprend directement le décalage entre une marque et le sujet après l’action. Elle demande que cette projection explique davantage de résultats passés que le mouvement ordinaire du sujet et qu’une arrivée fixe. Sur les 100 trajectoires, une prévision à décalage non nul se réalise dans PORT L1 sur deux prévisions émises. Aucune preuve supplémentaire de correspondance entre deux formes visuelles ne ressort de cette étude.

## Séparer le geste de préparation du geste de lecture

Pour chaque effet antérieur, on exprime la position de lancement et celle d’arrivée relativement à une pièce. Si cette pièce pouvait être amenée en C’, le programme calcule où replacer le sujet pour retrouver la première disposition locale et où il devrait arriver dans la seconde. Plusieurs poussées et des commandes de repositionnement peuvent précéder le déclenchement. Chaque position intermédiaire annoncée doit se vérifier avant la suivante.

| Échantillon | Programmes à l’essai | Premier geste exact | Toute la préparation exacte et commande suivante exécutée | Arrivée exacte | Arrivée à une case jamais visitée par ce sujet |
|---|---:|---:|---:|---:|---:|
| 100 jeux L1 | 237 | 30 | 21 | 13 | 11 |
| 18 niveaux supérieurs | 68 | 7 | 7 | 2 | 2 |

Les 15 arrivées proviennent de GABA, MIND et SKBN L1 ainsi que GIGO L4. Chacune diffère de l’arrivée sans la préparation et d’au moins un contrôle de même durée. Or, en mesurant le **déplacement depuis le point de départ de l’action finale**, aucun des 15 ne diffère du contrôle sans préparation. Aucun préfixe antérieur n’offre le même point de départ avec la pièce dans sa position initiale. Ces résultats démontrent la translation d’une expérience. Ils laissent ouverte la question de la capacité nouvellement acquise.

Le calcul géométrique expérimental énumère également les positions accessibles à mécanisme fixe, puis les dispositions censées atteindre une autre région après une poussée. Il élimine une destination qui coïncide avec l’effet moteur ordinaire déjà mesuré. Sur les 76 situations sources admissibles, deux situations de MIND L1 produisent chacune quatre dispositions candidates. Dans chaque situation, le premier geste du programme retenu échoue à produire la disposition prévue. Ce calcul reste dans les outils d’étude.

Les sélections de questions et les contrôles indépendants sont reproductibles avec `propose-source-translated-experiments.py`, `test-source-translated-experiments.mjs` et `test-source-reachable-previews.mjs`. Ils ne modifient pas le candidat morphologique v21.
