# SEQN · qualification indépendante des lignes 11 et 81

**Les deux lignes sont qualifiées sur le gel.** `b5dda8ec` a le même arbre moteur que `d0e7527c` et reproduit les mêmes décisions et retours. Les parcours sous plafonds communiqués de 16 et 19 gestes concordent jusqu’à T16. [Contrat scellé](CONTRAT.md) · [Reçu vérifié](recu.json)

### Ligne 11 · deux canaux d’un vrai retour

Les sept premiers gestes ramènent le jeu à la même image, dans la même époque et au même score. T8 libère ACTION1 sous `factored_material_return / public_factored_return`. Le plan sépare les rangées 60 à 62 du reste du plateau à partir des observations précédant T2, T4 et T5. Les deux projections sont confirmées sur T8–T10 pour ACTION1, ACTION3 et ACTION2. T11 joue ACTION4, termine N1 et obtient un résultat indéterminé au franchissement officiel.

À observation courante identique, supprimer le témoin précédant T2 de l’épisode consulté rend T8 à la frontière. Elle joue ACTION4 puis ACTION1, sans échantillon attribué au retour factorisé. Sur le vrai ticket T8 de la réserve, le jeu change 103 pixels matériels et 3 pixels de bande. Le paquet construit conserve les 3 pixels de bande et occulte les 103 autres. Une seule des deux projections concorde. Le service contredit la prévision, scelle le pas, n’acquiert aucun échantillon de réécriture et libère ACTION4 par la frontière.

### Ligne 81 · preuve transportée après la progression

Les trois échantillons acquis sous 11 à T8–T10 et la frontière officielle T11 produisent un modèle de couleur 5→14. Le modèle porte les références précédant ces trois échantillons et celle précédant ACTION4 au T11. T12 en N2 s’appuie sur ce modèle, joue ACTION1 sous `scored_local_rewrite / public_scored_rewrite` et revalide les 30 pixels du masque situé en (16,34).

- **Dépendance au modèle.** Retirer seulement l’attestation du modèle à T12 conserve ACTION1 et la même animation réelle. Le ticket appartient alors à la frontière et aucun reçu `scored_rewrite_test` n’est acquis. Le modèle disponible à nouveau autorise ACTION2 à T13 et le vrai retour le confirme.
- **Dépendance aux échantillons de 11.** Laisser un seul des trois échantillons à la qualification du modèle au T11 conserve le vrai franchissement et son paquet. Aucun modèle associé au score n’est acquis. T12 appartient à la frontière.
- **Réserve sur le masque.** Le vrai jeu réécrit les 30 pixels. Le paquet construit conserve ces pixels à leur état précédent. Le reçu de revalidation réfute ACTION1, scelle le pas et relie cette réfutation à T12. Le service garde un autre test du modèle et choisit ACTION2.

La comparaison rejette un reçu de revalidation portant la référence d’un autre retour. Le parcours prolongé observe la reprise en N3 après la progression officielle à T18.

### Périmètre et rejeu

Sept départs et **89 gestes par SHA**. Le catalogue couvre les **4 occurrences de 11 et les 5 occurrences de 81**. Les cinq tests de l’auteur passent sur les deux références avec le vrai jeu. Le verdict a été vérifié **2 min 41 s** après le premier essai indépendant. Le vérificateur a été repris sur les mêmes reçus pour comparer les champs de provenance du modèle acquis et du modèle restauré, et pour dénombrer les 30 pixels du masque plutôt que les 49 cellules de sa boîte 7 × 7.

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','b5dda8ecb17b1725816bae09b44973449869dbae')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
