# SS13 — validation de la version 0.1.0

## Résultats de livraison

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript stricte et HTML autonome | Réussis |
| Tests moteur | **31/31** |
| Parcours d’auteur | **8/8 WIN** |
| Entrées rejouées | **435**, dont 32 sélections |
| Refus et morts dans les témoins | **0 / 0** |
| Images contrôlées | **1 292** |
| Tutoriel au niveau 1 | **14/14 découvertes**, parcours de 77 entrées |
| Undo des fins de salle et relecture déterministe | Vérifiés sur les huit salles |
| HTML compilé dans Happy DOM | Réussi, pixels et durées contrôlés |
| Rendu dans un véritable navigateur | **Non validé dans cet environnement** |

Les rapports détaillés sont `validation/levels-report.json`, `validation/ui-dom-report.json` et `validation/design-constraints-report.json`. Les deux premiers portent le SHA-256 exact du HTML vérifié. `validation/browser-availability.json` explicite la limite navigateur.

## Contrat moteur

Les 31 tests couvrent la traction d’un seul occupant, l’absence de poussée et de capacité forcée, la sélection sans tour, les échanges avec la première cible, les visées déviées et les boucles, les priorités des miroirs, les appuis fixes, les cascades hydrauliques, les attaques simultanées et l’annulation.

Le validateur de campagne vérifie la correspondance exacte entre références d’auteur, cartes distribuées, crédits et actions pixel. Il contrôle l’absence de superposition des occupants, le contrat 64 × 64 / palette de 16 couleurs, chaque transition d’animation, l’absence d’état privé dans les observations et la progression jusqu’à WIN. Les huit cartes sont distinctes et les itinéraires sont absents du HTML.

## Interface compilée

Le vrai HTML construit est exécuté dans Happy DOM avec un tampon canvas et une file d’animation contrôlée. Les actions passent par les événements clavier, clics et boutons.

Les vérifications couvrent douze situations du duo, reflets proches/égaux, prévisualisations, miroir sur bouton, refus signalé en rouge, rayon bouclé, sélection sans tour, verrouillage pendant l’animation, interruptions par Annuler/Recommencer/Repartir/sélecteur, réduction des animations et panneaux terminaux différés. Les huit salles présentent leurs deux héros, deux destinations, aides et références. Le parcours réel du tutoriel obtient les quatorze découvertes depuis les pixels publics.

La découverte « presse » exige une fermeture visible à l’ancienne case d’un occupant puis son déplacement. Elle ne confond pas une élimination au combat avec une poussée.

## Contrôles de conception

Les contrefactuels locaux comparent des actions depuis des positions précises : laisser ou retirer le miroir-poids, marcher dans un appui inactif ou être transporté pendant sa mise en service, refléter une caisse avant/après déplacement du miroir, cibler la caisse dangereuse ou l’ancre dégagée, et refléter avant/après avoir préparé les deux héros.

Ces vérifications confortent les contraintes reprises des sources. Elles ne prouvent ni l’unicité d’une solution ni la nécessité globale de toutes les mécaniques présentes.

## Navigateur

Le contrôle natif reste à effectuer lors de l’intégration. Dans la validation SS12 immédiatement précédente, Chromium a échoué sur une création de socket interdite et le navigateur géré a refusé l’ouverture d’une URL locale. Ces restrictions n’ont pas été contournées pour SS13 ; aucun nouveau test natif n’est prétendu réussi.

Les matrices publiques des huit grilles ont été rendues et inspectées. Cette inspection et Happy DOM ne certifient pas la mise en page CSS, les périphériques tactiles ou l’affichage dans chaque navigateur.

`scripts/verify-ui-browser.mjs` prépare la vérification Playwright/Chromium pour un environnement autorisé. Il n’a pas été exécuté avec succès dans cette livraison.

## Reproduire

Depuis le répertoire du laboratoire :

```sh
npm install
npm test
npm run validate
node scripts/verify-design-constraints.mjs
node scripts/verify-ui-dom.mjs
```

Le dernier script nécessite Happy DOM. La version utilisée est 21.0.4 ; `HAPPY_DOM_MODULE` peut désigner le module installé. Pour un environnement autorisant le navigateur, rendre Playwright/Chromium disponibles puis lancer `node scripts/verify-ui-browser.mjs`. Variables optionnelles : `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` et `SS13_BROWSER_CAPTURE_DIR`.

Le build ne lance aucun solveur. Après une modification de carte, reconstruire son fichier d’auteur puis exécuter `node scripts/sync-levels.mjs` avant le build.

## Portée de la livraison

Les témoins démontrent que les huit salles sont solubles dans le moteur livré. Ils ne mesurent pas les performances de SRA. Aucun adaptateur natif ou chemin partagé du runtime Playground n’est modifié à cette étape ; aucune comparaison de coût global n’est donc revendiquée. Elle sera requise si l’intégration modifie un chemin partagé.
