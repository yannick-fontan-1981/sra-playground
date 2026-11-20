# SS10 — Validation de la version 0.3.0

## Résultats de la livraison

- Compilation TypeScript stricte et **87 tests du moteur réussis**.
- Huit parcours gagnants : **503 actions**, dont **44 sélections**, et **1 463 images**.
- Aucun refus et aucun décès dans ces huit parcours ; poussée et traction sont utilisées dans chaque salle.
- Tutoriel : **12 découvertes sur 12**, acquises sur son parcours de 57 actions.
- Exécution du HTML compilé avec Happy DOM : chaque image RGBA et chaque durée d’animation comparées au moteur de référence.
- Clic, Tab, 1/2, boutons de rôle, flèches, Espace/X, Annuler, Recommencer, retour au tutoriel et navigation entre les salles vérifiés.
- Interruptions d’animations, victoire finale, annulation de victoire et défaite atteignable en 24 actions vérifiées.
- Aucun appel réseau et aucune erreur JavaScript dans le contrôle d’interface.

Les rapports `validation/levels-report.json`, `validation/ui-dom-report.json` et `validation/tests-summary.json` donnent l’empreinte du HTML et les résultats de cette version.

## Réagencement final des niveaux 6 et 8

Le niveau 6 reprend l’ancien niveau 8, **Le dernier changement de sens**, avec sa carte et son parcours de **93 actions**. Son miroir donne accès à la plateforme finale ; l’ancienne porte redondante reste retirée.

Le niveau 8, **Les cinq points d’appui**, est une chicane originale avec cinq caisses mobiles et cinq coupures d’eau. Les deux héros commencent avant les coupures et les deux destinations sont après la dernière. Le témoin de **90 actions** crée exactement cinq appuis permanents à l’aide de **15 poussées et cinq tractions**.

Le validateur retire chaque appui à tour de rôle. Il autorise la marche sur les quatre autres et ignore les occupants. Les deux destinations sont inaccessibles depuis les deux départs dans chacun des cinq essais. La carte comporte uniquement des passages à pied et les cinq appuis à construire.

## Corrections visuelles conservées

- Reflet impossible : les pixels noirs du socle du miroir (5) clignotent en rouge (8), tandis que la diagonale reste blanche (0). Le cas `LLUULCDX` du niveau 5 (`C` = Tab, `X` = Espace) identifie les deux miroirs responsables sans consommer de tour ni ajouter d’entrée Annuler.
- Niveau 7 : l’accent du circuit `presse` est blanc (0). Son bouton est rose à centre blanc et sa porte-presse rose avec marques blanches. Le parcours de 69 actions reste gagnant ; la comparaison des rendus avant/après ce changement était limitée aux deux cellules concernées.

## Nécessité et historique des cartes

La carte du niveau 5 est inchangée depuis la revue exhaustive : impossibilité sans poussée (2 108 états), sans traction (7 202), sans reflet (32 580), sans premier miroir (7 652), sans second miroir (2 248), ou sans jamais ouvrir la porte (33 600).

Les autres recherches conservées concernent notamment la traction du tutoriel, la traction du niveau 2, la poussée du niveau 3, les deux pouvoirs et le reflet du niveau 4. Une recherche arrivée à sa limite ne prouve pas l’impossibilité.

Les résultats de recherche de l’ancien niveau 6 sont archivés dans `reference/archive/ss10-v1-levels5-8-review.json`. Le constructeur de la finale et son témoin se trouvent dans `reference/author/build-level8.mjs` et `reference/level8-design.json`. La preuve topologique concerne l’obligation de construire les cinq passages.

Les témoins ne prouvent ni optimalité ni unicité. L’élimination des monstres du niveau 4 fonctionne dans le témoin, mais son caractère obligatoire n’est pas affirmé.

## Raccordement au Playground

`tests/custom4-native.test.ts` compare le moteur, l’adaptateur et le dispatcher sur les huit témoins. Le contrôle Chromium depuis la racine utilise `scripts/verify-ss10-browser.mjs`, avec un aperçu Vite sur le port 4174. Il vérifie les commandes Guerrier/Voleur, les douze découvertes, le clignotement des deux miroirs, les interruptions, les cinq appuis finaux, les vignettes et les liens de la galerie.
