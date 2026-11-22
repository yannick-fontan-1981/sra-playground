# SIC Fallback — bilan des campagnes et de la nuit du 21 au 22 novembre 2026

**Sur les 100 premiers jeux, SIC Fallback a gagné 7 L3 après avoir lui-même gagné le L1 et le L2 dans la même partie. Sur le lot Custom 4 historique SS01 à SS14, il a gagné 9 L1, 8 L2 et 0 L3 dans cette condition.** Cela représente **17 niveaux sur 42, soit 40,5 %**. Sur le catalogue de `main`, qui inclut désormais SS15, la couverture attestée représente **17 sur 45, soit 37,8 %**. Ces chiffres comptent les niveaux distincts déjà gagnés, toutes versions qualifiées réunies. Ils ne prédisent pas les performances d’une version particulière. Point de mesure du 22 novembre à 10 h 26, heure de São Paulo. [Crédits Custom par jeu](custom4-campagnes-depuis-l1.json) · [Crédits L3 sources](sources-campagnes-l3-depuis-l1.json)

## 1. Quelle différence entre SIC et SIC Fallback sur Custom 4 ?

Les deux utilisent les mêmes jeux, les mêmes images publiques, les mêmes commandes et le même compteur officiel. **SIC** peut conserver la première famille de raisonnement spécialisée qui propose un plan admissible. En **SIC Fallback**, le moteur peut retirer cette première famille et recommencer la sélection. Trois familles restent disponibles dès le départ pour explorer les commandes, composer des gestes et tester des effets préparés. Si l’une d’elles prend déjà la main, les deux modes peuvent choisir la même commande. Le panneau du Playground transmet aussi le réglage d’expérimentation du pack en mode Fallback. Le reçu indique quelle famille a été retirée lorsque cela arrive. [Sélection du mode](../../../src/main.ts#L1307) · [Retrait et nouvel arbitrage](../../../src/logos-engine/v6-native-runtime.ts#L641)

**L’écart de taux de victoire entre SIC standard et SIC Fallback sur Custom 4 reste inconnu.** Les comparaisons témoin/candidat de ce chantier opposent deux réglages de **SIC Fallback**. Le score historique de 636/636 de SIC standard porte sur les 100 jeux sources. On ne peut en déduire ni une égalité ni un avantage sur Custom 4. Conformément au périmètre demandé, la nouvelle file ne lance que SIC Fallback. [Périmètre du score de SIC standard](../../architecture/sic-v8-reference-levels.md)

## 2. Où en sont les campagnes Custom 4 ?

Une victoire est comptée si le pilote part du L1, émet les commandes lui-même et gagne tous les niveaux précédents dans la même partie. Le moteur rejoue ensuite la trajectoire pour vérifier le crédit. Une campagne programmée jusqu’au L2 ne mesure pas le L3. Un niveau jamais atteint garde le statut « non atteint ».

| Niveau | Gagnés sur SS01–SS14 | Part des 14 jeux | Jeux gagnés |
|---|---:|---:|---|
| L1 | 9/14 | 64,3 % | SS01, SS02, SS03, SS04, SS05, SS07, SS12, SS13, SS14 |
| L2 | 8/14 | 57,1 % | SS01, SS02, SS03, SS04, SS05, SS12, SS13, SS14 |
| L3 | 0/14 | 0 % | Aucun crédit en campagne continue dans les certificats examinés |

**Pourquoi deux dénominateurs ?** Le moteur figé du chantier enregistre SS01 à SS14. Le catalogue de `main` au commit `bfa3ff324` enregistre aussi **SS15**, donc 15 jeux et 45 niveaux L1–L3. La campagne de l’ancien laboratoire SS15 gagnait le L1 en 91 actions. J’ai comparé le moteur, l’adaptateur et les définitions des niveaux avec `main`. Les règles et l’adaptateur correspondent, mais la carte du L1 a changé. Je ne reporte donc pas ce crédit sur le SS15 publié. SS16 figure dans les expériences du dépôt et n’a pas d’entrée dans le catalogue de cette révision. [Vérification de SS15 et périmètre de la nuit](bilan-nuit-sic-fallback-preuves.json)

## 3. Pourquoi aucun L3 Custom 4 gagné en campagne ?

**J’ai consacré trop de la qualification nocturne aux départs sur un niveau supérieur.** Parmi les 39 trajectoires L3 Custom distinctes retrouvées dans les certificats écrits ou réécrits pendant la nuit, **une seule avait commencé au L1**, celle de SS13. Les 38 autres ne pouvaient pas valider ton critère. Quatre L3 ont bien obtenu un crédit moteur en entrée directe au fil du chantier, SS06 en 141 actions, SS10 en 81, SS11 en 77 et SS13 en 176. Ces résultats expliquent l’ancien chiffre de quatre. Aucun ne justifie un crédit L3 dans le tableau ci-dessus. [Comptage nocturne et définition de la fenêtre](bilan-nuit-sic-fallback-preuves.json) · [Registre historique à conditions multiples](couverture-sic-niveaux-1-2-3.json)

Trois L3 ont maintenant des traces de campagne exploitables. Les blocages observés diffèrent.

| Jeu et campagne | Ce qui s’est effectivement passé au L3 | Ce que cela établit |
|---|---|---|
| **SS13**, v109, après des victoires en 143 puis 36 | Le temps actif expire au 277e geste. Le pilote a vu 25 images distinctes et effectué 166 retours vers une image déjà visitée après un changement. Aucune tentative de la famille de composition comptabilisée. | La campagne a réellement atteint le L3. Le pilote répète des transitions. La trace ne démontre pas quelle expérience aurait gagné. |
| **SS01**, v144, deux packs, 100 gestes chacun au L3 | Le témoin visite 53 images, avec 40 retours. Le candidat visite 25 images, avec 64 retours. Il consacre 33 commandes à l’inversion de préparations. Les deux avaient gagné le L2 en 32. | La nouvelle expérience réduit ici la couverture et les deux approches épuisent le budget. |
| **SS14**, v144, après des victoires en 31 puis 52 | Les deux packs produisent les 183 mêmes commandes et images sur la campagne. Au L3, le candidat atteint le plafond avec 100 images distinctes, aucun retour comptabilisé et aucune commande du nouveau test d’ordre. | Une règle anti-boucle ne traiterait pas ce cas. La nouveauté visuelle seule n’indique pas un progrès vers la sortie. |

Pour le reste du lot, le registre ne permet pas d’attribuer une cause mécanique au L3. Par exemple, une campagne SS07 s’arrête au L2. Sur d’autres jeux, la série certifiée visait seulement L1–L2. **« Aucun L3 gagné » ne signifie donc pas « quatorze échecs joués au L3 ».** [Mesures des trois L3](bilan-nuit-sic-fallback-preuves.json) · [Reçus des nouveaux essais](campagnes-ordre-des-preparations-v144.json)

## 4. Quels L3 des 100 premiers jeux sont gagnés ?

**7/100 en SIC Fallback et en campagne continue.** Dix jeux sources ont une campagne certifiée ayant atteint le L3. Sept le gagnent et trois l’ont atteint sans victoire enregistrée dans cette condition, AS66, CASC et COLM. Les 90 autres restent sans arrivée au L3 certifiée selon ce protocole. Le précédent total de 30 L3 agrégeait d’autres modes d’entrée.

| Jeu | Gestes au L1 | Gestes au L2 | Gestes au L3 |
|---|---:|---:|---:|
| AMZE | 3 | 5 | 6 |
| CATL | 8 | 8 | 8 |
| CATR | 32 | 4 | 5 |
| CAVA | 7 | 12 | 19 |
| CGWL | 15 | 33 | 36 |
| CLRS | 17 | 10 | 13 |
| GABA | 49 | 50 | 85 |

Chaque ligne est une même campagne gagnante. Les nombres indiquent une trajectoire vérifiée par jeu. [Certificats et empreintes des trois niveaux](sources-campagnes-l3-depuis-l1.json)

## 5. Quels gains de généralisation sont réels ?

**Transmettre une capacité apprise du L1 au L2 a fait gagner deux niveaux.** Dans l’expérience v109, le binaire et les budgets sont identiques. Pour chaque jeu, les deux packs produisent exactement les mêmes commandes et les mêmes images au L1. Une seule option change au passage au L2, celle qui autorise la transmission de la leçon de contrôle. La première décision diffère dès l’entrée du L2.

| Jeu | Réapprendre le contrôle au L2 | Réutiliser la leçon du L1 | Gain attribuable à la transmission |
|---|---|---|---|
| SS12 | Échec à 350 | Victoire en 30 | Un L2 gagné |
| SS13 | Échec à 99 | Victoire en 36 | Un L2 gagné |
| SS14 | Victoire en 99 | Victoire en 52 | 47 commandes économisées |

La même stratégie fonctionne sur trois jeux dont les dispositions changent. Le pilote réutilise les sujets et relations de mouvement observés et reconstruit son trajet dans la nouvelle scène. La bibliothèque lui fournit les hypothèses de marche, poussée, traction, échange ou projection à tester. Cette comparaison démontre un transfert **entre niveaux**. Elle ne mesure pas la probabilité de succès sur un jeu inédit. [Comparaison contrôlée et décisions du pilote](lecons-autonomes-v109.md#quapprend-réellement-le-l1)

**Choisir une expérience sur un effet inconnu fonctionne sur AS66, avec un coût de résolution mesuré.** Sur les 100 trajets L1 sources, huit occasions dans cinq jeux permettaient d’inverser les deux préparations depuis une nouvelle visite du même état. Une seule a révélé une différence de mobilité ou de crédit parmi les continuations testées. Cet exemple a motivé v144. L’auteur du pack déclare la question « l’ordre des préparations change-t-il l’effet du geste suivant ? ». Le pilote choisit le lieu, les deux préparations et le geste de vérification dans sa propre mémoire.

Dans la campagne AS66, les cinq premières commandes et images du témoin et du candidat sont identiques. Au coup 6 le témoin joue `4`. Le candidat joue `2 → 3 → 4`, après avoir déjà observé `3 → 2 → 4`. Au coup 8, il constate que le même sujet, auparavant immobile sous la commande `4`, avance de 16 pixels. Le contrôle indépendant depuis la même origine confirme cette mesure. **Le résultat officiel est défavorable au candidat.** Le témoin gagne les L1 et L2 en 11 et 23 gestes. Le candidat gagne le L1 en 19 et échoue au L2 à 60. Il dépense 27 des 60 gestes du L2 en comparaisons d’ordre. Sur les deux niveaux, 6 de ses 14 comparaisons complètes détectent une différence de mouvement. Aucun reçu de comparaison suivante ne cite ces découvertes pour justifier son choix. Le transfert de v144 à une nouvelle victoire Custom reste à prouver. [Première divergence, effets mesurés et scores](campagnes-ordre-des-preparations-v144.json) · [Interventions indépendantes](mesures-ordre-des-preparations.json)

## 6. Que s’est-il passé pendant la nuit ?

Fenêtre retenue du **21 novembre à 20 h au 22 novembre à 8 h**, heure de São Paulo. La première lignée Git de la branche contient 76 commits dans cette fenêtre, intégration de v104 comprise. Ce total retrace le travail, tandis que les crédits et comparaisons ci-dessus en mesurent la valeur.

| Heure locale | Travail vérifiable | Résultat pour le chantier |
|---|---|---|
| 20 h 00 à 21 h 07 | Intégration de v104 sur `main`, puis comparaison de la transmission de la leçon sur SS12–SS14 | Trois campagnes L1–L2 gagnées. Le test de transmission isole deux gains de victoire et un gain de 47 gestes. |
| 01 h 11 à 06 h 34 | Vérification des L3 de SS13, SS10, SS11 puis SS06 en entrée supérieure et analyse des premières décisions différentes | Quatre crédits sur ces L3 dans le registre historique. L’évaluation répondait mal à la demande de campagne continue. |
| 06 h 36 à 07 h 57 | Mesure des déplacements avant/après préparation, vérification de GABA en campagne et de l’expérience qui débloque SS07 L1 | GABA dispose d’une campagne L1–L3 vérifiée. Une expérience peut faire gagner le L1 de SS07. Son L2 reste bloquant dans les campagnes examinées. |
| Après 8 h | Comparaison de deux ordres de préparation, gel de v144 et essais autonomes avec deux packs | Une capacité expérimentale démontrée sur AS66, une régression sur son L2, aucun L3 Custom gagné en campagne à ce point de mesure. |

Les comptages nocturnes dédupliquent le jeu, l’entrée et l’empreinte de la trajectoire. Ils s’appuient sur les certificats locaux horodatés dans la fenêtre. Une réécriture ultérieure peut déplacer un certificat hors de la fenêtre. [Chronologie des commits et décompte des trajectoires](bilan-nuit-sic-fallback-preuves.json)

## 7. Décision et suite du chantier

La file précédente a été arrêtée. La nouvelle file utilise un seul worker, le mode `sic-fallback`, deux packs à budget égal et des campagnes autonomes depuis L1 vers L3. Elle couvre les 100 sources et les 15 jeux du catalogue Custom 4 publié. SS10 sert de contrôle du transfert du pack figé. Son essai en campagne est en cours au moment de ce bilan. Les campagnes bloquées sont comptabilisées au niveau effectivement atteint.

**Le prochain changement à éprouver concerne la sortie d’expérimentation.** Sur AS66, SIC finit de mesurer un effet nouveau, puis dépense d’autres gestes à mesurer sans que ses reçus établissent quelle étape du plan devient possible. L’essai décisif consiste à comparer, depuis ce point, poursuivre les expériences ou tenter une commande précédemment bloquée dont la condition vient de changer. Sur SS01, le témoin à battre est sa couverture de 53 images et surtout le crédit L3. Sur SS14, il faut d’abord identifier une conséquence utile parmi les états nouveaux. Le jalon reste une victoire officielle supplémentaire en campagne sur un jeu distinct.

Le candidat v144 est figé à `5619e1676` sur `codex/sic-autonomous-lessons`. V104 est intégré à `main`. V144 reste expérimental. Le contrôle TypeScript et les deux tests ciblés sur l’ordre passent. La suite complète du checkout partiel donne 16 044 tests réussis et 133 échecs, dont des fichiers de référence absents. La cause de tous les échecs n’est pas attribuée. La qualification historique des 100 victoires sources et des victoires Custom appartient aux versions déjà certifiées. La campagne de préservation de v144 reste incomplète. La régression AS66 suffit déjà à écarter une intégration de ce pack en l’état.
