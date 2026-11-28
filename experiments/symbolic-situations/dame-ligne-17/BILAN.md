# DAME · ligne 17

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `775f40c5505add040d3b1c1aac5aba8d0dd0a027` ont le même moteur. Six départs et 35 gestes par SHA donnent des reçus identiques.

- T1 sélectionne `[2,0]` en `(31,19)). Les cinq membres gardent leur place et le retour montre deux invitations `[0,2]` et `[4,2]`. Au T2, le vrai clic `(17,33)` déplace le sujet vers `[0,2]` et retire l’intermédiaire `[1,1]`. La population passe de cinq à quatre. L’enregistreur acquiert la relation sous la référence de ce retour.
- Masquer une invitation dans le vrai paquet T1 conduit au clic opposé `(45,33)`, joué sur le jeu et suivi d’une réduction à quatre membres. Masquer les deux invitations conduit à une autre sélection `(24,26)`, avec cinq membres. Quand seul l’intermédiaire est restauré dans le retour T2 présenté, l’arrivée du sujet reste visible. Aucune réduction n’est acquise et le même clic de nouvelle sélection est joué.
- Au T3, le nominal utilise la relation du T2 et choisit une prise dans un plan de cinq gestes après avoir examiné huit états. Retirer la seule relation à même vue conserve `(31,47)` mais le transforme en sondage d’un seul geste. Le vrai résultat physique est identique et la réduction à trois membres est alors acquise par cette nouvelle mesure.
- En N2, les sept membres sont remesurés. Le modèle repris conduit au même clic de sélection T8 au départ témoin, avec un plan de huit gestes issu de 33 états. Retirer la relation à cette coupure garde le clic et son vrai retour, avec un plan de sélection d’un seul geste. Dans le nominal, T9 confirme la première réduction à six, puis T15 reçoit le passage officiel. Le premier passage officiel était au T7.

Présélection `7266e525`, bilan d’auteur `b7289bfb221eee9284927f74314ee46b0ed5f1a7`. Premier essai à 01:21:43, verdict à 01:28:02 (UTC−3, 6 min 19 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-dame-17-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
