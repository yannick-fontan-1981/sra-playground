# SIC Fallback · Placer un mécanisme pour ouvrir une suite d’actions

Le témoin est le commit `7f2cb3eb29a4bd7640c3c38b71107af86b521ad5`, balisé `sic-projected-affordances-source100-control-v1`. Le candidat est le commit désigné par `sic-projected-affordances-source100-candidate-v1`. Le moteur est fixé à `f4d28aee9ebbb35533bb97a26968efd22887473d`. Les deux balises doivent exister sur le dépôt distant avant le premier essai de cette série sur Custom 4.

## Origine des hypothèses

Les huit journaux `source-final-0..7` couvrent les 100 jeux sources. Leur rejeu par `scripts/collect-spatial-source.mjs` vérifie les empreintes des observations et donne les poses publiques. `scripts/study-projected-affordances.py` trouve 129 combinaisons rôle, origine, commande et repère mobile à arrivées variables. Dans 54 cas répartis sur quatre jeux, un autre mouvement du rôle est observé depuis une telle arrivée. Ces associations peuvent aussi dépendre d’autres éléments de la scène. L’expérience antérieure sur les niveaux suivants des sept jeux sources a motivé le contrôle séparé de la continuation.

Chaque jeu dispose d’une voix dans `scripts/learn-projected-directions.py`. Le seul a priori numérique transféré est une orientation par commande, retenue au-delà de 75 % des voix avec au moins cinq jeux favorables. Deux autres commandes compatibles à une même échelle doivent avoir été observées sur le rôle courant avant de proposer une direction manquante. Les positions, couleurs, rôles et dispositions cibles sont acquis dans le niveau.

## Prédictions

Le modèle ajuste les mouvements dans le repère du mobile ou d’un autre mobile et peut les conditionner à des coordonnées absolues ou relatives. Il distingue les supports des deux pièces. Lorsqu’une partie d’un groupe rencontre une bordure, le moteur peut imaginer que l’autre continue. Il compare des suites de configurations simulées localement et enregistre la disposition de départ du déclenchement, l’arrivée et le résultat attendu de l’action suivante avant l’exécution. Il recherche les nouveaux contacts, les rapprochements de cibles encore inaccessibles et les contacts simultanés de deux rôles. Chaque action est vérifiée sur l’observation publique suivante. La première divergence clôt le plan.

`scripts/audit-projected-motion.mjs` mesure les prévisions sur les deux prochaines commandes des journaux sources. Le choix des rôles, du modèle et de l’arrivée précède la lecture des deux résultats. Les positions nouvelles pour la première commande, les deux mouvements prévus et les identités visibles définissent le périmètre. Le comparateur applique les deux translations modales. Cette épreuve mesure une prévision conditionnelle aux commandes enregistrées. La campagne SIC mesure ensuite la sélection autonome des commandes.

## Épreuve figée

Même moteur, agent neuf, entrée directe SS01 L2, même budget de 1 200 commandes pour chaque version. La victoire exige un franchissement officiel du niveau. Les commandes et les empreintes des images permettent un rejeu indépendant. Les prévisions de placement, d’arrivée et de continuation restent distinctes. Un témoin et un candidat ont le droit de terminer plus tôt sur une fin de partie ou faute de proposition. SS01 a été étudié avant cette série. SS09 L2 reste en réserve.

Le budget des 100 L1 pour la comparaison source est de 60 commandes par jeu. Le témoin source peut être repris d’une campagne archivée lorsque la version du solveur, le moteur, le budget et les entrées sont identiques. Toute nouvelle version issue d’un échec constitue une autre expérience. Les résultats de SS01 ne servent pas de traces de conception.
