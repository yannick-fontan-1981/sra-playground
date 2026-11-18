Intègre **SS04 — L’Axe violet** dans SRA-Playground comme **quatrième jeu de Custom 4**, après SS01, SS02 et SS03, puis publie la version intégrée sur le Site existant.

## Base de travail

Dépôt canonique : https://github.com/yannick-fontan-1981/sra-playground

Repars du dernier `main`, lis `AGENTS.md` et les règles de synchronisation du dépôt, puis travaille dans ton propre checkout et sur ta propre branche. Préserve les commits parallèles et pousse régulièrement.

Le laboratoire validé **SS04 v0.1.0** est déjà sur `main` :

- Dossier : `experiments/sinking-star-ss04/`
- Commit de livraison : `2e1e0b0d166688c9b96b0d50ef1880fccc215dcb`
- Commit d’intégration : `0c8937307815bafeaa75d1ea1816042b3ebf25c4`

Utilise ce laboratoire comme référence. Conserve les huit cartes, leurs règles, leurs couleurs et leurs animations.

Lis d’abord son `README.md`, `docs/integration.md`, `docs/specification.md`, `docs/provenance.md`, puis `src/core.ts`, `src/levels.ts`, `src/level-info.ts` et `src/browser.ts`.

## Backend, catalogue et galerie

Prends pour modèle l’intégration native de SS03 actuellement présente :

- `src/games/sinking-star-ss03.ts`
- `src/runtime/native-game-dispatcher.ts`
- `src/games/catalog.ts`
- `src/main.ts`
- `scripts/native-game-gallery.mjs`
- `scripts/generate-game-gallery.mjs`
- `tests/custom4-native.test.ts`

Crée le backend SS04 en réutilisant directement **WizardPuzzleSession** et **SS04_LEVELS** du laboratoire. Route `load`, `action`, `undo`, `reset`, `restart` et `selectLevel`. Le chargement de SS04 doit fonctionner sans Python. Une erreur de chargement doit invalider l’ancien backend actif.

Ajoute **SS04 — L’Axe violet**, huit niveaux, dans `custom_4`, après SS03. Mets à jour les compteurs, liens de sélection et tests du catalogue. Génère les huit aperçus de galerie depuis le vrai moteur et sa palette ; actualise le manifeste et la page de galerie.

Reprends les crédits de `src/level-info.ts`. Le niveau 5 a un identifiant source confirmé, mais pas de numéro de guide confirmé. Le niveau 6 est une adaptation avec miroirs fixes.

## Commandes et tutoriel

SS04 n’utilise que **ACTION1 à ACTION4** : haut, bas, gauche, droite. Une direction échange automatiquement le Magicien avec la première caisse ou le premier monstre visible ; sans cible, il tente de marcher d’une case.

Conserve les cellules **3 × 3 pixels**, l’image **64 × 64** et le Magicien violet **couleur 15**. N’ajoute ni Espace, ni ACTION5, ni orientation séparée, ni changement de personnage.

Au chargement normal, sélectionne le **niveau 1 en mode manuel, tutoriel ouvert**. Respecte toutefois un lien explicite demandant un autre niveau et garde le mode agent disponible.

Reprends les six apprentissages du tutoriel : déplacement, échange, création d’appui, échange réfléchi, poids sur bouton et ouverture de porte. Leur progression doit rester calculée uniquement à partir des pixels publics et des entrées. Tu peux extraire cette logique dans un module partagé, en conservant le comportement de la démo.

Intègre les aides sur les miroirs, les monstres et les presses. Les monstres sont immobiles, dangereux sur les cases cardinales voisines et utilisables comme poids ; les miroirs renvoient la visée par leur face blanche, avec dos noir bloquant.

Dans `src/main.ts`, étends les conditions pertinentes de `isDirectionalNativeGame` et les traitements actuellement réservés à SS03 : mode initial, commandes, accessibilité clavier, tutoriel, défaite, autorisation d’action de l’agent et annulation pendant animation. Le texte doit décrire l’échange du Magicien.

## Animations, progression et états terminaux

Présente **toutes les images de `frames` avec leurs `frameDurationsMs`**, sans plafond de trois images. Au niveau 8, l’action 11 produit sept images : marche, poussée d’une file, puis seconde presse créant un appui. Durées attendues : `[40,60,80,40,60,80,0]`.

Bloque les directions pendant l’animation. Undo, Reset, Restart et sélection de niveau doivent rester utilisables et invalider les callbacks périmés.

Affiche les panneaux **WIN / GAME_OVER après la dernière image**. Bloque les directions en état terminal, même si l’observation conserve `availableActionIds: [1,2,3,4]`.

Préserve le contrat de progression : victoire après résolution des huit niveaux, passage au premier niveau non résolu, Undo capable d’annuler une transition. Reset recommence le niveau courant ; Restart efface toute la progression.

## Contrat avec le SRA

Transmets seulement les observations publiques : pixels, palette, durées, actions et progression. N’expose ni état interne, ni cible calculée, ni circuits sémantiques, ni solveur, ni témoins. N’ajoute aucune stratégie spécifique à SS04 dans SRA, SIC ou Logos Engine.

## Validation

Exécute les tests du laboratoire et sa validation des huit niveaux. La référence comprend **42 tests**, puis **398 actions** réussies : 55 échanges, dont 5 réfléchis et 8 avec un monstre, 5 poussées de presse et 4 appuis créés, sans coup refusé ni mort.

Rejoue les mêmes témoins **à travers le routeur de production**, en comparant chaque image, durée, état et progression au laboratoire. Vérifie aussi Undo/Reset, navigation directe, victoire hors ordre, GAME_OVER et changements entre SS01–SS04 et jeux historiques.

Vérifie la non-régression de SS01–SS03, puis les tests pertinents et la compilation du dépôt. Respecte le budget de performance du projet si un chemin commun de l’agent est modifié.

Dans un navigateur réel, contrôle le catalogue, les huit aperçus, le tutoriel ouvert et ses six leçons, les échanges réfléchis, la cascade du niveau 8, Undo pendant animation et la récupération après une défaite. Les onze contrôles Happy DOM déjà fournis ne remplacent pas cette vérification du Site.

## Publication et compte rendu

Publie sur le Site existant :
https://sra-playground.yannick-fontan.chatgpt.site/

Réutilise l’identité de `.openai/hosting.json` et préserve l’accès actuel du Site.

Suis la chaîne : **tests → commit → push GitHub → intégration sur main → publication Site → vérification du SHA source publié**. Préserve et réconcilie toute divergence GitHub/Site avant publication.

Termine par : lien du jeu, validations effectuées, branche, dernier commit, commit poussé, commit intégré, version Site, SHA source publié et état de synchronisation. Signale précisément tout blocage réel ; la présence des sources sur main ne suffit pas à déclarer SS04 disponible sur le Site.
