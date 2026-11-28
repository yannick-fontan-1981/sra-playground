# COLM · ligne 59

**Qualification indépendante au gel.** Les mêmes 16 décisions du catalogue et leur retour distinguent le réordonnancement, la translation et la réception. Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `b8902646b6c968f78e5512f62d1d641b0bd20dd0` ont le même arbre moteur. Sur chaque SHA, huit départs, 45 gestes de service et deux gestes dans des sessions auxiliaires donnent les mêmes reçus.

- Au T1, ACTION1 réordonne `[8,11,8]` en `[8,8,11]` avec colonne 3 et champ posé inchangés. Deux permutations sont admissibles. Au T2, la même commande donne `[11,8,8]` et départage en faveur de `[2,0,1]`. Les translations T4/T5 gardent l’ordre des membres et changent les colonnes de `−1` et `+1`.
- Dans deux sessions auxiliaires, à partir de la même ouverture, ACTION3 translate le groupe inchangé en colonne 2. ACTION2 le dépose et introduit `[14,8,14]`. Aucun contrôle d’inactivité n’est joué ici. Les résultats authentiques montrent que l’ordre, la position et le renouvellement répondent différemment au choix de commande. Au ticket ACTION1, un stationnaire construit ne crée aucune loi. Dupliquer la finale garde ACTION1 au T2 comme nouvel essai, sans permutation acquise.
- Quand les deux paquets réels auxiliaires sont délibérément rattachés au ticket ACTION1, le moteur mesure correctement une translation ou une réception et inscrit cette mesure sous ACTION1. L’association entre commande physique et ticket dépend donc du relais qui fournit le retour. La qualification des effets sur le parcours nominal repose sur l’exécution du ticket par le relais réel.
- T3. Sans l’ordinal 1, même ticket ACTION2, même paquet officiel et même finale. Les deux retours sont scellés avec `matched:null`. Le statut acquis passe de `received_then_automatic_or_return_unknown` à `unexplained_or_boundary`. Les deux clôtures possibles et le contrôle de réception ne sont plus acquis. Le service relance ACTION2 là où le témoin nominal passe à ACTION3.
- T6. Le stationnaire construit réfute la prémisse courante sans effacer la loi de déplacement déjà acquise. ACTION2 reste le choix suivant et repart à l’indice 0 au lieu de poursuivre le préfixe à l’indice 1.
- T16 en N2. Les deux ordinals 1 et 2 suffisent à revalider la réception, avec l’ordinal 1 retenu. Supprimer les deux garde la finale, donne `unexplained_or_boundary` et laisse le contrôle portable en attente de revalidation. Le plafond de 16 gestes écarte toute mesure d’une décision suivante. Le catalogue termine un niveau.

Présélection `a7040ffa`, verdict d’auteur `1ce9bd3f20f0c788a3a476dcce16578cc0cf40bc`. Premier essai à 00:54:54, verdict à 00:58:52 (UTC−3, 3 min 58 s). L’assertion de nouvelle expérience distingue un objet de modèle vide d’un modèle absent. Les parcours ont été conservés. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-colm-59-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
