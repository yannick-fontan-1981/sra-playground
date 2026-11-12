# Politique de synchronisation GitHub ↔ SRA Playground Site

## But

Éviter qu'une version publiée du Site contienne du code qui n'existe plus dans un dépôt Git durable.

## Source canonique

Le dépôt GitHub `yannick-fontan-1981/sra-playground` est la source canonique du code.

Les checkouts Sites, worktrees temporaires et environnements de conversation sont des espaces de travail éphémères.

## Procédure obligatoire avant publication

1. Exécuter les tests requis.
2. Créer un commit cohérent.
3. Pousser le commit sur GitHub.
4. Intégrer le commit sur la branche canonique prévue pour la publication.
5. Vérifier que le commit intégré est visible sur GitHub.
6. Publier le Site depuis ce code.
7. Relever la version Site et, lorsque disponible, le SHA source associé.
8. Vérifier que la publication correspond au commit GitHub prévu.
9. Enregistrer les deux identités dans la feuille de route ou le compte rendu.

## Preuve de synchronisation

Une publication est considérée synchronisée seulement lorsqu'on peut relier :

`version Site → SHA source publié → commit GitHub durable`

Lorsque l'outil Sites ne fournit plus le snapshot source ou le SHA, conserver au minimum dans le dépôt et dans le compte rendu le commit GitHub à partir duquel la publication a été faite.

## Branches de lots

Chaque lot travaille sur sa branche et pousse régulièrement.

Une branche de lot peut rester non intégrée, mais elle ne doit pas rester uniquement dans un checkout local.

## Divergence

Si GitHub et le Site divergent :

1. arrêter toute affirmation selon laquelle les deux représentent le même état ;
2. préserver les deux états disponibles ;
3. identifier les commits et fonctionnalités présents de chaque côté ;
4. reconstruire ou récupérer le côté manquant sans écraser l'autre ;
5. requalifier si nécessaire ;
6. rétablir la chaîne GitHub → Site.

## Interdictions

- Ne pas publier une modification qui n'existe que dans un checkout temporaire.
- Ne pas supprimer un checkout contenant des commits non poussés.
- Ne pas traiter un SHA connu mais introuvable comme une sauvegarde suffisante.
- Ne pas forcer `main` sans avoir identifié et préservé l'état remplacé.
- Ne pas annoncer une synchronisation GitHub/Site sans preuve vérifiable.

## Rapport de fin

Toujours fournir :

`branche | commit local | commit GitHub | commit intégré | version Site | SHA Site | état de synchronisation`

Cette politique est référencée par `/AGENTS.md` et s'applique à tous les lots du projet.
