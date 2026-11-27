# G50T · qualification indépendante de la ligne 23

**Le vrai G50T reproduit l’essai local de la ligne 23, son acquisition et la question suivante.** Le banc a joué le premier geste depuis L1 et demandé le ticket suivant dans trois processus neufs, sur l’inventaire `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le candidat `ba04161fbce03f9660e9e73c14ed2c14ef2538d7`. Tous les champs des trois projections concordent, y compris les références des preuves, la garde, l’admission, le ticket et la chaîne du graphe après le retour. Le harnais utilise le pack par défaut, l’agenda navigateur, la session déterministe `frontier-qualification`, une horloge contrôlée et les plafonds natifs par niveau. [Contrat et harnais](https://github.com/yannick-fontan-1981/sra-playground/tree/ba04161fbce03f9660e9e73c14ed2c14ef2538d7/experiments/sic-agenda-offres/essai-local-23)

| Étape native | Résultat commun aux trois SHA |
|---|---|
| Tour 1 | `observed_frontier / test_local_input / experiment` ouvre `Q_36ce889058ea8eda599b` pour un besoin `observe_untried_input_effect`. La commande locale n’a encore aucun essai. La garde `current_public_premises_match_provisional_step` admet le pas d’indice 0 et le moteur libère le ticket `frontier-qualification:native:1`, `ACTION1`. |
| Retour du jeu | Le service consomme ce ticket. Le plan, le besoin et sa question sont liés au retour de révision 2. Le besoin devient `observed`, le résultat vaut `unknown_effect_observed` et `matched=null`. L’empreinte de la frame reste `f79ab0e9d856fdf8` et sa référence d’observation avance d’une révision. |
| Ticket 2 | La même stratégie ouvre une autre question, `Q_407559e98cd1587424e2`, avec un nouveau besoin qui cite ce retour. Elle libère `ACTION2` sur `frontier-qualification:native:2`. La capture se termine à la délivrance de ce ticket. |

La qualification porte sur le témoin historique et la poursuite du raisonnement au tour suivant. L’inventaire global compte 405 commandes pour le triplet de la ligne 23. Cette vérification porte sur G50T. Les contrôles de développement du harnais comparent également variations du domaine et du classement, retour au même contexte et deux refus de ticket. Leurs résultats sont identiques sur le gel et le candidat. Le crédit de la ligne 23 provient de G50T. REGN relève de la ligne 22. Les épreuves indépendantes de transfert ont leur propre périmètre. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md)

### Portée du changement de types

Le seul fichier modifié dans `src` entre le gel et le candidat est `src/logos-engine/v6-observed-frontier.ts`. Les lanceurs, jeux, références, dépendances et configuration TypeScript concordent. Le blob du module passe de `e59030e7fde5582aa71c098fd3358c74c677db44` à `303464d6b7162379b877d5fbba1408f2dc5e7bc1`. Avec TypeScript 5.9.3, cible ES2022, module ESNext, `verbatimModuleSyntax` activé et commentaires retirés, le banc a comparé les tampons JS octet par octet. Les **50 967 octets** sont identiques, SHA-256 `f5c8da5e1defbfa748db5e2f0806fe040e484842a5d6041e63ab40c5a2b1aabc`. Cette comparaison porte sur le module modifié du gel et du candidat. L’ancien moteur d’inventaire a été comparé par exécution du préfixe. Le comportement qualifié est déjà présent au gel. Le lot du banc porte sur deux tickets de G50T, sans nouveau parcours intégral des 107 jeux.

### Reproduire depuis le banc

Placer `$moteur` sur un checkout propre de `ba04161f`, avec les deux révisions antérieures accessibles par Git. Utiliser Node 24.22.3.

```powershell
$moteur = (Resolve-Path ../sic-banc-ls19).Path
$sortie = (New-Item -ItemType Directory ./rejeu-g50t-23).FullName
Push-Location $moteur
git rev-parse HEAD
npm ci
node scripts/prepare-python.mjs
node experiments/sic-agenda-offres/essai-local-23/verifier.mjs --pyodide "$moteur/public/vendor/pyodide" --recu "$sortie/controle.json"
Pop-Location
foreach ($rev in '8ce7ee35','d0e7527c','ba04161f') {
  node scripts/sic-capture-g50t-line23.mjs $moteur $rev "$sortie/G50T-$rev.json"
  if ($LASTEXITCODE) { throw $rev }
}
$mesures = Get-ChildItem "$sortie/G50T-*.json" | ForEach-Object {
  $r = Get-Content $_ -Raw | ConvertFrom-Json
  ConvertTo-Json @($r.first,$r.receipt,$r.next) -Depth 40 -Compress
}
if (@($mesures | Select-Object -Unique).Count -ne 1) { throw 'Projections divergentes' }
```

Les originaux locaux se trouvent sous `artifacts/qualification-g50t-ba04161f/`. L’archive contient les trois captures indépendantes et le reçu du vérificateur, SHA-256 `6e44964b29cc96d181f1986ad6b67608a4491d7d1c9f47714b89982d04c027c7`. [Index et références des besoins](sic-g50t-ligne-23/banc.json) · [Reçus](sic-g50t-ligne-23/recus.zip)
