# SS07 — La Distance Dérobée

Version **0.1.1 · HTML v2**. Laboratoire autonome du septième jeu de la série Sinking Star, destiné au lot **Custom 4** de SRA Playground.

Le **Marchand orange pousse une pièce**. Le **Voleur vert tire la pièce immédiatement derrière lui lorsqu’il marche vers une case libre**. Changer de côté, laisser un objet sur un bouton et quitter son axe par reflet sont au cœur des huit salles. Les deux personnages doivent occuper les **deux destinations en même temps**.

**Reflets corrigés en v2 :** chaque miroir ne téléporte que l’élément le plus proche parmi ses deux axes. L’élément plus éloigné reste immobile et une arrivée bloquée pour lui n’empêche pas le plus proche de passer. À distance égale, les deux éléments échangent leurs places. La prévisualisation suit la même règle.

## Jouer

Ouvrir `dist/SS07-demo.html`, produit par la compilation. Le fichier de livraison s’appelle **SS07-demo-v2.html** : il contient le jeu complet et fonctionne hors ligne. Le niveau 1 démarre avec son tutoriel ouvert ; les huit niveaux sont accessibles depuis le sélecteur.

| Commande | Effet |
|---|---|
| Flèches | Marcher ; pousser avec le Marchand ou tirer avec le Voleur |
| Espace / X / bouton Reflet | Activer les miroirs |
| Clic sur un héros, Tab dans la grille, 1 / 2, boutons de rôle | Sélectionner le Marchand ou le Voleur |
| Z | Annuler l’action précédente et ses effets en cascade, y compris pendant une animation |
| R | Recommencer la salle |
| Retour au tutoriel | Recommencer la campagne au niveau 1 |

La sélection ne fait avancer ni les portes ni les monstres. Un départ par miroir ou un déplacement imposé par une presse ne provoque aucune traction supplémentaire.

## Huit salles distinctes

| Niveau | Salle | Problème central |
|---|---|---|
| 1 | **L’atelier du pas de côté** | Neuf apprentissages : extraction, poussée, deux appuis, presse latérale, déplacement du miroir et arrivée du duo. |
| 2 | **Les lacunes du miroir** | Tirer un miroir entre les trous, se dégager par reflet et préparer le dernier accès avec le Marchand. |
| 3 | **Partir sans reprendre** | Un miroir maintient un bouton ; l’autre permet au Voleur de partir sans le reprendre. Les héros se libèrent mutuellement. |
| 4 | **Les quatre appuis** | Quatre caisses, cinq îlots et plusieurs changements d’axe du miroir pour construire les traversées. |
| 5 | **La presse des deux rives** | Une presse libère une file de deux caisses ; le Voleur récupère le miroir pendant que le Marchand construit le pont. |
| 6 | **Le poids de la sentinelle** | Déposer le monstre sur un bouton éloigné, puis combiner traction et poussée dans un virage étroit. |
| 7 | **La forteresse des deux sceaux** | Deux circuits, une presse, un combat mutuel et une relève temporaire sur un bouton pendant le reflet du Voleur. |
| 8 | **Le pont qu’on ne rend pas** | Tenir un pont provisoire, récupérer la troisième caisse, puis transformer trois plateformes rétractables en appuis permanents. |

Cinq salles sont des adaptations déclarées du guide, trois sont des créations originales. Les sources et les différences sont précisées dans [la provenance](docs/provenance.md).

## Repères visuels

La grille comporte **20 × 20 cellules de 3 × 3 pixels**, dans une image **64 × 64** agrandie sans lissage. Le point blanc désigne le héros sélectionné et sa direction. Les destinations sont des contours jaunes. La prévisualisation de reflet d’un héros est un **+ gris clair** ; celle d’une caisse est un **contour carré gris clair**. Les déplacements ordinaires n’ont pas de prévisualisation.

Une caisse immergée devient un appui fixe marron avec **X cyan**. Au niveau 8, un carré rose plein représente une plateforme déployée et les coins roses sur l’eau une plateforme rétractée. Le centre indique son circuit. Les trois plateformes reçoivent chacune une caisse avant leur retrait ; les deux appuis déjà présents conduisent ensuite au miroir final.

## Développer et vérifier

Node 22 ou ultérieur, TypeScript 5.9.3.

```bash
npm install
npm test
npm run validate
HAPPY_DOM_MODULE=/chemin/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

La livraison comporte **73 tests de règles**, **596 actions / 1 754 images** dans les huit parcours de validation et **15 contrôles de l’HTML**. Les résultats détaillés sont dans `validation/`. Les parcours sont déterministes et sans action bloquée ni décès ; ils établissent la solvabilité, sans annoncer une solution optimale ni une résolution autonome par le SRA.

Le tutoriel fait l’objet de contrôles distincts : supprimer les poussées du Marchand, les tractions du Voleur, les presses ou la création d’appuis rend sa résolution impossible dans les recherches terminées. Le reflet est nécessaire par la géométrie : tout trajet terrestre optimiste exige au moins trois cases d’eau, alors que deux caisses seulement peuvent produire des appuis. La limite atteinte par une recherche sans reflets n’est pas utilisée comme preuve d’impossibilité.

## Organisation et suite

- `src/core.ts` : règles, rendu et `DuoPuzzleSession`.
- `src/levels.ts` et `src/level-info.ts` : huit cartes et références publiques.
- `src/browser.ts` et `index.template.html` : interface, animations et tutoriel fondé sur les pixels publics.
- `reference/levelN-design.json`, `tests/witnesses.json` et `scripts/solver.mjs` : conception et validation, exclues du jeu distribué.
- [Spécification](docs/specification.md), [conception des niveaux](docs/level-design.md), [intégration](docs/integration.md), [feuille de route](docs/roadmap.md).

Branche de travail : `feat/ss07-duo-lab-20261119`. Cette version est un laboratoire à valider en HTML. Le passage sur `main`, l’ajout au catalogue SRA Playground et la publication du site sont des étapes ultérieures.
