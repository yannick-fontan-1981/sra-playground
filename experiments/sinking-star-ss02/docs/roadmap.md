# SS01–SS25 — jalon SS02 / 0.4.0

## Livré dans ce laboratoire

SS02 possède huit niveaux jouables : tutoriel original, deux grilles attribuées à
Heroes of Hauling et cinq nouvelles énigmes aquatiques. L’ancien niveau 3 devient
le niveau 2 ; les niveaux 3, 4, 5, 6 et 8 sont reconstruits. Guerrier rouge, cellules 3×3, chaînes de pierres,
poussée directement avec les flèches, mouvement en trois images (1/2/3 pixels),
eau, supports, boutons,
portes, Undo, Reset, navigation et VICTORY sont opérationnels. La poussée n’affiche
aucune prévisualisation et ne demande plus de commande Espace.

Validation : les résultats actualisés de compilation TypeScript, des tests du
moteur, des huit témoins, de la nécessité de l’eau et de l’interface DOM figurent
dans `validation/`. Le contrôle Chromium est indisponible dans cet environnement.
Les témoins utilisent uniquement les directions et ne sont pas annoncés minimaux.

## Sauvegarde et intégration

Branche : `feat/ss02-warrior-lab-20261117`, base GitHub
`9e36d1998013454566dbe33198ab2b958fbcd850`.

Périmètre : `experiments/sinking-star-ss02/` uniquement. Les sources de production
et SS01 sont inchangées. Le commit de livraison est indiqué dans le compte rendu
après vérification de l'arbre distant.

Intégration de SS02 au catalogue et au runtime : non. Publication Site de SS02 : non. Version/SHA
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
au stade laboratoire ; SS01 dispose déjà d'un raccordement au runtime du Playground.

La présence de ce dossier sur `main` sauvegarde les sources validées du laboratoire.
Elle ne rend pas encore SS02 sélectionnable dans Custom 4 : le raccordement du
backend, des commandes, du tutoriel et de la galerie constitue l'étape suivante.
