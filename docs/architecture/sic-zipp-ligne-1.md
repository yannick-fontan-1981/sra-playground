# ZIPP · identifier la commande qui agit sur la cible

## Contrat de la ligne 1 avant le changement

La branche part du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. L’entrée de catalogue est `acquire_control_for_target / experiment`, ZIPP L2, commande 15, `ACTION2`. Elle totalise huit commandes dans l’inventaire. La recapture du niveau 1 jusqu’au plafond historique de 16 commandes, avec reprise de la même session après le passage de niveau, donne `replicate_translation` pour ce ticket sur `8ce7ee35`, `d0e7527c` et `3c2d6bcf`. La voie `sample_unused_control` de la même famille est celle qui appelle `bindMissingControlTrial`. Le reçu de T15 ne porte aucun `missingControl`. [Catalogue](sic-v8-strategies-observees.md?plain=1#L27) · [Choix de l’expérience](../../src/logos-engine/v6-native-caller.ts#L375)

| Situation à vérifier | Invariant préenregistré |
|---|---|
| ZIPP L2 T15 | Un seul essai antérieur de la commande dans l’époque, deux recalages possibles, une signature suivie et une origine différente justifient de proposer une répétition. Préserver `ACTION2`, la paire morphologique, la signature, le vecteur attendu (0,12), les trois références dans leur ordre, le garde, le résultat du pas et la décision T16. |
| Mêmes commandes, plateau et objectif, historique modifié | Un essai antérieur hors époque ne justifie plus cette répétition. Si la signature de la cible manque dans la preuve ou si le sujet est revenu à l’origine de l’essai, aucun déplacement de ce sujet ne justifie l’offre. Une autre décision reste possible suivant les offres ouvertes. |
| Autre contexte | Sur le protocole public indépendant à carré mobile, la première commande sans mesure ouvre un essai P05. Le déplacement depuis une origine différente ouvre ensuite la répétition, avec son propre vecteur. Comparer le sujet et les reçus jusqu’au retour. |
| Périmètre du candidat | Isoler uniquement la construction de l’offre de répétition à partir de l’essai mesuré, en réutilisant le recalage et le déplacement du moteur. La famille garde l’ordre des expériences et des commandes, la paire retenue et le passage par la frontière. Le moteur garde l’autorisation d’exécuter. |

Le crédit sur le gel et l’apport du candidat seront établis séparément. La ligne 18 possède son propre témoin et son propre dénominateur.
