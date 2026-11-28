# WA30 · deux preuves de contact

**Ligne 26.** Le gel éprouve la relation des contours et confirme leur translation au geste suivant. Le candidat permet de retirer l’offre frontale au sein du fournisseur. **Ligne 31.** Le gel acquiert déjà l’essai d’un site et passe au suivant. Le candidat permet de substituer l’autre site au même état. Le vrai retour du premier site ne montre aucun déplacement. [Contrat scellé](CONTRAT.md) · [Reçu opérateur](recu.json)

Les deux révisions reproduisent les 16 commandes, leurs familles et leurs retours du catalogue. Un deuxième départ transmet effectivement un plafond de 19 au service. Il reproduit les 16 premiers tickets et retours, puis permet de jouer la reprise. Les observations nominales concordent avec la trace publique archivée.

### Ligne 26 · relation puis transport

Le retour de T2 publie une invitation devant le porteur en (8,10), orienté (0,−1). T3 libère ACTION5 sous `oriented_coupling / conditional_oriented_coupling`, sans prédiction de pose. Les 12 pixels modifiés appartiennent à la bordure du seul contour voisin. La tuile du porteur est inchangée. Le reçu garde le voisin en (8,9) comme candidat et laisse `coupled=false`. Au T4 suivant, ACTION1 déplace les deux tuiles d’un pas vers le haut, soit quatre pixels. Les mêmes pixels de chaque motif se retrouvent à leurs nouvelles positions. Le retour confirme la translation conjointe et donne `coupled=true`.

Retirer uniquement l’invitation au T3 conserve le plateau et libère ACTION1 sous `observed_frontier`. Ce mouvement laisse le plateau stable. Le couplage peut alors proposer ACTION5 au T4. Le retrait interne `frontalContactTrial` de la branche donne les mêmes tickets et retours. La réserve a trouvé une seule composante de 12 pixels au retour de T3. Sa conservation reproduit la décision nominale. Le témoin stationnaire complémentaire conserve la trace de l’essai, laisse la relation vide et rend le ticket suivant à la frontière.

### Ligne 31 · site essayé et effet visible

| Départ | Ticket | Retour et suite |
|---|---|---|
| Catalogue, T16 | `pre_score_contact / observed_effect_access`, ACTION1, site (36,29) | Les pixels sont identiques. Le reçu date l’essai et porte le vecteur de commande connu (0,−4). Il ne confirme ni le déplacement ni un effet distant. |
| Prolongation, T17 | Même famille, ACTION3, autre site (32,33) | Le porteur passe de (36,33) au voisin de gauche. La tuile du porteur quitte son emplacement et ses couleurs sont retrouvées à gauche. Le retour change 44 pixels et date le second essai. Aucun effet distant n’est attribué. T18 appartient au couplage. |
| Substitution au T16 sur la branche | Même famille, ACTION3, site (32,33) | Le reçu d’essai appartient à l’accès au contact. T17 appartient au couplage. |
| Retrait de l’offre au même T16 | `oriented_coupling`, ACTION3 | Même commande et même image de retour que sous substitution. Le couplage reçoit le ticket et aucun essai d’accès au contact n’est acquis. Le vérificateur rejette le reçu qui confond les deux attributions. |

La réserve T16 présente le plateau antérieur dans toutes les images. Le vrai retour est déjà stationnaire. L’essai est acquis et le site suivant reste (32,33) dans les deux présentations. En supprimant uniquement l’inscription de l’essai, le service redemande (36,29). Le complément stationnaire au T17 masque les 44 pixels du vrai déplacement. Le reçu garde la tentative et son vecteur connu. Ces informations suffisent à quitter le plan d’essai sur ce départ, avec un prochain ticket de couplage. Elles ne prouvent pas que le déplacement a eu lieu dans l’observation servie.

Les 13 occurrences catalogue de la ligne 26 sont couvertes sur WA30. La ligne 31 couvre une des 11 occurrences du catalogue. Le second site joué à T17 relève du parcours prolongé.

Le transport fixe l’identifiant de session pour comparer les départs. Le numéro du ticket T16 est donc identique entre les variantes. La vérification utilise aussi son propriétaire et le reçu acquis par cette famille.

Le gel couvre 9 départs et 111 gestes. Le candidat couvre 12 départs et 149 gestes. Les suites de l’auteur passent avec le vrai jeu, 4 sur 4 applicables au gel et 7 sur 7 sur le candidat. Le verdict a été vérifié 6 min 45 s après le scellement. Le groupe des retraits a été rejoué après correction du harnais. Le retrait d’un résultat de `EffectAccess.propose` renvoie désormais une abstention structurée, conformément à son contrat.

### Rejeu

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de reçus neuf. La sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','14a185d909d3b3cb42fcc8584b841865b8ff6dd0')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node qualifier.mjs 14a185d909d3b3cb42fcc8584b841865b8ff6dd0 branche $jeu "$reçus/14a185d9.branche.json"
node verifier.mjs $reçus
```
