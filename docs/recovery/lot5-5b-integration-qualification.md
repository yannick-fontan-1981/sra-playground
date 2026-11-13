# Lot 5B — qualification d’intégration sur la reconstruction Site 109

Date : 2026-11-12

## Portée

Branche de travail : `recovery/lot5-site109-rebase-20261112`

Branche canonique visée : `recovery/site109-reconstruction-20261112`

Le sous-lot qualifié couvre la chaîne :

`acquisition adressée → réponse → conservation → frontière → revalidation → obligations de préservation → proposition bornée → guards → observation ou réfutation → bundle OP18`

## Sources V6 réellement portées

- `common_addressed_material.py`
- `common_addressed_field.py`
- `common_field_stock.py`
- `common_linked_preparation.py`
- `geometric_observer.py::components`
- `typed_material_observations.py::child_present`

La conservation reste distincte de l’applicabilité. Un `prior` retenu ne peut être consommé qu’après création réussie d’un `FieldStock` lié à l’observation courante.

## Rapprochements Git

Les rapprochements ont toujours conservé la reconstruction canonique comme premier parent et l’historique Lot 5 comme second parent, sans force ni écrasement.

Candidat final qualifié :
- parent canonique : `24fcdbb16c93de59489a6bb0392cc709b7a75d14` ;
- tête Lot 5 qualifiée : `42634871a47986935d2b8ce9617d97a17e350b35`.

Aucun fichier 5A/5B/5C n’existait sur la branche canonique avant ce rapprochement. Les fichiers ont donc été ajoutés sans remplacer les composants concurrents.

## Compatibilité concurrente Lot 6C

Le rapprochement avec le Lot 6C a révélé une incompatibilité ESM dans `src/product-presentation-effects.ts` : deux imports TypeScript omettaient leur extension.

La correction qualifiée est strictement limitée à :
- `./runtime/browser-games` → `./runtime/browser-games.ts` ;
- `./product-presentation` → `./product-presentation.ts`.

Le corps fonctionnel du fichier Lot 6C est conservé à l’identique. Les tests de présentation et de dispatch passent après cette correction.

## Qualification GitHub Actions finale

Workflow temporaire de branche : `.github/workflows/lot5-addressed-material-qualification.yml`.

Exécution finale réussie :
- run GitHub Actions : `43341200851` ;
- commit qualifié : `42634871a47986935d2b8ce9617d97a17e350b35` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `tsc --noEmit` : réussi ;
- tests ciblés Lot 5 : **52/52 réussis** ;
- régression TypeScript complète, incluant les lots concurrents présents : **255/255 réussis** ;
- test `FieldStock bundle template is admitted by the existing OP18 native authority` : réussi ;
- tests Lot 6C de présentation/dispatch : réussis.

La régression complète utilise :

`node --experimental-transform-types --test tests/*.test.ts`

Le workflow temporaire sert uniquement à la qualification de branche et n’est pas ajouté à l’arbre canonique.

## Statut fonctionnel

5B est fonctionnellement qualifié sur le runtime V6 reconstruit pour :
- acquisition initiale et réconciliation de réponse ;
- ambiguïté et réfutation ;
- rétention de connaissance adressée à une frontière officielle ;
- revalidation explicite dans la nouvelle scène ;
- absence d’héritage automatique par un nouvel objet ou contexte ;
- guards avant/après ;
- stock typé, réécriture observée et obligations de préservation ;
- proposition bornée ;
- consommation contractuelle OP18 par l’autorité native existante.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Cette qualification ne remplace pas le protocole officiel STCK/SMLP. Aucun benchmark synthétique n’est utilisé comme preuve officielle.
