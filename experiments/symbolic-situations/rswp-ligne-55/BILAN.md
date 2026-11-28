# RSWP · ligne 55

**Qualification indépendante au gel.** La reprise des T8 et T16 repose sur la correspondance locale remesurée. Le journal `effects` n’est requis dans aucun des deux départs. Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `f3051af812f4f7f74f0179a804a87753bffa5910` ont le même arbre moteur et les mêmes reçus sur neuf départs et 91 gestes par SHA.

- Au T1, `ACTION6(45,12)` confirme la sélection du panneau supérieur. Le retour modifie 32 pixels de ce panneau et aucun pixel de zone. Le contrôle stationnaire est contredit et produit un arrêt bloquant. Au T4, retirer seulement la sélection mémorisée ramène le plan de trois gestes à un seul. Le premier clic `(45,17)` et son vrai retour concordent.
- Au T7, ACTION5 modifie 21 pixels dans chacune des trois zones, sans changement officiel de niveau. Les matériaux des panneaux passent de `[15,12,13]` à `[12,13,15]`. Au T15, la même ACTION5 modifie à nouveau 21 pixels par zone, avec les matériaux `[13,15,12]` inchangés. Les reçus d’application sont rattachés à leurs deux références et portent `matched:null`.
- Vider le seul journal des effets au T8 ou au T16 conserve l’observation, les contributions de la proposition, le paquet de gestes et le vrai retour qui suit. La configuration suivante démarre par `ACTION6(45,12)` dans les deux contextes. Le contrôle construit qui remet la première zone du retour dans son état avant application ramène les changements à `[0,21,21]`. La correspondance mesurée, les contributions et le vrai ticket de configuration restent identiques.
- Retirer la seule pièce de la zone supérieure qui montre la correspondance, à panneaux, deux autres zones et journal inchangés, bloque le service aux T8 et T16 sur `panel_service_correspondence_unresolved`. Les pièces retirées valent 12 et 13, dans les boîtes `[28,20,30,22]` et `[28,53,30,55]`. Aucun repli n’est libéré. Ce contrôle touche le fait remesuré nécessaire. La somme de changements du retour ne suffit pas à identifier ce fait.
- Le catalogue joue 16 tickets de la famille et termine deux niveaux. Les deux applications suivies ne font pas progresser le score. Les modifications de retour des variantes sont étiquetées et séparées du vrai paquet.

Présélection `c7db37eb`, attentes auteur `47ef461c`, bilan auteur `4d5f0df00a945896664ed3afc37bb11b32fc4595`. Premier essai à 00:42:43, verdict à 00:51:25 (UTC−3, 8 min 42 s). Première passe complète. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-rswp-55-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
