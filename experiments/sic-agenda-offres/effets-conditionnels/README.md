# A isolé · indexer avant de connaître le résultat du cadran

Consommateur figé **`6191afeeafe7baac597685f2d9e5b08b241cce99`**, issu de `f296ac1c`. Le commit préalable `df8b13a2` fixe la première divergence. Sur la réduction A, la première commande devient `indexer P` dans les deux situations compatibles. Les deux parties réussissent en quatre gestes. [Attendu](ATTENDU.md)

| Étape | Ce que le solveur sait | Décision ou retour |
| --- | --- | --- |
| Avant le premier geste | P n’est pas indexé. Le cadran indique initialement R. Le guide inconnu peut valoir R ou S. | L’indexation est autorisée. |
| Au retour matériel `poste indexé` | P est indexé. La valeur antérieure du cadran a été invalidée. Un seul état de connaissance porte les deux issues possibles R et S. | Demander `lire`. |
| Au retour R ou S | La valeur du cadran est désormais observée. Le guide reste inconnu. | Marquer P avec la valeur lue, puis valider. |

La correction porte uniquement sur la projection des commandes matérielles. Les conditions d’exécution doivent être établies avant de considérer leurs conséquences. Une suite de règles `when → set` peut représenter une table complète indexée par une seule variable publique stable. La projection demande une cible unique, une affectation cohérente pour chaque valeur possible et des sorties appartenant au domaine déclaré. Les effets certains s’appliquent normalement. Les sorties différentes restent des possibilités dans un seul successeur : la recherche doit choisir un même geste pour cet état jusqu’au retour qui les distingue. Si toutes les affectations produisent la même valeur, cet effet est certain. [Implémentation](../public-v1/planifier.mjs)

La première décision examine deux valeurs. La recherche conserve son horizon maximal de dix gestes. La nouvelle table est limitée à huit valeurs et à 64 cas examinés par décision, avec réutilisation en cache et une seule cible incertaine à la fois. Précondition inconnue, couverture partielle, conflit, risque terminal et violation des bornes déclenchent l’abstention. Les neuf variations négatives et la permutation des commandes et règles passent. [Contrôles](verifier.mjs)

| Réduction | Gel historique | A seul |
| --- | --- | --- |
| A · effet conditionnel | 0/2, arrêt avant le geste | 2/2, indexer puis lire et agir selon le retour |
| B · accusé matériel | 0/1 | 0/1, même geste et même arrêt après `indexé` |
| C · engagement prématuré | 2/2 | 2/2, lecture en premier |
| 18 anciens départs de développement | 18 succès, 74 gestes, 12 lectures | 18 reçus identiques, vérifiés avec le même opérateur `c7f9629c` |

Le contre-exemple indépendant du tampon commun garde le coût quatre sur ce SHA. Le correctif de coût reste à `bd61ff40`. Le comportement linguistique des accusés reste celui du gel historique.

Depuis ce checkout avec Node 24 et le checkout opérateur voisin :

```powershell
$reductions = '../symbolic-public-format/experiments/symbolic-situations/public-format/reductions'
node experiments/sic-agenda-offres/effets-conditionnels/verifier.mjs $reductions
node "$reductions/rejouer.mjs" A 6191afeeafe7baac597685f2d9e5b08b241cce99 (Get-Location).Path --exiger-passage
```

Entrée à monter : `experiments/sic-agenda-offres/public-v1/solveur.mjs`. Les dépendances relatives sont `public-v1/admission.mjs`, `public-v1/planifier.mjs`, `public-v1/schema.json` et `agenda.mjs` sous `experiments/sic-agenda-offres/`, ainsi que `src/sic/reasoning-mode.ts` à la racine. Seul `planifier.mjs` diffère dans ce montage.
