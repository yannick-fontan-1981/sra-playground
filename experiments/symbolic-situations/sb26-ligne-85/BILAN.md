# SB26 · ligne de catalogue 85

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `4e1760327c1aea9031654e7de7c26da3ae19cf7b` donnent les mêmes reçus sur six départs et 37 gestes par SHA. Onze des 16 tickets nominaux appartiennent au producteur de substitution.

- Au T3, l’inventaire spatial `[14,15,9,11]` et la bordure `[9,14,11,15]` désignent la pièce 9 en `(35,58)`. Son retour conserve l’inventaire et confirme la sélection d’indice 2. Le T4 consomme cette sélection et joue `(22,29)`. Le vrai retour dépose 9 dans le premier emplacement et retire la pièce correspondante du stock.
- Permuter les deux premières bordures à inventaire fixe donne `[14,9,11,15]`. Le service sélectionne 14 en `(19,58)`. Au T4, le même clic `(22,29)` est réellement joué sur le jeu et dépose 14. Le retour mesure la disparition du jeton d’indice 0 et confirme le dépôt attendu dans cette session instrumentée. Aucun gain officiel ne suit à ce stade.
- Inverser l’ordre des commandes candidates du T3 conserve les décisions et les deux retours jusqu’au dépôt du T4. Sur le vrai ticket nominal de dépôt, remplacer seulement 9 par 14, ou rétablir le logement vide tout en gardant le jeton retiré, produit `matched:false` et scelle le plan. La sélection reste acquise et la famille se retire pour l’époque. Le service joue ensuite ACTION5 sous le propriétaire de repli.
- Le plan nominal du T6 contient sept gestes jusqu’à la soumission. Le mot complet précède le passage officiel du T12. N2 remesure sept emplacements. Le T15 dépose réellement 12 dans le premier.

Présélection `1a45d32a`, bilan d’auteur `930f29c8bf47fb4310130db73cc7599df09a95d2`. Premier essai à 01:17:15, verdict à 01:21:01 (UTC−3, 3 min 46 s). Le dépôt permuté a été joué en complément. Le vérificateur compte les 11 tickets de la famille. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-sb26-85-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
