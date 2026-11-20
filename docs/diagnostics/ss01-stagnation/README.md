# SS01 L2 · de la boucle locale à l’expérience sur le miroir

Sur le parcours guidé commun, SIC sait annoncer l’arrivée du marchand sur la marque dès sa première commande. Le premier échec se produit au choix de l’expérience suivante. Même lorsque SIC finit par bouger le miroir, il faut vérifier quelle pièce il avait nommée et quelle arrivée il attendait.

## Ce que décide le candidat

Le L1 a été joué selon un trajet de démonstration et officiellement terminé. Après trois déplacements publics de démonstration au L2, la famille de composition de SIC choisit seule ses commandes suivantes. Le moteur indépendant contrôle la position du marchand et des deux miroirs avant et après chaque commande. Cette expérience isole la décision de SIC. Les départs entièrement autonomes sont mesurés séparément.

| Mesure sur cette même entrée | v24 | v25 | v26 | v27 |
|---|---:|---:|---:|---:|
| Commandes jusqu’à l’arrêt | 69 | 66 | 160 (plafond) | 80 |
| Téléportations physiques au terme de l’essai | 31 | 31 | 27 | 32 |
| Téléportations dans les 66 premières commandes | — | 31 | 27 | 26 |
| Téléportations physiquement vérifiées et taguées stagnantes | — | 0 | 6 | 7 |
| Cases visitées | 8 | 8 | 11 | 11 |
| Poussées du miroir avec prédiction correcte du sujet, de la pièce et du déplacement | 0 | 0 | 0 | 0 |
| Îlots atteints | haut | haut | haut | haut |

V25 tague dix retours stagnants et laisse passer chacune des 31 téléportations. V26 reconnaît aussi les boucles entièrement rejouées. À la commande 51, il pousse réellement le miroir de (8,3) à (8,2), alors que sa prédiction désigne la case (8,4). V27 reconnaît le marchand durant une étape de manipulation sur treize. Aucune des treize ne désigne le miroir. Diminuer les téléportations au même horizon a donné trois cases de plus sur l’îlot du haut. La traversée reste à démontrer.

## Où s’arrête le raisonnement en v27

| Constat ou déduction attendue | Contrôle dans le moteur | Comportement de SIC |
|---|---|---|
| Un marchand précis peut arriver sur la marque visible après une commande | Au L1, le marchand quitte (6,9), atteint la marque (9,6) et l’autre marchand reste sur place | Acquisition mécanique vérifiée. La règle est conservée au changement de niveau guidé. |
| La téléportation initiale du L2 reste sur l’îlot du haut | Dès que la marque est visible après les trois déplacements, (8,4) donne (9,3) | Le premier transfert est prévu correctement. Sept activations reçoivent ensuite un tag de stagnation dans l’essai v27. |
| Les déplacements accessibles avec le miroir fixe épuisent le territoire initial | L’énumération indépendante donne 18 cases sur le même îlot en configuration initiale | Le départ autonome visite 18 cases. Le parcours guidé en visite 11. Ces visites seules ne prouvent pas que SIC a déterminé la fermeture du territoire. |
| Une pièce gouverne la relation entre le marchand et sa marque | Le miroir du haut est un repère compatible avec les transferts observés | À la commande guidée 15, SIC identifie encore le bon marchand et dispose de cinq observations compatibles avec un repère sur le miroir. Deux directions seulement lui sont utilisables. Aucun programme n’est proposé pour cette paire. |
| Une poussée vers la gauche permet d’ouvrir une traversée | Quatre placements du premier miroir ouvrent onze couples départ–arrivée. Avec le miroir en (5,3) et le marchand en (10,3), l’arrivée est (5,8) | Aucun plan guidé v27 n’annonce cette traversée. En départ autonome, les commandes 28 et 29 poussent le miroir vers le bas. |
| Sur le deuxième îlot, la même relation permet de rejoindre le troisième | Le déplacement du deuxième miroir de (4,11) à (4,9) permet de partir de (4,14) et d’arriver en (9,9) | Le marchand autonome n’a pas atteint le deuxième îlot. Aucune réutilisation sur place n’a été observée. |
| Une fois sur l’îlot de droite, le marchand atteint la sortie | Le trajet dirigé atteint la sortie en (11,8) | Aucune victoire autonome, en départ direct ou en campagne depuis le L1. |

Le détail des marches, de la marque, des deux transferts et de la terminaison officielle du trajet dirigé figure dans le [diagnostic géométrique indépendant](https://github.com/yannick-fontan-1981/sra-playground/blob/7eef7c3f0bc4fcf7a52532bc9e3b06cc7eef464d/docs/diagnostics/ss01-l2-v19/README.md).

## Départs directs, sans démonstration

Chaque bras démarre avec un agent neuf et la même empreinte de plateau. Aucune remise à zéro. Le plafond commun est de 1 200 commandes, avec un budget de temps actif. Le nombre de commandes effectivement exécutées varie. Les quatre colonnes ci-dessous donnent le nombre de commandes. Aucun des niveaux ne franchit sa frontière officielle dans ces bras.

| Niveau | Témoin v1 | v25 | v26 | v27 |
|---|---:|---:|---:|---:|
| SS01 L2 | 579 | 606 | 573 | 561 |
| SS06 L2 | 751 | 581 | 556 | 555 |
| SS07 L2 | 5 | 41 | 47 | 47 |
| SS08 L2 | 791 | 803 | 775 | 744 |

V26 marque 94 stagnations sur SS01 L2 en départ direct. Sur 54 tests exploratoires, 50 incluent une composante située sur un miroir parmi les pièces nommées. Aucun de ces 50 tests ne déplace le miroir nommé. Une expérience où l’agent surveille six pièces ne compte pas comme une prédiction de poussée ciblée.

## Provenance

Les candidats v25, v26 et v27 ont chacun été figés et poussés avant leur évaluation. Les données de développement viennent des 100 jeux sources et de 18 niveaux supérieurs. Les difficultés des versions précédentes sur SS01 étaient connues de l’expérimentateur. SS09 L2 demeure réservé. Le témoin est `7f2cb3eb`, le moteur `f4d28aee`. Les engagements avant les actions, les causes de stagnation, les empreintes et les totaux sont consignés dans les [mesures](mesures.json). Les expériences sources sont décrites dans le [protocole de généralisation](../../architecture/sic-stagnation-zone-source100.md).
