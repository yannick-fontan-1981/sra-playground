# Lot 6C — contrat déterministe de présentation produit

Branche de travail :
`recovery/lot6c-presentation-contract-20261112`

Baseline de départ :
`recovery/site109-reconstruction-20261112` à `c1ea7eec84b0075f677c5395eabab7ad107dee56`.

## Travail

Cette étape isole les décisions déterministes de `present()` sans déplacer le rendu DOM lui-même.

Nouveau module :
`src/product-presentation.ts`

Règles extraites :
- validité initiale génération + jeu ;
- validité de boucle présentation + sélection ;
- choix des frames d'animation ;
- fallback vers la frame finale si `frames=[]` ;
- durée explicite `frameDurationsMs` ;
- fallback et clamp FPS historique ;
- message final WIN / LEVEL_COMPLETE / GAME_OVER / GAMEOVER.

`src/main.ts` utilise désormais ces règles, tout en gardant :
- `paint()` ;
- les appels DOM ;
- `window.history` ;
- `window.setTimeout` ;
- la libération de `busy`.

## Tests frais — 9/9 PASS

1. génération + jeu doivent correspondre ;
2. frames explicites conservées ;
3. frames vides → frame finale ;
4. durée explicite non négative prioritaire ;
5. durée invalide → fallback FPS ;
6. fallback/clamp FPS historique, incluant 0, >60 et <1 ;
7. feedback WIN / LEVEL_COMPLETE ;
8. feedback GAME_OVER / GAMEOVER et silence normal ;
9. stale-check de boucle sur génération présentation + génération sélection.

## Typecheck

Typecheck strict isolé de `src/product-presentation.ts` avec l'interface `GameObservation` correspondante : **PASS**.

## Gardes directes sur GitHub — 6/6 PASS

Blob `src/main.ts` qualifié :
`55a38730fc023ee52e44e5c4239798adeda464b6`

Vérifications :
- import des helpers de présentation ;
- garde initiale extraite ;
- garde stale de boucle utilisée avant/pendant la fin d'animation ;
- choix des frames extrait ;
- durée de frame extraite ;
- feedback final extrait.

## Portée

- aucun vrai jeu démarré ;
- aucun payload GABA/KLOT rouvert ;
- pas de navigateur réel ;
- pas de publication Site ;
- pas de mesure officielle STCK/SMLP.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

## Prochaine frontière

Qualifier les effets DOM eux-mêmes via un hôte minimal ou isoler les ports de présentation :
- paint ;
- updateInterface ;
- history.replaceState ;
- game-feedback ;
- libération de busy ;
- interruption d'une animation en cours.
