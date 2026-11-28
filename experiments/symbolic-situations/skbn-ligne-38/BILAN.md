# SKBN et KEYD · ligne 38

**Transfert fonctionnel établi sur KEYD au gel. Qualification stricte partielle pour la provenance.** Les deux tickets recapturés sur SKBN approchent une destination dont le rôle reste inconnu. KEYD montre l’acquisition d’un accès local, puis son utilisation dans la décision suivante. Le même geste suivant est admis comme dépendant de cet accès quand on lui substitue les références d’un autre mouvement.

Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et la remise `fa126d653aa5e123f9de78c220e9e6129a6436a2` ont le même arbre moteur. Les deux replays donnent des reçus identiques sur dix départs et 133 gestes par SHA. Les deux catalogues plafonnés à 16 recapturent 18 des 31 occurrences documentées, dont 2 sur SKBN et 16 sur KEYD. KEYD a été repéré par SIC SYNC, puis recapturé ici avec le même service sur les deux révisions.

| Situation | Retour et décision observés |
| --- | --- |
| SKBN T14 ACTION1, T16 ACTION4 | Le corps arrive deux fois dans la même boîte `[46,11,49,14]`. Les 16 pixels étrangers parmi les 62 changements contredisent la conservation attendue. Le reçu scelle le préfixe et l’enregistreur retient `changed_endpoint_reached`, sans acquisition d’accès. T15 passe à la frontière observée, T17 au contact préalable au score. |
| SKBN T14, deux retours construits | Le retour stationnaire perd la preuve d’arrivée. Conserver les régions étrangères en gardant la même arrivée confirme la projection et donne au T15 une nouvelle approche. La case conserve son rôle inconnu et aucun accès n’est acquis. |
| SKBN T14, mémoire de commande | À raster identique, retirer le relevé ACTION1 laisse la même approche mais sans cette preuve de commande. Y substituer les références d’une autre commande laisse l’offre et son retour physique inchangés. La garde du premier pas refuse une observation périmée. |
| KEYD T1–T8 | T1–4 approchent la source, T5 ACTION5 observe un transfert correspondant avec `matched:null`, T6–8 tentent l’accès sous la signature affichée. T8 ACTION4 confirme l’arrivée dans la partition, la signature disparaît et le service acquiert `local_access_return` sous les références du T8 et de son retour. |
| KEYD T9–T16 | Huit offres de sonde de capacité citent la paire de références du T8. Retirer la signature au T6 ou le reçu d’accès au T9 conserve le geste et le retour physique, mais convertit le ticket en simple approche. |
| KEYD T9, référence étrangère | Les champs avant/après et les références de l’accès sont remplacés par ceux du T7, qui ne donne aucun reçu d’accès. La même sonde de capacité est admise, jouée et confirmée physiquement. Son offre cite les mauvaises références. |

Les deux jeux restent à zéro niveau terminé dans le catalogue mesuré. Une sonde de capacité et son déplacement confirmé laissent ouvertes la capacité du matériau et la règle terminale. Préenregistrement opérateur `dc7487f5`, attentes auteur `f1d9d890`. Premier essai à 00:22:28, verdict vérifié à 00:34:09 (UTC−3, 11 min 41 s), huit tests par SHA. Le rejeu a été repris pour figer les preuves avant leur retour et inclure les deux fixtures du noyau dans le montage. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-skbn-38-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', 'fa126d653aa5e123f9de78c220e9e6129a6436a2'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'catalogue','suite','retrait','jeu-KEYD','preuve-KEYD') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
