# VOIS · ligne 62

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `1391bd741ad11addfce68370db8969cd3d37b6b0` ont le même moteur. Six départs et 27 gestes par SHA donnent des reçus identiques.

- Au T1, les carrés définissent les places `[5,6]` et `[5,7]`. Les pions `[5,3]` et `[5,10]` sont à égalité de distance. Le service pointe le premier en `(15,23)`. Le retour identifie le pion en attente. Le vrai ACTION1 au T2 le déplace seul vers `[4,3]` et étaye le contrôle. Sur le retour stationnaire construit, la loi n’est pas acquise.
- Déplacer seulement le carré 8 de `(55,55)` vers `(55,59)`, à pions inchangés, modifie les places en `[5,7]` et `[6,6]`. Le service choisit le second pion en `(43,23)`. Retirer le carré 14 donne deux pions pour une place. Retirer séparément le second pion donne une unité pour deux places. Dans les deux cas l’offre de population n’est pas libérée. Le repli de contact animé joue le même clic et produit le même vrai retour sur le jeu.
- Au T6, les longueurs des quatre trajets donnent la matrice `[[3,4],[4,3]]`. Le seuil 3 impose l’appariement entier `[5,3]→[5,6]` et `[5,10]→[5,7]`. Le moteur joue le déplacement du seul premier pion aux T6–T8 et le retrouve en `[5,6]`. Garder le même paquet joué au T6 et altérer le motif de référence dans l’image servie réfute la projection, ferme le plan et suspend la revalidation sans nouveau ticket.
- Le vrai T14 termine N1. Le service remesure quatre pions et quatre places au T15, tout en gardant les quatre directions. Le retour T16 confirme le mouvement du pion pointé de `[7,9]` vers `[6,9]`. Ce mouvement n’implique pas un nouveau passage officiel.

Présélection `497ff17e`, bilan d’auteur `4ce57872507613a988c3472bcc581c0e145f4ba8`. Premier essai à 01:09:23, verdict à 01:14:00 (UTC−3, 4 min 37 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-vois-62-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
