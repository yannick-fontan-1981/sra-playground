# REGN/80 · comparer une branche après son retour

**La ligne 80 est déjà fonctionnelle sur le gel `d0e7527c` dans deux niveaux de REGN.** Le service exige un épisode refermé sans score et une question encore ouverte à la bifurcation. L’arbre `src` de `6bfb8ccf` est identique au gel. Les deux références ont produit exactement les mêmes reçus sur **six départs et 66 gestes chacune**. [Présélection](CONTRAT.md) · [Reçu indépendant](recu.json)

| Situation | Accès connu | Essai inédit et reprise |
|---|---|---|
| N1 | Les deux ACTION3 précédentes reviennent à l’image initiale sans changer d’époque ni de score. T3 sélectionne `returned_branch_contrast / access`, cite une arête et émet ACTION3. Le retour correspond à l’image prévue. | Au T4, la même famille teste ACTION4 sans image prédite. Le retour ferme le préfixe avec `matched:null` et le jeu passe au N2. |
| N2 | L’épisode se referme après trois transitions. Les deux arêtes de l’accès justifient les ACTION3 de T8 et T9. Les deux images prédites sont confirmées. | Au T10, ACTION4 teste la question ouverte sans prédiction. Le retour passe au N3. |

**Nécessité de la preuve.** Quatre interventions, une par couple niveau × donnée retirée. À plateau et historique du service identiques, retirer au seul fournisseur la dernière transition, ou retirer la seule question de son domaine, fait disparaître son offre dans les quatre cas. Le service émet alors ACTION4 pour `observed_frontier / test_local_input`, avec un effet inconnu et sans progression de niveau à ce tour. En N1 la famille de contraste redevient pertinente au T5 et émet cette fois ACTION4 comme accès confirmé. Les deux domaines de bifurcation mesurés contiennent chacun une question. Le lot établit l’effet du retrait, sans prétendre avoir choisi entre deux questions de contraste simultanément admissibles.

**Attribution et budget.** Les quatre tentatives d’attribuer à l’accès le reçu d’une sonde ou d’un autre niveau sont rejetées. Avec une limite de lecture identique de 16, les budgets globaux réellement transmis de 16 et de 600 produisent les mêmes commandes jusqu’au T16 inclus. Le premier écart d’attribution se produit au T16 en N3. Avec 16, `observed_frontier` donne ACTION4 pour atteindre une question. Avec 600, `returned_branch_contrast` donne ACTION4. L’image réellement rendue et l’accord physique sont identiques. La qualification de la ligne 22 possède son propre protocole.

La vérification de l’auteur a aussi terminé ses 11 parcours sur les trois révisions publiées. Les six départs par SHA ci-dessus forment la mesure opérateur distincte.

### Rejeu

Dans ce dossier avec Node 24, définir le chemin absolu de Pyodide et un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','6bfb8ccf9df3aa8597e74f0fd3f30a5744c55b35')) {
  foreach ($g in @('budget','n1','n2')) {
    node qualifier.mjs $sha $g $pyodide "$reçus/$($sha.Substring(0,8)).$g.json"
  }
}
node verifier.mjs $reçus
node qualifier.mjs 6bfb8ccf9df3aa8597e74f0fd3f30a5744c55b35 auteur $pyodide "$reçus/6bfb8ccf.auteur.json"
```
