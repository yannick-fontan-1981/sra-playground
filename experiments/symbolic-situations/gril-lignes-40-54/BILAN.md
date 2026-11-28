# GRIL · qualification indépendante des lignes 40 et 54

**Les deux contributions sont déjà consommées et peuvent être retirées séparément sur le gel.** La révision `915e0601` a le même arbre moteur que `d0e7527c` et reproduit les mêmes tickets et retours. Les observations nominales concordent avec l’archive publique. [Contrat scellé](CONTRAT.md) · [Reçu vérifié](recu.json)

### Ligne 54 · soumettre une réponse dans la vue courante

Au T2 de N1, `occluded_catalogue_composition / occluded_catalogue_experiment` libère ACTION6 en (11,53). Le substrat 5 qualifie le candidat 0 pour la palette 8. Le moteur acquiert un reçu `catalogue_response`, daté par les observations avant et après, avec 63 pixels changés et un résultat indéterminé. T3 peut alors essayer le sélecteur de palette 9. En N3, T12 soumet le candidat 3 en (54,53) avec sa propre preuve. Le retour change 53 pixels et T13 essaie également la palette 9.

Retirer seulement le reçu de soumission de T2 dans la mémoire consultée, avec le vrai retour et le candidat conservés, fait répéter le clic en (11,53). Le second retour laisse les pixels inchangés. Le service enregistre sa propre soumission et redemande ensuite le sélecteur. L’épreuve isole le rôle de l’inscription de la tentative.

Dans la réserve, 31 des 63 pixels du vrai retour T2 restent visibles. Le service date toujours la soumission de la palette 8. Le sélecteur nominal disparaît de la décision suivante et T3 devient ACTION4 sous la frontière. La preuve de soumission survit donc à cette observation partielle, avec une suite différente à cause de l’état perçu.

### Ligne 40 · accéder à une nouvelle vue

Au T4 de N1, `catalogue_view_experiment` réutilise ACTION3 à partir du témoin du T1. Ce retour de frontière avait changé le champ tout en préservant la structure du catalogue. Le ticket T4 change 39 pixels et fait passer les candidats de `[0,1,2]` à `[2]`. Le reçu demande une nouvelle comparaison. En N3, la preuve d’accès propre au T11 autorise ACTION3 au T15. Son retour change 57 pixels et fait passer les candidats de `[0,1,2,3]` à `[0]`.

Retirer seulement le témoin T1 libère ACTION4 sous la frontière au T4. Le vrai retour change 50 pixels et apporte son propre témoin. Retirer les deux événements de T2 à état T4 identique reproduit exactement l’offre nominale. Le lien entre 54 et 40 passe par le changement de palette qui conduit à l’état T4. La preuve d’accès consommée par 40 vient de T1.

En N3, retirer le témoin T11 en laissant disponible celui de N1 écarte l’offre de vue. T15 passe à ACTION4 sous la frontière. Le vrai retour change 39 pixels et date un nouveau témoin. T16 conserve la même commande de soumission que dans le parcours nominal. La preuve du changement de vue est propre à chaque ticket.

La réserve stationnaire après le vrai T4 garde `field_changed=false` dans le reçu construit, laisse les trois candidats et conduit à ACTION4 au T5. Le jeu avait changé 39 pixels sur ce ticket. Trois faux reçus à référence d’arrivée empruntée sont rejetés par le vérificateur.

### Périmètre et rejeu

**7 départs et 48 gestes par SHA**, dont un catalogue de 16 gestes. Les neuf occurrences catalogue de 54 et les deux de 40 sont couvertes. Les quatre tests de l’auteur passent sur chaque moteur avec le jeu actif. Le verdict a été vérifié **3 min 01 s** après le premier essai. Le groupe des retraits a été rejoué après correction du harnais. Le numéro de révision du retour se lit sur l’argument d’observation, qui suit la commande dans `record`.

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','915e0601e3aad82653733ac602909bef2286343d')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
