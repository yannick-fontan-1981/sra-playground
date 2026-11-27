# FOGW · ligne 61, renouvellement de la demande

**La première différence entre `e2e5b52f` et son enfant direct `21fd159e8339ee464a5b7bee0824b93ccefe9995` apparaît au retour du T17, avant le ticket suivant.** Dans le scénario préenregistré où le L remplace la croix, l’événement 34 de la projection ordonnée passe de `reception_control_projection` à `reception_subject_changed` dans le champ `reason`. Les deux retours portent `matched:true` et la même référence d’observation. La confirmation physique de stationnarité est conservée. [Qualification de l’extraction](sic-qualification-fogw-e2e5b52f.md) · [Comparaison et reçus](sic-fogw-ligne-61-correctif/recus.zip)

| Moment | Extraction | Correctif |
|---|---|---|
| T17, avant le changement | Première attente du plan de huit pour la croix `8081538d…`, une attente déjà dépensée | Identique |
| Retour T17 | La position prévue concorde, le préfixe reste ouvert. | Le nouveau sujet est visible sur la même disposition et au même support. Le moteur ferme le préfixe pour la croix. |
| Ticket T18 | `native:18 / ACTION4`, indice 1 sur 8. Le plan cite encore la révision 17 et la croix. | Même identifiant ordinal et même commande. L’indice est 0 sur 1, le plan cite la révision 18 et le L `0c273d66…`. Compteur d’attente 2, maintien du nouveau sujet à mesurer. |
| Retour T18 et ticket T19 | L’opérateur a prolongé le bras du parent et observé la poursuite de l’ancien plan. | La position concorde sur le même L. Le moteur ouvre un nouveau plan de huit pour ce L à la révision 19, indice 0, maintien confirmé, compteur 3. |

Le catalogue depuis L1 concorde sur les 16 tickets et retours (32 événements de cette projection). Le prolongement du vrai jeu à 32 commandes concorde sur 64 événements avec ses deux captures à T18 et T32. Le bras de remesure unitaire concorde sur ses 35 événements. Les deux SHA passent chacun les quatre tests de leur révision. Le L retouché et son deuxième retour stationnaire sont des observations construites. L’opérateur a reproduit trois changements de demande corrigés, deux demandes stables et 23 exécutions sur les trois moteurs. [Épreuve indépendante](https://github.com/yannick-fontan-1981/sra-playground/blob/abd1c209d2d0879f94f851482caf6f9c80654f14/experiments/symbolic-situations/fogw-ligne-61/BILAN.md)

## Jeu complet en mode SIC exclusif

Sous Ubuntu 24.04, deux sessions indépendantes depuis L1 ont terminé **6/6 niveaux, 173 décisions et 1 623 événements identiques**. Le comparateur a lu les deux traces. Leur SHA-256 commun est `427111dce42f58710996fb638dcf2720103f5a1315abe700372d2aa52a916594`. Les deux reçus complets concordent avec celui du gel. Ce mode de validation est distinct du pack utilisé pour le changement de demande. Le workflow vérifie le parent Git, les deux SHA et la commande `FOGW auto <reçu> 1 sic`. [Run 46081644546](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46081644546) · [Workflow épinglé](https://github.com/yannick-fontan-1981/sra-playground/blob/50005cf66379b99d3b5962fb5286b0fb1df5b388/.github/workflows/sic-fogw-qualified-course.yml)

Sur Windows, les plafonds historiques ont écourté les deux essais locaux en série. Le parent valide quatre niveaux puis s’arrête au N5 après 28 commandes de ce niveau (29 s). L’enfant valide trois niveaux puis s’arrête au N4 après 27 commandes (19 s). La première différence locale est l’événement 589, N4 T27, `native` face à `stop`. Ces deux reçus et leur comparaison restent dans l’archive avec les mesures Ubuntu. Les traces Windows sont conservées dans `artifacts/qualification-fogw-21fd159e/`.

## Reproduire la première différence

Avec Node 24.22.3, préparer les jeux sur un checkout propre de chaque SHA. Depuis chaque checkout moteur, utiliser le même fichier de sonde du banc et un chemin de reçu neuf. Le service et la méthode d’acquisition du jeu restent ceux de la révision capturée.

```powershell
$env:SIC_RECEIVER_GAME_ROOT = (Get-Location).Path
$env:SIC_RECEIVER_SOURCE = $env:SIC_RECEIVER_GAME_ROOT
$env:SIC_RECEIVER_RECEIPT = Join-Path $sortie "$rev.json"
$sonde = ([uri](Join-Path $banc 'scripts/sic-observe-fogw-61.mjs')).AbsoluteUri
node --import $sonde tests/sic-reception-fogw-line61.test.ts
```

Depuis le banc, comparer les deux fichiers. Le contrôle vérifie le retour, le plan, le sujet, l’indice, la référence et le budget avant la reprise.

```powershell
py scripts/check-sic-fogw-61.py "$sortie/e2e5b52f.json" "$sortie/21fd159e.json"
```
