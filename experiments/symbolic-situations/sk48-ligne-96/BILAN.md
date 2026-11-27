# SK48 · ligne 96

**La composition locale est attestée sur le gel. Le transfert du parcours complet échoue sur quatre des dix départs préenregistrés.** Les résultats du gel et de la révision `08fa10a6` sont identiques, arbre `src` compris. Chaque départ a été relancé dans un processus neuf. [Protocole figé](https://github.com/yannick-fontan-1981/sra-playground/blob/dc0eb28e8506058c33c93c8f9e7d693c09b11e86/experiments/symbolic-situations/sk48-ligne-96/CONTRAT.md).

| Départs par révision | Première décision discriminante | Portée |
|---|---|---|
| 2 parcours historiques | T12 réfuté. À preuve antérieure identique, T13 ACTION3 rétracte la pointe 46 → 40, ou ACTION1 remonte le support de 6 pixels. Le jeu confirme la projection complète de chaque ticket. | Deux choix fondés sur deux. Les parcours historiques finissent L1 aux gestes 19 et 21. |
| 4 départs de développement, permutation 9 ↔ 14 | Les commandes de calibrage ACTION1, ACTION4, ACTION3 et ACTION2 passent. L’ordre visible devient 8, 9, 14. À la révision 5, quatre contrôles mesurés, aucun contre-exemple de contact, arrêt `frontier_unknown`. Au même choix, l’historique libère le premier geste du plan conditionnel. | 4 échecs de transfert du parcours sur 4. La mesure locale de 96 est inapplicable pour ces quatre départs. L’éventuelle retouche du retour 12 n’a jamais été servie. [Reproduction publique](premier-ecart-public.json). |
| 4 départs de réserve, situation préenregistrée | Sur témoin de translation conjointe, 2 priorités sur 2 libèrent des commandes différentes au T13, toutes deux confirmées. En échangeant les identités distales au seul retour 12, le support, la pointe et la première pièce concordent, mais la chaîne perd sa preuve. Aucune des deux priorités ne libère de T13. | 4/4 verdicts locaux. Les positifs s’arrêtent volontairement après le retour 13. |
| 2 contrôles supplémentaires de développement | Palette historique, même échange des deux pièces distales au seul retour 12. Deux arrêts `frontier_unknown` après 12 tickets, témoin de chaîne absent. | 2/2 refus justifiés. [Conditions additionnelles fixées après le diagnostic amont](CONTROLE-PUBLIC.md). |

**Dénominateurs.** Par SHA, l’étape 96 est atteinte et qualifiée dans 6/10 départs du protocole initial (4 reprises confirmées, 2 refus justifiés). Les 4 autres s’arrêtent avant T5. Les 2 contrôles supplémentaires portent la mesure locale à 8 cas sur 12. Total comparatif de 24 exécutions. Le même support et la même pointe avaient été prédits correctement au geste 12, mais les prédictions de deux pièces sur trois étaient fausses. La commande conservait sa mesure de +6 pixels. Les deux reprises ont fait l’objet d’une comparaison séparée avec les pixels du vrai jeu. Le vérificateur rejette la validation de toute la scène sur le seul accord du support, ainsi que l’attribution du reçu d’une reprise à l’autre.

Les cas construits changent les identités visibles dans la géométrie SK48. La campagne n’établit pas le transfert à un autre plateau géométrique. Les 19 et 21 gestes sont des résultats de parcours historiques distincts du verdict de composition. [Reçu comparatif](recu.json).

### Rejeu

Depuis ce dossier avec Node 24, définir `$pyodide` (dossier absolu de Pyodide du Banc) et `$reçus` (répertoire de sortie neuf). Le fichier de sélection de réserve est conservé chez l’opérateur. Les autres groupes sont rejouables sans celui-ci.

```powershell
node jeu.mjs $pyodide "$reçus/pixels.json"
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','08fa10a6b9986e7028551fbfc9d9e16eb83726b7')) {
  $court = $sha.Substring(0,8)
  foreach ($groupe in @('historique','développement','réserve','complément')) {
    node qualifier.mjs $sha $groupe "$reçus/$court.$groupe.json" $pyodide "$reçus/selection.json"
  }
}
node verifier.mjs $reçus
```

Pour reproduire le premier arrêt seul, fournir [la fiche de cinq gestes](premier-ecart-public.json) à `experiments/sic-agenda-offres/revision-96/lancer.ps1 operateur --moteur gel --fiche <fiche> --pyodide <dossier>` dans le checkout de preuve `08fa10a6`.
