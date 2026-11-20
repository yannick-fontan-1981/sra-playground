# SS06 — Les Ponts Réfléchis

Version **0.2.1** — laboratoire autonome de **Les Ponts Réfléchis**, sixième jeu du lot Custom 4 de SRA Playground.

Dans les niveaux 1 à 7, le Marchand orange et le Guerrier rouge doivent occuper **deux destinations en même temps**. Le Marchand pousse une pièce ; le Guerrier pousse toute une file. Les deux peuvent déclencher les miroirs. Le changement de personnage ne fait pas avancer le monde. Le niveau 8 se joue avec **le Guerrier seul et une cible** : ses deux miroirs de droite permettent de maintenir le circuit vert pendant la traversée.

## Jouer

Ouvrir `dist/SS06-demo.html`, produit par la compilation. Le fichier distribué s’appelle **SS06-demo-v5.html**. Il contient tout le jeu et fonctionne hors ligne. Le niveau 1 et son tutoriel sont ouverts au démarrage ; les huit salles sont sélectionnables.

| Commande | Effet |
|---|---|
| Flèches | Marcher ou pousser dans la direction |
| Espace / X / Reflet | Activer les miroirs |
| Clic sur un héros, Tab, 1 / 2, boutons de rôle | Sélectionner le personnage |
| Z | Annuler la dernière action, y compris pendant une animation |
| R | Recommencer la salle |
| Retour au tutoriel | Effacer la progression et reprendre au niveau 1 |

Au niveau 8, le Guerrier rouge est le seul personnage. La sélection de personnage ne consomme aucun tour et n’ajoute aucune entrée Undo dans cette salle.

Les cellules logiques mesurent 3 × 3 pixels dans une image 64 × 64. Les personnages sont des + orange / rouge ; les destinations sont des contours jaunes. Le point blanc indique le personnage sélectionné et sa direction.

## Huit salles

1. **L’atelier des deux rives** — huit apprentissages observables, vraie poussée en file indispensable, quatre caisses utiles, pont et presse distante.
2. **Le pacte des deux îlots** — boutons croisés, miroir et caisse poussés ensemble, départ simultané.
3. **Les deux rideaux** — deux barrières de polarités opposées commandées par une caisse et un miroir mobile.
4. **Le ponton chargé** — longue file de caisses, déplacement du miroir et construction d’appuis par reflet.
5. **Le rendez-vous des deux ponts** — ancien niveau 8 : ateliers séparés, deux presses, trois boutons et départ commun.
6. **La diagonale des sentinelles** — deux alignements font disparaître quatre monstres ; deux reflets de caisses construisent l’accès final.
7. **L’écluse à revers** — un appui donne accès au dos du miroir ; une presse provoque un combat et libère le passage.
8. **Le verrou vert** — adaptation de Heroes and Mirrors 20 : placer un second miroir dans la salle de droite pour garder les quatre plateformes vertes actives, puis alterner les trois plateformes violettes avec un seul Guerrier.

Les références et adaptations sont détaillées dans [docs/provenance.md](docs/provenance.md). Il s’agit de cinq adaptations déclarées et trois créations originales.

## Portes-plateformes

Un carré rose plein porte les personnages ; les coins roses entourant de l’eau signalent une plateforme rétractée. Le point central reprend la couleur du bouton associé. Les plateformes peuvent apparaître ou disparaître après une action : il faut se placer sur un appui qui restera actif avant une bascule. Une caisse sur une plateforme rétractée devient un appui fixe brun avec X cyan. L’aide dédiée s’affiche au niveau 8, qui contient sept plateformes et aucune porte-presse.

## Développement et validation

Node 22 ou ultérieur, TypeScript 5.9.3.

```bash
npm install
npm test
npm run validate
node scripts/validate-levels.mjs --mechanisms
HAPPY_DOM_MODULE=/chemin/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

Résultats dans `validation/` : **55 tests de règles**, **15 contrôles de l’HTML**, **433 actions / 1 338 images**, 17 sélections et huit salles résolues. Les niveaux 1 à 7 conservent leurs cartes et témoins. Les empreintes d’observations des huit anciennes cartes ont également été comparées au moteur v4 : elles sont identiques.

Le nouveau témoin de L8 comporte 61 actions, 192 images, trois reflets et aucune sélection. Il établit la solvabilité de la carte. Retirer le miroir bloqueur juste avant le deuxième reflet de ce parcours désactive le vert et fait tomber le Guerrier. Ce contrefactuel ne constitue pas une preuve globale d’unicité de la solution ou d’impossibilité de toute autre stratégie. Les témoins ne sont ni annoncés optimaux ni produits par le SRA.

Le navigateur Chromium de l’exécuteur n’a pas pu démarrer (création de socket refusée). Les contrôles d’interface exécutent l’HTML réel sous Happy DOM et comparent le buffer canvas et les durées. Une planche de contrôle des images initiales a été inspectée séparément.

## Architecture

- `src/core.ts` : moteur pur, rendu et `DuoPuzzleSession`.
- `src/levels.ts` : huit cartes.
- `src/level-info.ts` : références publiques de chaque salle.
- `src/browser.ts` / `index.template.html` : interface et tutoriel fondé sur les pixels.
- `scripts/solver.mjs`, `tests/witnesses.json`, `reference/` : outils d’auteur, exclus du bundle jouable.
- [docs/integration.md](docs/integration.md) : raccordement natif au Playground et vérifications.

Le [Playground SS06](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS06#playground) utilise ces mêmes huit salles et le même moteur.

