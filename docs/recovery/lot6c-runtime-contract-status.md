# Lot 6C — qualification du contrat runtime produit

Branche de travail :
`recovery/lot6c-runtime-contract-20261112`

Baseline de départ :
`recovery/site109-reconstruction-20261112` à `efbfa1f8f413245dcc30e9387b3f2729281a24e9`.

## Travail

Cette étape étend la reprise Lot 6C déjà intégrée :

1. `dispatchProductAction` conserve maintenant le type concret de l'observation via un paramètre générique.
2. Le cast `next as GameObservation` a été supprimé du chemin produit dans `src/main.ts`.
3. `BrowserGameRuntime.action()` utilise une fonction pure exportée `buildActionRequest()`.
4. La forme de requête worker est qualifiée sans démarrer de worker ni de jeu.

## Contrats exécutés localement

### Dispatch produit — 7/7 PASS

- readiness ;
- refus terminal / action indisponible ;
- ACTION6 conserve les coordonnées ;
- le timing de dispatch exclut la présentation ;
- présentation avant libération de `busy` ;
- rejet d'une génération obsolète avant présentation ;
- changement de génération pendant présentation sans libérer le `busy` de la nouvelle sélection.

### BrowserGameRuntime action mapping — 3/3 PASS

- action simple sans champ `data` ;
- ACTION6 conserve `{x,y}` ;
- ACTION6 conserve explicitement `{x:0,y:0}`.

Total exécutable : **10/10 PASS**.

## Typecheck

Typecheck isolé strict des fichiers :
- `src/agent-product-dispatch.ts`
- `src/runtime/browser-games.ts`

Résultat : **PASS**.

## Gardes du raccordement GitHub

Vérifiées directement sur le blob `src/main.ts` `19ce4b588cab2cce5c45f63869ac2fac2d8012a0` :

- import du dispatch partagé : PASS ;
- chemin produit via `dispatchProductAction`, sans ancien `run(() => runtime.action(...))` : PASS ;
- présentation typée sans assertion `as GameObservation` : PASS.

Résultat : **3/3 PASS**.

## Portée

Aucun vrai jeu n'a été démarré.
Aucun payload GABA ou KLOT n'a été rouvert.
Aucune publication Site.
Aucune mesure officielle STCK/SMLP.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
