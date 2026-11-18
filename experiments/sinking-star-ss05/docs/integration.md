# Préparation de l’intégration SS05

Le laboratoire est autonome. Son intégration dans le catalogue Custom 4 et le site relève d’une étape distincte après essai du HTML.

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
