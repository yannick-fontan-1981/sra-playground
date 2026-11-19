# Raccordement futur au SRA Playground

Ce laboratoire est le sixième jeu prévu pour **Custom 4 · Sinking Star**. À ce stade, le catalogue de production et la publication Site ne sont pas modifiés.

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

Exécuter les tests pertinents, typage, build et non-régression de SS01–SS05. Faire un essai navigateur réel ; la validation de cette livraison est Happy DOM. Les témoins et solveurs restent des outils d’auteur et ne deviennent jamais une politique du SRA.

Terminer par tests → commit → push GitHub → intégration sur main → publication Site → vérification SHA GitHub/Site. Conserver la visibilité existante. Rapporter les commits, la version et le SHA source du Site réellement vérifiés.

