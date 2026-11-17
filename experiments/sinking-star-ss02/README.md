# SS02 — La force rouge

Laboratoire TypeScript autonome pour le Guerrier rouge de la série Sinking Star.
Huit niveaux : un tutoriel original complet, puis sept cartes issues de transcriptions
publiques de Heroes of Hauling. Aucun fichier de SS01 ou du runtime de production
n'est modifié par ce laboratoire.

## Jouer

Ouvrir `dist/SS02-demo.html` dans un navigateur. Le fichier inclut le moteur, les
cartes et l'interface, sans serveur ni dépendance réseau.

Flèches : marcher et s'orienter. Espace : pousser une pierre ou une file de pierres
d'une case. Z / Ctrl+Z : Undo. R : recommencer le niveau. Les boutons à l'écran
conviennent aussi au tactile. Le tutoriel du niveau 1 est ouvert au démarrage.

## Construire et tester

Node.js 22 ou supérieur ; TypeScript disponible dans les dépendances de développement.

```sh
npm install
npm test
npm run validate
node scripts/browser-trace.mjs
CHROMIUM_PATH=/usr/bin/chromium python scripts/verify-browser.py
```

Le dernier contrôle nécessite Python, Playwright et Chromium. Il injecte le HTML
exact dans le navigateur ; la navigation directe `file://` était bloquée par
l'environnement de réalisation. Ce point n'est pas présenté comme testé ici.
Le test de navigateur n'est pas une dépendance du jeu.

## Limites et livraison

- 53 tests automatisés réussis ; huit parcours témoins rejoués jusqu'à WIN.
- Campagne de 373 commandes vérifiée dans Chromium, avec comparaison des images.
- Les parcours sont des témoins de solvabilité, pas des solutions minimales.
- Un mauvais placement peut rendre un niveau insoluble : Undo et Reset sont disponibles.
- Les niveaux 4, 5, 6 et 8 changent le rôle original en Guerrier ; leurs solutions
  ne prétendent pas reproduire les solutions du Voleur ou du Magicien.
- Fidélité vérifiée contre les grilles textuelles attribuées, pas contre chaque
  capture du jeu commercial. Voir `docs/provenance.md`.
- Le jeu n'est pas encore enregistré comme SS02 dans le catalogue du Playground.
  Aucune publication Site, mesure globale de performance ou réussite du SRA n'est revendiquée.
