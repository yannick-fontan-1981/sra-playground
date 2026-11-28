# MEMO · rappel d’un exemple acquis

Le gel `d0e7527c` autorise un rappel au T7 de MEMO à partir d’un exemple acquis au T6. C’est le premier rappel sans enclos du départ depuis L1 en ouverture native, avec 16 gestes de session et 600 par niveau. Le journal natif de référence donne le même témoin. Le dossier SPOR retient indépendamment le test d’un enclos courant et le verdict séparé de la ligne 9. [Journal de référence](../../../tests/v6-occurrence-recall.test.ts) · [Verdict SPOR](https://github.com/yannick-fontan-1981/sra-playground/blob/2aad6e6c/experiments/sic-agenda-offres/spor-9-56/VERDICT.md)

Les six premiers clics partent d’un indice courant et chacun avance à une scène `forward`. Le retour du T6 conserve comme antécédent le pré-événement de ce geste, avec ses trois occurrences. Au T7, aucun des trois candidats n’est encadré. Parmi les occurrences du T6, celle de (46,41), non choisie, est la seule à correspondre au masque et à la couleur du candidat courant (15,35). Quatre modèles convergent, sur tous les exemples précédents ou seulement les non choisis, avec comparaison par masque seul ou masque et couleur. Chacun porte quatre appuis sans contre-exemple. Le service autorise `ACTION6(15,35)` sur la coupe courante et l’antécédent de T6. Le retour est `forward` et le T8 rappelle l’occurrence suivante, à (14,28).

| Variation appliquée uniquement à la comparaison du T7 | Résultat dans le service |
|---|---|
| Écarter l’exemple de (46,41) | Les quatre modèles ne retrouvent aucun candidat sur leurs sources précédentes. La famille s’abstient. `animated_contact` émet (37,13). Le retour ne produit aucun acquis de rappel et le service s’arrête ensuite sur `frontier_unknown`. |
| Écarter l’autre exemple non choisi, à (14,37) | Prédictions, offre, ticket et retours T7–T8 identiques. |

L’intervention retire un seul exemple de la comparaison. Le contexte porté par l’offre, la calibration, les compteurs et le préfixe physique restent ceux du jeu. Lors du premier contrôle de développement, tronquer aussi le contexte porté par l’offre avait changé la famille retenue alors que la prédiction restait identique. Le harnais final circonscrit le retrait à l’entrée de la comparaison. Les deux cas de ce tableau s’exécutent dans le vrai service natif.

**Attribution.** La ligne 56 dispose déjà sur le gel d’un fournisseur qui lie un exemple acquis, prépare l’offre et consomme son retour. C’est ce chemin MEMO qui fonde le verdict sur le rappel d’exemple. Dans SPOR, l’unique ticket de la même sous-question exigeait l’enclos courant et n’avait aucun contexte antérieur.

## Rejouer

Depuis la racine du checkout, avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/memo-56'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/memo-56.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-exemple --pyodide $py --recu "$env:TEMP/memo-56-retrait.json"
```

Les quatre préfixes comparent le nominal historique `8ce7ee35` au gel et éprouvent les deux retraits sur le gel. [Critères préenregistrés](ATTENDUS.md) · [Harnais](operateur.mjs) · [Vérificateur](verifier.mjs)
