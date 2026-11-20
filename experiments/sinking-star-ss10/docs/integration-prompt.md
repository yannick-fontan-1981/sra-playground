# SS10 — Prompt de raccordement natif dans SRA Playground

## Référence validée

Le laboratoire se trouve dans `experiments/sinking-star-ss10/`, version **0.3.1**. La campagne conserve « Le dernier changement de sens » en position 6 et se termine par la reprise de Heroes and Water 3 conservée dans `reference/author/build-level8.mjs`. Utiliser le `main` actualisé contenant cette version et ses rapports.

Au moment de la préparation, `main` à `07bb91ef97247d5c1ea26de8519873424f0d0f89` raccordait SS01–SS08. SS09 était présent comme laboratoire. Recontrôler le catalogue au démarrage pour préserver les intégrations intervenues depuis.

## Prompt à copier

```text
Intègre nativement SS10 — L’Entrepôt Réversible dans SRA-Playground, depuis le main actualisé du dépôt yannick-fontan-1981/sra-playground.

Lis AGENTS.md, docs/migration/git-site-sync-policy.md et les documents du laboratoire experiments/sinking-star-ss10/ : README.md, docs/specification.md, docs/validation.md et docs/provenance.md.

Le laboratoire version 0.3.1 est la source de vérité. Le niveau 6 s’intitule « Le dernier changement de sens ». Le niveau 8 « Les cinq points d’appui » reprend la carte définie dans reference/author/build-level8.mjs, conservé sans modification, et propagée dans reference/level8-design.json et les données jouables.

Enregistre le jeu :
- code SS10 ; id ss10-c4000001 ;
- nom L’Entrepôt Réversible ;
- groupe custom_4 ; famille sinking_star_duo ;
- 8 niveaux ; Guerrier rouge et Voleur vert ;
- sourcePath experiments/sinking-star-ss10/src/levels.ts.

Réutilise DuoPuzzleSession et les cartes du laboratoire. Crée src/games/sinking-star-ss10.ts sur le modèle de src/games/sinking-star-ss08.ts. Raccorde :
- src/games/catalog.ts ;
- src/runtime/native-game-dispatcher.ts ;
- src/main.ts ;
- tests/custom4-native.test.ts ;
- scripts/native-game-gallery.mjs et scripts/generate-game-gallery.mjs.

Le jeu doit fonctionner dans le canvas et le runtime natifs du Playground. Aucun iframe, Python ou copie divergente du moteur.

Vérifie les intégrations présentes au démarrage. SS08 est le modèle natif constaté lors de la préparation ; SS09 était encore un laboratoire. Actualise les compteurs à partir des jeux réellement jouables.

Deux adaptations demandent une attention particulière :
1. Les commandes de duo existantes supposent un Marchand en premier rôle. Adapte les types, libellés, aides et sélections au Guerrier (rôle 1, rouge 8) et au Voleur (rôle 2, vert 14), en préservant les autres duos.
2. Le tutoriel SS10 est actuellement dans experiments/sinking-star-ss10/src/browser.ts, avec des accès DOM et une session globale. Extrais les fonctions pédagogiques pures dans un module réutilisable fondé sur les observations publiques ; garde le HTML autonome fonctionnel. Le Site et le worker ne doivent pas importer browser.ts tel quel.

Conserve le comportement validé :
- niveau 1 chargé par défaut, tutoriel ouvert et ses douze apprentissages ;
- ACTION1–4 pour marcher, pousser avec le Guerrier et tirer avec le Voleur ;
- ACTION5 par Espace/X pour la réflexion ;
- ACTION6 avec coordonnées pixels 0–63 pour sélectionner, sans tour de monde ;
- clic, Tab, 1/2 et boutons de personnage ;
- Annuler, Reset, Restart, choix des huit niveaux et retour au tutoriel ;
- rendu 64×64, cellules 3×3, palette exacte et agrandissement sans lissage ;
- toutes les images et frameDurationsMs, interruptions d’animation, victoire et défaite ;
- reflet du plus proche, prévisualisation en plus gris clair pour un héros et contour carré gris clair pour une caisse, miroirs au-dessus des boutons et aucune prévisualisation de poussée.

Préserve les deux corrections validées :
- Lorsqu’un miroir bloque une réflexion, son socle noir (5) clignote en rouge (8) et sa diagonale reste blanche (0). Au niveau 5, LLUULCDX depuis Reset, avec C=Tab et X=Espace, signale les deux miroirs incompatibles.
- Au niveau 7, le circuit presse utilise color:0 : bouton rose à centre blanc et porte-presse rose avec marques blanches. Les circuits pont et sortie utilisent respectivement 14 et 15.

L’agent doit uniquement recevoir les observations publiques. Les solveurs, parcours témoins, états d’auteur et solutions restent réservés à la validation et exclus du bundle de production.

Valide :
- npm test et npm run validate dans experiments/sinking-star-ss10/ ;
- la parité laboratoire/dispatcher natif sur les 8 parcours actuels de tests/witnesses.json : 627 actions, 58 sélections, 1 807 images (référence de validation antérieure, non rejouée pour cette publication) et leurs durées ;
- les douze découvertes du tutoriel et la sélection ACTION6 ;
- Annuler, Reset, Restart, progression, victoire et défaite ;
- les deux corrections visuelles aux niveaux 5 et 7 ;
- les contrôles clavier/souris et les animations dans un navigateur ;
- la galerie Custom 4, sa vignette SS10 et le lien direct du jeu ;
- la non-régression des jeux déjà intégrés.

Utilise tests/custom4-native.test.ts et scripts/verify-ss08-browser.mjs comme modèles, avec scripts/native-browser-checks.mjs pour les contrôles navigateur. Actualise la galerie et les compteurs réellement concernés, puis exécute les tests et le build du projet.

Travaille sur une branche dédiée et pousse régulièrement. Termine par tests → commit → push GitHub → intégration sur main → publication du Site → vérification GitHub/Site.

À la fin, indique la branche, le commit poussé, le commit intégré, les résultats des tests, la version Site, son SHA source, l’état de synchronisation et le lien direct de SS10. Distingue les vérifications effectuées de celles bloquées par l’environnement.
```

