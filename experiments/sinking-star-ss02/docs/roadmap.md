# SS01–SS25 — jalon SS02 / 0.2.0

## Livré dans ce laboratoire

SS02 possède huit niveaux jouables : tutoriel original complet puis sept grilles
attribuées à Heroes of Hauling. Guerrier rouge, cellules 3×3, chaînes de pierres,
prévisualisation carrée gris clair, animation de poussée, eau, supports, boutons,
portes, Undo, Reset, navigation et VICTORY sont opérationnels.

Validation : compilation TypeScript stricte ; 53/53 tests ; huit témoins rejoués ;
373 commandes de campagne dans Chromium ; aucune erreur JavaScript ni requête HTTP.
Le HTML exact est injecté dans Chromium car la navigation `file://` était bloquée
par l'environnement. Les contrôles tactiles sont disponibles ; l'affichage 390 px
est testé sans débordement horizontal. Les témoins ne sont pas annoncés minimaux.

## Sauvegarde et intégration

Branche : `feat/ss02-warrior-lab-20261117`, base GitHub
`9e36d1998013454566dbe33198ab2b958fbcd850`.

Périmètre : `experiments/sinking-star-ss02/` uniquement. Les sources de production
et SS01 sont inchangées. Le commit de livraison est indiqué dans le compte rendu
et dans le manifeste du paquet distribué, après vérification de l'arbre distant.

Intégration canonique de SS02 : non. Publication Site de SS02 : non. Version/SHA
Site : sans objet pour cette livraison. La synchronisation du site existant n'a
pas été réévaluée. Aucun résultat autonome du SRA n'est revendiqué.

## Suite

1. Raccorder le même moteur SS02 au backend natif du Playground ; enregistrer
   SS02 comme deuxième jeu de Custom 4 ; créer les huit aperçus de galerie.
2. Rejouer SS01 et SS02 dans le vrai Playground ; vérifier les anciennes collections
   et mesurer la non-régression globale selon le seuil de +10 %, avant publication.
3. Tests → commit → push → intégration canonique → publication sur le site existant
   → vérification du commit source et de la version réellement publiée.
4. Poursuivre SS03 : Voleur vert, en réutilisant les énigmes de traction avec leur
   rôle d'origine plutôt qu'en leur donnant les règles du Guerrier.

Comptage de contenu : SS01 et SS02 ont chacun huit niveaux préparés, soit 16/200
niveaux planifiés (8 % en nombre, pas une estimation de l'effort total). SS02 reste
au stade laboratoire, contrairement à l'intégration GitHub déjà réalisée pour SS01.
