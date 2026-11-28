# THER · ligne 65

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `dc9314cc1ebdfc4ac4888d5ad0e7bfa0fb62542f` ont le même moteur et donnent des reçus identiques. Six départs de service, 26 gestes et un contrôle d’archive sans geste joué par SHA.

- En N1, le clic T1 `(21,21)` fait passer les longueurs de `[0,0,0]` à `[3,0,0]` et acquiert l’ajout. Le clic T2 `(21,35)` réduit la même chaîne à un et acquiert la coupe. Les deux mesures citent le ticket et son retour. Un stationnaire au T1 n’acquiert rien. Changer aussi une chaîne sœur fait refuser l’attribution au seul sujet. Un stationnaire au T2 conserve l’ajout et laisse la coupe indéterminée.
- Le T3 nominal utilise les deux acquisitions et projette `[1,2,0]` à partir des domaines `[[1],[2],[1]]`. Le vrai retour confirme cette projection et poursuit le plan à l’indice 1. Retirer seulement l’ajout à la même vue donne un nouveau sondage `(21,21)`. Après retrait de la coupe, la longueur disponible est insuffisante pour la retester et un autre propriétaire joue `(21,32)`. Le service revient ensuite à une offre de réalisation conditionnelle dans les deux cas. Les passages officiels se produisent aux T4, T7, T11 et T15.
- Le témoin public V42/N5, après 15 retours acquis, conserve une seconde preuve de mesure. En nominal, le comptage complet donne 14 marques sur chaque axe et les domaines du vrai T16. Ajouter une seule unité de marque sur le dernier indice de ligne garde les chaînes et les comptes de colonne `[2,3,4,3,2]`, mais produit des totaux 15 et 14. Le calcul signale `EMPTY_DOMAIN_CONTRADICTION` et le producteur ne propose aucun geste. L’archive ne fait jouer aucune variante. Dans le vrai catalogue, le T16 est joué et confirme le préfixe `[4,0,0,0,0,0]`.

Présélection `497ff17e`, remise d’auteur `0ca67a95446f6ea5de980eafaae97529b7cf4bea`. Premier essai à 01:09:23, verdict à 01:14:00 (UTC−3, 4 min 37 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-ther-65-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
