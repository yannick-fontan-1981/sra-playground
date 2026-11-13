# Lot 5B — qualification d’intégration sur la reconstruction Site 109

Date : 2026-11-12

## Portée

Branche de travail : `recovery/lot5-site109-rebase-20261112`

Branche canonique visée : `recovery/site109-reconstruction-20261112`

Le sous-lot qualifié couvre la chaîne :

`acquisition adressée → réponse → conservation → frontière → revalidation → obligations de préservation → proposition bornée → guards → observation ou réfutation → bundle OP18`

## Rapprochement Git

Le premier rapprochement a conservé les deux historiques :
- parent canonique : `b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd` ;
- parent Lot 5 : `5f8752a821ceb338d2fdf2b9c601a790cc94bbd4` ;
- commit de rapprochement : `a0f251dd9e2f5e10ea9e6f1f0928d8f472bc2fa5`.

Le second rapprochement a repris la tête canonique plus récente sans écrasement :
- parent canonique : `530b1c45af4036ba697fdef0584c6e87cc279be6` ;
- parent Lot 5 qualifié : `90aa1f955869b3fff234b445eb91a2f784d5786b` ;
- candidat combiné : `d5d12cb013d78517a971328ee95eb57468c273f1`.

Aucun fichier 5A/5B/5C n’existait sur la branche canonique lors de ces rapprochements. Les ajouts ont donc été portés sans remplacement de composants concurrents.

## Qualification GitHub Actions

Workflow temporaire de branche : `.github/workflows/lot5-addressed-material-qualification.yml`.

Première exécution complète réussie :
- run GitHub Actions : `43340509677` ;
- commit qualifié : `90aa1f955869b3fff234b445eb91a2f784d5786b` ;
- Node : `22.18.0` ;
- installation : `npm ci` réussie ;
- `tsc --noEmit` : réussi ;
- tests ciblés Lot 5 : **52/52 réussis** ;
- régression TypeScript complète : **248/248 réussis** ;
- test `FieldStock bundle template is admitted by the existing OP18 native authority` : réussi.

La première exécution diagnostique avait utilisé le chargeur TypeScript strip-only et échouait sur trois parameter properties préexistantes hors Lot 5. La commande complète a été corrigée vers `node --experimental-transform-types --test tests/*.test.ts`, sans changement du code fonctionnel.

Le présent commit documentaire déclenche une nouvelle qualification sur l’arbre combiné dont le premier parent est `530b1c45af4036ba697fdef0584c6e87cc279be6`. L’intégration canonique ne doit être avancée qu’après succès de cette exécution.

## Statut fonctionnel

5B est fonctionnellement qualifié sur le runtime V6 reconstruit pour :
- acquisition initiale et réconciliation de réponse ;
- ambiguïté et réfutation ;
- rétention de connaissance adressée à une frontière officielle ;
- revalidation explicite dans la nouvelle scène ;
- absence d’héritage automatique par un nouvel objet ou contexte ;
- garde avant/après ;
- stock typé, réécriture observée et obligations de préservation ;
- proposition bornée ;
- consommation contractuelle OP18 par l’autorité native existante.

La conservation reste distincte de l’applicabilité. Un `prior` retenu ne peut être consommé qu’après création réussie d’un `FieldStock` lié à l’observation courante.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Cette qualification ne remplace pas le protocole officiel STCK/SMLP. Aucun benchmark synthétique n’est utilisé comme preuve officielle.

## Intégration

Le workflow temporaire de qualification reste propre à la branche Lot 5 et ne doit pas être conservé dans l’arbre canonique publié. Le document de qualification et les fichiers fonctionnels/tests peuvent être intégrés après succès de la qualification exacte du candidat combiné.
