# Qualification indépendante de l'accusé matériel

**Le candidat `ba2d1e7f` satisfait 10 des 11 départs préenregistrés.** Il admet les 11 fiches, demande le geste attendu 11 fois, valide après 6 des 7 confirmations légitimes et suspend les 4 dialogues négatifs. Le témoin `f296ac1c` admet et engage également les 11 départs. Il valide après 0 des 7 confirmations légitimes et suspend 3 des 4 dialogues négatifs.

| Retour présenté après le geste attendu | Témoin conforme | Candidat conforme |
| --- | ---: | ---: |
| B0 · fiche originale | 0/1 | 1/1 |
| B1 et B2 · renommage simultané, puis permutation des commandes, règles et citations | 0/2 | 2/2 |
| B3 · annonce de l'accusé avant le prérequis et l'effet | 0/1 | 0/1 |
| B4 à B6 · autre poste, changement de son accusé, puis libellé partagé entre les postes | 0/3 | 3/3 |
| N1 · commande physiquement refusée | 1/1 | 1/1 |
| N2 · accusé d'un autre poste injecté sur le fil | 0/1 | 1/1 |
| N3 · retour illisible identique après une exécution et un refus physiques | 2/2 | 2/2 |

**Premier écart B3.** Les deux solveurs demandent `caler P`. L'appareil renvoie `calage enregistré`, exactement comme l'annonce la source citée. Les deux répondent `{"arret":"accusé matériel non reconnu pour la commande demandée"}`. Le candidat sait permuter les lignes et leurs références en B2. Il perd l'association lorsque la même information est rédigée sous la forme « La commande caler P renvoie exactement … » en B3. L'énumération indépendante confirme le succès en deux gestes sur les sept fiches positives. [Fiche publique B3](B3.json)

**Croisement exploratoire, hors score.** Avec cette formulation et le verbe historique `indexer`, les deux solveurs refusent la confirmation annoncée pour P (`indexé`). Sur la même fiche, ils valident si l'opérateur substitue le libellé de Q (`poste indexé`). L'appareil avait physiquement indexé P dans les deux essais, d'où le succès terminal fortuit du second. Le retour livré au solveur ne justifiait pas ce choix.

**Contrôles identiques pour les deux SHA.** A se termine par un arrêt avant toute action sur 2/2 départs. C réussit 2/2 après lecture. Les deux familles réussissent 18/18 en développement (74 commandes), puis 18/18 sur les témoins opérateur (68 commandes). Les huit anciens départs structurels restent à 0/8. Quatre s'arrêtent avant le premier geste et quatre après `indexé`, annoncé dans ces fiches par « Le retour est toujours “indexé” ». Les journaux de ces 48 contrôles sont identiques entre versions. La réserve destinée au correctif conjoint reste scellée.

Le [préenregistrement](PRE-ENREGISTREMENT.md) est publié à `16c30e57`, le banc de mesure à `e34ebc10`. Node `v24.22.3` a lancé un processus neuf par départ. Les empreintes des 11 fiches transmises concordent entre versions. Seuls les blobs de `admission.mjs` et `solveur.mjs` diffèrent dans le montage.

| Consommateur Git | SHA-256 du reçu opérateur complet |
| --- | --- |
| `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6` | `69b9ed1e9410397f7e271c42f435c6ef97c3e9b5da52e3d519ff68f572eb2765` |
| `ba2d1e7f3140f1f33d2cf7d47694de395d585bf0` | `8600be39e899e5ff5c2135f30b1f140cb1cf5b0024a0dada83cbc2fff450cb0a` |

Rejeu public avec Node 24 depuis `experiments/symbolic-situations/public-format` :

```powershell
$depot = 'D:/dev/ARC-AGI/SRA-Playground/sic-agenda-retour-public'
$sha = 'ba2d1e7f3140f1f33d2cf7d47694de395d585bf0'
node accuses/qualifier.mjs $sha $depot
node accuses/croisement.mjs $sha $depot
```

L'opérateur ajoute un chemin de reçu neuf puis `--historiques` à la première commande pour inclure les anciens lots locaux.
