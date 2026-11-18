# Raccordement de SS03 dans Custom 4

Ce dossier est un laboratoire autonome. Il ne modifie pas le catalogue de production, le moteur SRA, le SIC ou le Logos Engine.

Lors du raccordement, relire `AGENTS.md`, l’état courant du runtime et l’intégration effective de SS01/SS02. Copier le moteur, les huit niveaux et la présentation humaine depuis ce dossier validé ; conserver les identifiants et la palette. Le code de catalogue proposé est `SS03`, dans `custom_4`, après SS02.

Points de parité à préserver :

1. `PullPuzzleSession` : `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel`.
2. Quatre actions directionnelles uniquement ; ne pas afficher une action Espace ou un bouton de changement de Marchand.
3. Charger le premier niveau et ouvrir le tutoriel humain à l’entrée du jeu, pas seulement charger la grille sans explications.
4. Transporter toutes les images et leurs durées ; toujours afficher `frame` comme image finale.
5. Autoriser Undo/Reset/sélection pendant l’animation avec annulation des rappels en attente.
6. Rejouer les huit témoins via le backend réellement intégré et vérifier la parité des images, de la progression et des annulations.
7. Générer la ligne de galerie à partir des huit véritables images initiales. Conserver les jeux déjà présents dans Custom 4.
8. Garder les témoins, le solveur et les fichiers de recherche hors des observations et des entrées de l’agent.

Suivre la chaîne canonique du dépôt : tests → commit → push GitHub → intégration sur main → publication du Site → vérification du SHA source publié. Ne pas annoncer que SS03 est disponible sur le Site à partir du seul push du laboratoire.
