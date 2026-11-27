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

## Candidat : apparence de contact acquise après dépôt et retrait

Le nouveau rôle est une relation d’affichage réversible entre la coquille au repos et le contour vu directement devant la face du joueur. Un dépôt exécuté retient seulement un témoin provisoire ; le déplacement ou la rotation suivante doit laisser la même caisse immobile, faire disparaître le contact et rendre la coquille au repos. Aucun autre porteur adjacent ne doit expliquer ce retour. Les trois références publiques sont conservées après cette seconde action, avant le retour anticipé de l’organisation parallèle. Une planification seule n’acquiert rien.

Le réemploi concerne seulement une caisse réellement déplacée avec un propriétaire apparié sans ambiguïté. L’indication doit se trouver exactement devant la face actuelle, ne pas être la charge propre et correspondre à la forme/coquille de repos acquises ; le porteur doit posséder une unique coquille liée confirmée. La représentation du transport garde alors cette coquille sous l’indication momentanée. Les cellules du sujet et de la cible restent comparées sans normalisation. Un contour inexpliqué, un couplage ambigu ou un autre emplacement ferment la série et conservent les faits de déplacement propres indépendants.

La restitution des retours archivés confirme l’acquisition aux commandes 98–99 et lève exactement les deux refus des commandes 107–108 ; la première disparition non encore expliquée à 99 ferme toujours la série. Cette comparaison ne promet pas deux décisions économisées : un garde avant peut encore constater une arrivée devenue occupée. Reproduction sans ouvrir le jeu : `node docs/diagnostics/sic-27-wa30-20261127/probe-contact-appearance.mjs`.

Deux scénarios natifs exécutent réellement un dépôt, un retrait, puis deux translations continues d’une nouvelle disposition avec une pièce de pair portant l’indication acquise. Ils varient la maille, l’orientation, la palette, les positions et la commande de translation. Les tickets de réemploi portent les trois preuves et se réconcilient une seule fois. Cinq cas distincts refusent l’absence d’apprentissage, l’indication hors face, deux couplages possibles, un contour contradictoire et la modification du sujet protégé. Les 38 tests natifs de continuité, les tests de passage/cycle et TypeScript sont verts. Ce candidat attend une nouvelle campagne complète sous les références d’origine ; WA30 demeure non qualifié à ce stade.

## Rejeu strict du candidat de contact : arrêt au niveau 6

Le source figé `d0d41f3a` a conservé les cinq premiers parcours (26, 59, 76, 48 et 113 commandes), ainsi que leurs empreintes, nombres de nœuds et deltas. Il s’arrête ensuite à 37 commandes du L6 au délai original de 21 000 ms, soit 359 commandes et cinq niveaux gagnés. Ce résultat est un échec conservé sous `wa30-strict-d0d41f3a.*` ; il ne permet pas de qualifier le candidat ni ses niveaux 8–9.

Les quatre refus publics du L6 sont exactement les mêmes que sur `3872019d` : révisions 325, 326, 327 et 349. Les trois premiers concernent l’apparence d’un porteur dont le transport n’était pas encore acquis. Le quatrième révèle un réemploi encore absent du rôle de contact : après disparition du porteur perturbateur, une caisse immobile perd l’indication quand le joueur s’écarte. La relation avait déjà été acquise au L5 (révisions 296–298), mais seule la variante concernant une caisse portée par un pair l’utilise. La route propre ordinaire prédit donc encore l’indication périmée. Cette observation justifie d’examiner la composition de ce retrait connu ; elle ne justifie pas d’augmenter les budgets ni de relancer jusqu’à réussite.

## Retrait d’un contact connu dans une route

Le préfixe réemploie la relation lorsque la caisse immobile se trouve devant le joueur, sans autre porteur adjacent, et demeure extérieure au sujet et à la cible protégés du trajet. Le retour doit établir la séparation et la coquille au repos dans cette même cellule. Si la coquille observée contredit la relation sous ces prémisses, la réconciliation invalide cette association et conserve les faits de mouvement indépendants. Un autre porteur adjacent ou une cible devenue occupée ferme le préfixe sans invalider le rôle.

`node docs/diagnostics/sic-27-wa30-20261127/probe-contact-withdrawal.mjs` vérifie les empreintes des images 349 et 350 et reconstruit la proposition de neuf commandes avec le programme SIC et les références d’acquisition 296–298. Le premier retour réel est reconnu. Le garde de la commande suivante est admis sur ce retour. Le diagnostic s’arrête à ce garde.

Deux scénarios natifs exécutent l’acquisition, puis deux commandes de retrait et de continuation. Ils varient la maille, la palette, l’orientation, la commande et la présence d’un pair. Les refus couvrent un propriétaire concurrent, l’indication qui persiste après retrait et l’occupation d’une cible protégée. Dans les deux succès, les deux commandes sont réconciliées une fois dans l’ordre. Les 55 tests ciblés et TypeScript passent. Ce candidat attend sa qualification stricte de L1 à L9 avec les limites d’origine.

## Premier rejeu strict avec retrait connu

Le [run GitHub 46024175969](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46024175969) a testé le commit figé `90fb06f44016a1a60ecacf888086de1a69873783` avec Ubuntu 24.04, Node 24, un worker et les plafonds d’origine. Il gagne 8 niveaux en 547 commandes. Les commandes par niveau sont 26, 59, 76, 48, 113, 48, 42 et 135. Le L6 marque en 17 143 ms sous 21 000 ms et le L8 en 90 786 ms sous 103 000 ms.

Le L9 s’arrête à 41 commandes sous 51 000 ms, pour 588 commandes cumulées. Les huit dernières commandes documentées passent par l’accès aux cavités puis l’exploration des entrées. Les reçus bruts, les plafonds et leurs empreintes sont conservés dans `github-46024175969/`. WA30 reste à qualifier. La prochaine investigation porte sur la première décision du L9 où un rôle de livraison devrait être admis.

## Réassociation du secteur quand un pair attache une caisse

Le [diagnostic passif 46025848752](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46025848752) collecte le passage réel du L8 au L9 du même source. Les deux premières commandes, ACTION4, exécutées par les effets préparés, reproduisent le parcours du propriétaire. A la révision 550, les 13 récepteurs sont encore visibles, mais une caisse stationnaire passe de sa coquille au repos à la coquille liée déjà confirmée pour le pair voisin. Le détecteur compte huit caisses au repos alors que les scènes successives contiennent les neuf caisses. Le propriétaire se retire. Le retour de l’ACTION1 suivante reste celui du parcours attendu, puis la quatrième commande du L9 diverge.

Le réemploi s'appuie sur la direction effectivement exécutée dans la même époque, les deux scènes où l’acteur est retrouvé, les récepteurs compatibles et le changement de coquille entièrement expliqué par les couplages observés. Un motif de remplissage déjà acquis et revalidé dans les deux images écarte une cellule de surface prise pour un second porteur. La relation retrouvée conserve la référence du retour et les preuves d’acquisition du pair. Un contour inconnu, un pair ambigu ou un récepteur changé fait refuser cette réassociation.

`node docs/diagnostics/sic-27-wa30-20261127/probe-level9-sector-rebind.mjs` vérifie sur les images publiques archivées que le propriétaire propose ACTION1 à 550, accepte le retour réellement observé, puis admet le garde d’ACTION4 à 551. Deux parcours natifs de transfert et trois cas négatifs font partie des 60 tests ciblés. Les limites du prochain rejeu de qualification restent celles d’origine.

Le [strict 46028295665](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46028295665), sur `0a8b02e744cd9e5a2284a8c396593a0079de987a`, préserve les huit premiers parcours. Au L9, il atteint maintenant 63 commandes sous 51 000 ms, soit 610 commandes au total. Les huit derniers tickets de ce niveau appartiennent tous à la livraison orientée. Le résultat reste 8/9. Les reçus et leurs empreintes sont dans `github-46028295665/`.

Le candidat combiné part de `15f683fc`, qui intègre les optimisations de canonisation et de réconciliation déjà validées avec SNAR. Les fichiers WA30 sont repris à l’identique depuis `cb90cfbb`. Ce rejeu distingue ainsi la performance du moteur commun avec la même stratégie WA30. Le seuil de 51 secondes du L9 est conservé.

Le [strict combiné 46029488256](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46029488256) sur `6f508a61` gagne les huit premiers niveaux avec les mêmes comptes. Il s’arrête au L9 après 52 commandes à 51 secondes, soit 599 cumulées. Les huit derniers tickets sont de nouveau tous associés au propriétaire orienté. Les reçus et leurs empreintes sont dans `github-46029488256/`.

## Préfixes bornés dans un secteur avec interférence connue

Le trajet peut engager plusieurs commandes acquises si toutes les poses prévues restent dans le secteur d’envoi et si les gardes coopératifs couvrent chaque arrivée. Ils restent vérifiés sur le retour réellement exécuté. Une route mise en défaut dès la première arrivée ne reçoit pas ce préfixe. Lorsque le porteur perturbateur se retrouve à portée d’interception, le retour valide clôt la série et rend la décision au moteur. Le premier essai propriétaire sans cette borne divergeait à la commande 40.

La recherche en largeur utilise la première découverte de chaque état, avec le même ordre de parcours et la même limite d’états traités. Sur `probe-level9-owner.mjs`, la comparaison propriétaire conserve les 66 couples de commandes et d’empreintes publiques et passe de sept à dix-neuf continuations. Les mesures et la trajectoire commune figurent dans `wa30-sector-prefix-comparison.json` et `wa30-sector-prefix-public-hashes.json.gz`. Le diagnostic part du retour L8 archivé et la qualification reste réservée au rejeu L1→L9. Deux variantes du parcours natif vérifient que la clôture n’émet pas le deuxième ticket lorsque l’interception devient possible.

Le [strict 46031341255](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46031341255) sur `b037f9f97d6d8f6df1f53e8e609c26683388262a` (arbre `44c31afdca3e94203903e01f4a1adc169a1760df`) atteint **9/9 en 613 commandes SIC**, sans reset ni undo. Les comptes par niveau sont 26, 59, 76, 48, 113, 48, 42, 135 et 66. Le L9 marque en 46 027 ms, sous 51 000 ms. La commande, les plafonds, les retours par niveau, les empreintes et le reçu brut figurent dans `github-46031341255/`. La collecte physique du même SHA et la validation sur la source d’intégration sont des contrôles séparés.

Le [rejeu physique 46032251104](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46032251104) reproduit les comptes par niveau sur ce SHA exact, soit 613 commandes au total. Au L8, il mesure 56 continuations, 53 paires de déplacements du porteur et 44 paires de translations consécutives de la même caisse. Au L9, il mesure respectivement 19, 19 et 8. Ces deux niveaux portent le contrôle commun à 170 niveaux, sur 26 jeux et 25 cohortes. Les sept planchers historiques de WA30 restent inchangés. Le collecteur utilise 166 comme maximum technique commun, égal au plafond original du L8. Le contrat contrôle les plafonds propres à chaque niveau, dont 80 pour le L9. Les échéances strictes restent celles de la référence archivée. Le reçu de collecte, ses empreintes et son manifeste figurent dans `github-46032251104/`.

`npm run test:sic-continuity -- <reçus>` a accepté les 25 cohortes. Le contrôle a repris les reçus de la PR143 et remplacé le seul reçu WA30 de sept niveaux par la collecte de neuf niveaux. Les actions de la CI d’intégration devront être rejouées sur sa propre source.

## Travail de recherche partagé entre les approches d’un même état

Dans le strict combiné sur `ed7d394d`, WA30 atteint 65 commandes au L9 sous 51 000 ms. Pour les approches sans charge, les cases occupées, la surface et les commandes disponibles sont identiques pour chaque combinaison caisse et orientation. Une recherche à progression paresseuse répond à ces demandes depuis la même frontière. Elle conserve la première découverte FIFO et la limite de 2 048 états traités. Les critères des trajets chargés et le départage des choix restent inchangés.

`node docs/diagnostics/sic-27-wa30-20261127/probe-level9-route-work.mjs` compare l’optimisation à `01226397` sur le diagnostic propriétaire du L9. Les 66 commandes, leurs empreintes de retour et leurs indices dans les tickets sont identiques, avec 19 continuations. Les recherches passent de 1 717 à 799 et les états visités de 323 166 à 61 596, soit 80,9 % de moins. Le strict combiné reste la qualification de cette source.

## Retrait gardé pendant la livraison d’un pair

Le strict suivant, sur `bbb2ca84`, atteint aussi la commande 65 au L9 à 51 secondes. Le diagnostic physique montre trois retraits identiques à partir de la commande 64 pendant que le dernier pair transporte sa caisse. Le recul peut rester engagé tant que le secteur distant a reçu assez de caisses pour ses récepteurs, que les cibles locales occupées sont préservées et que les retours expliquent les déplacements et couplages du pair. Chaque retour physique doit confirmer le même choix de recul et une arrivée libre avant que le ticket suivant soit émis.

Sur `probe-level9-owner.mjs`, la comparaison avec `ac7790f0` conserve les 66 commandes et toutes leurs empreintes. Les commandes 65 et 66 deviennent les deuxième et troisième tickets du même préfixe. La mesure conservée dans `wa30-guarded-wait-measurement.json` passe ainsi de 19 à 21 continuations. Deux variantes natives valident la réconciliation unique. Une cible changée, un pair non apparié ou une arrivée bloquée ferme le préfixe.
