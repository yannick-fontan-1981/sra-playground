# SC25 · ligne 21 · ouverture sur terrain construit

**Passage natif du motif à l’accès vérifié sur deux terrains construits. Le verdict du vrai SC25 reste partiel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et la remise `4dcc659183c31502edcca85f29d661426660a426` ont le même arbre moteur. Huit départs et 44 gestes par SHA donnent des reçus identiques, et six tests d’auteur passent par SHA.

- Le petit environnement repris du test auteur produit chaque image à partir du support, de l’empreinte du corps, des bits et de la commande réellement émise. Le vrai `V6AgentService` choisit et autorise les tickets et rattache le résultat à l’identifiant du geste. `MotifAccess.record` mesure les déplacements et l’effacement. Le harnais opérateur mesure en plus les différences de raster et l’occupation du support sans relire l’état de route du moteur.
- Sur les deux terrains, les observations jusqu’au T3 et son clic `ACTION6(7,24)` sont identiques entre les départs ouvert et fermé. Le panneau s’efface dans les deux cas, au même emplacement du corps. La seule différence des images après le retour est l’apparition du support sur dix pixels. Le service donne alors `walk / ACTION4`. Si la piste reste fermée, le même propriétaire joue `toggle / ACTION6(7,20)` et le corps reste immobile.
- Le déplacement calibré vaut `(2,0)` ou `(0,2)`. La première marche T4 reste sur le support ancien et la seconde, au T5, occupe deux pixels de la partie neuve. Les vrais retours des terrains confirment ces deux franchissements. Le préfixe conserve le reçu du T5 à sa clôture. Dans chaque terrain, servir au T5 un retour construit qui garde la pose précédente produit `matched:false`, scelle le préfixe et fait revenir à `toggle`.
- À raster ouvert identique, retirer seulement l’événement de l’invocation et sa référence historique laisse le même `walk / ACTION4`, effectivement joué et confirmé, avec une référence historique de moins. La référence à la vue courante reste naturellement celle du retour. Dans ces deux cas, l’autorisation de marcher dépend du support observé et du vecteur acquis. Elle ne dépend pas de la présence de l’entrée historique de l’invocation.
- Aucun niveau terminé dans les terrains construits. Le [parcours officiel SC25](../sc25-ligne-21/BILAN.md) s’arrête au T51 en N1, sans déplacement d’accès du motif. Les terrains établissent la composition du service et la réponse à une obstruction contrôlée, avec un seul corps mobile. La consommation d’une ouverture dans un épisode officiel SC25 reste à établir.

Préenregistrement `5c5a7a13`, attentes auteur `d4f1eec1`. Premier essai à 00:33:38, verdict à 00:38:27 (UTC−3, 4 min 49 s). Reprise des contrôles pour comparer tous les pixels du retour d’invocation. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24. Le terrain utilise la fixture Git.

```powershell
$out = Join-Path $env:TEMP ('sic-sc25-access-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', '4dcc659183c31502edcca85f29d661426660a426'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  node qualifier.mjs $sha contrôles (Join-Path $out "$short.contrôles.json")
  node qualifier.mjs $sha auteur (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
