# Sources et nouvelles cartes — SS02 0.4.0

La première campagne reprenait sept grilles de Heroes of Hauling. À la demande de
l’utilisateur, cinq cartes sont désormais remplacées par des créations originales
plus axées sur l’eau, les détours et les accès permettant de pousser du bon côté.
L’ancien niveau 3 est conservé en position 2 ; le tutoriel et le niveau 7 sont conservés.

| SS02 | Origine | Grille / transformation |
|---|---|---|
| 1 | Création originale | Tutoriel : chaînes, eau, pont, boutons, porte |
| 2 | Heroes of Hauling, énigme 2 | `heroes1_2_v2`, ancien niveau 3, Guerrier conservé |
| 3 | Nouvelle création originale | La digue et la cheminée |
| 4 | Nouvelle création originale | Les amarres croisées |
| 5 | Nouvelle création originale | Le port des trois appuis |
| 6 | Nouvelle création originale | La spirale et le quai de manœuvre |
| 7 | Heroes of Hauling, énigme 4 | `heroes1_4`, Guerrier conservé |
| 8 | Nouvelle création originale | Les trois chantiers |

Guide de référence pour les deux cartes conservées :
https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/

Grilles textuelles : `joric/ootss`, `scripts/ootss.pz`, blob Git
`3b8768a5152c34e0f572e7e66251dfadb4cb6d1d`. Les deux extraits retenus sont
conservés dans `reference/hauling-grids.json` et comparés automatiquement aux
cartes jouées. Leurs dimensions et positions restent celles de cette transcription.
Les anciennes versions des cinq cartes remplacées sont conservées dans l’historique Git.

La transcription publique provient du port PuzzleScript de la démo. Elle ne
certifie pas une copie exacte des captures ou de la version commerciale. La carte
`heroes1_4` contient trois pierres ; cette transcription est conservée telle quelle.
Les cinq nouvelles cartes ne sont pas présentées comme des niveaux du jeu original.

La poussée de files reprend la règle du Guerrier. Les commandes sont uniquement
les quatre directions depuis la version 0.3.0. La version 0.4.0 fait avancer chaque
sprite de 1, 2 puis 3 pixels lors d’une poussée, sans clignotement ni prévisualisation.

Les parcours de `tests/witnesses.json` servent seulement à valider la solvabilité.
Ils ne sont pas annoncés minimaux et ne sont pas inclus dans le HTML jouable ni dans
les observations d’un agent. La nécessité de construire des appuis est vérifiée
séparément dans `validation/levels-report.json`.

Attribution : conception des deux énigmes sources — Order of the Sinking Star ;
transcriptions — Joric ; adaptation ARC, tutoriel et cinq nouvelles énigmes — projet
SRA Playground de Yannick Fontan. Aucun graphisme ou audio original n’est inclus.
