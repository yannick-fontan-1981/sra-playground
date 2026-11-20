# Arbitrage v31 sur trois départs à froid de Custom 4

Le candidat `3ea19a86` est entré sur `main` par avance rapide au commit `cf6069a1`. Le témoin est l’ancienne tête de `main`, `f3b4edc2`. Les six parties ont démarré directement au L2 après la fusion, avec un SIC neuf, sans leçon, sans réinitialisation et avec le même plafond de 1 200 actions et de temps actif. Les moteurs utilisés proviennent de `f4d28aee`. Pour ces trois jeux, les fichiers de moteur et de niveau concordent avec ceux de la fusion. SS09 L2 reste en réserve.

| L2 | Ancien main | Main fusionné | Destinations occupées simultanément, au mieux |
| --- | --- | --- | --- |
| SS06 | 46 coups, aucune proposition suivante | 151 coups, mort du marchand | 0 sur 2 dans les deux parties |
| SS07 | 5 coups, mort du voleur | 5 coups, mort du voleur | 0 sur 2 dans les deux parties |
| SS08 | 124 coups, aucune proposition suivante | 544 coups, temps actif écoulé | 0 sur 2 dans les deux parties |

Sur **SS06**, les 46 premiers coups sont identiques. Le marchand a visité 26 cases et le guerrier une. Ces deux nombres restent les mêmes après les 105 coups supplémentaires du candidat. Le candidat prend le contrôle du guerrier et teste des compositions. Au coup 151, ACTION5 déclenche une réflexion qui tue le marchand. Depuis cet état précis, les quatre commandes de déplacement laissaient les deux personnages en vie au coup suivant.

Sur **SS07**, les actions, les images et l’empreinte de trajectoire coïncident jusqu’à la fin. Au cinquième coup, la phase d’exploration publique sélectionne ACTION5. La réflexion tue le voleur. Les quatre déplacements testés depuis le même état le laissent en vie un coup de plus. Cette intervention mesure la conséquence immédiate de chaque choix.

Sur **SS08**, la première différence de commande survient au coup 22. Au coup 124, les personnages ont visité respectivement 10 et 9 cases avec le témoin, 8 et 2 avec le candidat. Ce dernier a seulement contrôlé le marchand. Ces chiffres restent identiques au coup 544. Le candidat a vu 30 images distinctes et enregistré 302 actions de rejeu, contre 66 images et 3 actions de rejeu pour le témoin. La distance géométrique minimale totale des deux personnages aux deux destinations distinctes est de 10 pour le témoin et de 12 pour le candidat. Ce calcul ignore obstacles et mécanismes.

### Reproduction

Le fichier [custom4-rejeux.json](custom4-rejeux.json) contient l’image initiale sous forme d’empreinte, les commandes émises, les empreintes des images suivantes et les mesures par paire. Depuis le dépôt, la commande ci-dessous rejoue les deux parties de SS06 sur un checkout du moteur figé. Remplacer le dernier argument par SS07 ou SS08 pour rejouer les autres paires. Chaque transition et les mesures finales sont vérifiées.

```powershell
node scripts/measure-duo-replay.mjs ../sic-contact-acquisition docs/diagnostics/sic-plan-arbitration/custom4-rejeux.json SS06
```

La comparaison mesure l’effet de l’ensemble des changements entre les deux versions. Isoler l’effet causal du seul arbitre nécessiterait une ablation. Le [rapport de gel](README.md) documente la cohorte des 100 jeux et les deux départs de SS01.
