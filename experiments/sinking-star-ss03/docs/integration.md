# Raccordement de SS03 dans Custom 4

SS03 — La ruse verte est le troisième jeu de Custom 4, après SS01 et SS02. L’adaptateur de production importe directement `PullPuzzleSession` et les huit cartes v0.4.0 du laboratoire. L’interface manuelle partage le suivi du tutoriel avec le laboratoire et utilise les métadonnées humaines des salles. La galerie génère ses huit aperçus depuis les observations initiales. Le crédit Sinking Star et les liens de référence sont conservés.

Points de parité à préserver :

1. `PullPuzzleSession` : `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel`.
2. Quatre actions directionnelles uniquement ; ne pas afficher une action Espace ou un bouton de changement de Marchand.
3. Charger le premier niveau et ouvrir le tutoriel humain à l’entrée du jeu, pas seulement charger la grille sans explications.
4. Transporter toutes les images et leurs durées ; toujours afficher `frame` comme image finale. Une action avec traction puis piston comporte six images ; une cascade peut en produire davantage. Ne jamais tronquer à trois images.
5. Autoriser Undo/Reset/sélection pendant l’animation avec annulation des rappels en attente.
6. Rejouer les huit témoins via le backend réellement intégré et vérifier la parité des images, de la progression et des annulations.
7. Générer la ligne de galerie à partir des huit véritables images initiales. Conserver les jeux déjà présents dans Custom 4.
8. Garder les témoins, le solveur, les phases internes et les fichiers de recherche hors des observations et des entrées de l’agent.
9. Transporter les métadonnées `circuits` et `gates` des niveaux 2, 7 et 8, et l’état `GAME_OVER`. Préserver Undo/Reset après une mort.
10. Charger l’aide humaine aux pistons aux niveaux 2, 7 et 8, avec le lien de référence vers Heroes and Light pour le niveau 8.

## Vérifications du raccordement

- `npm test` dans le laboratoire passe ses 47 tests. `npm run validate` termine les huit parcours en 484 directions, 154 tractions et 10 phases de piston. Le témoin du niveau 7 compte 54 directions et valide l’activation simultanée des deux plaques de la presse nord.
- Les 14 tests de `tests/custom4-native.test.ts` passent. Le dispatcher compare tous les retours SS03 au moteur de référence, dont les images, les durées, l’annulation et la victoire lorsque le niveau 1 est résolu en dernier. Un plateau synthétique exerce `GAME_OVER`, Undo et Reset.
- Le laboratoire passe 16 contrôles Happy DOM. Edge Chromium a rejoué la campagne complète du vrai Playground, rendu les six images de la traction suivie d’un piston et les sept images de la cascade du niveau 8. Les quatre commandes d’interruption ont été exercées pendant la phase de piston. Une commande du mode agent a atteint le backend SS03 sans requête Python.
- Les campagnes de SS01 et SS02 terminent dans le navigateur. CASC et LS20 se chargent et acceptent une direction. Les 24 tuiles de Custom 4 correspondent aux pixels des états initiaux. SS03 s’ouvre au niveau 8 depuis la galerie et l’interface a été vérifiée sur 390 px de large.
- Le build TypeScript et Vite génère 103 jeux et 660 aperçus.

## Performance

Le runner des traces publiques compare `e63d17c5` au candidat `a3608191`, avec une affinité commune aux processeurs logiques 12 et 14. La première paire mesurait +13,10 % sur STCK et +1,14 % sur SMLP. La fenêtre A1/B1/B2/A2 conserve ces mesures, soit 24 sessions et 300 actions au total. Les commandes et les observations concordent. Les médianes globales sont à +7,28 % sur STCK et +1,64 % sur SMLP.

La comparaison directe du dispatcher sur la base `ffcdf076` et le candidat `de7edb79` mesure 16 campagnes complètes par jeu et par version, en alternance A/B/B/A. Les retours finaux concordent. Les médianes du coût de calcul des sessions sont à −3,49 % pour SS01 et −2,38 % pour SS02. Le seuil de +10 % est respecté dans ces deux comparaisons.
