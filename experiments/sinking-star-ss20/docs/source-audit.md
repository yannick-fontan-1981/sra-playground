# SS20 — sources et adaptations

Les deux index demandés orientent la sélection des problèmes :

- [Nord — The Hearty Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/north/)
- [Crossovers — zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/)

Les guides français ont été relus pendant la conception de SS20. Leurs numéros d’énigmes servent de références. Les huit cartes sont des compositions SS20 : une adaptation reprend une contrainte de résolution identifiable, avec les règles du trio Marchand / Voleur / Barde. Elle ne prétend pas reproduire une grille ou la solution officielle du jeu source.

## Références par salle

| SS20 | Source exacte | Principe adapté | Transformation propre à SS20 |
| --- | --- | --- | --- |
| N1 · L’atelier des marées | [Heroes 3, 12–14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) ; [Hauling, 5 et 14](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | Chant, rencontre préparée, départ imposé et relève des poids. | Trois cours et trente enseignements publics ; traction simple, presse latérale et travail d’un appui. |
| N2 · Le chargement à rebours | [Hauling, 5, 7 et 17](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) ; Heroes 3, 14 | Changer de côté, transporter une charge par un détour et maintenir l’accès pendant les arrivées. | Deux caisses prennent des fonctions successives ; Marchand et Voleur font entrer le Barde sans chant. |
| N3 · Le poids qui reste | [Mirrors, 20](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | Un poids devient stable pendant qu’une autre commande continue d’alterner. | Une presse installe un écran plus proche ; trois caisses finies remplacent la création de ressources. |
| N4 · Les quais en décalage | Mirrors, 22–23 | Transport décalé par deux miroirs et préparation des départs suivants. | L’escale masque un bras pour respecter l’atomicité ; la livraison retire le départ et ouvre l’arrivée. |
| N5 · Le pas qui manque | Mirrors, 24–25 | Les contraintes de diagonale limitent les rencontres obtenues par reflets seuls. | Un pas sélectif modifie la géométrie ; la rencontre libère un couloir de manutention. |
| N6 · Les pierres voyageuses | [Water, 27](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) ; référence complémentaire Water, 32 | Recaler un support par les butées et maintenir les conditions d’un passage. | Un seul appui dessert plusieurs traversées ; aucun empilement ni déplacement de deux cases. |
| N7 · La relève du passeur | Water, 28–29 ; [Light, 2](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | Départ imposé du Barde, réserve extraite par traction et maintien d’un accès depuis un autre côté. | Une caisse relève le Voleur ; une presse interdit la sortie prématurée de son poste. |
| N8 · Le chantier à démonter | Mirrors, 4 et 6 ; Light, 39 | Départ sans traction indésirable, préparation des dépôts et démontage différé. | La caisse d’un chantier est récupérée pour un pont ; trois caisses deviennent deux appuis et un poids sec. |

Les crédits affichés en jeu et les champs `source` / `adaptation` des fichiers `reference/levelN-design.json` accompagnent chaque carte. Les sources complémentaires donnent un principe limité ; elles ne revendiquent pas une reproduction des autres mécanismes de ces énigmes.

## Écarts qui comptent pour jouer

**Poussée et traction.** Le Marchand SS20 pousse une seule pièce et le Voleur en tire une seule. Les salles n’introduisent pas la poussée en file du Guerrier ni l’échange du Magicien. La presse, en revanche, peut pousser une file à sa fermeture : c’est son mécanisme visible propre.

**Chant.** SS20 utilise un carré de 5 × 5, diagonales et cloisons comprises, calculé avant le pas. Cette règle diffère du chant en ligne décrit par plusieurs guides. Un transport imposé du Barde ne chante pas ; les ancrages d’appuis suivent le contrat SS20.

**Miroirs.** Les sources décrivent parfois duplication et fusion. SS20 conserve des reflets atomiques sans copie d’acteur. La salle des quais ajoute donc une escale qui masque physiquement le premier bras du montage. Le verrou du niveau 3 utilise trois caisses finies et une presse au lieu de créer une nouvelle ressource.

**Eau.** Les empilements et mouvements de deux cases de Water 30–34 ne sont pas importés. Water 32 reste une référence complémentaire à la préparation d’un passage ; le support mobile du niveau 6 suit les règles unitaires de la série SS. Les plateformes SS20 ne détruisent pas un appui permanent en se réactivant.

**Monstres et lumière.** Les monstres SS20 n’ont aucune poursuite autonome. Leurs transports sont des conséquences visibles d’un geste. Les dragons, le feu, les pouvoirs de faisceaux, les transformations du Druide et la protection du Clerc ne sont pas repris. Light 39 inspire l’ordre du démontage, sans importer ses faisceaux destructeurs ni ses cristaux empilés.

## Diversité et limites des constats

Les sources ont été comparées aux motifs employés dans SS14–SS19. SS20 alterne un grand détour terrestre, une mémoire optique, une navette de quai, une correction de diagonale, un appui réutilisé, une relève et un chantier démontable. Le tutoriel rassemble les mécanismes, mais les salles suivantes n’exigent pas toutes l’eau, les monstres ou les miroirs.

La comparaison automatique des terrains, documentée dans le [rapport de conception](../validation/design-report.json), ne relève aucune copie exacte parmi les huit cartes ni avec les 48 terrains SS14–SS19 après recadrage et symétries. Elle ne mesure pas à elle seule l’originalité ou la difficulté. Les témoins démontrent la résolubilité ; les branches ciblées vérifient leurs conséquences ; une recherche interrompue ne devient jamais une preuve d’impossibilité.
