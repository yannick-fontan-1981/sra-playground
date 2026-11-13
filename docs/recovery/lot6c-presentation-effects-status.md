# Lot 6C — port testable des effets de présentation

Branche de travail :
`recovery/lot6c-presentation-effects-20261112`

Baseline de départ :
`recovery/site109-reconstruction-20261112` à `b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd`.

## Objectif

Encapsuler la séquence d'effets historiquement portée par `main.ts` derrière des ports déterministes, afin de qualifier l'ordre des effets et les interruptions stale avant le raccordement final au DOM réel.

Nouveau module :
`src/product-presentation-effects.ts`

## Séquence qualifiée

`observation acceptée → loading/failed remis à zéro → URL synchronisée → interface mise à jour → frames d'animation peintes → attente → frame finale peinte → busy éventuellement libéré → feedback terminal`

Le module réutilise les règles déjà qualifiées de `src/product-presentation.ts` :
- validité génération + jeu ;
- validité de boucle présentation + sélection ;
- sélection des frames ;
- durée des frames ;
- feedback terminal.

## Tests frais

Commande locale :

`node --experimental-strip-types --test tests/product-presentation-effects.test.ts`

Résultat : **7/7 PASS**.

Contrats :
1. ordre complet des effets sur le chemin heureux ;
2. palette de l'observation prioritaire sur la palette de repli ;
3. sélection ou jeu déjà stale : aucun effet ;
4. sélection devenue stale pendant l'attente : aucune frame ultérieure ni effet final ;
5. présentation supersédée pendant l'attente : aucune frame finale, aucun `busy=false`, aucun feedback tardif ;
6. `releaseBusy=false` conserve la propriété du dispatch tout en publiant le feedback ;
7. état non terminal : aucun feedback parasite.

## Typecheck

Typecheck strict du code de production : **PASS**.

Le typecheck couvre :
- `src/product-presentation-effects.ts` ;
- `src/product-presentation.ts` ;
- l'interface `GameObservation` correspondante.

## Statut de raccordement

Le port d'effets est **fonctionnellement qualifié comme composant**, mais n'est pas encore appelé par `main.ts` dans ce checkpoint.

Cette séparation est volontaire : le prochain changement doit remplacer uniquement le corps effectif de `present()` par un adaptateur de ports, sans réécrire le reste de `main.ts` et sans prétendre à une qualification DOM avant son test ciblé.

## Portée et limites

- aucun vrai jeu démarré ;
- aucun payload GABA/KLOT rouvert ;
- aucun DOM réel lancé ;
- aucun Site publié ;
- aucune mesure officielle STCK/SMLP.

Statut : **fonctionnellement qualifié comme composant, raccordement produit à effectuer, performance officielle à confirmer**.

## Prochaine étape

Raccorder `main.ts` à `presentProductObservation()` avec les ports réels :
- état `observation/loading/failed/busy` ;
- `history.replaceState` ;
- `paint()` ;
- `window.setTimeout` ;
- `updateInterface()` ;
- `#game-feedback`.

Puis exécuter les gardes structurelles et un hôte DOM minimal afin de confirmer que le raccordement ne modifie pas l'ordre historique.
