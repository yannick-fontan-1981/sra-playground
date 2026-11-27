# AS66 · qualification indépendante de la ligne 83

**Deux offres de sondage ont été reproduites au niveau 2, aux commandes 6 et 7 depuis L1.** Sur le même état au tour 6, le service accepte aussi une autre offre native fraîche. Celle-ci déplace réellement le carré vers une autre position et change la commande d’accès suivante. Une offre de l’observation précédente provoque l’arrêt `composition_target_stale_proposal`. [Captures et tests](sic-as66-ligne-83/recus.zip) · [Index](sic-as66-ligne-83/banc.json)

| Parcours | Ticket et retour public | Décision suivante |
|---|---|---|
| Historique, T6 | Après la victoire de L1 au T5, le nouveau carré est en (48,26). `ACTION1` le conduit en (48,46). Le déplacement local en coordonnées ligne/colonne est [20,0]. | À T7, `ACTION4` part de (48,46). Son déplacement local est [0,−8]. Les deux directions de commande sont désormais mesurées. |
| Historique, T8 | Les mesures libèrent `sliding_cavity_access / ACTION1`. | La projection d’accès concorde avec le retour du jeu. Les deux sondes antérieures ont `matched:null`, leur direction était à découvrir. |
| Autre offre native **avant** le choix T6 | Une seconde instance du fournisseur, avec les mêmes preuves et la même mémoire, donne priorité à `ACTION4`. Le service émet le ticket. Le carré passe de (48,26) à (28,26), soit [0,−20] en ligne/colonne. | Le service délivre `sliding_cavity_access / ACTION2` lié à l’observation obtenue. Le jeu confirme sa projection. |
| Ancienne offre **après** une nouvelle observation | Dans la contre-épreuve à plateau identique, l’époque et la géométrie satisfont encore la garde locale. La révision d’observation a changé. | L’autorité commune arrête le service avec `composition_target_stale_proposal`, sans ticket. |

Les captures d’inventaire sont parties de L1, graine 0, pack natif par défaut, plafond de session de 16 commandes. Sur chacune des trois sources, la séquence complète des 16 commandes et empreintes de retour, les deux lignes sélectionnées et l’arrêt concordent. Les sources sont l’historique `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le candidat `1aaafe36177ab73edf63c18f1a0950bd790a9c6c`, parent `d3ff955a0d2f2b17a10dcd1790127577296a007f`. Deux occurrences sur les deux de l’inventaire ont été observées. Le diff candidat/gel ajoute la fiche, le test et sa fixture. Leur arbre `src` est identique, `a1cbde2afc41532c7c047eb05c8637ef02b584d0`.

Les quatre suites candidates passent **97/97**. Les cinq cas de la suite ciblée passent aussi sur les modules chargés directement du gel. Les trajectoires nominale et alternative utilisent le vrai jeu. Le refus à plateau identique utilise le service natif avec un retour contrôlé. Le parcours SIC exclusif de tout AS66 au gel a validé 9/9 niveaux en 161 décisions. Il s’agit d’un autre réglage que le pack d’inventaire utilisé pour ces deux sondes. [Comparaison SIC exclusive](sic-comparaison-decisions.md) · [Contrat et test de la branche](https://github.com/yannick-fontan-1981/sra-playground/blob/1aaafe36177ab73edf63c18f1a0950bd790a9c6c/docs/architecture/sic-as66-ligne-83.md)

## Reproduire

Avec Node 24.22.3, prendre des checkouts isolés propres des trois SHA et préparer les jeux avec `node scripts/prepare-python.mjs` dans chacun. Depuis le banc, exécuter une fois par checkout dans un dossier de sortie existant, puis comparer la propriété `games` des JSON.

```powershell
node scripts/sic-recapture-strategy-inventory.mjs $moteur "$sortie/AS66-$rev.json" --offer sliding_cavity '*' cavity_direction_question AS66
```

Dans le checkout candidat préparé, activer le backend du jeu et lancer les quatre suites. Les rapports natifs du banc sont conservés localement dans `artifacts/qualification-as66-1aaafe36/`.

```powershell
$env:SIC_CAVITY_GAME_ROOT = (Get-Location).Path
node --test --test-concurrency=1 tests/sic-cavity-direction-as66.test.ts tests/v6-sliding-cavity.test.ts tests/sic-control-effect.test.ts tests/sic-native-resolution.test.ts
```
