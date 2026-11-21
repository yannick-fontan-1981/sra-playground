# SS14 — La Traction Harmonique

Laboratoire autonome du quatorzième jeu Sinking Star : **Voleur vert + Barde magenta**. Huit salles, dont un tutoriel de **dix-sept découvertes** au niveau 1. Grille logique 20 × 20, cellules 3 × 3 pixels, observation 64 × 64 et palette de seize couleurs.

## Jouer

Construire puis ouvrir `dist/SS14-demo.html`. Ce fichier contient le jeu complet et fonctionne sans réseau.

**Version 0.1.1** : bouton violet du niveau 8 lisible sur fond gris ; commande bleue du niveau 6 séparée de la presse violette, dont le centre est noir à la fermeture et gris à l’ouverture. Les huit parcours de référence restent gagnants avec les mêmes commandes.

- **Flèches** : avancer avec le héros sélectionné. Le Voleur tire un occupant adjacent derrière lui ; le Barde entraîne les éléments proches.
- **Tab, 1, 2 ou clic sur un héros** : sélectionner le Voleur ou le Barde sans faire avancer le monde.
- **Espace / X** : activer les miroirs.
- **Z / Ctrl+Z** : annuler une action entière, y compris ses presses, changements hydrauliques et combats.
- **R** : recommencer la salle. Le sélecteur permet d’accéder aux huit niveaux.

Occuper simultanément les deux contours jaunes. Un héros arrivé reste sélectionnable.

## Le problème propre au duo

Le Voleur tire une seule caisse, un seul miroir, monstre ou partenaire. Un départ perpendiculaire lui permet de laisser sa prise en place. Le Barde entraîne caisses, monstres, appuis immergés et Voleur dans un carré de 5 × 5 cases, sans entraîner les miroirs. Les obstacles retiennent certains membres du groupe ; ils permettent de modifier leurs écarts.

Un **Barde tiré ne chante pas**. Un **Voleur entraîné par le chant ne tire pas**. Cette distinction permet de quitter une commande sans enlever son poids, de libérer un partenaire et de préserver un appui pendant le transfert des deux héros.

Le premier atelier enseigne ces règles et leurs interactions avec l’eau, les miroirs, les commandes, les presses et les monstres. Les dix-sept découvertes sont reconnues depuis les images publiques ; aucune séquence de commandes n’est imposée. Annuler conserve les découvertes ; recommencer les efface.

## Adaptations

Les sources demandées sont [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/). Les salles réemploient des contraintes précises de Heroes 3, Heroes and Water, Heroes and Mirrors et Heroes and Light. Les cartes sont redessinées pour SS14.

Les crédits figurent dans l’interface. `docs/source-audit.md`, `docs/level-design.md` et `reference/levelN-design.json` distinguent les principes conservés des changements. Le chant carré et l’ancrage des appuis suivent le contrat de la série SS ; les cartes ne sont pas présentées comme des reproductions exactes du jeu commercial.

## Reconstruire et vérifier

```sh
npm install
npm test
npm run validate
node scripts/verify-design-constraints.mjs
node scripts/verify-ui-dom.mjs
```

Le dernier script requiert Happy DOM, indiqué au besoin par `HAPPY_DOM_MODULE`. `docs/validation.md` décrit les résultats et les limites de la vérification visuelle.

Après modification d’une salle, exécuter `node reference/author/build-levelN.mjs`, puis `node scripts/sync-levels.mjs` et reconstruire. Les scripts d’auteur utilisent le moteur du jeu. Leurs routes prouvent la solvabilité des cartes ; elles ne sont ni une solution minimale ni un résultat autonome de SRA.

Le build n’embarque aucun solveur, témoin ou état sémantique privé dans l’observation publique. Aucun chemin partagé du catalogue ou du runtime SRA n’est modifié par ce laboratoire.

## Intégration

`docs/codex-integration-prompt.md` contient la mission de raccordement à **Custom 4**, de vérification dans un navigateur et de publication du Site SRA Playground existant. `docs/roadmap.md` sépare l’état du laboratoire de ces étapes.
