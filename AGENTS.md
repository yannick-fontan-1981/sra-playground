# SRA Playground — règles persistantes de travail

Ces règles s'appliquent à tout travail réalisé sur ce dépôt, quelle que soit la conversation ou le lot.

## GitHub est la source canonique

1. GitHub est la source canonique et durable du code.
2. Un checkout local ou un checkout Sites sous `/workspace/sites/...` est temporaire et ne doit jamais être l'unique détenteur d'un changement utile.
3. Toute modification cohérente doit être commitée puis poussée régulièrement sur une branche distante.
4. Avant d'abandonner, supprimer ou perdre un checkout, vérifier que tous les commits utiles sont présents sur GitHub.

## Synchronisation GitHub ↔ Site

Toute publication du Site SRA Playground doit suivre cette chaîne :

`travail → tests → commit → push GitHub → intégration sur la branche canonique → publication Site → vérification GitHub/Site`

Avant de considérer une publication terminée :

- relever le SHA Git local ;
- vérifier que ce SHA ou son commit d'intégration existe sur GitHub ;
- publier le Site depuis cet état ;
- relever le SHA source associé à la version Site lorsque cette information est disponible ;
- vérifier que le code publié correspond au commit GitHub attendu ;
- consigner dans le compte rendu : branche, SHA local, SHA poussé, SHA intégré, version Site et SHA source du Site.

Si le Site et GitHub divergent, ne pas poursuivre silencieusement. Préserver les deux états, identifier lequel contient les changements les plus récents, réconcilier les sources puis reprendre le travail.

## Travail parallèle

Les lots peuvent développer, tester fonctionnellement, committer et pousser en parallèle dans leurs propres branches/checkouts.

Aucun lot ne doit attendre une publication d'un autre lot uniquement pour sauvegarder son travail.

Les commits doivent rester petits et cohérents, avec des pushes réguliers.

## Actions continues de SIC

Lorsqu’un plan contient plusieurs gestes déjà justifiés, exposer son préfixe au moteur natif. Une décision engage au plus 16 commandes, dans le budget restant. Entre les commandes, vérifier uniquement les prémisses et le retour observé. En cas de contradiction, de changement de niveau ou de limite, clore la série. Réconcilier une seule fois les gestes réellement exécutés, dans l’ordre, puis rendre la main au raisonnement. Une expérience dont la suite dépend d’une découverte peut rester unitaire.

Avant d’intégrer un changement de SIC, du pack, de l’arbitrage ou du moteur, exécuter `npm run test:sic-continuity`. Une victoire et un plan annoncé de plusieurs actions ne prouvent pas la continuité. Le contrôle examine les tickets exécutés et les clôtures natives sur chaque niveau protégé, avec des témoins de déplacements, de clics et de séries mixtes. Ajouter au contrat tout nouveau niveau dont on qualifie la continuité. Pour changer un seuil, documenter la raison et comparer le parcours antérieur dans la même modification.

Le contrôle doit aussi vérifier les effets physiques de la campagne depuis le L1. Compter séparément les poussées successives de la même caisse, du même miroir et le positionnement continu juste avant un transfert réussi. Une hausse des séries de marche ailleurs ne compense pas leur disparition.

## Généricité et transfert des rôles SIC

Ces exigences s’appliquent dès qu’une session Codex modifie l’apprentissage, la reconnaissance d’un rôle, le passage de niveau, la planification ou l’arbitrage SIC.

1. Reproduire la première décision qui échoue avec les observations et les commandes publiques. Avant de coder, nommer le rôle appris, le retour qui l’établit, la condition de réutilisation et le retour qui pourrait l’infirmer.
2. Chercher d’abord où ce rôle est appris et consommé dans le moteur commun. Conserver les effets confirmés et leurs preuves indépendamment des coordonnées, du plan en cours ou de la famille qui a exécuté l’action. L’identifiant du jeu, le numéro du niveau, une couleur absolue, des coordonnées fixes et un parcours témoin ne peuvent pas décider du comportement en production.
3. Après un changement de niveau, retrouver les instances à partir de leur forme et de leur couleur observées. Quand une instance et son interface sont compatibles, utiliser l’effet appris dès la première décision qui a besoin de ce rôle et contrôler le retour. Si plusieurs instances correspondent, choisir une observation qui peut les départager. Si un effet est contredit, revoir l’association ou la commande concernée et conserver les autres faits documentés.
4. Avant de qualifier la modification de générique, exécuter le scénario réel depuis le niveau 1 et au moins deux scénarios de transfert distincts. Varier la forme, la couleur, les positions et les commandes entre scénarios. Inclure un cas ambigu et un cas contradictoire. Vérifier dans les tickets exécutés et leurs preuves que le premier geste utile réemploie bien le rôle et que les vérifications ciblées ne relancent pas l’apprentissage complet.
5. Exécuter le test du rôle dans le moteur natif et le contrôle `npm run test:sic-continuity`. Dans le compte rendu de la session, donner les cas validés, le niveau où les faits ont été acquis et leurs conditions de réutilisation. Une victoire sur le jeu d’origine ne suffit pas à établir le transfert.

## Compositions atteignables

1. Avant de corriger un blocage, identifier le premier moment où une interaction atteignable est proposée, écartée ou perdue. Donner le retour observable et distinguer l'absence de reconnaissance, l'absence de chemin, la priorité et l'échec d'un garde.
2. Conserver les essais de contact atteignables quand l'objectif terminal est inconnu. Considérer un essai comme effectué après la commande de contact et son retour. Un trajet préparatoire ou une sélection de curseur seuls ne suffisent pas.
3. Pour qualifier la correction, vérifier dans les tickets le contact réel, les rôles réutilisés, la continuité de la préparation et l'effet physique. Ajouter au moins un cas avec une observation ambiguë ou manquante et un cas distinct du parcours corrigé. Annoncer les conditions et les limites de la preuve.

## Publication

### Pendant le test d’un jeu précis

Chaque modification destinée au prochain essai de Yannick inclut la relivraison du site, sauf s’il demande explicitement de différer. Retrouver son adresse de test dans la session. Si elle est locale, y servir la version dès qu’elle est prête et donner le lien sans attendre GitHub ni Sites. Quand Yannick demande un essai uniquement local, réserver la publication hébergée à une demande ultérieure. Pour une livraison hébergée, intégrer sur `main`, puis publier avec les accès existants.

Avant d’annoncer une victoire, la reproduire par les commandes de l’interface livrée avec le mode et le parcours demandés. Préciser le niveau de départ, le résultat officiel et les coups par niveau. Dans le compte rendu, donner le lien rejouable, la version déployée et le SHA vérifié. Si la livraison ou la reproduction échoue, le signaler et poursuivre le diagnostic.

Le Site est un déploiement du code, pas une archive source.

Ne jamais considérer une version Site comme suffisamment sauvegardée tant que le code correspondant n'est pas durablement présent sur GitHub.

## Compte rendu minimal de fin d'étape

Toute étape qui modifie ou publie le code doit indiquer :

- branche de travail ;
- dernier commit ;
- commit poussé sur GitHub : oui/non ;
- commit intégré à la branche canonique : oui/non ;
- version Site publiée, si applicable ;
- SHA source du Site, si disponible ;
- éventuelle divergence GitHub/Site ;
- prochaine étape.

Cette règle prévaut sur toute ancienne consigne qui autoriserait une publication Site sans sauvegarde GitHub durable.
