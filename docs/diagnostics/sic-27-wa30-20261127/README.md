# WA30 : routes continues après disparition des porteurs perturbateurs

## Verdict

Le correctif de source `966122137dc5fb4009a265e0f7ace243f79c2bab` reste **non qualifié pour intégration**. Le rejeu strict depuis le niveau 1 vise neuf niveaux et en gagne sept. Le niveau 8 s’arrête à **98 commandes et 103 003 ms**, à l’échéance du plafond inchangé de 103 000 ms et avant sa limite de 166 commandes. Il n’y a pas de victoire sur ce niveau ; le niveau 9 n’est pas atteint.

Les niveaux 1 à 7 gardent exactement leurs empreintes de commandes et retours : 26, 59, 76, 48, 113, 48 et 42 commandes, soit 412 au total. Les 20 tests natifs de continuité, neuf tests de cycle/passage et TypeScript passent. Deux scénarios de transfert modifient la maille, les positions, les couleurs et les commandes ; les retours ambigus, contradictoires ou bloqués ferment les séries.

## Changement testé

Après disparition des formes perturbatrices, les translations libres ou chargées déjà confirmées peuvent être proposées en préfixe, dans le budget restant et jusqu’à 16 commandes. Chaque ticket vérifie encore la position, la charge, les cellules protégées, les arrivées et les effets attribués aux pairs. Les approches mémorisées du dernier objet restent unitaires et ne consomment qu’un point par retour réel. Les attentes et les interceptions restent unitaires.

Le témoin instrumenté `d258b5b900c9f042b8535f75fee2c976ec5c71a5` s’arrêtait à 100 commandes au niveau 8 ; la campagne complète sur `4a546a13` s’arrêtait à 96. Ces mesures ne démontrent aucun gain temporel du candidat. L’instrumentation du témoin mesure surtout un coût élevé de réconciliation, restauration et publication lorsque chaque commande ferme sa décision.

## Pourquoi les séries se ferment encore

L’analyse hors jeu réutilise uniquement les images publiques et les champs de plan/garde capturés. Elle ne restaure pas un checkpoint runtime complet : les tableaux de références et l’historique d’interception ne sont pas présents dans la capture. Ces champs ne participent pas à la sélection de la route observée une fois les formes perturbatrices absentes. Le script vérifie que le `step` et sa route sont identiques avant de comparer les gardes.

À la commande 62, le candidat propose bien trois déplacements et son garde avant accepte. Le retour ferme pourtant la série : deux porteurs autonomes attachent/déposent leurs caisses sans déplacer leurs corps. Les coquilles changent ; les positions et la charge propres au joueur sont conformes.

Sur les 38 décisions capturées des commandes 62 à 99, 28 proposent plusieurs commandes et toutes passent leur garde avant. Le premier retour de ces 28 propositions se répartit ainsi :

| Cas | Nombre | Commandes de la capture |
| --- | ---: | --- |
| Retour accepté | 1 | 90 |
| Rapprochement de porteurs identiques exclu par la portée sectorielle | 11 | 63, 76, 80 à 88 |
| Caisse protégée ou visée modifiée pendant le tour | 12 | 67 à 69, 73 à 75, 94 à 99 |
| Coquille attachée/déposée modifiée hors cible | 4 | 62, 70, 89, 93 |

Le diagnostic contrefactuel active seulement la procédure existante d’appariement spatial mutuellement unique, actuellement limitée au contexte `sectorNetwork.localTargets`. Il n’exécute aucune commande et ne persiste aucun état. Cette comparaison explique les onze refus liés à la portée ; elle ne constitue pas une autorisation de relâcher un garde en production.

Le plan vise aussi parfois une caisse transportée par un pair. Le `record` parallèle ne retient pas les transports externes observés ; le plan peut donc poursuivre un sujet qui change réellement. La suite du travail devra conserver et consommer les preuves de transport par instance, distinguer les changements de couplage, et maintenir les réfutations sur les sujets et les cases d’arrivée.

## Reproduire l’inspection

L’archive `public-evidence.tar.gz` contient les manifestes, sorties brutes, journaux progressifs et scripts externes, avec métadonnées tar/gzip fixes. `summary.json` donne son SHA-256 et les empreintes de chaque fichier. Depuis un dossier temporaire :

```bash
tar -xzf /chemin/public-evidence.tar.gz
node probes/wa30-captured-guard-probe.mjs /chemin/checkout-96612213 baseline/wa30-baseline-13.jsonl --all
```

Cette commande n’ouvre aucun jeu. Un nouveau rejeu chronométré doit être coordonné séparément, avec une source figée et les mêmes références archivées. Aucun contrôle de continuité global ni publication du Site n’est revendiqué pour ce candidat.

## Candidat de reprise : preuves des transports par instance

La reprise du 27 novembre conserve le rôle déjà appris de porteur autonome d’une pièce. Deux observations de déplacement conjoint établissent ce rôle ; son réemploi exige la même apparence observée et un appariement spatial mutuellement unique dans le déplacement maximal confirmé. Plusieurs propriétaires possibles, une pièce perdue, un déplacement non apparié ou un changement de la cible protégée réfutent l’association et ferment la série.

La première perte documentée reste le refus du garde à la commande 63 du niveau 8 : deux porteurs de même apparence ont chacun une association spatiale unique, mais la procédure existante est réservée aux dispositions sectorielles. Le candidat autorise cette procédure pour toute apparence dont le rôle de transport est déjà confirmé. Il acquiert aussi les positions externes avant le retour anticipé des dispositions parallèles ; le plan peut ainsi conserver les sujets réellement transportés et leurs preuves.

Les 22 tests natifs de `sic-oriented-delivery-continuity` et TypeScript passent. Deux variantes exécutent cinq tickets successifs avec deux porteurs indépendants de même apparence, hors disposition sectorielle ; la seconde change l’orientation, la maille, les couleurs et les commandes. Les retours exécutés acquièrent les deux transports avec leurs preuves. Les cas bloqués, ambigus, contradictoires et de cible modifiée continuent à fermer les séries. La comparaison hors jeu lève exactement les onze refus de portée décrits ci-dessus, sans lever les refus portant sur les cibles ou les changements inconnus de couplage.

Ce candidat attend encore son rejeu strict des neuf niveaux depuis le L1, sous les budgets originaux, et le contrôle global de continuité. Le résultat historique de sept niveaux ne qualifie pas ces modifications.
