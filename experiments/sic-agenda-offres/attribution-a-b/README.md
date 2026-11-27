# Reçu d’attribution des candidats A et B

Le consommateur combiné est **`615e249349e6f274b07c7626d30c545d374234a5`**. Ses parents Git sont A, `6191afeeafe7baac597685f2d9e5b08b241cce99`, et B, `ba2d1e7f3140f1f33d2cf7d47694de395d585bf0`. Le montage reprend octet pour octet le planificateur de A et l’admission et le dialogue de B.

| Jeu de développement | Historique f296ac1c | A | B | A+B |
| --- | ---: | ---: | ---: | ---: |
| A · indexation à effet conditionnel | 0/2 | 2/2 | 0/2 | 2/2 |
| B · accusé annoncé en ligne 3 | 0/1 | 0/1 | 1/1 | 1/1 |
| C · lecture indispensable | 2/2 | 2/2 | 2/2 | 2/2 |
| Dix-huit anciens départs | 18/18 | 18/18 | 18/18 | 18/18 |

La première différence sur A se produit au tour 1 : `indexer P` devient possible. La lecture rend R ou S avant de marquer. Sur B, le premier geste reste `indexer P` et la réponse suivante devient `valider` après `indexé`. C conserve la lecture avant engagement. Le mode `--exiger-passage` de l’évaluateur public confirme les trois politiques minimales sur la combinaison. Les 18 anciens départs ont exactement les mêmes reçus que le gel historique, avec 74 gestes exécutés et 12 lectures.

**Défaut B3/N2 reproduit sur la combinaison.** Sur la même fiche publique et la même demande `indexer P`, X1 transmet le véritable accusé de P, `indexé` : le solveur s’arrête. X2 transmet l’accusé étranger `poste indexé` : le solveur conclut à tort et propose `valider`. Le jeu peut alors réussir car l’opérateur a physiquement indexé P. Ce succès ne valide pas la preuve utilisée par le solveur. Les deux contrôles renvoient `conforme:false`. L’opérateur avait trouvé six confirmations reconnues sur sept dans les positifs de B et quatre suspensions dans les quatre négatifs avant ce croisement. Une déclaration publique contradictoire doit primer sur tout repli historique et l’accusé doit être rattaché positivement à la commande complète et au sujet en attente.

Rejouer depuis le checkout combiné avec Node 24 et l’opérateur de développement `c7f9629c` ou sa version compatible :

```powershell
$format = '../symbolic-public-format/experiments/symbolic-situations/public-format'
$sha = '615e249349e6f274b07c7626d30c545d374234a5'
foreach ($cas in @('A','B','C')) {
    node "$format/reductions/rejouer.mjs" $cas $sha (Get-Location).Path --exiger-passage
}
node "$format/accuses/croisement.mjs" $sha (Get-Location).Path
```

Entrée opérateur : `experiments/sic-agenda-offres/public-v1/solveur.mjs`. Monter aussi `public-v1/admission.mjs`, `public-v1/planifier.mjs`, `public-v1/schema.json` et `agenda.mjs` sous `experiments/sic-agenda-offres/`, ainsi que `src/sic/reasoning-mode.ts`. Le candidat de coût `bd61ff40` possède son propre montage.
