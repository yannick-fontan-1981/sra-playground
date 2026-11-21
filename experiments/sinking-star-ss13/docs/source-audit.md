# SS13 — sources et choix d’adaptation

## Périmètre

SS13, **L’Ancre Verte**, associe le Voleur et le Magicien. Les références demandées sont les index [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/). Ces index conduisent aux guides numérotés ci-dessous, consultés le 21 novembre 2026.

Une adaptation conserve une contrainte intéressante et la rend jouable dans le contrat de la série SS. Elle ne prétend reproduire exactement ni les cartes, ni l’ensemble des pouvoirs d’Order of the Sinking Star. Les géométries et parcours de SS13 sont des créations propres au laboratoire. Les numéros cités sont ceux des pages de solutions françaises ; les vidéos associées emploient parfois une autre numérotation.

## Références retenues pour la conception

Cette table identifie les principes effectivement décrits par les guides. L’affectation finale des références aux huit salles et les choix précis de chaque adaptation sont consignés dans les fichiers `reference/levelN-design.json` et dans `docs/level-design.md`.

| Guide et énigme | Principe décrit dans la source | Application possible au duo SS13 |
| --- | --- | --- |
| [Heroes of Hauling, 13](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | Le Magicien échange avec le partenaire qui tient une plaque ; la plaque reste occupée pendant le transfert. | Enseigner la relève d’un bouton par échange entre héros et l’ouverture d’une route pour le Voleur. |
| [Heroes of Hauling, 19](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | Les échanges sortent les héros des cages ; des cristaux prennent leur place. | Le Voleur prépare une cible de retour, puis le Magicien libère son partenaire sans emprisonner définitivement l’un des deux. |
| [Heroes and Water, 7](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | Un échange conserve le nombre d’occupants de chaque moitié isolée. Une traversée par le passage commandé change ce nombre. | Faire distinguer permutation et transfert : le Voleur doit réellement traverser avant que les dernières transpositions deviennent utiles. |
| [Heroes and Water, 10](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | Réorganiser les cristaux tout en gardant libre l’alignement nécessaire pour sortir. | Le Voleur retire une cible intermédiaire ; le Magicien utilise ensuite l’ancre lointaine et préserve son trajet de retour. |
| [Heroes and Mirrors, 5](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | Le Voleur tirerait hors du bouton le miroir qu’il vient d’y poser. Il s’éloigne donc par reflet. | Conserver un poids sur sa commande en quittant la zone par reflet ou transposition, sans pas de traction. |
| [Heroes and Mirrors, 6](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | L’emplacement du miroir fixe la diagonale d’arrivée d’un cristal. Déplacer le miroir permet de combler les bonnes cases d’eau ; un autre trou se franchit par reflet. | Combiner traction du miroir, transposition d’une caisse et reflet pour fabriquer un appui indispensable, tout en conservant une ancre de retour. |
| [Heroes 2: Monsters, 15](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) | Le Magicien envoie un monstre sur une plaque, puis un cristal sur une autre. | Garder un monstre vivant comme poids de commande, le déplacer par échange à distance et aménager une circulation sûre autour de lui. |
| [Heroes and Light, 1](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | Une presse dépose un cristal là où le Voleur ne peut pas tirer. Un déplacement forcé peut aussi rompre la traction ; d’autres presses rapprochent deux gobelins. | Employer une presse latérale pour atteindre une plaque inaccessible, puis exploiter une poussée forcée ou un combat simultané. |

## Références complémentaires examinées

- [Heroes of Hauling, 5 et 9](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) présentent séparément la traction et l’échange aligné. Ce sont des bases pédagogiques, pas des justifications suffisantes pour un niveau avancé.
- [Heroes and Mirrors, 4](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) fait alterner traction du miroir et reflet pour changer de côté. C’est une bonne transition avant une commande qu’il faut laisser occupée.
- [Heroes and Light, 2](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) utilise le piston pour maintenir à distance une commande inaccessible depuis l’intérieur.
- [Heroes and Water, 6](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) fait déposer des cristaux sur des plateformes activables puis les retire pour créer des appuis. La source détruit ces appuis lors d’une réactivation : cette dernière règle n’est pas celle héritée de SS11.

## Contrat de la série à distinguer des sources

Le laboratoire reprend les règles établies pour la série SS et les spécifie dans `docs/specification.md`.

- La sélection d’un héros ne déclenche ni mouvement du monde ni combat.
- Le Magicien cible la première entité atteinte par son rayon. Les faces blanches des miroirs peuvent dévier ce rayon ; leurs dos noirs le bloquent. Une transposition n’est pas une marche du Voleur et ne déclenche donc pas de traction.
- Les reflets de SS appliquent la priorité au candidat le plus proche et l’échange à distance égale. Les conflits réels sont refusés. La règle générale des guides selon laquelle tout miroir bloqué interdit tous les reflets ne doit pas être importée implicitement.
- Les sources présentent aussi des dédoublements, des fusions, des dragons, des Clercs, des Druides et des faisceaux conférant d’autres pouvoirs. Leur présence dans un guide ne signifie pas qu’ils existent dans SS13.
- Les appuis immergés hérités de SS11 sont fixes et restent présents lors de la réactivation d’une plateforme hydraulique. Une adaptation de Water 6 peut reprendre la chute créatrice d’appui, mais ne peut prétendre reprendre son piège d’écrasement des appuis.
- Les monstres SS frappent simultanément les voisins orthogonaux après une action effective. Leur présence sur une commande et leur destruction sont deux usages distincts : une salle de maintien doit protéger le poids vivant tant qu’il reste nécessaire.

## Vérifier qu’une reprise apporte réellement un problème

Les critères suivants guident la vérification des cartes créées ; ce sont des décisions de conception SS13, pas des affirmations sur les solutions originales.

1. **Relève de commande :** vérifier qu’un échange conserve l’occupation pendant que les héros changent de région.
2. **Ancre de retour :** vérifier que la cible utile reste atteignable après le premier passage et que son déplacement modifie réellement les possibilités du Magicien.
3. **Transfert entre îles :** distinguer le nombre d’entités échangées du nombre d’entités qui traversent physiquement une frontière.
4. **Poids conservé :** comparer localement le départ forcé ou téléporté du Voleur avec le pas volontaire qui retirerait le poids.
5. **Caisse immergée :** constater la création et l’utilisation d’un appui ; une caisse simplement voisine d’un bassin ne démontre pas cette mécanique.
6. **Presse latérale :** constater un déplacement utile vers une case inaccessible par traction seule.
7. **Monstre :** vérifier son rôle comme poids, cible ou adversaire et contrôler les distances dangereuses après toute la cascade.

Un parcours gagnant prouve la solvabilité de la carte testée. Un événement présent dans ce parcours ne prouve pas que toutes les solutions doivent employer ce mécanisme. Toute recherche bornée interrompue doit rester déclarée inconclusive. Les parcours d’auteur restent séparés de l’observation et de la décision de SRA.

## Contrôle des adaptations réalisées

### Niveau 2 — Une place de plus sur l’autre rive

L’adaptation conserve l’invariant de Water 7 : les transpositions seules n’augmentent pas le nombre d’occupants sur la rive d’arrivée. Le parcours d’auteur crée un appui par reflet, puis fait traverser le Voleur à pied. La présence des miroirs autorise toutefois d’autres transferts que la marche ; aucune nécessité universelle de marcher n’est affirmée. Le miroir tracté jusqu’à une commande est une extension propre à SS13.

### Niveau 3 — La cellule et les trois relèves

Le Voleur commence dans une cellule isolée qui maintient le passage nord. Le Magicien le relève par échange. Le Voleur prépare ensuite une caisse dans la ligne de retour : le Magicien sort en laissant la caisse sur la commande de la cellule. Dans la partie haute, le Magicien tient une porte pendant que le Voleur extrait une seconde caisse ; celle-ci libère définitivement la dernière porte. Le parcours validé comporte 87 entrées, douze tractions et deux échanges, dont un entre héros, sans refus ni mort.

### Niveau 4 — Le miroir reste à quai

Une caisse prend la place du Magicien sur la commande hydraulique qui permet au Voleur de changer de côté par reflet. Le Voleur tracte ensuite le miroir sur une commande ouvrant le passage du Magicien. Son dernier reflet laisse ce poids en place. Le parcours validé comporte 32 entrées, quatre tractions de miroir, trois échanges de caisses et deux reflets, sans refus ni mort.

Le script d’auteur contrôle deux suites locales : un pas volontaire vers l’est après la pose du miroir produit une traction et libère le bouton ; le départ par reflet déplace le héros seul et conserve ce bouton. Il s’agit d’une vérification causale locale, sans affirmation d’unicité de la solution.

### Révision 0.2.0 — finales 7 et 8

La révision conserve les guides et le moteur, mais reconstruit les deux dernières géométries. Le niveau 7 développe le réemploi d’un miroir de Mirrors 6 en une boucle de traversées avec récupération d’un poids. Water 7 et 10 servent de références complémentaires pour le transfert physique, les échanges réciproques et les ressources à préserver. La presse et les liaisons commandées opposées sont des ajouts de conception SS13.

Le niveau 8 conserve Water 10 et Mirrors 5, et cite désormais Light 1 pour son dépôt latéral par presse. Ses deux caisses changent de fonction : l’une devient un appui après transport ; l’autre sert d’ancre aller, d’ancre retour puis de poids hydraulique. Les deux miroirs servent au transport et aux commandes, avec récupération du miroir du pont. Les quatre circuits et les portes qui ferment quand le pont s’ouvre sont une recomposition originale.

`validation/hard-finals-report.json` compare les versions avec le commit de référence et documente les essais de raccourcis. Les mesures distinguent les déplacements des manipulations ; une route longue ne suffit pas à établir la difficulté. Les erreurs d’ordre sont vérifiées à des états précis, sans prétention d’exhaustivité ou d’optimalité.
