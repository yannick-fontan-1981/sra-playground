# Raccordement de SS04 au SRA Playground

Cette version livre le laboratoire autonome et ses huit niveaux. Elle ne modifie pas le catalogue, le routeur de jeux, la galerie ou le site publié. Le code source durable se trouve sous `experiments/sinking-star-ss04/`.

## Backend natif

Prendre le backend du jeu SS03 ou SS02 présent sur `main` comme exemple de raccordement et importer directement :

```ts
import { WizardPuzzleSession } from '../../experiments/sinking-star-ss04/src/core.ts';
import { SS04_LEVELS } from '../../experiments/sinking-star-ss04/src/levels.ts';
```

Adapter l’extension aux conventions TypeScript réelles du dépôt. Le moteur doit être partagé, sans recopier ses règles dans une deuxième implémentation. Créer une session lors du chargement de SS04 et router `action`, `undo`, `reset`, `restart` et `selectLevel`. Aucun chargement Python n’est requis. Une erreur de chargement doit invalider l’ancien backend actif.

Enregistrer **SS04 — L’Axe violet**, huit niveaux, comme quatrième jeu de **Custom 4**, après SS01, SS02 et SS03. Si SS03 n’est pas encore raccordé dans le checkout courant, préserver son emplacement prévu et signaler précisément cette dépendance ; ne pas changer silencieusement l’ordre de la série.

## Commandes, tutoriel, animation

- Les seules actions de jeu sont 1–4 : haut, bas, gauche, droite. Ne pas montrer Espace, changement de personnage, ACTION5 ou commandes propres au Marchand.
- Une direction lance l’échange automatique ; sans cible, elle tente la marche. Ne pas transformer cette règle en orientation + action séparée.
- Charger le niveau 1 et ouvrir le tutoriel en mode manuel, sauf si une navigation explicite demande un autre niveau. Conserver la possibilité de jouer en mode agent.
- Reprendre les six leçons de `src/browser.ts`, calculées sur les pixels publics, et les aides sur miroirs, monstres, portes et presses. Les unités graphiques restent des cellules 3×3 dans une image 64×64.
- Présenter la totalité de `frames` avec `frameDurationsMs`, y compris les cascades. Échange : trois images 70/90/0 ms en phase finale ; presse : déplacement 1/2/3 pixels, 60/80/0 ms. Ne pas plafonner à trois images par action.
- Les directions sont bloquées pendant la présentation. Undo, Reset, Restart et sélection de niveau annulent les callbacks devenus obsolètes. Afficher les panneaux WIN/GAME_OVER après la dernière image pour ne pas masquer l’animation de réussite ou de défaite.
- `reset` efface la résolution du niveau courant ; `restart` efface toute la série. La victoire exige les huit niveaux et le moteur passe au premier niveau non résolu, pas nécessairement au numéro suivant.

Examiner les conditions particulières à SS02/SS03 dans `src/main.ts` : mode manuel initial, aide clavier, tutoriel, touches disponibles, annulation pendant animation et comportement de la victoire. Ajouter SS04 aux conditions pertinentes ou les factoriser proprement. Ne pas modifier les règles des jeux existants.

## Catalogue, galerie et sources

L’entrée du catalogue doit indiquer le chemin `experiments/sinking-star-ss04/src/levels.ts`. La galerie Custom 4 doit contenir les huit images initiales obtenues avec le même `WizardPuzzleSession`, sa palette et `selectLevel`. Mettre à jour le générateur natif de galerie, le manifeste et les totaux de collection. Reprendre les crédits de `src/level-info.ts` ; la source du niveau 5 a un identifiant confirmé mais pas de numéro de guide confirmé.

## Contrat avec l’agent

L’agent doit recevoir uniquement les observations publiques : pixels, palette, durées, actions et progression. Ne pas exposer `World`, `State`, `planSwap`, les circuits, `tests/witnesses.json`, les parcours de référence ou le solveur. Ne pas ajouter de stratégie SS04 spécifique dans SRA/SIC/Logos pour faciliter ses résultats.

## Vérification et publication

1. Repartir du dernier `main`, lire `AGENTS.md`, travailler sur une branche propre et préserver les changements parallèles.
2. Rejouer `npm test` et `npm run validate` dans le laboratoire. Le fichier `validation/levels-report.json` donne les métriques et empreintes des huit parcours.
3. Rejouer ces mêmes parcours à travers le vrai routeur de production et comparer toutes les images, durées, actions, états et progressions au laboratoire ; inclure Undo/Reset et les transitions entre jeux.
4. Vérifier SS01–SS03 et les backends historiques, puis exécuter la compilation et les contrôles requis du dépôt. Mesurer la performance commune si l’intégration en modifie le chemin d’exécution.
5. Tester dans un navigateur réel la galerie, le tutoriel ouvert, un échange réfléchi, les deux niveaux finaux, la défaite et Undo pendant animation. La validation Happy DOM fournie pour le fichier autonome ne remplace pas cette vérification du site.
6. Tests → commit → push GitHub → intégration sur `main` → publication du Site existant en respectant son accès actuel → vérification du SHA source publié. Ne pas créer un deuxième site.

Le compte rendu doit distinguer code poussé, code intégré et version effectivement publiée, avec branche, commit, merge, version Site et SHA source disponibles. Ne pas déclarer une publication si seul le laboratoire est présent sur `main`.
