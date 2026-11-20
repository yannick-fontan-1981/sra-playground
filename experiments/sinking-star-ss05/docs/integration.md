# Intégration de SS05 dans Custom 4

SS05 — Le Chant Magenta est le cinquième jeu de Custom 4. Le Playground importe le moteur et les huit cartes de la version 0.1.2. L’interface partage avec la démo le tutoriel fondé sur les pixels et utilise les crédits de chaque salle.

## Contrat à réutiliser

Importer directement `BardPuzzleSession` depuis `src/core.ts` et `SS05_LEVELS` depuis `src/levels.ts`. Réutiliser `LEVEL_INFO` pour les crédits. Ne pas réécrire le moteur ou les cartes dans un second fichier. SS05 est le cinquième jeu Sinking Star du lot Custom 4, après SS01 à SS04.

Les commandes sont ACTION1–4 pour les flèches et ACTION5 pour les miroirs. Ne pas classer SS05 dans une restriction générique aux quatre directions. La barre d’espace, la touche X et le bouton Reflet doivent envoyer ACTION5 ; le chant accompagne chaque déplacement et ne nécessite pas d’action spéciale. L’action5 ne déclenche jamais le chant.

Le rendu est exactement 64 × 64, avec cellules 3 × 3 et la palette historique. Toutes les images et leurs durées doivent être présentées : une action peut contenir plusieurs animations de trois images, un combat de cinq images et un éventuel changement de niveau. Après un coup mortel, le panneau GAME_OVER attend impérativement la fin du combat. Les prévisualisations de reflet (+ gris clair pour le Barde, contour carré gris clair pour une caisse) et l’aura en pointillés magenta sont déjà dans les pixels du moteur. Ne pas ajouter d’overlay qui révèle une cible, une solution ou un état caché.

La session conserve `undo`, `reset`, `restart`, `selectLevel`. Le catalogue doit proposer huit niveaux. La victoire exige les huit ; après une résolution, la session charge le premier inachevé. Le niveau 1 est chargé par défaut et son tutoriel doit être ouvert. Les six leçons et la légende peuvent être reprises de l’HTML ; toute reconnaissance reste fondée sur les observations publiques.

Bloquer les commandes lorsque l’état est WIN ou GAME_OVER, même si les identifiants 1–5 figurent encore dans `availableActionIds`. Afficher les panneaux terminaux après la dernière image. Annulation, changement de niveau et réinitialisation doivent invalider les anciennes animations. La chute reflétée de L6 (`RRRX`) vérifie le panneau de défaite, Undo et Reset.

## Vérification lors du raccordement

Comparer les observations du backend de production et de la session d’auteur sur les 395 actions témoins, y compris chaque frame, durée, statut et transition. Vérifier notamment les neuf images de la cascade L8, action 20, le transport des appuis de L7, la restauration après WIN/GAME_OVER et le mode de sélection hors ordre. Exécuter la non-régression des jeux Custom 4 existants et un essai dans le navigateur du site.

Le solveur et les parcours de `tests/` servent uniquement à la validation. Ils ne sont jamais livrés à l’agent et ne constituent pas une politique spécifique au jeu. Aucun changement de stratégie SRA n’est requis par ce laboratoire.

Conserver les travaux concurrents. Toute future publication suit les règles du dépôt : tests, commit, push, intégration sur main, publication du Site, puis vérification des SHA GitHub et Site. Enregistrer séparément la présence des sources sur main et la présence effective du jeu dans le catalogue publié.

## Vérifications du raccordement

- Les 31 tests du laboratoire, la validation des huit niveaux et les 14 contrôles Happy DOM passent. Le build de production génère 105 jeux et 676 aperçus. Les 22 tests natifs couvrent notamment la parité des 395 actions et des 1 222 images de SS05, les chargements directs, la victoire hors ordre et les commandes après WIN ou GAME_OVER.
- Chromium a vérifié les six leçons du tutoriel, Espace sans défilement, X et le bouton Reflet. Les captures du canvas concordent avec le moteur pour l’élimination mutuelle des monstres et le combat mortel de L3, le déplacement d’un appui de L7 et les neuf images de la cascade de L8.
- Undo, Reset, Restart et le changement de niveau ont été exercés pendant l’attaque de L3. Le panneau de défaite apparaît après le dernier rendu. Le reflet mortel de L6, puis Undo et Reset, passent avec les trois commandes de reflet.
- La campagne Chromium se termine en 395 actions avec le niveau 1 résolu en dernier. Une commande du mode agent atteint le backend natif. Aucune requête Python n’est déclenchée lors du chargement des jeux natifs.
- Les campagnes SS01 à SS04 terminent dans Chromium. CASC et LS20 se chargent et répondent aux commandes. Les 40 tuiles de Custom 4 correspondent aux observations initiales des cinq moteurs. La galerie ouvre SS05 au niveau choisi et le Playground a été contrôlé à 390 px de large.
