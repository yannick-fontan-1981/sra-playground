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

## Publication

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
