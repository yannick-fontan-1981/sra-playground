# SPOR · compartiment distingué et occurrence encadrée

Le catalogue donne SPOR N1/T1 pour la ligne 9 et SPOR N1/T3 pour la ligne 56. Le rejeu part de L1, en ouverture native, avec 16 commandes de session et 600 par niveau. Le préfixe s’arrête au plafond après avoir terminé un niveau. Il compte **15 tickets** `contextual_compartment_question` et **un ticket** `observed_occurrence_recall`. Les totaux de l’inventaire sont respectivement 17 et 25. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md) · [Critères préenregistrés](ATTENDUS.md)

## Ligne 9 · question de compartiment

| Épreuve | Décision et réponse |
|---|---|
| N1/T1 | Sur onze compartiments mesurés, la boîte fermée [43,44,46,57] est la seule au bord distingué de palette 0. Elle contient 24 pixels. La famille lie `ACTION6(44,50)` à cette boîte et à la seule observation initiale. |
| Vrai retour T1 | Le voisinage de cette boîte change et la tentative est enregistrée. Aucun autre compartiment conservé n’est enregistré comme récepteur pour ce retour. L’issue était ouverte, d’où `matched:null` et scellement. |
| Reprise N1/T2 | La mesure courante trouve douze compartiments et distingue la boîte ouverte [50,23,57,37], qui contient six pixels. Le service choisit `ACTION6(53,30)`. La référence du T1 apparaît deux fois dans le ticket, comme observation courante et comme réponse mémorisée. |
| Même ticket T1, plateau stationnaire construit | La famille consigne que le voisinage n’a pas changé, garde la même question comme tentée à cet état et n’émet plus d’offre pour cette boîte. La frontière émet `ACTION5`. |
| Retirer l’offre de `ContextualCompartments.choose` seulement au T1 | La frontière émet `ACTION5`. Au T2, la famille retrouve le compartiment et émet `ACTION6(44,50)`. |
| Second contexte N2/T9–T10 | La réponse au T9 associe [16,48,23,57] à un changement observé du contenu de [25,20,28,37]. Cette relation apparaît dans le plan qui lie le nouveau clic au récepteur au T10. |

**Attribution.** Le gel mesure, choisit, garde la liaison courante et réagit déjà aux retours. La boîte du T1 est localement distinguée. Au T9, une observation du récepteur enrichit la preuve de relation. [Fournisseur et garde](../../../src/logos-engine/v6-contextual-compartments.ts)

## Ligne 56 · occurrence actuellement encadrée

Au N1/T3, la sous-question `observed_occurrence_recall` du fournisseur partagé `public_occurrence_recall` choisit le point (34,7) de la boîte [20,6,49,8], palette 11. Le rectangle public de taille 42 × 5 donne l’hypothèse de calibration et distingue l’unique occurrence. Avant le calcul, le contexte, la calibration et les exemples mémorisés sont vides. Le ticket ne cite que l’observation courante. Le motif est `test_observed_enclosing_emphasis`. Le retour est `unknown_or_no_effect` et le service scelle l’essai avec `matched:null`, sans progression officielle.

| Intervention | Première différence |
|---|---|
| Retirer l’enregistrement du vrai retour T1 de la mémoire des compartiments | Le T2 garde l’observation courante et perd sa copie issue de la mémoire. Commandes et paquets physiques T1–T3 identiques. Le relevé avant choix et le ticket de rappel du T3 sont identiques. |
| Ouvrir le seul enclos courant en remplaçant le pixel (19,6) par le fond, sur la copie de l’image finale présentée par le harnais après T2 | Le paquet physique est le même. La mesure d’occurrence échoue et la famille s’abstient. Au T3, le service émet `contextual_compartment_question / ACTION6(55,29)`. Au T4, un nouvel enclos visible permet `observed_occurrence_recall / ACTION6(32,7)`. |

**Attribution.** SPOR qualifie la liaison de l’indice courant au ticket natif et son refus lorsque cet indice disparaît. Dans le préfixe SPOR, l’arbitrage à partir d’un exemple antérieur reste indéterminé. Le journal de référence MEMO exerce ce chemin distinct avec le motif `test_retained_occurrence_correspondence`. Les tests de ce journal restent attachés à MEMO. [Choix d’occurrence](../../../src/logos-engine/v6-occurrence-recall.ts) · [Tests de référence](../../../tests/v6-occurrence-recall.test.ts)

## Rejouer

Depuis le checkout de qualification avec Node 24+, Git, tar et Pyodide local.

```powershell
$d = 'experiments/sic-agenda-offres/spor-9-56'
$py = '../sic-comparison-bench/public/vendor/pyodide'
$node24 = (Get-Command node.exe -All | Where-Object { [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0' } | Select-Object -First 1).Source
& $node24 "$d/verifier.mjs" --pyodide $py --recu "$env:TEMP/spor-qualification.json"
& $node24 "$d/operateur.mjs" --moteur gel --variante sans-enclos-56 --gestes 4 --pyodide $py --recu "$env:TEMP/spor-enclos.json"
```

Les sept préfixes sont exécutés dans le vrai service. Le reçu retient les faits scellés avant le choix, leur ticket et leur retour, ainsi que les empreintes du paquet physique et du plateau présenté. L’intervention sur l’enclos conserve et signale les coordonnées du pixel modifié. [Opérateur](operateur.mjs) · [Assertions](verifier.mjs)
