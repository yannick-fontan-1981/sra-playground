# CONN · deux verdicts indépendants sur le gel

**Les lignes 63 et 66 disposent chacune d’une substitution fonctionnelle sur `d0e7527c`.** La révision de preuve `f8607d2a` partage avec le gel le même arbre moteur (`a1cbde2a`). Les neuf départs et leurs 90 gestes exécutés par SHA donnent des reçus identiques entre les deux révisions. Un des neuf départs est une fixture d’admission sur un champ isolé. Les 17 observations du parcours nominal concordent avec l’archive du jeu, animations incluses. [Présélection](CONTRAT.md) · [Reçu comparatif](recu.json)

| Ligne | Parcours historique | Substitution et repli dans le vrai jeu |
|---|---|---|
| **63 — prolonger une série, 5/5** | T1 propose (15,13). Quatre champs soutiennent une extension de longueur 3 à 4, couleur 11. Aux trois premiers retours, les pixels de la case confirment l’extension. T4 la réfute. T5 franchit le niveau et donne une longueur 4 associée au score. Conserver uniquement le champ de l’adresse initiale laisse le motif local visible. Le service passe alors à la frontière en (11,15). | Écarter le seul point nominal des entrées admissibles fait choisir **(47,22)** à la même famille. Le jeu confirme l’extension. T2 reprend en (15,13). Retirer l’offre entière donne la frontière en **(1,61)**, sans prédiction confirmée. Après ce retour, la série reprend en (15,13) et le geste est confirmé. |
| **66 — préparer l’appui, 4/4** | T13–T16 s’appuient sur la longueur acquise à T5 et sur les insertions du N3. Les quatre retours confirment une contribution et une réponse compatible. T13 vise (38,46). | Écarter le seul point nominal donne **(31,46)**. Le jeu confirme la préparation et T14 reprend en (52,32). Retirer l’offre entière donne **(10,25)** à la frontière. Après son retour, T14 reprend la préparation en (31,46), que le jeu confirme. |

**Contrôle temporel de 66.** Sur les animations des retours T10, T11 et T12, la première image à partir de laquelle la case de contribution reste acquise est respectivement 14, 12 et 9. Celle de la réponse est 31, 29 et 19 (indices à partir de zéro). Le vérificateur relit les rectangles de pixels sur les 35, 33 et 23 images correspondantes. Une image finale donne les deux cases au même instant dans chacun des trois cas.

Les trois images finales conservent donc les placements et la longueur scorée. Si l’on garde seulement ces images, T13 passe à la frontière (10,25), puis T14 à (10,18). **Tronquer uniquement le retour T12 suffit** à obtenir les mêmes décisions. Les deux observations encore ordonnées ne contiennent pas le blocage d’extension qui justifiait la préparation. En retirant uniquement la longueur de but pendant le choix T13, sur les trois animations complètes, la frontière reprend également en (10,25). Quand le but redevient disponible à T14, le service reprend la préparation en (31,46) et reçoit sa propre confirmation.

### Rejeu

Dans ce dossier avec Node 24, pointer `$jeu` vers la racine du Banc contenant `public/vendor/pyodide` et `public/python`, et `$reçus` vers un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','f8607d2ac0dac47900da3504365b3968a523a549')) {
  foreach ($groupe in @('initial','appui','temps')) {
    node qualifier.mjs $sha $groupe $jeu "$reçus/$($sha.Substring(0,8)).$groupe.json"
  }
}
node qualifier.mjs f8607d2ac0dac47900da3504365b3968a523a549 tests-auteur $jeu "$reçus/f8607d2a.tests-auteur.txt"
node verifier.mjs $reçus
```

La commande `tests-auteur` exécute séparément les sept tests de la branche avec le jeu actif. Le vérificateur des neuf départs peut également relire les reçus opérateur seuls.
