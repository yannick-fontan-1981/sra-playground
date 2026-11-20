# Résultats du candidat motivé par une frontière spatiale

Le candidat `411e364072db978da897df0375d48b4bfcaecc48` et le témoin `7f2cb3eb29a4bd7640c3c38b71107af86b521ad5` ont été figés sur GitHub avant les parties Custom 4 de cette série. Les deux exports vérifiés contiennent respectivement 2 436 et 2 401 fichiers. Les quatre niveaux ont été rejoués indépendamment depuis leur observation initiale.

## SS01 L2

Le candidat a désigné trois régions encore inexplorées et lancé 16 plans pour y accéder. Six plans partaient d'une limite déjà éprouvée. Il a tenté huit fois de déplacer une pièce. Aucun de ces huit essais n'a obtenu le placement annoncé. La mesure indépendante du trajet confirme zéro franchissement et le moteur accorde zéro victoire aux deux agents.

| Niveau Custom 4 | Commandes témoin | Commandes candidat | Plans spatiaux candidat | Placements vérifiés / essais | Franchissements géométriques témoin / candidat | Victoires témoin / candidat |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SS01 L2 | 654 | 592 | 16 | 0 / 8 | 0 / 0 | 0 / 0 |
| SS06 L2 | 566 | 532 | 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| SS07 L2 | 5 | 5 | 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| SS08 L2 | 715 | 898 | 241 | 0 / 50 | 130 / 0 | 0 / 0 |

Le plafond annoncé était de 1 200 commandes, avec le même budget de temps actif du moteur pour les deux agents. Le temps actif a arrêté les deux bras sur SS01, SS06 et SS08. Sur SS07 les deux parties se terminent par une défaite officielle au cinquième geste. À budget de commandes commun, les nombres d'images distinctes du témoin et du candidat sont respectivement 145 et 95 sur SS01, 39 et 67 sur SS06, 5 et 5 sur SS07, 280 et 29 sur SS08. Le décompte géométrique rétrospectif peut compter des allers-retours. Une entrée dans une cible prospectivement annoncée a un critère distinct.

## Jeux sources

| Parties autonomes | Témoin | v17 | v18 |
| --- | ---: | ---: | ---: |
| 100 jeux au niveau initial | 65 | 55 | 52 |
| 18 entrées supérieures des sept jeux | 7 | 8 | 6 |

Sur les 100, 96 des 122 plans spatiaux s'appuient sur un bord déjà éprouvé. SIC exécute 19 placements vérifiés sur 49 essais. Il entre trois fois dans une région qu'il avait désignée et jamais visitée, une fois sur chacun de PORT, DC22 et AR25. Dans les trois cas, un déplacement supplémentaire réussit à l'intérieur de la région. Omettre la préparation empêche ces entrées, mais change aussi le point de départ du voyageur au moment de la dernière commande. Aucune de ces trois entrées n'établit à elle seule que déplacer un mécanisme était nécessaire à position du voyageur égale. Le moteur accorde une victoire pendant un plan sur CN04.

Par rapport à la v17, la v18 gagne SNAR L1 et perd PORT, AR25, CLRS et ESCT L1. Sur les niveaux supérieurs, elle vérifie trois placements sur 19 essais, avec zéro entrée dans une région annoncée. Elle perd GIGO L2 et POLA L3. Les six victoires sont GARE L2, GRAV L2–L3, POLA L2 et GIGO L3–L4. Les 18 entrées dépendent des préfixes de niveau disponibles pour GRAV, GARE, POLA, CWSE, CATR, GIGO et MOTO.

La motivation spatiale déclenche bien des expériences sur SS01. Leur nombre ne prédit pas l'efficacité des commandes choisies, comme le montre aussi SS08. Cette série n'établit aucune victoire par transfert sur Custom 4. SS01 avait été évalué dans des séries antérieures. SS09 L2 reste réservé. TypeScript passe et 163 tests sur 164 passent. L'échec du test de recharge du cycle orienté préexistait.

Les empreintes des exports, les résultats individuels, les exemples d'entrée et les arrêts de chaque bras figurent dans [le relevé vérifié](sic-territorial-access-results.json). Les critères et la sélection avant évaluation figurent dans [le protocole](sic-territorial-access-protocol.md).

