# Raccordement de SS06 au SRA Playground

**Les Ponts Réfléchis** est le sixième jeu de **Custom 4 · Sinking Star**, après SS05. Le raccordement utilise le laboratoire 0.2.1 / HTML v5, introduit sur `main` par `e90c2ac451e46b8bb9dd5fd63ea2cc799cced9b3` depuis la source `303d3cf2080dc98da3650f2c7171620288bd83e0`.

- Le catalogue, le sélecteur, les liens directs et la galerie proposent les huit niveaux. La galerie génère ses aperçus à partir des observations initiales et affiche l’attribution Steam commune de Custom 4, également présente sous le plateau.
- L’adaptateur TypeScript importe le moteur et la campagne du laboratoire et relaie les coordonnées d’ACTION6. Le routeur charge SS06 sans Python.
- Les commandes de rôle, les huit acquis du tutoriel et leurs aides réutilisent les pixels publics. Le tutoriel partagé compile également dans l’HTML autonome. En duo, les deux contours jaunes doivent être occupés. La dernière salle utilise le Guerrier seul.
- Le mode agent reçoit la même observation publique et les six actions. Les cartes, les témoins et le solveur d’auteur restent hors de son interface de raisonnement.

## Backend

Importer directement `DuoPuzzleSession` et `SS06_LEVELS` version **0.2.1 / HTML v5** dans un adaptateur natif SS06. Conserver le moteur unique, les six commandes, tous les pixels et les durées. Lire le main actuel et AGENTS.md avant de choisir les fichiers d’intégration ; SS01 fournit un précédent pour la sélection ACTION6 et les jeux SS suivants pour les animations/circuits.

`action(id,data?)` reçoit les coordonnées de pixel pour ACTION6. Relayer observe, undo, reset, restart et selectLevel. Construire et valider une session avant de remplacer la session active. Aucun Python n’est requis pour SS06.

Préserver `LevelSpec.mode` : les niveaux 1–7 sont des duos par défaut ; L8 déclare `solo-warrior`, avec un Guerrier rouge et une seule cible. Le constructeur impose le contrat de chaque mode. Ne pas ajouter de second héros pour satisfaire une hypothèse de l’adaptateur. Le nom `DuoPuzzleSession` reste compatible avec cette campagne mixte.

## Interface

Charger le niveau 1 en mode manuel avec le tutoriel déplié. Les huit salles restent sélectionnables. Les directions poussent directement, sans Espace. Espace/X active ACTION5. Clic/Tab/1/2/boutons sélectionnent via ACTION6. Le personnage actif est reconnu par le point blanc dans son sprite public.

Au niveau 8, afficher uniquement le Guerrier présent et annoncer une cible. La sélection du seul héros et `nextHero()` restent sans effet, sans tour ni historique Undo supplémentaire. Déduire les personnages présents des pixels publics, comme les autres aides de l’interface.

Ne pas ajouter SS06 à un prédicat qui désactive ACTION5 ou ACTION6. Séparer les responsabilités mode manuel, annulation d’animation, combat et commandes disponibles. Préserver les deux contrôles spéciaux.

Les helpers pédagogiques de browser.ts lisent les pixels publics. Extraire des fonctions pures si le Playground les partage ; ne pas importer le module DOM complet. Mettre à jour le bundler autonome si un module est extrait.

## Présentation

Respecter les cellules 3×3, les + orange/rouge, les contours jaunes et la sélection. Le reflet d’un héros est un + gris clair, celui d’une caisse un contour carré gris clair. Les miroirs sont mobiles ; les appuis immergés sont fixes.

Les sept portes-plateformes du niveau 8 sont déjà gérées dans le moteur : quatre vertes, trois violettes, aucune porte-presse. Conserver leurs pixels et leur phase `platform` de trois images. Aucun nouvel identifiant d’action ni état sémantique public n’est nécessaire. Reprendre l’aide contextuelle et les deux symboles rose plein / cadre sur eau. Les deux miroirs de la salle de droite réalisent le verrou vert par obstruction physique d’un rayon ; aucun retard automatique au premier reflet ni règle spéciale d’horloge n’est ajouté.

Conserver toutes les images et toutes les durées. Les mouvements ont 3 images, les combats 5 et les cascades combinent les phases. Le statut logique terminal arrive avant la fin visuelle : attendre la dernière image pour afficher les panneaux. Interdire les actions manuelles et de l’agent pendant l’animation et après un terminal. Undo/Reset/Restart/sélection de niveau invalident les anciens callbacks.

## Validation et livraison

Rejouer les huit témoins via le routeur natif de production, comparer observations/images/durées/transitions et vérifier l’absence de chargement Python. Les parcours totalisent 433 actions et 17 sélections ; L8 comporte 61 actions sans sélection. Couvrir les six commandes, les décès L6 et la rétraction mortelle L8, Undo pendant le combat, les départs conjoints L2/L5, la transition duo → solo et son annulation, la progression hors ordre et les huit acquis du tutoriel.

Le build du Playground vérifie le typage et régénère la galerie. Les 28 tests Custom 4 couvrent le routeur et SS01–SS06. Pour SS06, ils comparent les 433 actions, dont 17 sélections, et les 1 338 images des huit témoins avec les observations et durées du moteur. Les 61 actions de L8 comprennent trois reflets et zéro sélection, avec le vert à `111` et le violet à `101`. Les tests couvrent aussi les trois défaites, Undo et la progression hors ordre.

Les 55 tests du moteur et les 15 contrôles Happy DOM de l’HTML autonome passent. L’essai Chromium, dans `scripts/verify-ss06-browser.mjs`, vérifie le tutoriel, les rôles, les quatre façons d’interrompre une animation, le dernier rendu avant le panneau de défaite, le niveau 8, la galerie et le lien de lancement. Après un build et un aperçu Vite sur le port 4174, exécuter `node scripts/verify-ss06-browser.mjs` avec Playwright, ou définir `PLAYWRIGHT_MODULE` vers une installation compatible.

Le rejeu vérifie la solvabilité et la parité du portage. Il ne mesure pas la réussite autonome d’une campagne par le SRA.

La version Site et son SHA source sont relevés après publication et comparés au commit intégré sur `main`, conformément à la [politique de synchronisation](../../../docs/migration/git-site-sync-policy.md). Le [site existant](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS06#playground) conserve ses paramètres d’accès.

