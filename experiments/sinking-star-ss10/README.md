# SS10 — L’Entrepôt Réversible

**Guerrier rouge + Voleur vert · 8 niveaux · version 0.3.1**

Laboratoire autonome du dixième jeu du lot Custom 4. [Jouer à SS10 dans le Playground](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS10#playground)
Le tutoriel concentre douze découvertes : marche, sélection, poussée simple et en
chaîne, traction, séparation des caisses, lâcher latéral, déplacement du miroir,
appuis dans l’eau, reflet, bouton/presse et deux destinations simultanées.

Le Guerrier pousse une file complète ; le Voleur tire une seule pièce adjacente.
Chaque niveau possède un parcours gagnant enregistré. Les six adaptations reprennent des principes décrits dans les index [Nord](https://sinkingstarwalkthrough.com/fr/north/)
et [Zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/).
La finale reprend la carte de Heroes and Water, énigme 3, conservée dans `reference/author/build-level8.mjs`, avec cinq caisses à transformer en appuis. Les références sont détaillées dans [la provenance](docs/provenance.md).

## Jouer

Construire puis ouvrir `dist/SS10-demo.html` dans un navigateur. Ce fichier contient
le moteur, les huit cartes, l’interface et la palette ; jouer ne demande aucun accès
réseau. Le premier niveau est chargé avec le tutoriel ouvert.

- Flèches : marcher, pousser avec le Guerrier ou tirer avec le Voleur.
- Espace / X : activer les miroirs.
- Clic sur un héros, Tab dans la grille, 1 / 2 ou boutons : sélectionner.
- Z : Annuler. R : recommencer la salle. Retour au tutoriel : reprendre au niveau 1.
- Le sélecteur permet d’essayer chaque salle directement.

Les cellules logiques mesurent 3 × 3 pixels. Le rendu 64 × 64 est agrandi sans lissage.
La poussée n’a pas de prévisualisation ; le reflet conserve le + gris clair pour un
héros et le contour carré gris clair pour une caisse. Les règles détaillées sont dans
[la spécification](docs/specification.md).

## Construction et validation

```sh
npm ci
npm run build
npm test
npm run validate

# Contrôles d’interface optionnels
npm install --no-save happy-dom playwright
node scripts/verify-ui-dom.mjs
node scripts/verify-browser.mjs
```

`HAPPY_DOM_MODULE`, `PLAYWRIGHT_MODULE` et `CHROMIUM_EXECUTABLE` permettent d’indiquer les outils de
navigation locaux au script de vérification. Les résultats sont consignés dans
`validation/`. Le solveur et les témoins sont réservés à l’auteur et ne sont jamais
inclus dans le HTML jouable.

Après modification d’un fichier `reference/levelN-design.json`, exécuter
`node scripts/sync-levels.mjs`, puis les validations. Les scripts de construction
reproductible des cartes sont conservés dans `reference/author/`.

## Intégration

Le Playground utilise le même moteur TypeScript et les mêmes cartes, avec le Guerrier en rôle 1 et le Voleur en rôle 2. Le tutoriel du Site partage les lecteurs de pixels du HTML autonome. Les [notes de validation](docs/validation.md) distinguent les contrôles antérieurs de cette publication.

Les résultats des témoins établissent la solvabilité. Les contrôles de nécessité
sont séparés et précisent quelles recherches ont réellement épuisé les états.
Aucune optimalité, solution unique ou résolution autonome du SRA n’est revendiquée.
