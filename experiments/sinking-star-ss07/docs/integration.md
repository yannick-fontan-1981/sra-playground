# Intégration future dans SRA Playground

SS07 **La Distance Dérobée**, version **0.1.2 / HTML v3**, est préparé comme septième jeu de **Custom 4 · Sinking Star**. La branche de laboratoire est `feat/ss07-duo-lab-20261119`. La validation de l’HTML précède le passage sur `main` et la publication du site.

## Adaptateur natif

Lire le `main` actuel et `AGENTS.md` avant de choisir les points de raccordement. L’adaptateur SS06 présent sur `main` fournit le précédent pour la session et le passage de `data` à ACTION6 ; reprendre le contrat public en conservant les règles SS07.

```ts
import { DuoPuzzleSession } from './core.js';
import { SS07_LEVELS } from './levels.js';

const session = new DuoPuzzleSession(SS07_LEVELS);
const observation = session.action(actionId, data);
```

Relayer `observe`, `action(id,data?)`, `undo`, `reset`, `restart` et `selectLevel`. Conserver les six actions. ACTION6 exige des coordonnées de pixel entières dans `[0,63]` : le centre de la cellule logique `(x,y)` est `(3 + 3*x, 3 + 3*y)`. Construire et valider une nouvelle session avant de remplacer la session active. Aucun chargement Python n’est nécessaire.

Toutes les salles de SS07 comportent **un Marchand, un Voleur et deux cibles**. Ne pas reprendre le mode solo de la dernière salle SS06. La poussée en file du Guerrier ne fait pas partie de SS07 : le Marchand pousse une pièce, le Voleur en tire une derrière son pas libre. Les presses conservent leur propre capacité à déplacer une file.

## Interface manuelle et agent

Charger L1 avec son tutoriel déplié. Maintenir la sélection libre des huit salles. Les flèches déclenchent directement les déplacements, poussées et tractions. Espace/X active ACTION5 ; clic, Tab, 1/2 et boutons de rôle sélectionnent via ACTION6. Préserver le + orange, le + vert et le point blanc de sélection.

Le tutoriel suit neuf acquisitions à partir des pixels publics : déplacement, sélection, poussée du Marchand, traction du Voleur, déplacement du miroir, création d’appui, activation de circuit, reflet et arrivée du duo. Les aides de `browser.ts` ne doivent pas accéder à l’état interne lorsqu’elles sont portées dans le Playground. Extraire des fonctions pures si nécessaire ; ne pas importer le module DOM complet dans le routeur.

Conserver la prévisualisation de reflet : **+ gris clair pour le héros, contour carré gris clair pour la caisse**. Les actions directionnelles n’ajoutent aucun fantôme de poussée ou de traction. L’aide sur les plateformes doit apparaître en L8 avec les symboles actif / rétracté et la couleur du circuit.

Pour chaque miroir, conserver la priorité au premier occupant le plus proche parmi ses deux bras. Comparer les distances avant de contrôler les destinations : un candidat plus éloigné est ignoré, y compris si son arrivée est bloquée. Deux candidats à distance égale échangent leurs positions. Le rendu de la prévisualisation et ACTION5 partagent cette sélection ; préserver les contraintes de collision entre les transferts retenus.

Ne pas neutraliser ACTION5 ou ACTION6 dans un prédicat générique de jeu manuel. La disponibilité des commandes, l’animation et l’état terminal sont trois contrôles distincts. Un changement de personnage n’avance pas le monde.

## Images, durées et annulation

Conserver le canvas 64 × 64, la palette, toutes les images et toutes leurs durées. Une traction comporte trois images d’avancement ; un combat en comporte cinq. Une fermeture de porte ou un retrait de plateforme peut suivre le mouvement dans la même action.

Le statut logique final est connu avant la fin de l’animation. Les panneaux terminaux attendent la dernière image. Bloquer les nouvelles actions manuelles et celles de l’agent pendant la lecture ; Undo, Reset, Restart et sélection de niveau annulent les callbacks antérieurs. Un Undo restaure l’action entière, y compris une cascade ou un changement de salle.

## Vérification du raccordement

Les huit témoins totalisent **593 actions / 1 745 images**. Les rejouer à travers le routeur natif de production et comparer les observations, images, durées, sélections et transitions avec celles du laboratoire. Les 73 tests de règles et les 15 contrôles de l’HTML accompagnent ces parcours.

Vérifier particulièrement l’îlot en ligne de L6 et la nécessité de sa porte verte, la traction dans les quatre directions, l’absence de traction après reflet ou presse, l’échec mortel et Undo de L7, les trois plateformes de L8 et leur conversion en trois appuis, la progression hors ordre et les neuf acquisitions de L1. Couvrir aussi le clavier, le clic avec coordonnées CSS converties en pixels, les entrées pendant les animations et l’annulation d’une animation en cours.

Les tests du laboratoire ne remplacent pas l’essai du site intégré dans un navigateur réel. Exécuter le typage, le build, les tests pertinents et les non-régressions de SS01–SS06. Les témoins, solveurs, références d’auteur et plans internes restent hors du bundle agent : ils servent à vérifier le jeu, pas à fournir une politique de résolution au SRA.

Après validation de SS07 : préparer le commit et le push sur `main`, fournir le prompt Codex d’intégration, ajouter le jeu au catalogue, publier le Site puis vérifier la version et les SHA réellement déployés. Une sauvegarde sur la branche de laboratoire ne constitue pas une publication sur SRA Playground.
