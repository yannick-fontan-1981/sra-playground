# Progression et choix des niveaux · v0.4.0

Le tutoriel reste chargé et ouvert au démarrage. Le niveau 2 introduit maintenant un défi de difficulté moyenne avec une seule presse ; les niveaux 7 et 8 développent ensuite ce mécanisme.

| Niveau | Problème principal | Choix de conception |
|---|---|---|
| 1 · L’atelier du Voleur | Tirer, relâcher, changer de côté et occuper trois boutons | Tutoriel conservé : trois caisses, trois boutons, 82 cellules accessibles sans tirer, aide ouverte et cinq apprentissages suivis. |
| 2 · La presse latérale | Charger deux caisses dans une presse et remplir un couloir | Création originale de difficulté moyenne : une presse vers l’est, un pilier à contourner et une porte de sortie commandée par deux boutons. |
| 3 · Les deux entrepôts | Dégager des accès avant d’ouvrir le passage inférieur | Heroes of Hauling 6, transcription conservée : sept caisses et deux étages reliés par le côté. |
| 4 · Le relais des deux terrasses | Transporter une caisse vers la chambre basse et garder l’accès à la sortie haute | Adaptation de Heroes of Hauling 14 ; deux caisses et deux chambres nécessaires. |
| 5 · Les alcôves de la cathédrale | Extraire deux caisses de directions opposées | Adaptation de Heroes of Hauling 15 ; changements d’axe avant de tenir les deux boutons. |
| 6 · Trois amarres | Organiser trois placements dans un espace contraint | Heroes of Hauling 8, transcription conservée ; trois caisses à manipuler sur les deux axes. |
| 7 · Les deux presses | Remplir deux niches avec des pistons | Création originale : presse vers l’ouest, poussée d’une file de deux caisses, puis presse vers le nord avec deux boutons simultanés. |
| 8 · Le train des six caisses | Alimenter une file et coordonner deux circuits | Reproduction de Heroes and Light 2, salle `multipush_for_me2` ; quatre déclenchements horizontaux puis cascade verticale. |

## Niveau 2 : une seule presse, deux chargements

La carte de 11 × 9 cellules contient deux caisses et une presse orientée vers l’est. Il faut préparer les caisses, contourner le pilier central et charger la presse par le haut pour garder une sortie de manœuvre. Deux déclenchements remplissent les deux boutons alignés : le second pousse une file de deux caisses sur les boutons qui libèrent la destination.

Le témoin comporte 27 directions, huit tractions et deux poussées. Les deux caisses sont conservées. La recherche exhaustive sans déplacement de piston épuise 6 766 états sans atteindre la cible : la presse est indispensable. La niche terminale a trois parois, ce qui empêche d’y tirer directement une caisse.

## Niveau 7 : une poussée indispensable

La première action du témoin, vers le bas, tire une caisse sur la case d’une porte puis presse le bouton qui la fait apparaître. Les deux animations se succèdent. Une deuxième caisse rejoint le dispositif et permet une poussée de file. La troisième caisse utilise une presse orientée vers le haut.

La version 0.4.0 ajoute une plaque en (10,5) au circuit de la presse nord. Le bouton existant en (9,2) et cette nouvelle plaque doivent être occupés ensemble. Le témoin récupère la caisse devenue disponible après les poussées ouest, la place sur la plaque et la contourne avant de préparer la dernière presse. Cela ajoute un besoin de réemploi et de placement ; aucune caisse ni paroi supplémentaire n’est ajoutée.

Le parcours vérifié compte 54 directions, 18 tractions et trois poussées, sans blocage, mort ni caisse perdue. Ce parcours n’est pas annoncé optimal et n’impose pas un ordre unique entre les presses. Les 30 premières directions de l’ancien témoin mettent le héros sur le bouton nord et une caisse sur sa porte, mais la nouvelle plaque reste vide : la porte ne pousse pas. La même configuration de déclenchement fonctionne lorsque la plaque est tenue dans le nouveau témoin.

Les deux boutons finaux sont dans des niches à trois parois. Aucune direction ne permet à la fois de placer une caisse avant le bouton et de laisser au Voleur une case après celui-ci : les niches ne peuvent pas être remplies par simple traction. Elles sont initialement vides et contrôlent l’unique accès à la cible. La nécessité des pistons est donc vérifiée géométriquement, indépendamment du témoin de résolution.

## Niveau 8 : reproduction de l’énigme demandée

La carte comporte 9 × 10 cases et 67 cases de sol. Elle conserve le Voleur, la destination, les six caisses, les deux boutons et les trois portes de la référence. Les deux boutons sont occupés par des caisses au départ.

La porte de droite pousse vers la gauche lorsqu’on presse son bouton. La porte centrale pousse vers le haut lorsque le bouton A reçoit une caisse ; ce même circuit ouvre la porte de sortie. Les caisses doivent être amenées et alignées sans perdre l’accès aux positions de traction. Le dernier déclenchement horizontal active aussi la poussée verticale.

Le témoin communautaire original de 154 directions fonctionne sans changement sur le moteur final. Il contient 53 tractions et cinq phases de piston : quatre poussées vers l’ouest de files de 2, 3, 5 et 6 caisses, puis une poussée vers le nord. Les six caisses sont conservées.

## Validation de la série

Les huit témoins comptent **484 directions, 154 tractions et 10 phases de piston**. Aucun n’a de mouvement refusé, décès ou caisse détruite. Ces parcours ne sont pas annoncés optimaux.

Une ablation des tractions confirme leur nécessité dans les huit niveaux. Les deux reprises intactes de Heroes of Hauling sont comparées cellule par cellule à la transcription. Le niveau 8 est comparé à son relevé de terrain et d’objets. Les observations complètes des sept niveaux conservés sont comparées à des empreintes produites avec le moteur v0.3.0.

L’eau conserve le contour du tutoriel. Le moteur de piston sait créer des plateformes en poussant une caisse dans l’eau, mais aucune eau supplémentaire n’est ajoutée à la reproduction du niveau 8.
