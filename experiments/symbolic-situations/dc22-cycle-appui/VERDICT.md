# DC22 N4 · qualification indépendante de la clôture d’appui

Candidat `fb8d6913addd23f5dd1cc375f96f9a69b2410b21`, arbre `src` `c6be00220e0691619413e9244101f9c6a302c144`. Témoin natif `9e96585a`, moteur `c515ea14`. Le [contrat opérateur](CONTRAT.md) et l’empreinte de la variation ont été publiés à `42cb721f` avant l’examen du candidat.

## Trois parcours natifs

| Parcours | Jusqu’au T14 inclus | Premier choix discriminant et retour |
| --- | --- | --- |
| Nominal | Au T1, l’enfant du premier contrôle est ouvert avant le ticket `ACTION6 (46,28)`, puis reste assigné après la première mesure. Au T14, `ACTION6 (56,28)` ferme le dernier cycle sur la paire réellement jouée 125→126. L’enfant de ce contrôle devient satisfait et porte le reçu de cette paire. | Au T15, le besoin parent cite deux fermetures acquises, portées par deux enfants distincts. `ACTION2` est autorisée et le vrai retour 126→127 confirme l’atterrissage. Les 187 commandes, effets physiques et quatre empreintes cumulées de fin de niveau concordent avec le témoin natif. |
| Dernier cycle rouvert | Même préfixe physique de 125 gestes. Réouverture du seul dernier cycle après la collecte du retour T14. | Le même enfant rouvre à la révision 126. Le service autorise et joue `ACTION6 (56,28)`. Le retour 126→127 confirme la mesure et laisse l’enfant assigné. Arrêt opérateur après ce retour, à 126 gestes. |
| Variation scellée | Même préfixe physique de 125 gestes. Entrée privée inchangée depuis son scellement. | La garde refuse la proposition `ACTION2` au T15 avec `phase_cycle_prerequisite_unattested`. Le service s’arrête sur `no_admissible_prefix` sans ticket ni nouveau retour physique. |

Les parties repartent du niveau 1 sur le terrain natif, avec les budgets historiques. L’option `phaseCycleNeeds` est activée dans le processus de qualification DC22.

## Quatre contrôles sur l’autorisation à la révision 126

Les contrôles repartent du même plateau et de la même offre nominale avant sa libération. L’effacement de la dernière fermeture dans la mémoire du fournisseur supprime l’offre alors que les deux cycles bruts restent fermés.

| Intervention isolée | Résultat de la garde native avant ticket |
| --- | --- |
| Masquer la seule preuve exacte dans la lecture du registre et garder l’offre | `phase_cycle_prerequisite_unattested` |
| Substituer une ouverture plus ancienne réellement observée | `phase_cycle_prerequisite_unattested` |
| Attribuer la preuve au contrôle voisin en gardant les références du retour | `phase_cycle_obligation_incomplete` |
| Présenter la revendication scellée | `phase_cycle_prerequisite_unattested` |

Le point reste lié au plateau dans les quatre contrôles. Ils s’exécutent avant l’autorisation en ligne et leurs commandes ne sont pas jouées. La vérification rétablit ensuite la lecture du registre et l’offre d’origine. L’autorisation et le retour d’`ACTION2` du bras nominal attestent cette restauration. Le rejeu natif de la revendication scellée confirme séparément l’issue du service.

## Rejeu opérateur

Dans le répertoire du candidat exact, avec Node 24 et Pyodide préparé, utiliser les variables `$Operateur` et `$Prive` pour désigner le dossier du présent protocole et le dossier opérateur qui contient la référence nominale et les entrées scellées. Employer un nouveau préfixe de sortie à chaque lancement.

```powershell
$observer = [Uri]::new((Join-Path $Operateur 'observer.mjs')).AbsoluteUri
$stem = 'operateur-' + [guid]::NewGuid().ToString('N')
$env:SIC_REPLAY_REFERENCES = 'docs/architecture/sic-replay-reference-levels-20261126.json'
$env:DC22_OPERATOR_PRIVATE = $Prive
foreach ($arm in 'nominal', 'reopen', 'reserved') {
    $env:DC22_OPERATOR_ARM = $arm
    $env:DC22_OPERATOR_RECEIPT = Join-Path $Prive "$stem-$arm-trace.jsonl"
    node --import $observer scripts/check-sic-chronological.mjs DC22 4 (Join-Path $Prive "$stem-$arm.jsonl") 1 sic
    if ($LASTEXITCODE) { throw "Échec du rejeu $arm" }
}
node (Join-Path $Operateur 'verifier.mjs') $Prive $stem
```
