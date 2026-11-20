# SS10 — Validation de la version HTML v1

## Résultats

- Compilation TypeScript stricte et **87 tests du moteur réussis**.
- Huit témoins gagnants : **475 actions**, dont **44 sélections**, et **1 392 images**.
- Aucun refus et aucun décès dans ces huit parcours ; les deux capacités sont utilisées dans chaque salle.
- Tutoriel : **12 découvertes sur 12**, acquises sur son parcours de 57 actions.
- Exécution du HTML compilé avec Happy DOM : chaque image RGBA et chaque durée d’animation comparées au moteur de référence.
- Clic, Tab, 1/2, boutons de rôle, flèches, Espace/X, Annuler, Recommencer, retour au tutoriel et navigation entre les salles vérifiés.
- Interruptions d’animations, victoire finale, annulation de victoire et défaite atteignable en 24 actions vérifiées.
- Aucun appel réseau et aucune erreur JavaScript dans ce contrôle d’interface.

Empreinte du HTML vérifié : `04ef7943e45206aa7d7cccfb2b7ff125941df1b14a8bb54b7decab4ac2efd3b0`.

Les rapports reproductibles sont `validation/levels-report.json`, `validation/ui-dom-report.json` et `validation/tests-summary.json`.

## Nécessité et revue des cartes

Le niveau 5 a fait l’objet d’une correction après deux raccourcis trouvés par une revue indépendante. Sur sa carte finale, la recherche exhaustive établit l’impossibilité sans poussée (2 108 états), sans traction (7 202), sans reflet (32 580), sans premier miroir (7 652), sans second miroir (2 248), ou sans jamais ouvrir la porte (33 600).

D’autres recherches exhaustives confirment notamment la traction du tutoriel (35 140 états), la traction du niveau 2 (7 080), la poussée du niveau 3 (13 248), les deux pouvoirs et le reflet du niveau 4, et les plateformes hydrauliques du niveau 6 (17 776). Les rapports de nécessité précisent les recherches qui atteignent leur limite. Une limite ne prouve pas l’impossibilité.

Au niveau 8, le passage à pied a été coupé pour que la réflexion donne accès à la plateforme finale ; la porte redondante a été retirée.

Au niveau 7, une quatrième caisse a été supprimée : les trois charges servent au convoyeur puis une charge doit être récupérée et réutilisée pour la sortie. Le parcours final de cette révision compte 69 actions.

Les témoins prouvent la solvabilité ; ils ne prouvent ni optimalité ni unicité. L’élimination des monstres du niveau 4 fonctionne dans le témoin, mais son caractère obligatoire n’est pas affirmé.

## Limite du contrôle visuel

Chromium installé ne démarre pas : l’environnement refuse une opération de socket (EPERM) avant tout chargement de page. Le rapport `validation/browser-report.json` conserve cette tentative sur la construction précédente. Aucun test visuel de navigateur natif ou de mise en page mobile n’est revendiqué. La planche des huit grilles a été examinée à partir des pixels du moteur ; elle ne remplace pas une vérification CSS dans un navigateur.

Le script `scripts/verify-browser.mjs` est fourni pour exécuter le même contrôle dans un environnement où Chromium peut démarrer.
