Intègre **SS05 — Le Chant Magenta** comme cinquième jeu du lot **Custom 4 · Sinking Star** dans SRA-Playground, après SS01, SS02, SS03 et SS04.

Dépôt : https://github.com/yannick-fontan-1981/sra-playground
Site : https://sra-playground.yannick-fontan.chatgpt.site/

## Point de départ

Pars du `main` actuel, lis `AGENTS.md` et travaille sur ta propre branche en préservant les travaux concurrents. Les sources de SS05 sont dans :

`experiments/sinking-star-ss05/`

La version validée est **0.1.2**, correspondant à **SS05-demo-v3.html**. Son commit de référence est :

`3ba90b9dd13d40532c3aa8f7d50f5f4a034bbf77`

Lis d’abord les documents `README.md`, `docs/integration.md` et `docs/specification.md` de ce répertoire. Réutilise directement :

- `src/core.ts` : `BardPuzzleSession`.
- `src/levels.ts` : `SS05_LEVELS`.
- `src/level-info.ts` : crédits et références.
- `src/browser.ts` et `index.template.html` : interface de référence et tutoriel.
- `tests/witnesses.json` et `validation/` : parcours et résultats de validation.

## Raccordement au site

Reprends le modèle d’adaptateur natif de `src/games/sinking-star-ss04.ts`, avec un `createSs05Backend` qui utilise directement la session du laboratoire. Préserve ses méthodes `observe`, `action`, `undo`, `reset`, `restart` et `selectLevel`. Valide un chargement ou une sélection avant de remplacer la session active.

Raccorde SS05 dans `src/runtime/native-game-dispatcher.ts`, puis dans `src/games/catalog.ts` avec le code **SS05**, le nom **Le Chant Magenta**, le groupe `custom_4`, **8 niveaux** et le chemin source du laboratoire. Ajoute sa vignette et mets à jour la galerie, les compteurs et les tests de catalogue selon l’état actuel du dépôt. Examine notamment `scripts/native-game-gallery.mjs` et `scripts/generate-game-gallery.mjs`.

Le jeu doit être sélectionnable et jouable dans le site. Le chargement par défaut ouvre **le niveau 1 en mode manuel, avec son tutoriel déplié**. La sélection manuelle des huit niveaux reste disponible.

## Commandes à préserver

- **ACTION1–4** : flèches ; le Barde marche et entraîne les objets proches.
- **ACTION5** : **barre d’espace**, touche **X** et bouton **Reflet** ; activation des miroirs.
- **Z** : annuler ; **R** : recommencer.
- Aucun changement de personnage pour ce jeu.

Dans `src/main.ts`, le prédicat actuel `isDirectionalNativeGame` combine plusieurs comportements : mode manuel initial, annulation des animations et suppression d’ACTION5. Sépare ces responsabilités pour SS05 : il doit bénéficier du fonctionnement manuel natif tout en affichant le bouton Espace et en acceptant ACTION5. Espace doit empêcher le défilement de la page.

Adapte les textes, l’aide clavier et les libellés d’accessibilité au chant et aux reflets. Les tests de SS04 qui refusent ACTION5 ou le gris clair au repos ne s’appliquent pas à SS05.

## Rendu et animations

Conserve exactement l’image **64 × 64**, les cellules **3 × 3 pixels**, la palette et les dessins du moteur :

- Barde **magenta, index 6**.
- **Aura en pointillés magenta**, également pendant les déplacements.
- Destination du Barde par reflet : **+ gris clair**.
- Destination d’une caisse par reflet : **contour carré gris clair**.
- Caisses immergées : appuis marron avec X cyan, mobiles sur l’eau sous l’effet du chant.

Ces éléments sont déjà dessinés dans les pixels du moteur.

Présente toutes les `frames` avec leurs `frameDurationsMs`, sans supposer un nombre fixe d’images. La marche, le chant, les presses et les reflets ont trois images. Un combat en a **cinq** : préparation, coup vers la cible, impact blanc et rouge, désagrégation et état final. Les monstres peuvent frapper tout en s’éliminant mutuellement.

Points de vérification précis :

- **L8, action 20** du témoin : cascade de **9 images**.
- Combat de **L3** : **8 images**, déplacement puis combat, avec les durées `[60, 80, 40, 80, 90, 100, 110, 0]`.
- Une résolution peut ajouter l’image du niveau suivant après une pause de 100 ms.

Le statut WIN ou GAME_OVER est déjà présent dans l’observation pendant l’animation : affiche les panneaux terminaux **après la dernière image**. Bloque les commandes manuelles et celles de l’agent pendant les animations et après un état terminal, même si `availableActionIds` contient encore `[1,2,3,4,5]`.

Undo, Reset, Restart et changement de niveau doivent invalider les anciennes animations, y compris pendant le coup d’un monstre.

## Tutoriel et progression

Reprends les six leçons : déplacement, chant, ancrage, plateforme, miroir et bouton. Le tutoriel et les aides expliquent le carré de portée **5 × 5**, le chant à travers les murs, les appuis mobiles, les monstres et les presses.

Les fonctions du tutoriel sont actuellement privées dans `src/browser.ts`, qui manipule le DOM. Extrais si nécessaire des helpers purs partagés, sur le modèle de `experiments/sinking-star-ss04/src/tutorial.ts`, et mets alors à jour le bundler `scripts/build-demo.mjs` pour préserver l’HTML autonome. N’importe pas directement le module navigateur dans le site.

Le suivi pédagogique utilise uniquement les pixels publics, les actions et les transitions de niveau. Conserve les crédits et liens propres à chaque salle.

La victoire exige les **huit niveaux**, même s’ils sont résolus dans un ordre différent. Après une résolution, la session choisit le premier niveau inachevé. Undo restaure aussi la progression et peut traverser un changement de niveau ; Restart revient au tutoriel.

## Validation

La référence actuelle comporte **31 tests de règles**, **14 contrôles de l’HTML**, **395 actions et 1 222 images**. Les contrôles d’interface existants utilisent Happy DOM et le buffer du canvas.

Ajoute la parité via le routeur de production, selon le modèle de `tests/custom4-native.test.ts` : compare les observations du backend et du laboratoire sur les huit témoins, y compris chaque image, durée, statut et transition, avec vérification que le backend Python n’est pas chargé.

Vérifie aussi :

- Les six leçons du niveau 1, Espace, X et le bouton Reflet.
- L’élimination mutuelle des monstres dans le parcours de L3.
- **L3 : `UURRRRRDDDRRRUUUUUU`**, attaque mortelle réelle ; panneau après le combat et Undo pendant l’attaque.
- **L6 : `RRRX`**, chute par reflet ; GAME_OVER, Undo et Reset.
- Les plateformes mobiles de L7, la cascade de L8, la progression hors ordre et les commandes après WIN.

Exécute les tests du laboratoire, les tests natifs pertinents, le typage, la compilation du site et la non-régression de SS01 à SS04. Fais un essai dans le navigateur réel du site, notamment sur les combats, les changements de niveau et l’annulation des animations.

Les parcours et le solveur d’auteur restent réservés aux tests. L’agent reçoit les observations publiques et les commandes normales ; n’ajoute aucune stratégie spécifique à SS05 ni accès à son état caché.

## Livraison

Mène l’intégration jusqu’au jeu visible et utilisable dans Custom 4. Respecte la chaîne du dépôt :

**travail → tests → commit → push GitHub → intégration dans main → publication Site → vérification GitHub/Site.**

Publie avec le mécanisme existant en conservant la visibilité actuelle du Site. Si la publication est inaccessible dans ton environnement, termine et pousse l’intégration puis indique précisément ce qui reste à publier.

À la fin, donne la branche, les commits poussé et intégré, les résultats des tests, la version et le SHA source du Site lorsqu’ils sont disponibles, ainsi que le lien permettant d’ouvrir SS05. Distingue explicitement la présence des sources dans main et la disponibilité effective du jeu publié.

