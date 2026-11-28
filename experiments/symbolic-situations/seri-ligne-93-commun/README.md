# SERI · contrôle ciblé du futur moteur commun

Référence opérateur scellée `e595f03f076bdc2cbde66326c6131aab8f33e843`. Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`, correctif contrôlé `eb5611b3ff76409fbd67680ac29a5f6a17586422`. [Bilan de provenance](../seri-ligne-93-temoins/BILAN.md).

Deux départs natifs depuis N1, six gestes par départ. Le premier présente deux complétions distinctes, fin de journal [2,3,3] et borne 5. Le plan doit citer [2,3,5] et le gabarit [5,2,3,5]. Le deuxième présente une unique question répétée avec retrait de la borne dans le journal. L’analyse directe garde le clic physique, le plan ne rappelle aucune continuation et le gabarit cite seulement [5]. Après chaque T5, comparer le remplissage et la décision du T6, puis son retour.

Les projections scellées de [references.json](references.json) contiennent les empreintes des deux reçus historiques complets, les commandes et références observées, les états d’admission et les empreintes des images et retours. Le lanceur monte le SHA exact du moteur indiqué, conserve les mêmes actifs et crée un service neuf par départ. Il rend un écart explicite avec le correctif de référence, même si les deux trajectoires physiques sont identiques. Le reçu donne aussi le premier écart avec le gel. Un effet hors de la fenêtre de six gestes ou une autre ligne du catalogue demande son propre contrôle.

## Rejeu

Node 24, depuis ce dossier. Fournir un chemin de destination libre. La racine de jeu est celle du Banc local.

```powershell
node rejouer.mjs <SHA complet> <racine jeu> <destination JSON>
```

Un code de retour 0 signifie que les deux départs concordent avec le correctif scellé. Un code 1 après écriture du reçu indique une divergence. Une erreur de chargement arrive avant l’écriture du reçu.

Le lanceur a reproduit les deux départs sur chacun des deux SHA historiques. Le correctif passe les deux. Au gel, le premier écart est le premier témoin du plan au T5 du départ dupliqué, révision 3 au lieu de 2. Le départ à une seule question passe aussi sur le gel.
