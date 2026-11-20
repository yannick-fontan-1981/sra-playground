# Prompt Codex — intégration native de SS09

Copier le texte ci-dessous dans Codex, dans le dépôt `yannick-fontan-1981/sra-playground`.

---

Intègre **SS09 — Le Chœur des Miroirs**, duo **Marchand + Barde**, comme neuvième jeu de **Custom 4**, immédiatement après SS08, puis publie et vérifie le résultat sur le Site SRA-Playground existant.

## 1. Source à utiliser

Lis `AGENTS.md` et `docs/migration/git-site-sync-policy.md`, synchronise `main`, puis travaille sur une branche dédiée en préservant les changements concurrents. Le laboratoire est dans `experiments/sinking-star-ss09/`, version **0.1.2 / HTML v3**. Sa source approuvée est le commit **`ee842d20d59d51312f10d2a8249b5c978d15c545`**. Vérifie sa présence dans l’historique de `main` et l’état actuel du dépôt avant de commencer.

Lis `README.md`, `docs/specification.md`, `docs/integration.md`, `docs/level-design.md`, le moteur et les tests du laboratoire. Réutilise exactement ce moteur et les huit niveaux ; aucun nouveau dessin de carte, changement de règles ou remplacement par un ancien HTML. Le fichier autonome sert de référence visuelle ; le jeu doit fonctionner **nativement dans le canvas et le worker du Playground**, avec les commandes manuelles et l’agent SRA.

## 2. Raccordement aux fichiers existants

Crée `src/games/sinking-star-ss09.ts` sur le modèle structurel de l’adaptateur SS08, en important `DuoPuzzleSession` et `SS09_LEVELS` depuis le laboratoire SS09. Raccorde `load`, `action`, `undo`, `reset`, `restart` et `selectLevel`. Valide les actions et les coordonnées ACTION6 avant tout appel ; valide le chargement avant de remplacer une session utilisable. La sélection de héros passe par ACTION6, jamais par `nextMerchant`.

Ajoute le chargement différé SS09 dans `src/runtime/native-game-dispatcher.ts`. SS09 ne doit pas initialiser Python/Pyodide. Conserve le fonctionnement des autres jeux et les erreurs des chargements invalides.

Dans `src/games/catalog.ts`, ajoute après SS08 : code `SS09`, identifiant `ss09-c4000001`, nom `Le Chœur des Miroirs`, groupe `custom_4`, famille `sinking_star_duo`, huit niveaux, disponibilité `playable`, source `experiments/sinking-star-ss09/src/levels.ts`.

Étends dans `src/main.ts` les ensembles de jeux natifs, `DuoGameCode`, `duoUi`, les commandes de sélection, panneaux d’aide, tutoriel, retours d’action et contrôles de défaite. Le partenaire SS09 est le **Barde**, palette 6 ; le Marchand utilise la palette 12. Les comportements propres au Magicien de SS08 ne concernent pas SS09.

## 3. Commandes et tutoriel

Ouverture par défaut au **niveau 1, tutoriel déplié**. Les huit salles restent sélectionnables. Flèches : ACTION1 haut, ACTION2 bas, ACTION3 gauche, ACTION4 droite. **Espace et X : ACTION5**, reflet sans chant. Clic, Tab, 1/2 et boutons Marchand/Barde : véritables ACTION6 avec coordonnées pixels entières 0–63, enregistrables et rejouables. Z : Undo ; R : Reset ; conserver Restart et la navigation des niveaux.

Extrais les fonctions pédagogiques de `src/browser.ts` du laboratoire vers un module pur `src/tutorial.ts`, partagé par la démo et le Playground, selon l’organisation de SS08. Préserve leur logique fondée uniquement sur les pixels publics, adapte le bundler autonome si nécessaire et évite deux implémentations divergentes. Conserve les douze découvertes : `select`, `move`, `merchant-push`, `bard-song`, `partner-song`, `selective-song`, `platform`, `support-slide`, `mirror-motion`, `mirror`, `gate`, `goals`. Le témoin L1 v3 atteint les douze, dont le chant sélectif avec une pièce mobile et une pièce retenue.

Affiche les objectifs, sources et explications de `src/level-info.ts`. Le chant choisit les membres avant le pas, à distance de Chebyshev 2, à travers les murs : Marchand, caisses, monstres et appuis, mais pas les miroirs. Les déplacements forcés ne chantent pas. L’appui sous un héros et celui à l’arrivée du Barde restent ancrés pendant le pas. Conserve toutes les autres règles du moteur.

## 4. Fidélité visuelle et niveaux approuvés

Garde le canvas **64 × 64**, les cellules **3 × 3**, le centrage déjà assuré par le moteur et la palette. Aura pointillée magenta sous les glyphes ; reflet d’un héros en **plus gris clair**, d’une caisse en **contour carré gris clair** ; miroir au-dessus du bouton. Aucun fantôme de poussée.

Pour chaque miroir, choisis l’occupant le plus proche avant de vérifier les arrivées. L’arrivée bloquée du plus éloigné ne bloque pas le proche ; à distance égale, conserve l’échange. Le rendu de prévisualisation et ACTION5 suivent le même choix.

Préserve impérativement les corrections acceptées :

- **L1 v3** : seul le petit îlot d’une case descend de `(9,8)` à `(9,11)` dans les lignes de carte avant centrage ; rive du premier îlot identique à v1. Ne réintroduis ni butée de deux cases ni découpe de rive de v2.
- **L4** : départ isolé du Barde, presse et pont nécessaires, monstres dans le couloir obligatoire, réglage final du miroir.
- **L8** : caisse, bouton et porte sur le rayon nécessaires au départ des deux héros ; poussée du Barde sans chant pour conserver le poids.

## 5. Animations, historique et agent

Transmets intégralement `frame`, `frames` et `frameDurationsMs`. Respecte les animations de trois images, les cinq images du combat et les cascades concaténées. N’ajoute aucun tick par image. Les panneaux de défaite/victoire attendent la dernière image.

Le miroir responsable d’un refus clignote rouge/blanc/rouge/blanc avec **`[110,70,110,0]`**. Cette animation se joue même si l’image finale et les positions sont identiques, sans tick, combat ni nouvelle entrée Undo. Espace répété la rejoue ; les miroirs non responsables restent blancs.

Bloque les nouvelles actions pendant la lecture. Undo, Reset, Restart, changement de niveau ou de jeu annulent proprement les présentations devenues obsolètes, y compris lors d’une transition depuis le mode agent. Undo restaure l’action entière. Préserve la progression réelle du moteur, qui choisit le premier niveau encore non terminé.

Le worker et l’agent reçoivent uniquement le contrat public `GameObservation` décrit dans `docs/integration.md`. Aucun état interne, solveur, témoin, indice d’auteur ou solution dans le bundle jouable ou le raisonnement SRA. Vérifie l’historique et le replay, en particulier les coordonnées ACTION6 et les durées.

## 6. Galerie, validation et publication

Ajoute la session SS09 à `scripts/native-game-gallery.mjs`. Régénère la galerie avec le générateur existant `scripts/generate-game-gallery.mjs` : huit véritables images initiales, carte SS09 après SS08, liens `/?game=SS09&level=N#playground`, crédits Sinking Star et sources conservés.

Étends `tests/custom4-native.test.ts` pour le catalogue, le dispatcher, les erreurs, la parité moteur/adaptateur et les changements de jeu. Rejoue les huit témoins sans les modifier : **443 actions dont 33 sélections, 1 312 images, huit victoires** ; le laboratoire possède **108 tests**. Vérifie aussi les quatre interférences de miroirs, les deux défaites et Undo.

Crée `scripts/verify-ss09-browser.mjs` avec les helpers de `scripts/native-browser-checks.mjs`, sur le modèle SS08 mais avec les règles et fixtures SS09. Contrôle le vrai canvas, le worker, les douze découvertes, animations, interruptions, sélection, mobile, galerie, liens et parcours agent générique ; aucune requête Python pendant SS09. Les contrôles Happy DOM du laboratoire ne remplacent pas cette vérification dans un navigateur.

Exécute les tests du laboratoire et sa validation, puis les tests, typecheck et build racine ; corrige les régressions nécessaires. Committe et pousse la branche, intègre sur `main`, puis publie le Site existant `https://sra-playground.yannick-fontan.chatgpt.site/` à partir de ce commit. Vérifie la version publiée, le worker et l’atlas, puis ouvre SS09 L1 et ses liens de niveaux. Termine avec les SHA poussés/intégrés, le statut réel de publication, l’URL jouable et les résultats de validation. Ne conclus pas à une publication réussie tant que la concordance GitHub/Site n’est pas vérifiée.
