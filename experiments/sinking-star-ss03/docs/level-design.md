# Progression et choix des niveaux · v0.2.0

Le tutoriel reste chargé et ouvert au démarrage. À la demande de l’utilisateur, l’ancien niveau 7 devient le niveau 2 et les deux derniers niveaux utilisent des portes qui poussent.

| Niveau | Problème principal | Choix de conception |
|---|---|---|
| 1 · L’atelier du Voleur | Tirer, relâcher, changer de côté et occuper trois boutons | Tutoriel conservé : trois caisses, trois boutons, 82 cellules accessibles sans tirer, aide ouverte et cinq apprentissages suivis. |
| 2 · Le triple verrou | Répartir trois caisses issues de chambres vers trois boutons | Ancien niveau 7 déplacé sans modification de la grille ; adaptation de Heroes of Hauling 18. |
| 3 · Les deux entrepôts | Dégager des accès avant d’ouvrir le passage inférieur | Heroes of Hauling 6, transcription conservée : sept caisses et deux étages reliés par le côté. |
| 4 · Le relais des deux terrasses | Transporter une caisse vers la chambre basse et garder l’accès à la sortie haute | Adaptation de Heroes of Hauling 14 ; deux caisses et deux chambres nécessaires. |
| 5 · Les alcôves de la cathédrale | Extraire deux caisses de directions opposées | Adaptation de Heroes of Hauling 15 ; changements d’axe avant de tenir les deux boutons. |
| 6 · Trois amarres | Organiser trois placements dans un espace contraint | Heroes of Hauling 8, transcription conservée ; trois caisses à manipuler sur les deux axes. |
| 7 · Les deux presses | Remplir deux niches avec des pistons | Création originale : presse vers l’ouest, poussée d’une file de deux caisses, puis presse vers le nord. |
| 8 · Le train des six caisses | Alimenter une file et coordonner deux circuits | Reproduction de Heroes and Light 2, salle `multipush_for_me2` ; quatre déclenchements horizontaux puis cascade verticale. |

## Niveau 7 : une poussée indispensable

La première action du témoin, vers le bas, tire une caisse sur la case d’une porte puis presse le bouton qui la fait apparaître. Les deux animations se succèdent. Une deuxième caisse rejoint le dispositif et permet une poussée de file. La troisième caisse utilise une presse orientée vers le haut.

Les deux boutons finaux sont dans des niches à trois parois. Aucune direction ne permet à la fois de placer une caisse avant le bouton et de laisser au Voleur une case après celui-ci : les niches ne peuvent pas être remplies par simple traction. Elles sont initialement vides et contrôlent l’unique accès à la cible. La nécessité des pistons est donc vérifiée géométriquement, indépendamment du témoin de résolution.

## Niveau 8 : reproduction de l’énigme demandée

La carte comporte 9 × 10 cases et 67 cases de sol. Elle conserve le Voleur, la destination, les six caisses, les deux boutons et les trois portes de la référence. Les deux boutons sont occupés par des caisses au départ.

La porte de droite pousse vers la gauche lorsqu’on presse son bouton. La porte centrale pousse vers le haut lorsque le bouton A reçoit une caisse ; ce même circuit ouvre la porte de sortie. Les caisses doivent être amenées et alignées sans perdre l’accès aux positions de traction. Le dernier déclenchement horizontal active aussi la poussée verticale.

Le témoin communautaire original de 154 directions fonctionne sans changement sur le moteur final. Il contient 53 tractions et cinq phases de piston : quatre poussées vers l’ouest de files de 2, 3, 5 et 6 caisses, puis une poussée vers le nord. Les six caisses sont conservées.

## Validation de la série

Les huit témoins comptent **493 directions, 156 tractions et 8 phases de piston**. Aucun n’a de mouvement refusé, décès ou caisse détruite. Ces parcours ne sont pas annoncés optimaux.

Une ablation des tractions confirme leur nécessité dans les huit niveaux. Les deux reprises intactes de Heroes of Hauling sont comparées cellule par cellule à la transcription. Le niveau 8 est comparé à son relevé de terrain et d’objets. Les observations complètes des niveaux 1 à 6 sont comparées à des empreintes produites avec le moteur v0.1.0 ; le niveau 2 correspond à l’ancien 7.

L’eau conserve le contour du tutoriel. Le moteur de piston sait créer des plateformes en poussant une caisse dans l’eau, mais aucune eau supplémentaire n’est ajoutée à la reproduction du niveau 8.
