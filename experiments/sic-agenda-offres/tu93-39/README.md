# TU93 · ligne 39 · accès par transitions alternées

Le témoin est N1/T15 `public_occurrence_recall / alternating_graph_composition / alternating_graph_access / ACTION4`. Le rejeu part de L1, ouverture native, plafond de session 16 et plafond de niveau 600, sur la référence `8ce7ee35` et le gel `d0e7527c`. Les deux tickets de cette offre sont les pas d’un même plan. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères](ATTENDUS.md)

## Le premier trajet consommé

La frontière émet les quatorze premiers essais. Le producteur du graphe enregistre les translations des acteurs réidentifiés à partir des retours publics. Au T15, il compare les échantillons de la même signature que le bloc 3 × 3 en [15,15,17,17], histogramme `[[4,1],[9,8]]`. Six échantillons retiennent quatre directions. L’unique translation [0,+6] d’`ACTION4` vient du vrai T4, révisions 4 et 5. Les autres directions viennent des révisions 7 à 15, reliées deux par deux.

Sur le plateau courant, le producteur mesure une description unique du graphe de 31 nœuds et 32 arêtes. Il lie le pas mesuré à l’alternance des matériaux et construit un trajet de 18 arêtes. Il reste deux actes à la session. Le service admet le préfixe suivant et confronte chacun de ses déplacements au retour. [Mesure de la topologie](../../../src/logos-engine/v6-alternating-graph-observation.ts) · [Offre, garde et retour](../../../src/logos-engine/v6-alternating-graph-access.ts)

| Geste | Ticket | Projection du déplacement | Retour |
|---|---|---|---|
| T15 | `ACTION4`, indice 0 | (15,15) → (15,21) sur support ordinaire de palette 0 | `matched:true`, préfixe ouvert |
| T16 | `ACTION2`, indice 1 | (15,21) → (21,21) sur le même type de support | `matched:true`, translation [6,0] mesurée. Arrêt au plafond de session pendant N1. |

## Contre-épreuves

| Variation au T15 | Résultat vérifié |
|---|---|
| Écarter l’unique échantillon d’`ACTION4` pour cet acteur | Même plateau et quatorze mêmes retours. L’offre devient `graph_access_absent_or_ambiguous`, avec abstention locale. Le service choisit `observed_frontier / ACTION3`. Le fournisseur réémet ensuite un `ACTION4` à l’indice 0 et son déplacement est confirmé. |
| Retirer seulement l’offre déjà calculée par `proposeGraph` | Même repli puis même reprise, avec les mêmes paquets, que lors de la suppression de la preuve. |
| Ajouter un échantillon de mouvement opposé sous une signature étrangère construite | Le fournisseur le laisse hors de la mesure de cet acteur. Offre, tickets et retours T15–T16 identiques. |
| Après le vrai ticket T15, présenter le plateau précédent | Le jeu a rendu le paquet nominal. Sur le plateau stationnaire présenté, le service détecte `graph_displacement_or_extra_effect_diverged`, scelle et mémorise la clé de cet essai. Il émet ensuite un ticket de frontière `ACTION3`. |

**Attribution.** Le gel comporte déjà une mesure séparée, `measureAlternatingGraph`, et un producteur d’offre distinct, `AlternatingGraphMemory.proposeGraph`, que le service consomme. Les retours prouvent deux déplacements ordinaires et la reprise après un essai refuté. Le trajet de 18 arêtes reste la projection initiale. Le plafond de session coupe son exécution après le deuxième pas.

## Rejeu

Depuis la racine du checkout, avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/tu93-39'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/tu93-39.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-action4 --pyodide $py --recu "$env:TEMP/tu93-sans-action4.json"
```

Le vérificateur compare six préfixes. Le reçu contient les faits scellés avant le choix du fournisseur, le ticket autorisé, les empreintes publiques et les retours. Les contre-épreuves sont limitées au processus opérateur. [Harnais](operateur.mjs) · [Assertions](verifier.mjs)
