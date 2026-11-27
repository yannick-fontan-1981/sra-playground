# G50T · ligne 18 · qualification opérateur

**Le gel distingue déjà l'essai d'une commande, l'approche et l'effet distant.** Le même service rejoue les dix tickets capturés, depuis L1, à `d0e7527c` et à `1a1cc965`. Sur la ligne 18, le point de catalogue éprouvé est le ticket 3 parmi les quatorze commandes historiques associées au triplet. [Contrat indépendant](CONTRAT.md) · [Reçu](recu.json)

| Ticket | Choix et preuve observée |
| --- | --- |
| T3–T5 | Le premier pas est en mode `binding`, sans destination prédite. T3 `ACTION1` déplace le porteur de (14,14) à (14,8). T4 `ACTION3` le laisse sur place. T5 `ACTION4` mesure le vecteur (6,0) et rend l'accès possible. Les trois retours portent `matched=null`. |
| T6–T7 | Le plan d'accès avance par `ACTION4` vers (26,8), puis (32,8). Les deux destinations correspondent. Aucun effet distant n'est inscrit lors de ces approches. |
| T8 | Le troisième pas du même plan atteint le site (38,8). L'évaluateur retrouve exactement les 23 pixels distants du reçu, avec anciennes et nouvelles valeurs. Les deux occurrences et la commande sont liées. La cause exclusive reste indéterminée. |
| T9 | Un nouvel essai de liaison reprend la référence de cette comparaison. |

**Même ticket d'accès, retours différents.** Une réponse stationnaire au T8 laisse le porteur en (32,8), donne `matched=false` et aucun événement de contact. Une arrivée avec support distant inchangé donne `matched=true` pour le pas et une comparaison vide. Modifier un pixel extérieur conserve ce résultat. Modifier un seul pixel du support donne une comparaison d'un pixel, avec ses coordonnées exactes. Les deux dernières interventions ont également été rejouées sur des positions réservées distinctes. L’offre d’accès est donc appréciée séparément de la mesure distante.

**Variation de la preuve au T3.** Sur la même observation, le même site et le même premier vecteur de trajet, fournir une commande mesurée transforme `ACTION1` en accès avec destination. Avec la mesure historique manquante, cette commande reste un essai. Lorsque toutes les commandes sont marquées comme déjà essayées au point de choix, la famille cède la place à la frontière. Les deux variations manipulent la preuve disponible à ce point et ne prétendent pas être des épisodes historiques.

**Attribution.** Sur chaque SHA : un parcours historique, quatre retours construits de développement, deux retours réservés et deux variations supplémentaires de la preuve de commande. Les deux altérations du reçu extérieur (fausse attribution d'un pixel et affirmation de causalité exclusive) sont rejetées dans chaque partition. Le candidat introduit `selectLinkedContactStep`. Dans un départ supplémentaire sur branche, retirer son offre au T3 conserve l'observation et les deux décisions antérieures. `observed_frontier` libère alors `ACTION2`. Le crédit fonctionnel est antérieur ; le raccordement est attesté sur la branche. La qualification concerne le pack natif standard.

## Rejeu

Depuis ce dossier, avec Node 24, Git et `tar`. Employer des noms de reçus neufs.

```powershell
$sha = '1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd'
node qualifier.mjs $sha historique "$env:TEMP/18-jeu.json"
node qualifier.mjs $sha dev "$env:TEMP/18-retours.json"
node qualifier.mjs $sha mesurée "$env:TEMP/18-acces.json"
node qualifier.mjs $sha épuisée "$env:TEMP/18-epuise.json"
node qualifier.mjs $sha retrait "$env:TEMP/18-retrait.json"
```

Le dernier appel cible la nouvelle interface du candidat. Les autres acceptent également le SHA du gel. [Évaluateur et contrôles d'attribution](verifier.mjs)
