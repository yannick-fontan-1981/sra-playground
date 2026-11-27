# Régression des réfutations de preview : GABA, 27 novembre 2026

Le correctif retrouve les six victoires de GABA en **447 commandes**, dans une seule session SIC depuis le niveau 1. Les 447 entrées `effects` du rejeu corrigé, y compris les commandes, changements de pixels, familles et situations, sont identiques à celles du témoin gagnant `4a546a139f9064422c078ef5f40b8c22133c39a8`. Les six `prefixHash` sont également identiques.

## Première décision fautive et portée de la preuve

Le lot des panneaux de PR132, source `ee9dad5f8773fed3ed507ad3c575181deae5f754`, avait fait échouer la continuité GABA : cinq niveaux gagnés puis 128 commandes au niveau 6 sans victoire. Le [job CI 140234604980](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/45915808188/job/140234604980) fournit les tickets exécutés et leurs retours. `ci-failure-GABA.jsonl.gz` est la copie compressée de cet artefact ; le SHA256 du ZIP téléchargé figure dans le manifeste.

La première divergence est la commande globale **347**, soit la deuxième commande du niveau 6. Les 346 premières commandes sont communes au témoin et à la CI. Le premier `ACTION1` du niveau 6 laisse la grille inchangée. La réfutation nouvellement partagée par époque, image et commande écarte alors toutes les autres associations portant `ACTION1`, même lorsqu’aucune interface de sélection n’a été identifiée. Elle expose une preview `ACTION2` prioritaire qui déplace des pixels et détourne le parcours.

Dans le témoin gagnant, le deuxième `ACTION1` mesure une autre association entre sujet et repère ; il reste lui aussi sans déplacement visible. Le contrôle de transport et son prochain `ACTION3` sont déjà disponibles avant ces deux essais. La reconstitution de l’état acquis montre que la seconde réfutation laisse ensuite une hypothèse de géométrie différente, traitée après les stratégies spécialisées. Le transport peut reprendre. Les observations publiques n’établissent aucun contrôle physique nouveau créé par le deuxième geste immobile ; son effet documenté porte sur l’état de l’enquête.

`first-divergence-public.json.gz` contient le diagnostic borné depuis le niveau 1, arrêté volontairement après la commande 347. Il conserve toutes ses commandes/effets et onze captures publiques, dont les retours d’acquisition au niveau 5 et la première divergence. L’extraction omet les entités dérivables des rasters et les copies répétées des états de famille ; son champ `extraction` énumère ces omissions et donne l’empreinte du fichier original. L’état complet des deux familles avant le premier geste du niveau 6 est conservé dans `tests/fixtures/sic-preview-cargo-refutation-public.json.gz`. Ce diagnostic instrumenté ne qualifie pas le temps d’exécution.

## Correction et conditions de réutilisation

Le changement de production est limité à `src/sic/witnessed-preview-transfer.ts`. Une réfutation commune à plusieurs associations exige désormais une interface non vide acquise lors d’une arrivée réellement observée, encore visible et réassociée sans ambiguïté. Sa clé conserve l’époque, l’image et la commande, et ajoute les rôles et les positions actuelles de cette interface. Deux interfaces distinctes ne partagent pas leur refus.

Lorsqu’aucune interface n’est acquise, le retour contradictoire reste enregistré pour l’association sujet/repère effectivement essayée. Les autres associations et leurs preuves demeurent disponibles. Le correctif ne modifie ni la planification du cargo, ni l’ordre des groupes, ni les plafonds. Les refus utiles des doublons sur les panneaux sont conservés.

## Rejeu standard corrigé

Source locale `f8b2f4f2ab202e24f755e38f590449432d2e34f9`, sauvegardée par l’API GitHub sous `f20cb3c160b6f1dbc14a5b0cfb5c696d07d0c4a5`. Les trois blobs et l’arbre `60a2f1777c1603e108f9b2888e5ea8bedd68f0e8` sont identiques. La différence entre les SHA de commits vient des métadonnées de création. Branche : `fix/sic-preview-cargo-regression-20261127`.

```sh
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json \
node scripts/check-sic-chronological.mjs GABA auto strict-GABA.jsonl 1
```

Le processus exécute une seule session SIC depuis L1, avec un worker et les références archivées inchangées. Il termine normalement sur `target_levels_completed`, après acquisition des 447 retours autorisés. Aucun reset ni undo n’a été demandé. Les six lignes du miroir `.levels` sont identiques aux six objets `levelStats` du résultat principal. Aucun score ne dépasse son plafond.

| Niveau | Commandes | Plafond commandes | Temps jusqu’au score | Plafond de temps |
| --- | ---: | ---: | ---: | ---: |
| 1 | 47 | 57 | 8,390 s | 20 s |
| 2 | 37 | 45 | 5,346 s | 16 s |
| 3 | 67 | 81 | 10,000 s | 23 s |
| 4 | 88 | 106 | 15,785 s | 36 s |
| 5 | 106 | 128 | 21,065 s | 50 s |
| 6 | 102 | 120 | 25,806 s | 37 s |

Les temps sont ceux de `scoredMs`. Les durées actives, totales et de réconciliation sont également conservées dans `report.json` et les bruts. La machine est partagée : aucun autre jeu n’a été lancé par cette campagne pendant son créneau, mais cette mesure ne prétend pas constituer un banc matériel isolé.

## Vérifications et limites

Les 20 tests ciblés de `sic-preview-interface`, `sic-experiment-arbitration` et `sic-pivot-cargo` passent, ainsi que `npx tsc --noEmit`. Ils couvrent deux transferts dans le moteur natif avec formes, couleurs, positions et commandes variées, une interface absente, un acteur ambigu, une contradiction, deux interfaces indépendantes et la reconstitution de la première décision publique de GABA. Une revue indépendante du correctif n’a relevé aucun bloqueur.

Le rejeu standard corrigé est une preuve de victoire et de conservation du parcours. Le contrat complet de continuité, notamment ses tickets et effets physiques par niveau, doit être relancé sur l’intégration PR132. La reproduction dans le viewer livré reste également à réaliser par le lot d’intégration. Les tests publics CRAF/SB26 protègent leurs interfaces acquises ; aucun nouveau bilan complet des 107 jeux n’est déduit de ce rejeu GABA.

`manifest.json` donne les empreintes des fichiers décodés et compressés, les références de source et la commande exacte du run. `baseline-GABA.jsonl.gz`, `strict-GABA.jsonl.gz` et `strict-GABA.levels.jsonl.gz` permettent de refaire les comparaisons sans rejouer un jeu.
