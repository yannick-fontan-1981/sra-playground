# KLOT · ligne 82

**Sélection, déplacement et refus confirmés au gel. Attribution du rôle partielle sous retour contradictoire.** Les deux SHA `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `a0df8a9b13b51e63d08b5ca184c996ba20453e9c` ont le même arbre moteur. Reçus identiques sur six départs et 48 gestes de service par SHA, plus neuf gestes dans la source du retour contrefactuel. Deux tests d’auteur passent sur chaque SHA.

- Le clic T1 sur la pièce 11 change 46 pixels et conserve les sept poses. La sélection reste une hypothèse. Le vrai T2 déplace seulement 11 de `[1,3]` à `[2,3]`, rattache correctement la sonde et réduit les modèles de 24 à 6. Son verdict de projection reste `matched:null`. Une décoration stationnaire construite au T1 laisse la même hypothèse et la vraie sonde ACTION4 confirme ensuite 11. Le changement de décoration n’est donc pas une condition nécessaire à la sonde.
- Au T7 et au T9, ACTION1 déplace seulement les pièces 6 et 12 respectivement, après leurs propres clics de sélection aux T6 et T8. Chaque mouvement est confirmé et les reçus identifient la pièce ainsi que la paire d’observations. À vue identique, retirer uniquement l’événement de sélection le plus récent aux T7 et T9 interrompt les deux départs sur `composition_target_unbound_action_set`, sans ticket.
- Un retour stationnaire construit au T7 contredit la projection et fait tomber à zéro le nombre de modèles. Au T9, une partie auxiliaire du vrai jeu rejoue le préfixe, sélectionne 6 en `(20,23)` au lieu de 12 et joue la même direction. Son image de retour déplace seulement 6 et est servie au ticket du sujet 12 dans la session instrumentée. Le moteur donne `matched:false`, scelle le préfixe et s’arrête sur `rigid_control_or_collision_model_refuted`. Le journal de rôle nomme encore 12 avec `observed_exclusive_receiver` malgré le mouvement étranger et zéro modèle. Ce défaut porte sur l’attribution du reçu, tandis que le plan n’est pas poursuivi.
- Au catalogue, les 16 tickets de `selected_rigid` se répartissent entre 12 retours confirmés et quatre sans prédiction vérifiée. Le vrai niveau se termine au T12. Ce passage officiel est compté séparément des mesures de réception.

Présélection `35b402cf`, attentes auteur `3252ff2f`. Horloge du moteur déterministe. Premier essai à 00:27:37, verdict à 00:40:03 (UTC−3, 12 min 26 s). Rejeu des retraits pour enregistrer la source avant l’arrêt, puis correction du vérificateur pour inclure le gain du T12. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-klot-82-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', 'a0df8a9b13b51e63d08b5ca184c996ba20453e9c'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'catalogue','retraits','retours') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
