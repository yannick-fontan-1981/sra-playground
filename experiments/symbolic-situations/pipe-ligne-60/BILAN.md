# PIPE · ligne 60

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `aa75791a365b1ab6edcfa6a464654c6432cb3b46` ont le même arbre moteur. Sur chaque SHA, les six départs, 42 gestes de service et un geste auxiliaire donnent les mêmes reçus. Les 16 gestes du catalogue relèvent de la composition de ports.

- Au premier ticket, la grille présente quatre raccords réciproques et huit ports ouverts. Une énumération indépendante des rotations admissibles trouve huit affectations orientées qui donnent un graphe fermé, connexe et sans cycle. Le coût minimal est de quatre quarts de tour, avec le sens horaire comme dans le cas où le sens reste inconnu. Ce calcul de coût ne présume pas le résultat officiel.
- T1 `ACTION6(16,28)` fait tourner d’un quart de tour horaire la seule cellule 3, dont les ports nord et est deviennent est et sud. Le raccord réciproque 3 sud–6 nord apparaît et les autres cellules gardent leurs ports. La sélection visible et la paire des observations font acquérir la méthode. Le retour du geste exploratoire reste `matched:null`.
- Un stationnaire construit ne confirme aucun raccord. Le retour auxiliaire du vrai clic sur la cellule 0 relie 0 à 3 et ouvre 0–1. Servi au ticket de la cellule 3, il n’acquiert aucune méthode pour cette cellule. Les premiers replis sont réellement joués.
- Au T2, retirer la seule méthode garde `ACTION6(48,28)` mais ramène le plan de trois gestes à un essai sans prédiction. La rotation est alors à nouveau acquise par le vrai retour. Au T4, substituer à la paire récente celle du T1 conserve l’offre. Cette paire atteste elle aussi le quart de tour dans la même géométrie et la même époque.
- En N2/T5 et N3/T13, une réépreuve lie la méthode à la nouvelle époque. En N2/T6, le moteur prépare sept opérations. Les passages officiels des T4 et T12 sont comptés séparément. Au T14, ajouter un pixel hors de la grille au retour présenté conserve les ports et `matched:true` mais scelle le préfixe. Au T15, le même clic `ACTION6(14,22)` est réellement joué et confirmé à l’indice 0 d’un plan de deux pas. Le départ nominal continue à l’indice 1 du plan de trois pas.

Présélection `a7040ffa`, bilan d’auteur `28b78d80e9f395acb1ab5be8142e2efd2e0296e2`. Premier essai à 00:56:18, verdict à 01:01:29 (UTC−3, 5 min 11 s). Le contrôle du pixel extérieur a été joué en complément après la première passe nominale. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et Pyodide local.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-pipe-60-' + [guid]::NewGuid())
node qualifier.mjs d0e7527ca8033bd805a6d7a8bb021eff62e87021 $py $out
node qualifier.mjs aa75791a365b1ab6edcfa6a464654c6432cb3b46 $py $out
node verifier.mjs $out
```
