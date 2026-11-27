# G50T · qualification de la ligne 18

**Les quatre moteurs reproduisent les 14 occurrences de `linked_temporal_preparation / linked_contact_experiment`, aux tours 3 à 16 de G50T L1.** Le banc a relancé depuis L1 l’inventaire `8ce7ee35`, le gel `d0e7527c`, le parent `ada97e9c234986878bb2b8d35f876d17039afd2c` et le candidat `1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd`. Les commandes, coordonnées, empreintes d’observation et résultats enregistrés concordent. Le pack par défaut, la graine 0, le plafond de session de 16 et le plafond de niveau de 600 reproduisent les conditions de l’inventaire. Le contrat `b360f44b` et le parent conservent l’arbre `src` du gel. [Contrat et changements du candidat](https://github.com/yannick-fontan-1981/sra-playground/blob/1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd/docs/architecture/sic-g50t-ligne-18.md)

| Tour | Commande et position du porteur après son exécution | Observation native |
|---|---|---|
| T3 | `ACTION1`, de (14,14) à (14,8) | L’essai mesure (0,−6). La destination de l’essai était inconnue. |
| T4–T5 | `ACTION3` laisse le porteur en place, puis `ACTION4` le mène en (20,8) | Le premier pas laisse `ACTION3` sans vecteur. Le second mesure (+6,0) pour `ACTION4`. |
| T6–T7 | `ACTION4` atteint (26,8), puis (32,8) | Les pas d’accès suivent le vecteur mesuré. L’acquisition native conserve `contact=null` à ces deux retours. |
| T8 | La même `ACTION4` atteint le site (38,8) | Les références avant/après lient **23 pixels modifiés** à la région distante. Le test compare les 23 valeurs avant et après aux observations publiques du vrai jeu. L’événement porte `exclusive_cause_established=false`. |

La sonde copie les positions, vecteurs et mesures enregistrés par `LinkedTemporalPreparation.recordSource`. Les 16 retours du gel et du candidat sont identiques. Le test d’origine du parent s’arrêtait à T10 et concorde sur ses dix retours. L’inventaire indépendant du même parent couvre les 16. Les suites choisies passent 74/74 sur le parent et 75/75 sur le candidat. Sur ce dernier, `selectLinkedContactStep` départage l’essai sans vecteur et l’accès disposant d’une commande mesurée. L’opérateur a vérifié le retrait de ce sélecteur et les retours discriminants du même ticket. Un changement hors de la région liée ne constitue aucune preuve d’effet distant. La qualification du témoin natif porte sur G50T L1. [Preuve opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/2c5ea4462422209a4bdca6a962a7851abd3c1f69/experiments/symbolic-situations/g50t-ligne-18/BILAN.md) · [Mesures du banc](sic-g50t-ligne-18/banc.json)

### Reproduire

Depuis le checkout du banc, pointer `$moteur` sur un checkout propre du SHA à rejouer, avec Node 24.22.3. Le filtrage de l’inventaire s’applique aux quatre révisions. Le test de 16 retours est celui du candidat.

```powershell
$banc = (Get-Location).Path
Push-Location $moteur
node scripts/prepare-python.mjs
Pop-Location
$rev = git -C $moteur rev-parse --short HEAD
node scripts/sic-recapture-strategy-inventory.mjs $moteur "./G50T-$rev.json" --offer linked_temporal_preparation '*' linked_contact_experiment G50T
$env:SIC_LINKED_GAME_ROOT = $moteur
$env:SIC_LINKED_RECEIPT = "$banc/mesures-$rev.json"
$sonde = ([uri](Join-Path $banc 'scripts/sic-observe-g50t-linked-contact.mjs')).AbsoluteUri
Push-Location $moteur
node --import $sonde tests/sic-linked-contact-g50t.test.ts
Pop-Location
Remove-Item Env:SIC_LINKED_RECEIPT,Env:SIC_LINKED_GAME_ROOT
```

Le SHA-256 de l’archive est `2eca9ede19fff5bcf89367da198ebc1c52d5d26fe01758f1a18c3a45d778f455`. Les originaux restent sous `artifacts/qualification-g50t-1a1cc965/`. [Captures et résultats](sic-g50t-ligne-18/recus.zip)
