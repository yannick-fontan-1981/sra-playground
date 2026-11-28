# REGN/22 · rejoindre une question encore ouverte

**La ligne 22 et le remplacement de sa recherche d’accès sont fonctionnels sur le gel `d0e7527c`.** À N3/T16, sur le même état, un autre calcul d’accès fondé sur les seules observations peut faire viser une autre question. Le premier ticket ACTION4 coïncide, mais le second change, ainsi que le besoin auquel les retours sont attribués. La référence de qualification corrigée est `be816a3f09e7b36d9393aaead8d835d9dc3850c5`. Ses changements depuis `626afb83` portent sur une assertion et sa documentation. [Critères opérateur](CONTRAT.md) · [Reçu vérifié](recu.json)

| Réglage au départ de N1 | Décision au N3/T16 | Ce que le retour établit |
|---|---|---|
| Budget global 16, lecture de 16 gestes | `observed_frontier / reach_open_input / access`. Le service libère ACTION4. | Le plateau prévu est atteint. Le budget de session ferme le parcours. La question distante reste ouverte. |
| Budget global 17, lecture de 17 gestes | Même accès et même retour physique au T16. | Le service émet ACTION3 au T17 comme continuation du plan. Son effet était inconnu. Le reçu porte `observed` pour la question distante et son besoin. |
| Budgets de niveau seuls, lecture de 16 gestes | `returned_branch_contrast` émet ACTION4 au T16. | L’image confirmée est la même. L’attribution appartient ici à la ligne 80. |

**Deux appels avant le ticket 16.** `advance` reçoit le résultat du ticket 15 à la séquence 15 et rend `boundary`, sans ticket. À la même séquence, `resume` rend `action` et délivre le ticket 16, ACTION4. Une coupure de lecture à 15 s’arrête après le premier appel. Ce dialogue a été enregistré sur le gel et la référence corrigée.

**Preuve disponible avant émission.** Les deux commandes locales ont déjà un témoin d’essai. L’énumération indépendante des chemins simples sur les arêtes déterministes observées retrouve **trois questions distantes distinctes**, à une, deux et trois arêtes. Toutes utilisent la même première arête, attestée par la commande et le retour du T12. Le vérificateur recalcule ses témoins à partir des tickets antérieurs. La question nominale `Q_8b45c6cdc354b85cd0a2` est celle à une arête.

| Intervention au T16, budget 17 | Libération mesurée et suite |
|---|---|
| Remplacer `ObservedFrontier.access` par l’énumération indépendante et rendre la question la plus proche | Les deux tickets, le besoin et le reçu d’acquisition sont identiques au nominal. Le remplacement a été appelé sur l’observation de T16. |
| Remplacer la contribution par la seconde question admissible, sans retirer d’offre du domaine | La question devient `Q_af0257e2c8ca6ad0386a`. Le besoin change. T16 puis T17 exécutent deux ACTION4 d’accès avec leurs deux projections confirmées. Le budget est épuisé avant d’interroger cette seconde destination. |
| Retirer uniquement la première question | La recherche native retrouve cette seconde question et produit exactement les mêmes deux tickets et retours que la substitution précédente. |
| Retirer seulement la première arête, ou retirer la contribution de recherche entière | Deux départs distincts, même résultat. Les quinze premiers tickets sont conservés. Le service s’arrête au choix T16 avec `frontier_frontier_exhausted`, sans libérer de commande ni recevoir d’effet supplémentaire. |

**Décompte.** Huit départs communs et 130 gestes exécutés sur chacun des trois SHA `d0e7527c`, `626afb83` et `be816a3f`, avec parité des reçus. Le catalogue `8ce7ee35` a été rejoué sur son départ de 16 gestes. Deux départs supplémentaires par SHA sur le gel et la référence corrigée (15 puis 16 gestes) vérifient les appels du service. Total **29 départs et 468 gestes**. Ce résultat attribue la composabilité mesurée au point d’accès déjà présent sur le gel.

### Rejeu

Depuis ce dossier avec Node 24, fournir un dossier de sortie neuf et le chemin absolu de Pyodide.

```powershell
$gel = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021'
$preuve = '626afb83bcc904c6be987fae08fae01b7bd8a94b'
$corrige = 'be816a3f09e7b36d9393aaead8d835d9dc3850c5'
foreach ($sha in @($gel,$preuve,$corrige)) {
  foreach ($g in @('budget','preuve','substitution','autre')) {
    node qualifier.mjs $sha $g $pyodide "$reçus/$($sha.Substring(0,8)).$g.json"
  }
}
foreach ($sha in @($gel,$corrige)) {
  node qualifier.mjs $sha appels $pyodide "$reçus/$($sha.Substring(0,8)).appels.json"
}
node qualifier.mjs 8ce7ee3563fa1d5eca1639c6ad03975cfc962460 catalogue $pyodide "$reçus/8ce7ee35.catalogue.json"
node verifier.mjs $reçus
```
