# SS09 — conception des huit salles

Le tutoriel L1 est original. L2–L8 reprennent des idées précises des pages North et Crossovers demandées, avec une topologie créée pour Marchand/Barde. Chaque `reference/levelN-design.json` contient grille, source, écarts, étapes, métriques et parcours exécutable. Les constructeurs sont dans `reference/author/`.

| Niveau | Titre | Référence et idée | Actions du témoin |
|---|---|---|---:|
| 1 | Le chantier des deux voix | Atelier original · préparer, chanter, pousser, refléter | 52 |
| 2 | La sortie sans refrain | Adaptation de Heroes 3: Bard, Druid 14 · quitter deux poids sans les entraîner | 21 |
| 3 | Les trois voix séparées | Adaptation de Heroes 3: Bard, Druid 15 · distribuer trois poids sur des boutons séparés | 63 |
| 4 | Le contrechant du pont | Adaptation de Heroes 3: Bard, Druid 13 · un duel dans le passage obligatoire | 60 |
| 5 | Laisser le dernier accord | Adaptation de Heroes and Mirrors 1 · quitter le chant en laissant le poids sur son bouton | 57 |
| 6 | Les trois passages de l’écluse | Adaptation de Heroes and Water 27 · guider un appui dans un labyrinthe | 71 |
| 7 | La presse à contretemps | Adaptation · Heroes and Light 1 — atteindre un bouton par une presse latérale | 58 |
| 8 | L’archipel du dernier accord | Adaptation · Heroes and Mirrors 2 / Heroes and Water 28 — changer d’axe sans chanter | 61 |

## Rôle des mécanismes

L1 enseigne douze événements réels : sélection, marche, poussée, chant, entraînement du partenaire, membre retenu, création et glissement d’appui, déplacement du miroir, reflet, presse et deux destinations. La v3 déplace uniquement l’îlot isolé d’une case, de (9,8) à (9,11), tout en bas du bassin. La rive originale du premier îlot est entièrement restaurée et les deux cases de sol supplémentaires de la v2 sont retirées. Les deux appuis se placent en (7,11) et (8,11), retenus devant l’îlot. Les deux héros suivent ce passage puis utilisent le miroir. Les positions initiales des personnages et dispositifs ne changent pas.

L2 fait sortir le Barde sans déranger deux poids. L3 répartit trois poids avec des butées et verrouillages distincts. L5 détache le Barde d’une caisse par reflet. L6 fait parcourir deux coudes à un appui, avec construction du pont après son passage. L7 exige de charger la seconde presse entre deux fermetures.

### L4 : chaque dispositif ferme un passage

Le Barde commence isolé. Le Marchand maintient le bouton qui ouvre son trajet de réflexion. La caisse est déjà chargée sur la presse et un mur interdit sa poussée manuelle vers le futur pont ; la géométrie empêche également le chant de produire ce pont avant la fermeture de la presse. Les deux monstres occupent le couloir obligatoire vers la sortie ; celui de gauche maintient aussi la presse ouverte. Leur duel libère le bouton et construit le pont du Marchand. Une fois le couloir dégagé, le Marchand doit remonter le miroir final d’une case pour aligner l’îlot des destinations. Les deux monstres doivent être déplacés ou éliminés ; le duel n’est pas déclaré unique.

### L8 : la caisse maintient le passage optique

La porte coupe le rayon du premier miroir. Le Marchand déplace le miroir, charge la caisse sur le bouton et pousse le Barde sur son départ sans chant. Un pas volontaire du Barde dans cette même direction entraîne la caisse dans l’eau, retire le poids et ferme la porte. Le bouton est voisin du seul départ sûr : un monstre utilisé comme poids tuerait le héros qui s’y présente. La case d’eau sous le bouton ferme également la sortie par un miroir non réglé. Les trois îlots, le second réglage de miroir et le duel du passage central restent présents.

## Preuves et limites

Les huit témoins réussissent sans refus ni décès : 443 actions, 33 sélections, 1 312 images. Ce sont des preuves de faisabilité, pas d’optimalité ni d’unicité.

Les recherches sans chant épuisent 2 520 états en L2 et 306 en L3 ; celle sans poussée du Marchand épuise 2 712 états en L6. En L4, la recherche sans poussée épuise 15 404 états ; sans chant, 48 ; sans reflets, 24 ; sans presse ou sans construction d’appui, 96. Les audits supplémentaires prouvent que la porte d’entrée doit s’ouvrir et que chaque monstre doit quitter sa position initiale ou mourir. La séparation géométrique de l’îlot final exige son miroir.

En L8, supprimer la caisse épuise 173 874 états sans réussir à faire quitter l’îlot initial aux deux héros. Maintenir la porte fermée épuise 419 014 états sans réussir à en faire sortir un seul. Ces objectifs étant plus faibles que la victoire, les résultats démontrent la nécessité de la caisse et de l’ouverture. Le script `reference/author/verify-level8-necessity.mjs` reproduit ces deux recherches.

Les recherches plafonnées restent explicitement inconclusives. Les preuves de capacité, les obstacles géométriques et les témoins gagnants sont distingués dans les fichiers `reference/levelN-necessity.json` ; aucune unicité générale de solution n’est affirmée.
