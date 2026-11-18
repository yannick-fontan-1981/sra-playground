# Conception des niveaux aquatiques — SS02 0.4.0

## Remplacement demandé

Le niveau 1 reste le tutoriel. L’ancien niveau 3 devient le niveau 2. Le niveau 7
est conservé. Les niveaux 3, 4, 5, 6 et 8 sont de nouvelles cartes originales.

## Mécaniques distinctes

### 3. La digue et la cheminée

La digue donne accès au plateau supérieur : on peut enfin passer sur le côté de la caisse bloquant la cheminée et la pousser latéralement.

### 4. Les amarres croisées

Le stock initial ne suffit pas à construire les deux accès. Une pierre doit revenir depuis une rive sur un pont existant puis repartir vers l’autre rive. Les deux ordres de visite restent possibles.

### 5. Le port des trois appuis

Les deux doigts de quai demandent des poussées opposées. Il faut transporter une pierre autour du bassin pour fabriquer un appui de côté, puis conserver une réserve pour la sortie centrale.

### 6. La spirale et le quai de manœuvre

Trois paliers forment une spirale. Un quai construit au bord de l’eau sert à contourner une caisse et à réorienter plusieurs cargaisons ; certains appuis servent ensuite de sol pour d’autres caisses.

### 8. Les trois chantiers

Trois chantiers réclament une répartition de neuf pierres entre six appuis et trois boutons. Les cargaisons nord-est et sud changent d’axe grâce à des appuis latéraux.

## Validation des parcours

Les nombres ci-dessous décrivent les parcours témoins rejoués, et non des minima.
Le nombre de commandes n’est pas présenté comme une mesure objective de difficulté.

| Niveau | Taille | Pierres initiales | Boutons | Appuis créés | Poussées | Actions |
|---|---|---:|---:|---:|---:|---:|
| 1 | 17×13 | 3 | 2 | 1 | 15 | 48 |
| 2 | 13×9 | 10 | 0 | 0 | 12 | 27 |
| 3 | 15×13 | 3 | 1 | 2 | 13 | 55 |
| 4 | 17×15 | 5 | 2 | 3 | 30 | 86 |
| 5 | 18×15 | 5 | 2 | 3 | 44 | 98 |
| 6 | 15×15 | 6 | 2 | 4 | 25 | 76 |
| 7 | 9×8 | 3 | 3 | 0 | 11 | 58 |
| 8 | 19×17 | 9 | 3 | 6 | 27 | 88 |

Les huit parcours aboutissent à la victoire. La campagne complète utilise
536 directions et les images de transition n’ajoutent aucun tour logique.

## L’eau fait partie de la résolution

Pour les cinq nouvelles cartes, la validation établit qu’une résolution sans
construire de support n’est pas possible :

- Niveau 3 : recherche sans immersion terminée sans solution après 2 710 états.
- Niveaux 4, 5 et 6 : la destination est déconnectée du départ sur le sol initial, même en retirant toutes les pierres et en ouvrant toutes les portes.
- Niveau 8 : les trois boutons sont dans des composantes de sol inaccessibles au départ. Aucun n’est déjà occupé ; il faut créer des accès avant de pouvoir les activer.

Le témoin du niveau 3 utilise la digue pour rejoindre un flanc terrestre. Celui
du niveau 4 réutilise un pont pour transporter une pierre. Les témoins des niveaux
5, 6 et 8 poussent directement depuis des appuis selon un axe perpendiculaire à
la poussée qui a créé ces appuis (respectivement 2, 4 et 4 fois).

Le niveau 4 a également été vérifié avec l’autre ordre de visite des rives. Le
parcours retenu dans la campagne commence au nord ; l’ordre sud puis nord reste possible.

## Mouvement en trois images

À chaque poussée réussie, toutes les pierres de la file et le Guerrier se déplacent
de 1, 2 puis 3 pixels. Une pierre qui entre dans l’eau devient un support au troisième
instant. Les couleurs restent constantes, sans clignotement ni aperçu de destination.
Les tests vérifient les positions exactes dans les quatre directions, les files,
les immersions, les objets fixes et l’égalité avec l’image finale de l’observation.
