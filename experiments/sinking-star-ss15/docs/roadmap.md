# SS15 — Feuille de route

## Laboratoire 0.2.0

- [x] Magicien violet + Barde magenta, échange dirigé et chant carré.
- [x] Rayon dévié, relais de miroirs et retour en boucle animé.
- [x] Reflets globaux, commandes, presses, plateformes et combat simultané.
- [x] Appuis immergés mobiles et ancrage sous les héros.
- [x] Ancien niveau 4 déplacé en première position.
- [x] Atelier de vingt découvertes déplacé en quatrième position, avec passages conditionnés.
- [x] Huit salles originales ou adaptées, avec sources et changements déclarés.
- [x] Finales avec ressources réemployées et contre-exemples locaux exécutés.
- [x] HTML autonome, contrôles complets et interruptions d’animation.
- [x] 38 tests moteur, huit routes gagnantes et rejeu du HTML compilé.
- [x] Revue indépendante des deux finales et des textes publics.
- [x] Atelier L4 : 142 entrées, vingt découvertes, six contre-branches et accès directs contrôlés.
- [x] Campagne réordonnée : 732 entrées, 2 153 images, aucun refus ni décès.
- [x] Documentation de règles, conception, sources, validation et intégration.

Les métriques et l’empreinte exacte de la construction qualifiée se trouvent dans `docs/validation.md` et `validation/`. Le code de ce lot est isolé sous `experiments/sinking-star-ss15/`.

## Prochaine étape : Custom 4 et Site

- [ ] Adaptateur natif SS15 et ajout au catalogue Custom 4.
- [ ] Galerie, accès direct, interface et aides du Playground.
- [ ] Parité des huit témoins dans l’adaptateur et le dispatcher.
- [ ] Vérification visuelle en navigateur sur ordinateur et mobile.
- [ ] Non-régressions du runtime partagé et du catalogue.
- [ ] Commit et push de l’intégration, intégration dans le `main` courant.
- [ ] Publication du Site existant depuis ce commit durable.
- [ ] Vérification du Site, de sa version et de son SHA source.

Le prompt exécutable de cette étape est `docs/codex-integration-prompt.md`. Le présent lot fournit le laboratoire et la démo autonome ; aucune version Site SS15 n’est associée à ce lot.

## Identité du lot

| Élément | Référence |
| --- | --- |
| Dépôt canonique | `yannick-fontan-1981/sra-playground` |
| Branche de travail | `fix/ss15-workshop-order-20261122` |
| Base main vérifiée au démarrage | `a14bd33e34c187c0c4fee2039676bfca43760465` |
| Révision locale / distante du laboratoire | Commit contenant ce dossier, relevé dans le compte rendu de livraison et par `git log -1 -- experiments/sinking-star-ss15` |
| Branche canonique visée pour le laboratoire | `main`, avec contrôle du parent et du même arbre avant mise à jour |
| Version du laboratoire | `0.2.0` |
| Version Site SS15 / SHA Site SS15 | Non applicables avant l’intégration native et la publication |
| Statut de synchronisation du Site pour SS15 | Non évalué par ce lot |

Conformément à `AGENTS.md`, le laboratoire doit être poussé sur GitHub avant la livraison. Le compte rendu fournit les SHA effectivement vérifiés ; la version du Site ne doit jamais servir d’archive unique du code.
