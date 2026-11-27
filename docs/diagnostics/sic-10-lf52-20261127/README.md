# LF52 : priorité d’une préparation encore justifiée

## Qualification stricte du second candidat : dix niveaux gagnés

Le candidat `7e736688`, figé au commit `6cd933919048b86039a52360a14339a3e39a31f2`, arbre `0cbe1da34f8f8c9af1d7be5b738219ca6bdec7ec` (GitHub `b4b6458e5add34b1174e745bc169bcde962ced98`), gagne les dix niveaux depuis le L1 avec un seul SIC et un seul worker. Le résultat officiel atteint 10/10, motif `target_levels_completed`, avec 713 commandes, 713 tickets et 713 commandes autorisées par SIC ; aucun reset ni undo. Les plafonds d’action et de temps d’origine restent inchangés. La capture passive et ses écritures incrémentales restent à l’intérieur du temps comptabilisé.

| Niveau | Commandes / plafond | Temps actif / plafond (ms) | Commandes continuées | Paires porteur / pièce / auxiliaire |
| --- | ---: | ---: | ---: | ---: |
| 1 | 8 / 13 | 2586 / 8000 | 7 | 0 / 0 / 0 |
| 2 | 40 / 48 | 12551 / 18000 | 0 | 0 / 0 / 0 |
| 3 | 46 / 56 | 19733 / 41000 | 0 | 0 / 0 / 0 |
| 4 | 54 / 60 | 25056 / 44000 | 0 | 0 / 0 / 0 |
| 5 | 99 / 119 | 72558 / 167000 | 38 | 29 / 3 / 0 |
| 6 | 91 / 110 | 65137 / 76000 | 18 | 21 / 1 / 10 |
| 7 | 148 / 178 | 99356 / 105000 | 87 | 87 / 23 / 18 |
| 8 | 68 / 82 | 98870 / 167000 | 14 | 6 / 2 / 0 |
| 9 | 112 / 135 | 243263 / 302000 | 0 | 0 / 0 / 0 |
| 10 | 47 / 57 | 108675 / 135000 | 13 | 17 / 4 / 1 |

Les 36 séries exécutées contiennent 177 commandes après leur index zéro ; aucune ne dépasse 16 commandes. Chaque retour intermédiaire est confirmé et chaque série ne réconcilie qu’une fois son préfixe réellement exécuté. Le niveau 1 conserve une série de huit clics. Les niveaux 5, 6, 7, 8 et 10 possèdent des translations physiques consécutives mesurées dans les images publiques. Les niveaux 2 à 4 et 9 restent unitaires : aucun témoin de continuité physique n’est revendiqué pour eux.

Le contrat `sic-carrier-preparation-contract.mjs` conserve séparément ces seuils par niveau, type de charge et longueur réelle de parcours. Les 17 tests du collecteur et du contrat passent, y compris la suppression ciblée de chaque type de charge, une image périmée, un ticket non exécuté et une acquisition prématurée ou absente. Il lie les positions mesurées aux empreintes des images, aux références des observations, à la commande acquise et aux tickets natifs. Une hausse des déplacements sans charge ne compense pas la perte du transport d’une pièce ou d’un auxiliaire. Le contrôle global combiné et la reproduction par l’interface publiée restent à effectuer avant livraison ; ce résultat ne signifie pas que le Site est déjà mis à jour.

Le reçu complet, le journal, les deux contradictions publiques conservées, le manifeste de source et le résumé sont archivés sous le préfixe `lf52-strict-6cd93391`. SHA-256 du reçu brut : `9847545b34abfce60b569b9b01b147b2f5e95ae2ea3aa98b23c2ee2d860ae9c6`. Empreinte de parcours : `d19704a5589bbb009ece09a686749e27eecc63e027cbe3061566c6c34c779e5a`.

## Échec strict historique du premier candidat

Le candidat de production `5455513b`, capturé depuis `bd2c45e5`, gagne les cinq premiers niveaux puis reste bloqué au niveau 6. Le watchdog arrête ce niveau à 93 commandes et 76 001 ms, au plafond original inchangé de 76 000 ms, avant ses 110 commandes autorisées. Le total est de 340 commandes. Les empreintes des cinq niveaux gagnés restent identiques au diagnostic initial ; leurs comptes sont 8, 40, 46, 54 et 99. Il n’y a pas de qualification ni d’annonce de victoire.

La capture passive de cette première tentative restait en mémoire et a été interrompue par le watchdog avant sa sérialisation. Les derniers tickets connus sont des sondes directionnelles étrangères au propriétaire. Cette limite ne permet pas de nommer encore le premier retour qui perd la nouvelle continuation. Le collecteur suivant écrit donc les contradictions et les préemptions publiques progressivement, après l’exécution, tout en conservant leur coût dans le temps mesuré. Les sorties partielles et le manifeste exact de cette tentative sont archivés ici ; la comparaison native et le résultat strict restent deux preuves distinctes.

## Seconde perte : le plan local est fini, le rôle reste valide

Le diagnostic public suivant rejoue uniquement les 278 commandes déjà enregistrées, jusqu’à l’image strictement identique de la première préemption. Il restaure le contexte du seul propriétaire à des fins de diagnostic, puis exécute réellement les quatre clics proposés. Les quatre retours confirment la sélection, le saut sur l’intermédiaire préservé, la nouvelle sélection et le saut réducteur. Le jeu n’est toujours pas terminé. La référence du propriétaire est actuelle, il n’est pas arrêté, et une pièce visible reste accompagnée de l’auxiliaire transporté.

À cette observation, le plan local est épuisé. L’entrée prioritaire refuse donc de proposer, tandis que l’entrée ordinaire du même propriétaire construit une route de révélation dont le premier geste est une commande `ACTION4` déjà acquise. La seconde correction conserve le rôle courant après la fin d’un plan local : elle retire seulement l’exigence de segment non vide. Les références actuelles, l’époque, l’absence de contradiction, l’effet connu et le refus des sondes ou essais entre auxiliaires restent exigés.

Deux nouvelles salles natives vérifient cette frontière sans injecter de plan. Une translation réelle déplace la caméra et révèle une troisième pièce ; ce retour supprime l’ancienne route tout en conservant les faits acquis. Avec les deux variantes de formes, palette, disposition et commandes, l’expérience concurrente prenait auparavant la main. Le rôle courant propose maintenant son prochain mouvement connu, qui est réellement exécuté et confirmé. Les sept tests natifs passent ; le rejeu strict du second candidat est maintenant décrit en tête du document.

`probe-carrier-returns.mjs` et les petites archives adjacentes rendent ce diagnostic reproductible. Ce rejeu d’un préfixe public n’est ni une campagne SIC fraîche ni une qualification temporelle ; il sert uniquement à exposer la première frontière et ses retours publics.

## Première perte publique

Le diagnostic chronologique part du niveau 1 et conserve un seul SIC, un seul worker et aucune reprise. Les cinq premiers niveaux demandent 8, 40, 46, 54 et 99 commandes. Au niveau 6, les commandes 30 et 31 exécutent une série de deux déplacements dont les retours confirment la projection. L’acquisition conserve une préparation de deux sauts et la référence de l’observation actuelle.

À la commande 32, l’arbitrage choisit pourtant `sic_test_prepared_effects / investigateContactFrontier` avant de consulter le propriétaire de cette préparation. Ce geste étranger rend sa référence périmée. Le refus ultérieur du propriétaire est correct ; la première perte est une priorité, sans contradiction du garde de déplacement. `first-preemption.json.gz` conserve l’image publique, l’observation, les preuves et l’état acquis au premier point de préemption.

Le diagnostic initial a omis la variable de références archivées et utilise donc au niveau 6 le plafond de secours de 80 commandes et 90 secondes. Il ne vaut pas qualification sous le plafond original de 110 commandes et 76 secondes. La perte à la commande 32 précède les deux limites. Un rejeu strict distinct doit utiliser `docs/architecture/sic-replay-reference-levels-20261126.json` sans changer les budgets.

## Rôle, preuve, réemploi et réfutation

Le rôle réutilisé associe une commande à la translation observée du porteur et de son contenu, puis les sauts supportés à la réduction observée de population. Les références de réduction sont acquises par les clics et leurs retours publics ; les contrôles viennent des déplacements effectivement observés. La disposition actuelle retrouve les instances à partir de la maille, des formes et des encres mesurées.

Le candidat donne accès au groupe de continuation précoce lorsque le dernier retour du rôle appartient exactement à l’observation et à l’époque actuelles, et que le propriétaire n’est pas arrêté. Il réemploie son planificateur et ses gardes existants, y compris quand une ancienne route vient de finir. Une commande encore inconnue, un essai de saut entre auxiliaires non établi, une référence périmée ou une contradiction ne gagne pas cette priorité.

Aucun identifiant de jeu, niveau, palette, coordonnées ou parcours témoin n’intervient dans cette règle de production.

## Transferts natifs

`tests/sic-carrier-reduction-transfer.test.ts` construit deux épisodes indépendants de trois salles. La première enseigne la réduction par quatre clics natifs et transmet leurs retours au crochet public d’acquisition ; la deuxième laisse le propriétaire découvrir les contrôles de porteur puis gagner ; la troisième déplace les instances et ajoute un auxiliaire transporté, alors qu’une expérience concurrente est prête.

La seconde variante change la silhouette, les dimensions, la palette, les positions et l’affectation des commandes. Dans les deux épisodes, le premier déplacement utile de la troisième salle réemploie le contrôle acquis, transporte ses preuves dans la proposition, puis la préparation conservée précède l’expérience concurrente et les tickets réels atteignent la victoire officielle. Une apparence d’auxiliaire ambiguë refuse l’association ; un retour de translation contradictoire ferme la préparation sans effacer les preuves antérieures. Un dernier test refuse les références périmées, les autres époques, les propriétaires arrêtés et les commandes encore à sonder.

Les sept tests natifs et TypeScript passent. La campagne réelle des dix niveaux est maintenant gagnée ; le contrôle global combiné et la reproduction dans l’interface livrée restent nécessaires avant publication.

Le collecteur passif `sic-carrier-preparation-continuity.mjs` mesure séparément les translations successives du même porteur, d’une même pièce transportée et d’un même auxiliaire transporté. Il utilise les positions relues dans les deux images publiques, les empreintes des images réellement lues, la commande effectivement exécutée, son contrôle acquis et les retours natifs rattachés au même plan. Une proposition seule, un changement de décision, un retour périmé, une commande inconnue, un changement de caméra ou un contenu absent ne remplacent pas cette preuve. Neuf tests vérifient ces refus sur le préfixe de deux commandes exécuté juste avant la préemption. L’archive `executed-carrier-prefix.json.gz` contient ce préfixe public (SHA-256 `bf97663df2fb993166b7f7a5f29e689f6e4dd91668296cc9ed6ff8b30e381879`). Les seuils par niveau proviennent désormais du reçu complet des dix niveaux décrit en tête du document ; ils ne sont pas extrapolés à partir de cet exemple.

```bash
node --test tests/sic-carrier-reduction-transfer.test.ts
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json \
  node scripts/check-sic-chronological.mjs LF52 auto /tmp/lf52-strict.jsonl 1 sic
```
