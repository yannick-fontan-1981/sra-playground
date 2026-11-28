# VC33/3 · transfert de bandes

**La mesure du sens, la prédiction et la reprise sont déjà fonctionnelles sur le gel. La sélection remplaçable de la première sonde est démontrée sur `f489393b`.** Sept départs et 27 tickets avec retour par SHA. Le parcours nominal possède 16 tickets identiques et 17 observations publiques vérifiées dans le jeu natif. [Contrat opérateur figé](CONTRAT.md) · [Reçu](recu.json)

| À partir de la même présentation initiale (32,12) | Ticket et effet physique | Décision suivante |
|---|---|---|
| Mesure nominale sur les deux moteurs | T1 clique en (61,25) sans prédiction signée. Les quantités mesurées deviennent (36,8), ce qui soutient un transfert de quatre unités vers la bande cliquée. Le reçu de mesure a `matched:null`. | T2 clique en (61,33), cite le retour de T1 et prédit (32,12). Le jeu confirme ce vecteur. La cible de 24 sur la seconde bande est à quatre gestes minimaux depuis (36,8). |
| Sélection de l’autre actionneur à T1 | Le gel garde le ticket nominal. Sur branche, les indices 0 et 1 sont admissibles. Sélectionner 1 libère (61,33), sans prédiction. Le jeu donne (28,16). | Le même point (61,33) est alors utilisé avec une prédiction distincte, (24,20), confirmée physiquement. La cible est à deux gestes minimaux depuis (28,16). |
| Retrait de la sonde à T1 | Le candidat donne le point (21,36) à la frontière. Après son retour, la famille des bandes rouvre la première sonde (61,25) et acquiert son propre résultat (36,8). | Sur le trajet nominal au T2, le sélecteur de sonde n’est pas appelé. Demander le même retrait à T2 conserve le ticket d’alignement et son effet. |

**Trois retours construits.** Une image stationnaire après T1 conserve (32,12). Le premier essai est mémorisé mais le sens reste inconnu. Le ticket suivant (61,33) est une nouvelle sonde. Un transfert apparent d’un pixel, (33,11), conserve aussi la somme 44 mais contredit l’unité de 4. Les deux moteurs réfutent le modèle et passent à la frontière. Enfin, supprimer la référence fixe au véritable retour (36,8) laisse le sens appris disponible mais empêche l’alignement. La famille se retire et le service passe à la frontière en (61,25).

Sur les 16 retours historiques, 13 prédictions de vecteur sont confirmées, le premier geste mesure le sens et deux gestes franchissent officiellement le niveau. Le contrôle couvre deux bandes horizontales au N1, trois au N2 et cinq verticales au N3. L’évaluateur mesure chaque longueur dans les pixels. Au N1 il énumère les premiers contrôles de tous les trajets minimaux. Les six tests de l’auteur passent avec le jeu actif sur le candidat, ainsi que les trois tests applicables au gel.

### Rejeu

Depuis ce dossier avec Node 24, `$jeu` désigne la racine du Banc contenant `public/python` et `public/vendor/pyodide`. Utiliser un dossier `$reçus` neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','f489393bb15a1ce775a3904ee97a216d40db026f')) {
  foreach ($g in @('parcours','retours','tests-auteur')) {
    $ext = if ($g -eq 'tests-auteur') {'txt'} else {'json'}
    node qualifier.mjs $sha $g $jeu "$reçus/$($sha.Substring(0,8)).$g.$ext"
  }
}
node verifier.mjs $reçus
```
