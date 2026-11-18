# SS02 — La force rouge

Laboratoire TypeScript autonome pour le Guerrier rouge de la série Sinking Star.
Huit niveaux : un tutoriel original complet, deux cartes issues de transcriptions
publiques de Heroes of Hauling et cinq nouvelles énigmes aquatiques originales. Aucun fichier de SS01 ou du runtime de production
n'est modifié par ce laboratoire.

## Jouer

Ouvrir `dist/SS02-demo.html` dans un navigateur. Le fichier inclut le moteur, les
cartes et l'interface, sans serveur ni dépendance réseau.

Flèches : marcher et pousser une pierre ou une file de pierres d'une case dans
la direction choisie. La poussée est immédiate, sans prévisualisation ni commande
séparée. Z / Ctrl+Z : Undo. R : recommencer le niveau. Les boutons à l'écran
conviennent aussi au tactile. Le tutoriel du niveau 1 est ouvert au démarrage.
Chaque poussée avance de 1, 2 puis 3 pixels sur trois images ; aucun clignotement.

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
exact dans le navigateur. Pour cette révision, l'environnement interdit la création
du socket nécessaire au démarrage de Chromium : le contrôle navigateur est bloqué,
comme l'indique `validation/browser-report.json`. Le test de navigateur n'est pas
une dépendance du jeu.

La logique de l'interface est aussi vérifiable sans navigateur via
`scripts/verify-ui-dom.mjs` et Happy DOM installé séparément. Définir
`HAPPY_DOM_MODULE` vers son module `lib/index.js`, puis exécuter le script avec Node.
Le résultat figure dans `validation/ui-dom-report.json` ; ce contrôle des événements
et du buffer Canvas ne remplace pas une vérification visuelle dans un navigateur.

## Limites et livraison

- Les validations du moteur, des huit parcours témoins et du navigateur sont
  consignées dans `validation/`. Les parcours utilisent uniquement les quatre directions.
- Les parcours sont des témoins de solvabilité, pas des solutions minimales.
- Un mauvais placement peut rendre un niveau insoluble : Undo et Reset sont disponibles.
- L’ancien niveau 3 devient le niveau 2. Les niveaux 3, 4, 5, 6 et 8 sont
  reconstruits avec de nouvelles géométries, des plateformes et des accès latéraux.
- Fidélité vérifiée contre les grilles textuelles attribuées, pas contre chaque
  capture du jeu commercial. Voir `docs/provenance.md`.
- Le jeu n'est pas encore enregistré comme SS02 dans le catalogue du Playground.
  Aucune publication Site, mesure globale de performance ou réussite du SRA n'est revendiquée.
