# Intégration des rôles confirmés par une autre stratégie

Ce lot part de `main` `267ba98cf4b68b0a083aa5ced439e8431ebf2168` et intègre la branche
`fix/sic-27-observed-compositions-20261126`, tête distante
`e785a7c56a3673f91350096f331c56b5dfec82f3`.

## Problème et comportement

Les captures publiques de UPST et CWSE montrent une victoire officielle obtenue
par une stratégie différente de celle qui a appris le rôle. Le rôle conserve
alors son ancien compteur et refuse la scène suivante. La correction reconnaît
l'effet confirmé dans les images publiques de fin de niveau, puis avance ce
compteur en conservant les autres faits et leurs preuves.

`observed-role-completion.ts` factorise la sélection des images de la scène
terminée et la transmission d'une seule progression officielle. Chaque rôle
reste responsable de prouver son propre effet. Les images identiques à la
nouvelle scène sont exclues de cette preuve. Un compteur avancé seul, une
observation absente ou ambiguë et une contradiction n'autorisent pas le transfert.

L'accès à une rencontre atteignable reste également proposé dans les
compartiments lorsque le terminal est encore inconnu. Le contact et son retour,
et non le trajet seul, constituent l'expérience.

## Validation locale archivée

Les replays complets depuis L1 utilisent la source de production distante
`55fc7b488e8443b730de3bf17cdc9e4b2d1c6883`, arbre
`f0e8e29cf6fa1fb33f38843849675e75321afd7d`, un seul worker SIC et les plafonds
inchangés du bilan des 107 jeux. Ils ont produit les mesures suivantes :

| Jeu | Niveaux marqués | Commandes par niveau | Total |
|---|---:|---|---:|
| UPST | 6/6 | 19, 4, 11, 7, 14, 17 | 72 |
| CWSE | 6/6 | 4, 5, 40, 31, 36, 79 | 195 |

CWSE utilise les plafonds de secours déjà présents dans le bilan, soit
80 commandes et 90 secondes par niveau ; son dernier niveau ne conserve qu'une
commande de marge. Les 267 commandes ont autant d'autorisations et d'acquisitions
SIC. Ces mesures sont des replays natifs, pas une validation de l'interface
publiée et pas un nouveau bilan complet des 107 jeux.

Les 27 cas ciblés incluent des transferts natifs avec formes, palettes,
positions et commandes distinctes, ainsi que les refus ambigu, manquant et
contradictoire. Les captures, les bruts compressés et leurs empreintes figurent
dans `sic-public-completion-20261127/`. Cette intégration ajoute les tests ciblés
à la CI ; le contrat complet de continuité reste obligatoire et inchangé.

## Livraison

Ce lot est indépendant de la modification d'arbitrage de la PR132, dont le
contrôle a détecté une régression GABA L6. Il n'inclut pas cette modification.
La publication et la reproduction dans le viewer sont à effectuer après la
validation de la CI et la fusion sur `main`. La version Site courante reste 199,
source `d258b5b900c9f042b8535f75fee2c976ec5c71a5`, jusqu'à cette livraison.
