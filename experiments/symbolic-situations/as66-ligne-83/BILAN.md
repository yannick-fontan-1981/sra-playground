# AS66 · ligne 83

**Qualification indépendante acquise dès d0e7527c.** Sur chacune des deux révisions, le service libère deux sondes historiques et accepte une autre sonde à la première décision de L2. Le retour de cette autre commande déclenche immédiatement un ticket d’accès différent. L’arbre `src` est identique à `1aaafe36`. [Critères préalables](https://github.com/yannick-fontan-1981/sra-playground/blob/9121949c36147fd332d2f4e683cadd81c9cc7b6b/experiments/symbolic-situations/as66-ligne-83/CONTRAT.md).

| Départs par révision | Ticket et retour mesurés |
|---|---|
| 1 parcours historique | T6, corps `[11,4,4]` en (48,26), après `[8,4,4]` au niveau précédent. La cavité de 80 pixels et la surface reçoivent leurs propres références. T6 ACTION1 et T7 ACTION4, famille `sliding_cavity`, besoin `test_missing_control`. Déplacements nets (ligne, colonne) = (+20,0) et (0,−8). Les pas de quatre pixels des images intermédiaires attestent (−1,0) et (0,+1). Aucun résultat de sonde n’était prédit. T8 libère `sliding_cavity_access / ACTION1`, retour conforme. |
| 1 accès alternatif dans le jeu | Même préfixe et mêmes preuves au T6. La substitution d’une offre native libère ACTION4. Le corps arrive en (28,26), la question directionnelle cède dès T7 à `sliding_cavity_access / ACTION2`, retour conforme. |
| 2 départs construits à L2 | Un pixel manquant au corps ou la disparition de la cavité fait perdre la sonde. Le service libère dans les deux cas `observed_frontier / experiment / ACTION2`. |
| 2 départs à retour stationnaire | Même image après T6, nouvelle occurrence. La prochaine sonde fraîche ACTION4 obtient un ticket. La même offre, portant seulement la référence antérieure, passe le garde de géométrie puis s’arrête à `composition_target_stale_proposal`. |
| 2 départs de réserve | Même contrôle après translation des objets d’une colonne. L’image, la commande, les preuves, la clé et le garde sont identiques entre les deux bras au moment du choix. Un ticket frais, zéro ticket périmé. |

**16 exécutions de service**, huit départs sur le gel et les mêmes huit sur la révision de preuve. Les trois empreintes de groupe coïncident entre révisions. Le jeu Python a reproduit séparément 10/10 observations du parcours historique et 8/8 du parcours alternatif, dont six communes. L’évaluateur vérifie sur les images la position et le sens, rattache le retour au ticket et rejette les attributions altérées (corps, occurrence, sens déduit du seul déplacement net). Le verdict concerne la sélection de sonde et le retour à l’accès.

Depuis ce dossier avec Node 24 et un dossier de reçus existant, utiliser les SHA complets de [CONTRAT.md](CONTRAT.md). La sélection réservée reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','1aaafe36177ab73edf63c18f1a0950bd790a9c6c')) {
  $court = $sha.Substring(0,8)
  foreach ($groupe in @('parcours','développement','réserve')) {
    node qualifier.mjs $sha $groupe "$reçus/$court.$groupe.json" "$reçus/selection.json"
  }
}
node verifier.mjs $reçus
node jeu.mjs $pyodide
```
