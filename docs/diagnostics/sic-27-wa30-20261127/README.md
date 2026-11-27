# WA30 : routes continues après disparition des porteurs perturbateurs

## Troisième tentative stricte : dernière commande non exécutée au niveau 8

Le candidat `3872019d` conserve les sept premiers niveaux puis atteint 134 commandes au L8 avant le watchdog de 103 000 ms, soit 546 commandes au total. Il reste non qualifié à 7/9 ; les plafonds 166 commandes et 103 000 ms n’ont pas changé. Le manifeste, la sortie stricte, le journal et les fermetures publiques incrémentales sont archivés sous ce préfixe.

Une restitution diagnostique des commandes publiques, depuis le L1, retrouve les six images de refus strictes (commandes 69, 99, 100, 103, 107 et 108). Elle restaure uniquement la famille orientée au préfixe public 61 et poursuit les commandes réellement dispatchées : le L8 se termine à la commande 135. Ce diagnostic n’est pas un SIC complet et n’est pas chronométriquement qualifiant. Il infirme la piste d’une approche mémorisée arbitrairement unitaire : les derniers transports possèdent déjà leurs préfixes continus. La dernière commande est simplement le dépôt, après une translation à la commande 134.

Deux pertes évitables restent documentées aux commandes 107 et 108. Une caisse se déplace avec son propriétaire unique, mais son contour devient l’indication de contact lorsqu’elle passe devant la face du joueur, puis retrouve son contour lié quand le joueur se tourne. La commande 99 avait déjà observé la disparition de cette indication sur une caisse déposée et restée immobile lorsque le joueur s’écarte. Le prochain candidat devra acquérir cette relation à partir du dépôt et du retrait réellement observés, puis la réutiliser uniquement devant la face actuelle et pour un couplage acquis sans ambiguïté. Les gardes sur les cellules visées restent nécessaires. Aucun succès complet n’est revendiqué.

## Nouvelle tentative stricte : sept niveaux, puis délai au niveau 8

Le candidat `71a6680b` repart du L1 avec un seul SIC, un seul worker et les références originales inchangées. Il conserve exactement les sept premiers comptes : 26, 59, 76, 48, 113, 48 et 42 commandes. Le niveau 8 atteint cette fois 110 commandes avant le watchdog à 103 001 ms, pour un total de 522 commandes. Le plafond reste 166 commandes et 103 000 ms. Le candidat reste donc non qualifié ; le niveau 9 n’est pas atteint.

La capture passive incrémentale conserve 47 retours contradictoires publics, même après l’arrêt du processus. À partir de la commande 62 du niveau 8, les refus sur les apparences identiques ont disparu. Les fermetures restantes concernent notamment des changements réels de couplage hors sujet aux commandes 62, 70, 74, 89 et 96, puis la poursuite de pièces nouvellement attachées ou transportées aux commandes 100–105. Les premières preuves d’un nouveau transport ne suffisent actuellement pas à réserver sa pièce, même quand le rôle du porteur a déjà été acquis. Les images, propositions, états publics et retours sont archivés dans `wa30-strict-bd2c45e5.jsonl.public.jsonl.gz` ; `wa30-remaining-closures.json.gz` donne leur classement. Les gardes de cible restent fermés tant que cette association n’est pas justifiée.

## Candidat suivant : couplage appris et nouvelle pièce d’un porteur connu

La première fermeture encore évitable se produit à la commande 62 du niveau 8 : la route propre et ses cellules protégées restent conformes, tandis qu’un pair dépose une caisse et qu’un autre attache une caisse immobile. Le retour change deux coquilles entre leur état lié et leur état au repos. Les commandes publiques 60 et 61, archivées avant cette perte, suffisent à acquérir la coquille liée lors de deux translations conjointes. Une réacquisition hors jeu de ces retours établit ce rôle avec deux références d’observation ; le garde de la commande 62 accepte ensuite les deux changements indépendants. Ce diagnostic ne restaure pas tout le SIC et ne remplace pas une campagne chronométrée.

Le rôle de couplage conserve l’apparence du porteur, l’apparence observée de la coquille et les deux preuves de déplacement conjoint. Son réemploi exige un porteur stationnaire apparié sans ambiguïté, une seule caisse liée adjacente et le passage entre l’état au repos connu et l’état lié acquis. Le garde conserve les contraintes sur le mouvement propre, la charge, les arrivées et les sujets protégés. Une coquille inconnue, deux propriétaires possibles ou deux caisses liées possibles ferment la série. Les cellules portant une apparence déjà reconnue de sol intérieur ne sont plus simultanément proposées comme propriétaires : la commande 62 contenait précisément une telle cellule à côté de la nouvelle pièce liée.

Une première association actuelle, obtenue par mouvement conjoint ou par ce couplage reconnu, réemploie le rôle de porteur déjà acquis. La réservation ne réclame plus deux nouveaux déplacements à chaque changement de caisse. Sur les véritables observations des commandes 102 et 105, la proposition évite désormais la caisse du pair et vise une autre pièce. Les preuves du nouveau rattachement et du rôle antérieur figurent dans la proposition. L’association perdue ou ambiguë n’est pas réservée.

Deux variantes natives changent la palette, la taille des cellules, l’orientation, les positions et la commande acquise. Chacune exécute cinq commandes continues à travers un dépôt et un rattachement publics, avec une seule réconciliation. Deux autres exécutions observent ce rattachement en fin de préfixe puis vérifient la réservation dès la décision suivante, avant deux nouvelles translations. Les refus de propriétaire ambigu, de coquille inconnue, de caisses ambiguës, d’obstacle, de charge perdue et de cible modifiée restent vérifiés. Les 31 tests natifs de continuité, six tests de passage et TypeScript passent. Le nouveau candidat attend encore un rejeu strict complet depuis le L1.

Les fichiers `wa30-coupling-public-prefix.json.gz` et `wa30-coupling-public-counterfactual.json.gz` conservent les images, commandes, preuves et deux verdicts du garde. `wa30-reused-role-counterfactual.json.gz` conserve les propositions comparées des commandes 102 et 105. Reproduction hors jeu :

```bash
node docs/diagnostics/sic-27-wa30-20261127/probe-public-coupling.mjs
node docs/diagnostics/sic-27-wa30-20261127/probe-reused-role.mjs /chemin/checkout-6cd93391
```

## Verdict historique

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

Les 24 tests natifs de `sic-oriented-delivery-continuity` et TypeScript passent. Deux variantes exécutent cinq tickets successifs avec deux porteurs indépendants de même apparence, hors disposition sectorielle ; la seconde change l’orientation, la maille, les couleurs et les commandes. Les retours exécutés acquièrent les deux transports avec leurs preuves. Deux autres variantes font se croiser les apparences : chaque arrivée possède deux origines également proches, le premier retour ferme la série et conserve le rôle de transport précédemment établi. Les cas bloqués, ambigus, contradictoires et de cible modifiée continuent aussi à fermer les séries. La comparaison hors jeu lève exactement les onze refus de portée décrits ci-dessus, sans lever les refus portant sur les cibles ou les changements inconnus de couplage.

Le rejeu strict de ce candidat est décrit en tête du document : sept niveaux gagnés puis délai au huitième. Le candidat suivant de couplage demande une nouvelle campagne ; aucune qualification complète n’est revendiquée.
