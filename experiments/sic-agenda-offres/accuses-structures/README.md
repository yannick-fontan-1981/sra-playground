# Reçu du lecteur structuré

**SHA consommateur à monter : `2c8168f2e1df1eaa6961c0f39a473ffdf0cde147`.** Le parent fonctionnel est la combinaison A+B `615e249349e6f274b07c7626d30c545d374234a5`. Le comportement attendu sur P et Q a été figé à `22ec77d6` avant le raccordement au contrat du producteur `857e606e05be9c5a9a73dc64e1fb0a8f17075b7c`. [Attendus](CONTRAT-CONSOMMATEUR.md)

| Entrée et statut matériel | Exposition | Résultat mesuré |
| --- | --- | --- |
| `sra.public/1.1`, accusés déclarés sur les réductions A/B/C | Cinq départs | A 2/2 en quatre gestes, B 1/1 en deux, C 2/2 en trois. Les marques de A et C utilisent la lecture réellement livrée. |
| `sra.public/1.1`, reformulations et confirmations insuffisantes | Onze départs | 7/7 confirmations valides reconnues et 4/4 contrôles insuffisants suspendus. |
| `sra.public/1.1`, même commande `indexer P`, même fiche X1/X2 | Deux retours distincts | X1 : `indexé` confirme P et conduit à `valider`. X2 : l’accusé de Q `poste indexé` conduit à `unmatched` et à l’arrêt. |
| `sra.public/1`, conventions historiques | Douze anciennes fiches, dix-huit départs | 18 succès, 74 commandes exécutées, 12 lectures. Les reçus de départ sont identiques au parent. |
| `sra.public/1.1`, mêmes douze fiches traduites avec statut matériel `undeclared` | Dix-huit départs | 18 admissions, 28 commandes exécutées, 10 lectures reçues, 18 arrêts `undeclared`, 0 succès. Le premier geste matériel peut avoir lieu sans que son effet puisse ensuite être confirmé par son libellé. |

Le relais d’opérateur `37220539341f8d5951382325bed4eecb8661d684` a fourni les traductions des fiches publiques. La mesure v1 conserve l’interprétation historique des libellés. Elle inclut les limites connues du lecteur v1 sur les textes étrangers ou reformulés. Le passage de X1/X2 est attesté pour le format **1.1 déclaré**.

## Effets que le solveur confirme

La version de la fiche détermine le schéma et la procédure. Le lecteur 1.1 utilise le validateur relationnel et la qualification des retours du producteur. La relation est indexée par le tableau exact de commande, y compris les arguments. Le libellé est comparé dans les réponses de cette commande. La couverture d’un effet doit reprendre l’effet inconditionnel et ses citations dans les règles du même geste. Le validateur contrôle la provenance publique du libellé. L’ordre des mots autour de la citation ne choisit aucune interprétation.

Une confirmation peut ne couvrir qu’une partie des effets projetés. Le consommateur écarte les valeurs touchées que l’accusé ne confirme pas, y compris une ancienne valeur devenue incertaine. `keep` conserve une valeur déjà attestée. Une contradiction entre couverture et projection suspend la décision. `coverage:"unknown"` confirme l’exécution et laisse son effet matériel non établi. Les sorties conditionnelles du cadran peuvent rester possibles jusqu’à une lecture. Un reçu d’exécution n’attribue aucune valeur observée au capteur ou au guide. [Admission et sélection du format](../public-v1/admission.mjs) · [Mise à jour des faits](../public-v1/solveur.mjs)

L’absence de tableau en 1.1, le statut `undeclared` et une déclaration `ambiguous` ne déclenchent aucun repli sur le dictionnaire du v1. Le protocole conserve le refus standard, les verdicts terminaux et les retours de lecture. Les contrôles couvrent aussi une couverture falsifiée pour le mauvais poste, deux libellés en conflit, un effet partiellement couvert et un libellé partagé entre deux commandes. [Tests de propriété](verifier.mjs)

## Montage et rejeu

Entrée : `experiments/sic-agenda-offres/public-v1/solveur.mjs`. Les sept dépendances Git à monter pour l’opérateur sont :

```text
experiments/sic-agenda-offres/public-v1/admission.mjs
experiments/sic-agenda-offres/public-v1/planifier.mjs
experiments/sic-agenda-offres/public-v1/schema.json
experiments/sic-agenda-offres/public-v1/protocole-1.1/contrat.mjs
experiments/sic-agenda-offres/public-v1/protocole-1.1/schema.json
experiments/sic-agenda-offres/agenda.mjs
src/sic/reasoning-mode.ts
```

Les blobs Git de `protocole-1.1/contrat.mjs` et `protocole-1.1/schema.json` sont respectivement `b891e984d1d0d8e2e490b563e956344462b44783` et `81f4a031ce7472122f615e92cd334a045e3fd4ec`, identiques à la version du producteur. [Référence de qualification](../public-v1/protocole-1.1/contrat.mjs)

Depuis ce checkout, avec Node 24 et le checkout d’opérateur voisin :

```powershell
$f = '../symbolic-public-format/experiments/symbolic-situations/public-format'
$t = 'experiments/sic-agenda-offres/accuses-structures'
$p = 'experiments/sic-agenda-offres/public-v1/protocole-1.1'
$sha = '2c8168f2e1df1eaa6961c0f39a473ffdf0cde147'
node "$t/verifier.mjs" $f
node "$t/qualifier.mjs" $f $sha
node "$t/historique.mjs" $f $sha "$p/contrat.mjs" "$p/schema.json"
```

Le deuxième rejeu monte le SHA scellé et utilise uniquement les cas de développement nommés. Le troisième compare les reçus v1 au parent, à l’identique, et indique leur emplacement local. [Qualification 1.1](qualifier.mjs) · [Comparaison historique](historique.mjs)
