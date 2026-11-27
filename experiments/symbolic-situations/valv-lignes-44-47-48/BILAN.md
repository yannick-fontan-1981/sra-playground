# VALV · qualification indépendante des lignes 44, 47 et 48

Une seule ouverture de VALV L1 a servi aux 16 gestes nominaux et aux trois retraits sur branche. À chacun des tours choisis, le vrai service a émis le ticket de repli, le jeu l’a exécuté et le service a traité son retour. L’opérateur a ensuite utilisé `undo`, contrôlé le plateau et repris le parcours nominal. Les 17 observations nominales concordent avec l’archive publique, animations incluses. [Critères opérateur figés](https://github.com/yannick-fontan-1981/sra-playground/blob/c671aa0a70411bcd8d632c8b2d0604ec566a396b/experiments/symbolic-situations/valv-lignes-44-47-48/CONTRAT.md).

| Ligne | Verdict sur le gel et le candidat | Retrait sur `699ac89e`, retour du jeu et suite |
|---|---|---|
| **44 — enveloppe** | **3/3 occurrences.** Les images de T2 et T4 sont identiques. T2 répète en (32,50), puis le retour lie le contraste au point (8,50). T4 répète ce contraste en (8,50). Garder les 16 pixels changés de l’indicateur au retour T1 et annuler uniquement les 56 modifications des champs fait disparaître l’offre T2 et arrête le service. | Sans `offerEnvelopeFill` au T2, le service sélectionne l’expérience imbriquée en **(32,50)**. Le clic et sa réponse physique coïncident avec le nominal. Le reçu est acquis comme réponse imbriquée et ouvre à nouveau une répétition de l’enveloppe en (32,50). |
| **47 — champ** | **6/6 occurrences.** T1 et T5 ont les mêmes pixels. Le retour T4 atteste la restauration avec un seul champ ayant présenté un remplacement opaque. T5 isole en (50,33). Le contrôle change d’orientation, les champs sont préservés, T6 sert en (32,50). Un seul pixel de champ non restauré à T4 entraîne `field_restoration_unconfirmed` et zéro ticket T5. | Sans `offerFieldService` au T5, expérience imbriquée en **(32,50)**. Sa réponse est acquise et le service revient à l’isolation en (50,33). |
| **48 — transfert** | **6/6 occurrences nominales.** La transition officielle T10 fournit les deux références. T11 revalide (11,35), la porte passe d’horizontale à verticale et T12 reprend en (32,51). Retirer le témoin entier écarte l’offre de transfert. **La vérification de la date est partielle** : remplacer seulement sa première référence par une occurrence antérieure authentique laisse T11 admis sur les deux moteurs. Le vérificateur de provenance rejette cette paire. | Sans `offerFieldTransfer` au T11, expérience imbriquée en **(32,51)**. Après son retour, le service redemande la revalidation de la source en (11,35). |

Les 15 occurrences se répartissent sur 16 tickets, le premier étant une expérience imbriquée. Chaque ticket nominal admet sa garde courante, refuse la référence périmée et reçoit un effet physique non prédit (`matched:null`). Pour chacune des 15 occurrences, l’événement propre à la ligne porte l’occurrence d’émission et celle du retour. Les trois retraits attestent la substitution par les entrées nommées de la branche. Le gel a été éprouvé sur les décisions et leurs acquisitions.

**Décompte.** Cinq départs préenregistrés par SHA : parcours nominal, indicateur seul, restauration incomplète d’un pixel, témoin de niveau absent, témoin daté altéré. Une reproduction publique supplémentaire par SHA remplace T10 par T9 dans la première référence. Les douze reçus de ces comparaisons concordent entre révisions par paires. S’ajoutent trois retraits propres au candidat. Le parcours nominal a également été rejoué en direct pour vérifier l’archive. [Reçu détaillé](recu.json).

### Reproduire l’écart 48

Depuis ce dossier avec Node 24 et un nouveau fichier de sortie :

```powershell
node qualifier.mjs 699ac89e70be0e3cd9bceafa16689552576310a0 reproduction-48 "$env:TEMP/valv48-reproduction.json"
```

La reproduction garde les deux niveaux réels et l’image L2. La seule donnée modifiée est la première référence du champ `official_boundary_witness`. À T11, le témoin déclaré relie les révisions **9 et 11**, tandis que le ticket T10 et le retour officiel relient **10 et 11**. Malgré cette différence, le service libère `revalidate_source_access` puis `revalidate_conditional_service` après le retour réel archivé. Cette mesure porte sur la validation du champ daté dans une mémoire construite ; l’historique du parcours contient toujours le véritable changement de niveau.

La première instrumentation n’altérait que la mémoire appliquée. Le contrôle d’intégrité du journal a détecté la divergence au rappel. Les résultats publiés proviennent de l’injection à la construction de l’événement, lue à l’identique par la mémoire et le journal.

### Rejeu complet

Définir `$pyodide` (dossier absolu du paquet du Banc), `$reçus` (répertoire neuf) et `$selection` (fichier réservé de l’opérateur). Le groupe public et la reproduction 48 sont autonomes.

```powershell
node jeu.mjs $pyodide "$reçus/jeu.json"
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','699ac89e70be0e3cd9bceafa16689552576310a0')) {
  foreach ($g in @('public','réserve','reproduction-48')) {
    node qualifier.mjs $sha $g "$reçus/$($sha.Substring(0,8)).$g.json" $selection
  }
}
node verifier.mjs $reçus
```
