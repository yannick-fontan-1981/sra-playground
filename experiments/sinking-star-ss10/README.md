# SS10 — L’Entrepôt Réversible

**Guerrier rouge + Voleur vert · 8 niveaux · version 0.2.0**

Laboratoire autonome destiné au dixième jeu du lot Custom 4 de SRA Playground.
Le tutoriel concentre douze découvertes : marche, sélection, poussée simple et en
chaîne, traction, séparation des caisses, lâcher latéral, déplacement du miroir,
appuis dans l’eau, reflet, bouton/presse et deux destinations simultanées.

Le Guerrier pousse une file complète ; le Voleur tire une seule pièce adjacente.
Chaque niveau possède un parcours gagnant enregistré. Les six adaptations et la reprise du dernier niveau
utilisent des problèmes décrits dans les index [Nord](https://sinkingstarwalkthrough.com/fr/north/)
et [Zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/).
Les références et changements sont détaillés dans [la provenance](docs/provenance.md).

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

La livraison intègre les corrections du socle des miroirs et du circuit rose-blanc
du niveau 7, puis le déplacement de l’ancien niveau 8 au niveau 6 et la reprise
de Heroes and Water 3 en dernier niveau. L’utilisateur a demandé l’intégration
du laboratoire sur `main`. Le [prompt Codex de raccordement](docs/integration-prompt.md)
décrit l’étape suivante : enregistrer SS10 dans le catalogue natif et publier le Site. Le
raccordement natif devra conserver la parité des images, des actions, du tutoriel,
d’Annuler et de la progression. Le nom prévu est **L’Entrepôt Réversible**, code **SS10**,
collection **Custom 4**, avec huit niveaux.

Les résultats des témoins établissent la solvabilité. Les contrôles de nécessité
sont séparés et précisent quelles recherches ont réellement épuisé les états.
Aucune optimalité, solution unique ou résolution autonome du SRA n’est revendiquée.
