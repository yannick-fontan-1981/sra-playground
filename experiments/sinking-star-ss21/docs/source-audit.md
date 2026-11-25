# SS21 — Audit des sources et des adaptations

## Périmètre

Les index demandés sont [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Les articles ci-dessous ont été relus pour vérifier les numéros utilisés dans [`src/level-info.ts`](../src/level-info.ts), puis comparés aux huit fichiers [`reference/levelN-design.json`](../reference/).

Ces articles sont des guides de parties du jeu d’origine. Ils établissent les motifs cités ; ils ne constituent pas la spécification du moteur SS21. Les cartes, les objectifs à quatre personnages, les circuits et les parcours SS21 sont des créations du laboratoire. Aucun plan de cases de la source n’est présenté comme reproduit à l’identique.

## Références vérifiées

| Source | Énigmes citées | Principe relevé dans le guide | Salles SS21 |
| --- | --- | --- | --- |
| [Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | [3](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-3), [4](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-4), [13](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13) | Une ou plusieurs commandes restent occupées ; un échange entre partenaires redistribue les postes. | 1 |
| [Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | [19](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19), [20](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-20) | Des caisses prennent la place de héros isolés ; les charges et les commandes permettent de les libérer. | 2 |
| [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | [31](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31), [32](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-32) | La position du miroir dépend du départ final et de l’accès nécessaire à sa manutention. | 3 |
| [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | [34](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-34), [30](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30) | Un circuit de miroirs ramène la visée au Magicien ; les faces réfléchissantes permettent aussi un échange autour d’un angle. | 4 ; introduction optique de 1 |
| [Heroes and Light](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | [8](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-8), [2](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2) | Conserver un élément proche évite un échange indésirable ; une rangée de charges transmet l’occupation d’une commande à distance. | 5 |
| [Heroes and Water](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | [7](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-7), [11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11) | Un échange seul conserve la population des régions séparées ; un franchissement physique permet de modifier cette répartition. | 6 |
| [Heroes and Water](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | [6](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-6), [12](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-12) | Déposer une charge sur un soutien escamotable avant son retrait ; placer un monstre sur ce soutien pour le faire tomber. | 7 |
| [Heroes and Light](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | [4](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-4), [45](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-45) | Un monstre complète deux poids et avance par presses successives ; une ressource contre une paroi exige un transport indirect. | 8 |

Les numéros **2, 4, 8 et 45 de Heroes and Light** correspondent bien aux idées annoncées. SS21 n’importe pas leurs faisceaux colorés : les caisses, le Magicien, les miroirs et les circuits locaux réalisent les fonctions retenues. La référence 45 porte sur l’extraction indirecte, pas sur la reproduction de sa téléportation violette ni de sa butée.

## Ce que chaque adaptation change

| SS21 | Construction propre au laboratoire |
| --- | --- |
| 1 | Atelier à quatre rôles, file mixte, séparation par traction, arrivée optique, appui fixe, presse de rencontre et trois poids ouvrant quatre sorties. Les démonstrations enrichissent le tutoriel sans conditionner artificiellement la victoire. |
| 2 | Deux chambres dans des coins opposés, six cases d’eau réparties en deux coupures, trois caisses au total et une cour finale commune. Les deux dernières caisses commencent en file et exigent une reprise depuis des côtés différents. |
| 3 | Un miroir ordinaire dessert quatre balcons initialement vides. Il se déplace sur un rail et garde sa face ; aucun miroir spécial, aucune casse, aucune caisse et aucune commande. |
| 4 | Les quatre miroirs restent en place. Une presse injecte l’unique caisse dans le circuit optique ; cette caisse est ensuite extraite par une trappe et réemployée sur la commande de la cour. |
| 5 | Une double serrure exige deux postes simultanés. Trois caisses, des relèves instantanées et un partenaire interposé dans la dernière visée remplacent les systèmes de lumière de la référence. |
| 6 | Quatre rôles, quatre îlots décalés, trois détroits et quatre caisses. Trois charges deviennent des appuis ; la dernière reste sèche pour l’accès aux destinations. |
| 7 | Une plateforme et le sas voisin répondent en sens opposés au même circuit. Le gardien est ordinaire, sans feu ; une caisse stabilise ensuite le passage et les deux autres commandent le fronton. |
| 8 | Le gardien reste vivant sur son bouton. Une archive séparée, un miroir fixe, la traction et les échanges permettent de récupérer la troisième caisse ; les trois caisses financent un appui et deux poids secs. |

## Contrat SS21 à conserver

Ces règles sont vérifiables dans [`src/core.ts`](../src/core.ts) et sont détaillées dans [la spécification](specification.md).

- **Appuis fixes.** Une caisse immergée devient un appui permanent, qui ne se pousse, ne se tire et ne s’échange plus. Il subsiste lors de la réactivation d’une plateforme. Le guide Water décrit une destruction à la remontée : cette règle n’est pas reprise.
- **Quatre rôles, sans Barde.** Les solutions ne peuvent pas utiliser le chant, un appui mobile, le Clerc, le Druide ou les aptitudes du Marin.
- **Monstres immobiles.** Les monstres ne poursuivent pas les héros. Seuls les déplacements commandés ou forcés les transportent ; les contacts sont orthogonaux et simultanés. Il n’y a ni dragon, ni feu, ni porte liée au nombre de monstres.
- **Deux opérations optiques distinctes.** Une direction du Magicien suit la première cible échangeable, avec plusieurs déviations possibles. L’action globale des miroirs projette à distance égale entre deux bras et n’enchaîne pas un trajet à travers un autre miroir.
- **Pas de duplication.** Les reflets concurrents incompatibles sont refusés. Les dédoublements, les fusions et les miroirs magiques de certains passages du guide Mirrors ne font pas partie de SS21.
- **Presses explicites.** Une fermeture agit sur l’occupant de sa propre case et suit la direction dessinée ; elle ne donne pas un coup périodique à chaque pas du joueur.

## Portée de cet audit

Les rapprochements portent sur des idées de résolution et sur leurs transformations visibles dans les cartes SS21. Ils ne certifient pas une fidélité complète au jeu commercial. Les parcours fournis établissent les séquences à contrôler ; les résultats d’exécution et les limites des contre-branches sont rapportés séparément dans [la validation](validation.md). Une branche locale ou un témoin gagnant ne prouve pas l’unicité de la solution.
