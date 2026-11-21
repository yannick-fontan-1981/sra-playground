# SS12 — La Colonne en Marche

Laboratoire autonome du douzième jeu Sinking Star : **Guerrier rouge + Barde magenta**. Huit salles, dont un tutoriel de **treize découvertes** au niveau 1. Grille logique 20 × 20, cellules 3 × 3 pixels, observation 64 × 64 et palette de seize couleurs.

## Jouer

Ouvrir `dist/SS12-demo.html` après construction. Le fichier est autonome et fonctionne sans réseau.

- **Flèches** : le Guerrier marche ou pousse une file entière ; le Barde marche et entraîne les éléments proches.
- **Tab, 1, 2 ou clic sur un héros** : sélectionner sans faire avancer le monde.
- **Espace / X** : activer les miroirs, sans chant.
- **Z / Ctrl+Z** : annuler toute l’action et ses cascades.
- **R** : recommencer la salle. Le sélecteur donne accès aux huit niveaux.

Les deux contours jaunes doivent être occupés simultanément. Un héros arrivé reste sélectionnable.

## Ce que le duo apprend

Le Guerrier prépare les files, les ponts et les axes des miroirs. Le Barde guide les caisses, monstres, appuis immergés et son partenaire dans son aura carrée de 5 × 5 cases. Les pièces retenues restent en place. Le Guerrier entraîné ne pousse pas une deuxième file ; le Barde poussé, reflété ou déplacé par une presse ne chante pas.

Le tutoriel **La répétition des deux rives** commence sur deux ateliers séparés. Réunir les rives, conserver une commande, régler le miroir et rejoindre l’îlot final mobilisent les capacités du duo. Les treize coches sont déduites des images publiques, pas d’un itinéraire imposé. Elles persistent après Annuler ; Recommencer les efface.

## Adaptations et sources

Les références proviennent de [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/). Les cartes sont redessinées pour les règles de la série SS. Les références, contraintes conservées et changements sont documentés dans `docs/level-design.md` et `reference/levelN-design.json` ; chaque salle présente également son lien dans l’interface.

Le chant carré, l’ancrage des appuis occupés et les règles de miroirs sont ceux de la série SS. Les adaptations ne sont pas annoncées comme des reproductions exactes du jeu commercial.

## Reconstruire et vérifier

```sh
npm install
npm run build
npm test
npm run validate
```

Le build compile uniquement les modules jouables. Il ne lance aucune recherche et n’embarque ni solveur, ni route d’auteur.

Après modification d’une salle, exécuter son `reference/author/build-levelN.mjs`, puis `node scripts/sync-levels.mjs` et reconstruire. Les scripts d’auteur emploient le même moteur que le jeu. Les témoins prouvent la solvabilité ; ils ne constituent pas un résultat de l’agent SRA.

Les contrôles complémentaires d’interface sont dans `scripts/verify-ui-dom.mjs` et `scripts/verify-ui-browser.mjs`. Ils demandent respectivement Happy DOM et Playwright/Chromium ; voir `docs/validation.md` pour les commandes et les résultats.

## Intégration

Ce dossier constitue le laboratoire HTML. `docs/codex-integration-prompt.md` décrit le raccordement au catalogue natif, aux contrôles et à la publication du Playground. Aucun code du catalogue ou du runtime SRA n’est modifié par le laboratoire.
