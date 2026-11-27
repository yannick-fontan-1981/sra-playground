# Qualification prospective du consommateur f296ac1c

**18 succès sur les 18 départs de la réserve préenregistrée.** Les 12 fiches sont des instances inédites des deux familles de développement. Le consommateur a admis chaque départ et le jeu a exécuté chaque commande proposée.

| Famille | Fiches | Départs admis | Commandes proposées / exécutées / refusées | Lectures demandées / valeurs nouvelles rendues | Lectures suivies d’une commande | Succès |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cadran | 8 | 12 / 12 | 44 / 44 / 0 | 8 / 8 | 8 | 12 / 12 |
| Ressource partagée | 4 | 6 / 6 | 24 / 24 / 0 | 4 / 4 | 4 | 6 / 6 |
| Total | 12 | 18 / 18 | 68 / 68 / 0 | 12 / 12 | 12 | 18 / 18 |

Les six paires ambiguës ont commencé avec des entrées identiques. Dans chacune, les deux processus ont proposé les mêmes actions et reçu les mêmes retours jusqu’à la lecture discriminante. Les valeurs alors rendues étaient différentes et les commandes immédiatement suivantes aussi. Les deux branches ont abouti. Le reçu compte zéro incompatibilité, abandon, défaite terminale ou arrêt technique.

Le gel opérateur `514cf4a83d168d1c5eb3131af00f3b1b1022b315` a lancé un processus Node `v24.22.3` neuf à chaque départ. Le point d’entrée `experiments/sic-agenda-offres/public-v1/solveur.mjs` et ses cinq dépendances proviennent directement du commit consommateur `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. L’opérateur a vérifié l’engagement avant la génération, puis transmis seulement la fiche publique et les retours successifs. Les traces détaillées et les données de sélection restent chez l’opérateur. Empreinte SHA-256 du reçu détaillé : `35bb56b1ffe532b151b561c518fc7d73c44e32d4a4af26b591d73b1bb96e9e67`.

La qualification porte sur ces nouvelles instances du cadran et de la ressource partagée. Le premier essai au format Markdown, avec le gel `475044aa`, conserve son bilan historique. [Dialogue public](../DIALOGUE.md) · [Exemples de développement](../examples/)
