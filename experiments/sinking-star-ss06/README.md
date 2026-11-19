# SS06 — Les Ponts Réfléchis

Version **0.1.2** — laboratoire autonome du sixième jeu Sinking Star, pour le futur lot Custom 4 de SRA Playground.

Le Marchand orange et le Guerrier rouge doivent occuper **deux destinations en même temps**. Le Marchand pousse une pièce ; le Guerrier pousse toute une file. Les deux peuvent déclencher les miroirs. Le changement de personnage ne fait pas avancer le monde.

## Jouer

Ouvrir `dist/SS06-demo.html`, produit par la compilation. Le fichier distribué s’appelle **SS06-demo-v3.html**. Il contient tout le jeu et fonctionne hors ligne. Le niveau 1 et son tutoriel sont ouverts au démarrage ; les huit salles sont sélectionnables.

| Commande | Effet |
|---|---|
| Flèches | Marcher ou pousser dans la direction |
| Espace / X / Reflet | Activer les miroirs |
| Clic sur un héros, Tab, 1 / 2, boutons de rôle | Sélectionner le personnage |
| Z | Annuler la dernière action, y compris pendant une animation |
| R | Recommencer la salle |
| Retour au tutoriel | Effacer la progression et reprendre au niveau 1 |

Les cellules logiques mesurent 3 × 3 pixels dans une image 64 × 64. Les personnages sont des + orange / rouge ; les destinations sont des contours jaunes. Le point blanc indique le personnage sélectionné et sa direction.

## Huit salles

1. **L’atelier des deux rives** — huit apprentissages observables, vraie poussée en file indispensable, quatre caisses utiles, pont et presse distante.
2. **Le pacte des deux îlots** — boutons croisés, miroir et caisse poussés ensemble, départ simultané.
3. **Les deux rideaux** — deux barrières de polarités opposées commandées par une caisse et un miroir mobile.
4. **Le ponton chargé** — longue file de caisses, déplacement du miroir et construction d’appuis par reflet.
5. **La caisse de l’écluse** — la presse pousse la caisse vers le bas dans l’eau pour former un appui ; le circuit rouvre ensuite le passage.
6. **La diagonale des sentinelles** — deux alignements font disparaître quatre monstres ; deux reflets de caisses construisent l’accès final.
7. **L’écluse à revers** — un appui donne accès au dos du miroir ; une presse provoque un combat et libère le passage.
8. **Le rendez-vous des deux ponts** — ateliers séparés, deux presses, trois boutons et départ commun.

Les références et adaptations sont détaillées dans [docs/provenance.md](docs/provenance.md). Il s’agit de cinq adaptations déclarées et trois créations originales.

## Développement et validation

Node 22 ou ultérieur, TypeScript 5.9.3.

```bash
npm install
npm test
npm run validate
node scripts/validate-levels.mjs --mechanisms
HAPPY_DOM_MODULE=/chemin/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

Résultats dans `validation/` : **43 tests de règles**, **14 contrôles de l’HTML**, **413 actions / 1 269 images**, 19 sélections, huit salles résolues et deux routes de défaite. Les témoins prouvent la solvabilité ; ils ne sont ni annoncés optimaux ni produits par le SRA.

Le navigateur Chromium de l’exécuteur n’a pas pu démarrer (création de socket refusée). Les contrôles d’interface exécutent l’HTML réel sous Happy DOM et comparent le buffer canvas et les durées. Une planche de contrôle des images initiales a été inspectée séparément.

## Architecture

- `src/core.ts` : moteur pur, rendu et `DuoPuzzleSession`.
- `src/levels.ts` : huit cartes.
- `src/level-info.ts` : références publiques de chaque salle.
- `src/browser.ts` / `index.template.html` : interface et tutoriel fondé sur les pixels.
- `scripts/solver.mjs`, `tests/witnesses.json`, `reference/` : outils d’auteur, exclus du bundle jouable.
- [docs/integration.md](docs/integration.md) : contrat pour le raccordement futur au Playground.

La sauvegarde de ce laboratoire sur une branche GitHub ne l’enregistre pas dans le catalogue du site.

