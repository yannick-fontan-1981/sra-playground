# ZIPP · qualification indépendante de la ligne 1

**Le candidat `16f3c5e8d300903e475400fb9b67a513f2834663` conserve la décision du gel sur ZIPP N2 au quinzième geste depuis L1. Il prévoit une translation (0,12). Le sujet se déplace effectivement de (0,0).** Le résultat natif reste `unknown_effect_observed`, avec `matched=null`. Le parent `273b95a740a26bde3688e37a45338a624fb5450c` a le même arbre `src` que le gel. Le contrat est `3c94bd96ec3bba066609cb560a6d3737971d19d5`. [Contrat et candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/16f3c5e8d300903e475400fb9b67a513f2834663/docs/architecture/sic-zipp-ligne-1.md)

### Un ticket identique, deux justifications

Le vrai jeu et le service ont été relancés séparément pour chaque bras sur quatre révisions, depuis L1 dans une session continue jusqu’au niveau 2, avec le pack par défaut et les budgets historiques de la fixture. Le banc compare les observations publiques aux références après l’exécution de chaque ticket. Le bras natif couvre les 16 gestes. Le bras d’intervention s’arrête après le retour du geste 15.

| Situation au geste 15 | Offre admise | Mesure |
|---|---|---|
| Histoire native dans l’époque | `acquire_control_for_target / replicate_translation`, `ACTION2`. Un unique essai antérieur a déplacé le sujet de [11,31,17,37] à [11,43,17,49]. L’offre cite les révisions 15, 10 et 11, dans cet ordre. Le garde admet le pas. | Le sujet reste en [11,43,17,49]. Le déplacement attendu (0,12) et la mesure (0,0) sont conservés séparément. Le tour 16 passe à `observed_frontier / test_local_input`, `ACTION6(14,10)`. |
| Seul essai `ACTION2` réattribué à l’époque précédente, plateau et paire identiques | `acquire_control_for_target / sample_unused_control`, toujours `ACTION2`. L’offre cite uniquement la révision 15 et ne porte aucun vecteur prévu. | Sur le gel, `3c2d6bcf` et le candidat, le reçu natif porte `missingControl.id = test_missing_control`. Sur `8ce7ee35`, l’expérience et la commande sont les mêmes, mais le champ P05 manque. |

Sur le candidat, la sonde placée dans `acquireControlForTarget` copie la valeur effectivement renvoyée par `offerTranslationReplication`. En parcours natif, un retour non nul sur sept appels fournit `ACTION2`, la signature du sujet et (0,12). Après changement d’époque, les cinq appels renvoient une absence d’offre. Sur le second contexte, un carré mobile construit, le premier ticket ouvre un essai P05, puis un retour non nul sur six appels propose la répétition `ACTION1` avec (2,0). Les positions du carré confirment cette translation de deux pixels. Ce protocole passe sur le gel, `3c2d6bcf` et le candidat. Sur le moteur d’inventaire plus ancien, le test s’arrête à sa première assertion requérant l’étiquette P05. L’archive conserve cet échec. Les six suites du candidat passent **111/111**, avec le jeu source activé. [Observations, références et reçus des appels](sic-zipp-ligne-1/banc.json)

### Première différence et horloges

- **Gel / révision P05 / candidat.** Avec l’horloge de mémoire fixée, tous les champs de chaque capture concordent par bras, y compris la chaîne du graphe associée à chaque ticket. Une seconde session naturelle du gel reproduit le même fichier. Les premiers essais à horloge système présentaient des empreintes différentes sur les tickets détaillés. La mémoire de raisonnement native utilise `Date.now()`. L’archive conserve ces essais et les recaptures à horloge fixée.
- **Inventaire `8ce7ee35` / gel `d0e7527c`.** À horloge fixée, la première différence conservée apparaît dans `ticket.graphChain` de **ZIPP L1, tour 2**. La comparaison locale des 225 nœuds hydratés examinés isole deux champs du nœud `caller:controls`. Les entrées `pending[0]` et `pending[1]` ont désormais une palette de 16 éléments. Les commandes, familles et observations de jeu comparées concordent. Au tour 15 du bras d’intervention, la preuve P05 ajoutée dans le reçu constitue une différence d’observabilité distincte. L’index donne les deux empreintes complètes du tour 2.
- **Portée.** Le crédit direct de la ligne 1 porte sur le témoin ZIPP et sur le protocole construit du carré. Le catalogue publie huit commandes de cette famille. L’étude détaillée de ZIPP porte sur son quinzième geste. Les captures de ce lot établissent la conservation sur ce préfixe et le rôle du nouvel appel en production. Le transfert réservé dispose de son épreuve opérateur séparée. [Inventaire](https://github.com/yannick-fontan-1981/sra-playground/blob/2a17e14b/docs/architecture/sic-v8-strategies-observees.md)

### Reproduire depuis le banc

Utiliser Node 24.22.3. Le checkout dédié doit contenir les objets Git de la preuve et des quatre moteurs. La fixture est lue depuis le commit de preuve, indépendamment de la révision du moteur exécuté. Les rapports doivent être neufs.

```powershell
$banc = (Get-Location).Path
$moteur = (Resolve-Path ../sic-banc-deplacement).Path
$sortie = (New-Item -ItemType Directory ./rejeu-zipp-1).FullName
foreach ($rev in '8ce7ee35','d0e7527c','3c2d6bcf','16f3c5e8') {
  git -C $moteur switch --detach $rev
  if ($LASTEXITCODE) { throw $rev }
  Push-Location $moteur
  node scripts/prepare-python.mjs
  if ($LASTEXITCODE) { throw 'Préparation des jeux' }
  Pop-Location
  foreach ($bras in 'native','previous-epoch') {
    node scripts/sic-capture-zipp-line1.mjs $moteur $bras "$sortie/$rev-$bras.json" --fixed-clock
    if ($LASTEXITCODE) { throw $bras }
  }
}
```

Sur le checkout candidat, recueillir en plus les valeurs au point d’appel. Pour le bras d’époque, remplacer `native` par `previous-epoch` et choisir de nouveaux noms de reçus.

```powershell
$env:SIC_ZIPP_ENGINE = $moteur
$env:SIC_ZIPP_CALLS = "$sortie/appels-zipp.json"
$sonde = ([uri](Join-Path $banc 'scripts/sic-observe-zipp-offer.mjs')).AbsoluteUri
node --import $sonde scripts/sic-capture-zipp-line1.mjs $moteur native "$sortie/zipp-sonde.json" --fixed-clock
$env:SIC_ZIPP_CALLS = "$sortie/appels-carre.json"
Push-Location $moteur
node --import $sonde tests/v6-control-attention-kernel.test.ts
Pop-Location
Remove-Item Env:SIC_ZIPP_CALLS,Env:SIC_ZIPP_ENGINE
```

Les originaux sont sous `artifacts/qualification-zipp-ligne-1/`. L’archive contient les mesures à deux horloges, la répétition du gel, les preuves d’appel et les rapports de tests. Son SHA-256 est `ef518bbc6e97ec70646958727414e9df6b2c04dde67efb95214b226568bddc6d`. [Archive compacte](sic-zipp-ligne-1/recus.zip)
