# SS10 — Validation de la version 0.2.0

## Résultats de la livraison

- Compilation TypeScript stricte et **87 tests du moteur réussis**.
- Huit parcours gagnants : **627 actions**, dont **58 sélections**, et **1 807 images**.
- Aucun refus et aucun décès dans ces huit parcours ; poussée et traction sont utilisées dans chaque salle.
- Tutoriel : **12 découvertes sur 12**, acquises sur son parcours de 57 actions.
- Exécution du HTML compilé avec Happy DOM : chaque image RGBA et chaque durée d’animation comparées au moteur de référence.
- Clic, Tab, 1/2, boutons de rôle, flèches, Espace/X, Annuler, Recommencer, retour au tutoriel et navigation entre les salles vérifiés.
- Interruptions d’animations, victoire finale, annulation de victoire et défaite atteignable en 24 actions vérifiées.
- Aucun appel réseau et aucune erreur JavaScript dans le contrôle d’interface.

Empreinte du HTML vérifié : `cfad02b0336ebe019eae60dcb8668a237c16dcc5a73bc9dc7e60679bfaaef845`.

Rapports de cette version : `validation/levels-report.json`, `validation/ui-dom-report.json` et `validation/tests-summary.json`.

## Réagencement final des niveaux 6 et 8

Le niveau 6 reprend l’ancien niveau 8, **Le dernier changement de sens**, avec sa carte et son parcours de **93 actions**. Son miroir donne accès à la plateforme finale ; l’ancienne porte redondante reste retirée.

Le niveau 8, **Les cinq points d’appui**, reprend la grille de Heroes and Water, énigme 3. Le terrain et les placements des cinq caisses, des deux héros et des deux destinations ont été comparés cellule par cellule au relevé `reference/heroes-and-water-03-grid.json`. Le cadrage comprend une couronne d’eau autour de la grille utile. Les cinq caisses commencent mobiles ; aucun appui n’est déjà créé.

Le parcours de **214 actions** crée exactement les cinq appuis du relevé, avec **37 poussées, 26 tractions et un déplacement du partenaire**. Aucun refus, décès ou modification du terrain source n’est nécessaire. Les nombres d’actions sont des témoins de solvabilité, pas des records d’optimalité.

## Corrections visuelles conservées

- Reflet impossible : les pixels noirs du socle du miroir (5) clignotent en rouge (8), tandis que la diagonale reste blanche (0). Le cas `LLUULCDX` du niveau 5 (`C` = Tab, `X` = Espace) identifie les deux miroirs responsables sans consommer de tour ni ajouter d’entrée Annuler.
- Niveau 7 : l’accent du circuit `presse` est blanc (0). Son bouton est rose à centre blanc et sa porte-presse rose avec marques blanches. Le parcours de 69 actions reste gagnant ; la comparaison des rendus avant/après ce changement était limitée aux deux cellules concernées.

## Nécessité et historique des cartes

La carte du niveau 5 est inchangée depuis la revue exhaustive : impossibilité sans poussée (2 108 états), sans traction (7 202), sans reflet (32 580), sans premier miroir (7 652), sans second miroir (2 248), ou sans jamais ouvrir la porte (33 600).

Les autres recherches conservées concernent notamment la traction du tutoriel, la traction du niveau 2, la poussée du niveau 3, les deux pouvoirs et le reflet du niveau 4. Une recherche arrivée à sa limite ne prouve pas l’impossibilité.

Les résultats de recherche de l’ancien niveau 6 sont archivés dans `reference/archive/ss10-v1-levels5-8-review.json` : ils ne sont pas attribués à la nouvelle carte. La revue courante des niveaux 6 à 8 précise les témoins et empreintes des cartes actuelles. Aucune nouvelle preuve exhaustive de nécessité n’est revendiquée pour le nouveau niveau 8.

Les témoins ne prouvent ni optimalité ni unicité. L’élimination des monstres du niveau 4 fonctionne dans le témoin, mais son caractère obligatoire n’est pas affirmé.

## Limite du contrôle visuel

L’essai de Chromium conservé dans `validation/browser-report.json` échoue au lancement : l’environnement refuse une opération de socket (EPERM) avant tout chargement de page. Aucun test visuel de navigateur natif ou de mise en page mobile n’est revendiqué. Les nouvelles grilles 6 et 8 ont été examinées à partir des pixels du moteur ; cela ne remplace pas une vérification CSS dans un navigateur.

Le script `scripts/verify-browser.mjs` est fourni pour exécuter le contrôle dans un environnement où Chromium peut démarrer.
