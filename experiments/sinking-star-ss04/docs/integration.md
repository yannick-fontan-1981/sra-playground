# Raccordement de SS04 au SRA Playground

SS04 — L’Axe violet est le quatrième jeu de Custom 4. Le backend de production importe `WizardPuzzleSession` et les huit cartes v0.1.0 depuis le laboratoire. Le tutoriel du Playground partage l’analyse des pixels de la démo et l’interface lit les références des salles dans `src/level-info.ts`.

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

## Résultats du raccordement

- Les 42 tests du laboratoire, sa validation des huit niveaux et les 11 contrôles Happy DOM passent. La validation rejoue 398 directions avec 55 échanges, dont 5 réfléchis et 8 avec un monstre, 5 poussées de presse et 4 appuis créés.
- Les 17 tests du routeur et du catalogue passent, avec comparaison de chaque retour public au moteur du laboratoire. Les parcours en ordre et hors ordre, l’annulation d’une transition, la défaite au niveau 4 et les échecs de chargement sont exercés.
- La campagne SS04 jouée dans Chromium termine au niveau 1 résolu en dernier et affiche `VICTORY`. Le navigateur valide aussi les six leçons du tutoriel, l’échange réfléchi, la cascade à sept images, les quatre interruptions, la défaite affichée après l’animation et les boutons de récupération. Une commande en mode agent a atteint le backend natif sans requête Python.
- Les références du niveau 5 et de l’adaptation du niveau 6 sont vérifiées dans le Playground. Les 32 tuiles Custom 4 concordent avec les pixels des quatre moteurs et la galerie ouvre SS04 au niveau sélectionné. Le build génère 104 jeux et 668 aperçus.
- SS01, SS02 et SS03 terminent leurs campagnes dans Chromium. CASC et LS20 se chargent et répondent aux commandes. Après intégration des derniers changements de `main`, le build, le contrôle navigateur et les 20 tests ciblés passent.

## Performance

Le runner des traces publiques compare `664dcb9e` à `c616f967` dans l’ordre A1/B1/B2/A2, avec la même affinité aux processeurs logiques 12 et 14. Les 24 sessions mesurées et leurs 300 commandes concordent. Les médianes globales sont à +1,18 % sur STCK et −4,17 % sur SMLP. Les deux résultats respectent le seuil de +10 %.
