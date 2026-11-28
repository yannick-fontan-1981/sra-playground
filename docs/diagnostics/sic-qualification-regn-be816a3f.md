# REGN · ligne 22 depuis N1

**L’accès à une question distante est composable sur le gel.** Au même état en N3/T16, la recherche d’accès de `ObservedFrontier` peut fournir un trajet vers une autre question. Si son trajet est retiré, le service laisse ouvert le même besoin d’accès. La décision et ses effets sont identiques sur `d0e7527c` et `be816a3f`. Le préfixe complet des quinze décisions, leurs retours, le graphe et le domaine local coïncident avant l’intervention. [Contrôle du banc](sic-regn-be816a3f/banc.json) · [Reçus des six parcours et du vérificateur](sic-regn-be816a3f/recus.zip)

| Conditions au T16 | Ticket et justification | Retour et T17 |
|---|---|---|
| Budget transmis 16 | Avec une place, le contraste de retour se retire. `observed_frontier/reach_open_input` émet `ACTION4`. Les deux commandes locales ont déjà un témoin ; une arête observée au T12 mène à la question `Q_8b45c6cdc354b85cd0a2`. | Projection d’accès confirmée. Le budget s’épuise avant d’exécuter la question. |
| Budget transmis 17 | Le plan natif contient l’accès `ACTION4` et la question `ACTION3`. | Après la confirmation de T16, la continuation au T17 acquiert `observed` pour la question et le besoin d’information d’origine. Effet initialement inconnu, `matched:null`. |
| Lecture coupée à 16, budget global omis | Le fournisseur prioritaire `returned_branch_contrast` dispose de quatre places pour son plan et emporte le choix. Même `ACTION4`, même plateau de retour. | Le fournisseur de frontière n’est pas appelé sur ce ticket. |
| Même budget 17, première question retirée | Après 15 retours identiques, retirer la seule question du premier domaine distant laisse la recherche explorer le suivant. Elle sélectionne `Q_af0257e2c8ca6ad0386a` avec un autre besoin d’information. La première arête reste attestée par `transition:b4b5c2ea…`. | T16 puis T17 émettent deux accès `ACTION4`, tous deux confirmés. Les deux places sont consommées pour atteindre le second contexte. Son besoin d’information reste sans acquisition. |
| Même budget 17, trajet retiré | Le banc enregistre l’arête et la question trouvées par le vrai moteur, puis retire uniquement le résultat de `access` avant le sélecteur. | `frontier_exhausted` et besoin d’accès ouvert, avec le même identifiant que le prérequis nominal. Le service s’arrête après 15 retours. |

**Deux appels distincts.** L’avance qui consomme le retour 15 renvoie `boundary`. L’appel `resume` à la séquence 15 libère le ticket 16 ou renvoie l’arrêt dans le cas de retrait. Le banc a capturé les deux réponses. Après l’accès nominal, la question est acquise exclusivement lorsque le service peut exécuter et observer le T17.

Le vérificateur reproduit les onze parcours de sa matrice (historique `8ce7ee35`, gel, révision de preuve) et le témoin construit `02032a3d`. Les six captures supplémentaires du banc rejouent le niveau 1 dans le vrai jeu, cible complète, 600 gestes par niveau, plafond global 17, horloges fixées, sans graine explicite. Les interventions touchent la recherche au seul état public ciblé, avant la sélection. L’opérateur a qualifié ses propres retraits et substitutions au commit `641f5540`. Le contrôle de REGN/80 figure dans une fiche distincte. [REGN/80](sic-qualification-regn-6bfb8ccf.md)

La révision de preuve est `be816a3f09e7b36d9393aaead8d835d9dc3850c5`, préenregistrement `176f054a`. La correction depuis `626afb83` porte sur l’assertion de frontière et sa documentation. Le lanceur opérateur et l’arbre moteur `a1cbde2afc41532c7c047eb05c8637ef02b584d0` sont identiques. Les 107 gardent le résultat de l’assemblage auquel ils se rapportent.

Depuis le banc, avec un checkout propre de cette révision en `../sic-regn-22`, Node 24.22.3 et Pyodide local :

```powershell
$d = 'artifacts/verification-regn-22'
New-Item -ItemType Directory $d | Out-Null
node ../sic-regn-22/experiments/sic-agenda-offres/regn-22/verifier.mjs --pyodide public/vendor/pyodide --recu "$d/qualification.json"
foreach ($version in 'gel','candidat') {
  foreach ($cas in 'nominal','sans-question','sans-trajet') {
    node scripts/sic-observe-regn-access.mjs ../sic-regn-22 $version $cas public/vendor/pyodide "$d/$version-$cas.json"
  }
}
py -3.11 scripts/check-sic-regn-access.py $d
```
