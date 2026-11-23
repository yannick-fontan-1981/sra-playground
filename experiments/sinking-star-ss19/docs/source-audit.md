# SS19 — sources et adaptations

Les deux index demandés ont été consultés le 23 novembre 2026 :

- [Zones mixtes / Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/)
- [Monde Nord](https://sinkingstarwalkthrough.com/fr/north/)

Les huit plans sont des créations SS19. Une adaptation reprend une contrainte de résolution décrite par le guide ; elle ne prétend reproduire la grille, les personnages exacts ou la solution officielle. Les numéros ci-dessous suivent les pages françaises.

## Références retenues

| Guide | Énigmes | Principe retenu |
| --- | --- | --- |
| [Heroes 2: Monsters](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) | 1, 10, 14, 15, 22, 29 | Réaction des ennemis aux gestes ; attraction vers une position préparée ; monstres et objets utilisés comme poids. |
| [Heroes 3: Bard, Druid](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) | 13, 14, 18, 19 | Faire se rencontrer des monstres autour d’un obstacle ; conserver des gardiens sur leurs commandes ; guider depuis les angles. |
| [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | 1, 16, 18, 19, 30 | Départ sans capacité passive ; commande réversible à distance ; miroir devenu obstacle ; livraison retardée ; visée déviée. |
| [Heroes and Water](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | 11, 12, 27, 28 | Retrait du soutien d’un monstre ; recalage d’appuis par des butées ; arrivée imposée du Barde sans chant. |
| [Heroes and Light](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | 1 | Deux presses successives changent l’axe de livraison d’une charge. |

Les crédits affichés dans chaque salle et les rubriques `adaptation` des huit fichiers de conception précisent la part conservée et la géométrie nouvelle. Les liens ne sont pas nécessaires pour jouer hors ligne.

## Règles SS19 à distinguer des sources

Le guide Heroes 2 décrit des monstres qui bougent avec les héros, mais ne fixe pas un algorithme complet de poursuite. SS19 applique le contrat déterministe prévu pour « La Chasse Noire » : héros sélectionné comme cible, un pas par action effective, axe dominant, verticale prioritaire en cas d’égalité, blocage sans détour, propositions simultanées. Ce contrat est spécifié et testé dans le laboratoire ; il n’est pas présenté comme un relevé du code du jeu original.

Les cristaux offensifs, le feu, le Clerc, le Druide, les transformations et l’empilement de certaines sources ne sont pas importés. Le combat orthogonal simultané, le chant dans un carré de 5 × 5, les appuis qui glissent uniquement d’eau en eau et les presses suivent le contrat de la série SS. Dans l’adaptation de Mirrors 19, un appui permanent remplace l’empilement ; la première cible disparaît du plan des reflets, ce qui permet de différer la livraison suivante.

Le départ imposé du Barde est réalisé par poussée, échange, reflet ou presse selon la carte. Un texte de guide qui décrit une traction n’accorde pas ce pouvoir au Guerrier SS19. La réactivation d’une plateforme ne détruit pas nos appuis permanents.

## Variété et portée de la vérification

La comparaison automatique normalise le terrain, retire la bordure vide et considère les huit rotations/réflexions. Elle compare les huit cartes à celles de SS14, SS15, SS16, SS17 et SS18. Elle détecte les reprises exactes de terrain, y compris tournées ou déplacées ; elle ne mesure pas à elle seule la variété des raisonnements.

La revue de conception examine aussi les verrous visibles, les ressources disponibles, les départs sans chant, la cible des chasseurs et les raccourcis proposés par un second auteur. Les témoins prouvent que les cartes sont résolubles ; leur longueur ne constitue pas une mesure de difficulté et leur usage d’un pouvoir ne prouve pas que toute solution l’utilise.
