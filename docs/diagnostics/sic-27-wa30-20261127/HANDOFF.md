# Reprise WA30 — checkpoint non qualifié du 27 novembre 2026

## État vérifié

- Branche : `fix/sic-10-carriers-20261127`.
- Checkout de travail : `/workspace/scratch/8b7740e8a750/carriers`.
- Checkout strict figé : `/workspace/scratch/8b7740e8a750/carriers-wa30-strict`, source `d0d41f3a2d2dd02a185500128a9d98c0368151bc`, arbre `a2836164e37c541c5d7d289484c286b1b9661a7a`.
- Source strict durable : `e811c21d3ecdd7e575715ebaefadfdae0e5f6ec7`, même arbre.
- Aucun processus de campagne de ce lot ne tourne.
- Le dernier strict de WA30 gagne **5/9**, puis atteint le délai original de **21 000 ms au L6 après 37 commandes** (359 au total). Il conserve les parcours, empreintes, nœuds et deltas des cinq premiers niveaux. Le précédent candidat `3872019d` gagnait sept niveaux puis atteignait 134 commandes au L8 avant son délai original de 103 000 ms. Aucune de ces deux sources n’est qualifiée pour WA30 complet.
- Une restitution propriétaire seule du précédent candidat avait gagné le L8 à la commande135, après la dernière translation134 et le dépôt135. Ce diagnostic ne remplace pas une campagne SIC complète.

## Preuves archivées et rôle déjà testé

`wa30-strict-d0d41f3a.*` contient le dernier manifeste, l’échec brut, le journal et les quatre refus publics du L6. Les budgets proviennent toujours de `docs/architecture/sic-replay-reference-levels-20261126.json`. Le runner passif extérieur est `/workspace/scratch/8b7740e8a750/wa30-strict-contact.mjs`, SHA256 `04433cd8216066b01090b945a669406f5477212cb229de9330619214ae30ae6a` ; il reprend exactement le précédent runner. Ne pas changer les délais, l’UUID, les plafonds ou le nombre de workers.

Le source `d0d41f3a` acquiert une apparence de contact après un dépôt réellement exécuté puis le retrait observé : même caisse immobile, disparition du contact, retour de la coquille au repos et absence d’autre porteur adjacent. Les trois références sont conservées. La planification n’acquiert rien. Le réemploi sur une pièce déplacée par un pair exige sa position devant la face actuelle, un propriétaire unique, une coquille liée unique acquise et une géométrie compatible. Les cibles protégées restent strictes.

Les **38 tests natifs de continuité**, **9 tests de passage/cycle** et TypeScript étaient verts sur `d0d41f3a`. Deux variantes exécutent dépôt, retrait puis deux tickets continus de réemploi avec couleurs, maille, orientation, positions et commande différentes ; cinq négatifs couvrent apprentissage absent, indication hors face, couplage ambigu, contour contradictoire et cible modifiée. `probe-contact-appearance.mjs` confirme sur les retours réellement archivés l’acquisition98–99 et lève exactement les refus107–108 du L8. Une revue indépendante de `audit_27_evidence` n’a pas relevé de mutation à la planification ni de défaut évident de portée. Ces validations ne compensent pas l’échec du dernier strict.

## Première perte encore exploitable : retour349 au L6

Les refus325,326,327 sont identiques au précédent source : une nouvelle apparence de porteur n’a pas encore son transport confirmé. Le refus349 est différent dans son interprétation actuelle : la caisse immobile à `[8,4]` perd son contour de contact lorsque le joueur s’écarte de `[7,4]` vers `[7,5]`. Le rôle existe déjà, acquis au L5 aux révisions296–298, mais son consommateur ne couvre que les déplacements de pairs. La route ordinaire continue à prédire le contour de contact ancien. Cette caisse n’est ni le sujet visé `[14,7]` ni la cible `[7,4]` de la route. Ces coordonnées décrivent uniquement la preuve publique ; elles ne doivent pas entrer dans la logique de production.

## Modifications de travail conservées, NON TESTÉES

Après `d0d41f3a`, une ébauche ajoute dans `src/sic/oriented-delivery.ts` :

- `knownContactAppearance`, pour partager la vérification de compatibilité ;
- `routeSubjects`, pour partager les cellules à protéger ;
- `WalkStep.withdrawnContact`, une prévision de disparition de l’indication sur une caisse immobile initialement devant la face, non protégée et sans autre propriétaire adjacent ;
- `contactWithdrawalMatches`, qui vérifie cette prévision sur les deux images et les propriétaires réellement observés ;
- composition du contour au repos dans les scènes du préfixe, et raccordement du retour coopératif.

Cette ébauche a été interrompue à la demande de reprise utilisateur **avant tout typecheck ou test**. Les deux nouveaux scénarios natifs de retrait ordinaire/cooperatif et leurs négatifs restent à écrire. Aucun succès, gain temporel ni correction définitive ne peut être attribué à cette version de travail. Contrôler aussi que le garde avant du ticket suivant accepte réellement la scène acquise ; lever un seul garde après ne prouve pas la continuité.

Deux fichiers additifs non testés sont conservés : `scripts/sic-oriented-delivery-contract.mjs` et `tests/sic-oriented-delivery-contract.test.mjs`. Ils factorisent la mesure physique déjà existante et conservent seulement les **sept niveaux historiques**, avec contrôles de préfixe, observation et réconciliation. Ils ne sont pas raccordés au gate principal et ne qualifient pas les niveaux8–9. Le raccordement final devra remplacer la copie existante de `measureOrientedDelivery` dans `verify-sic-continuity.mjs`, préserver les modifications des autres lots et ajouter8–9 seulement après preuves réelles.

## Prochaine étape proposée

1. Reprendre le checkpoint et lire `AGENTS.md`.
2. Examiner l’ébauche de retrait349 ; écrire deux variantes natives distinctes et des refus sur propriétaire ambigu, cible protégée et retour contradictoire. Vérifier absence d’acquisition à la planification et réconciliation unique des tickets exécutés.
3. Rejouer hors jeu la proposition réelle349 avec son état public et le rôle acquis296–298 ; vérifier son premier retour et le garde avant suivant.
4. Exécuter les tests concernés et TypeScript, committer/pousser, puis figer un checkout.
5. Coordonner une seule campagne complète L1→9, un SIC/un worker, plafonds d’origine. Conserver chaque échec ; ne pas relancer pour obtenir un meilleur tirage de durée.
6. Si elle réussit, archiver la preuve et les effets physiques, compléter le contrat9 niveaux, exécuter le gate combiné, intégrer sur main puis reproduire par l’interface livrée. Le parent possède les autres lots et les étapes GitHub/Site.

LF52 est indépendant et déjà qualifié par sa campagne complète10/10=713 sur `6cd93391` ; ses reçus et son contrat physique sont archivés dans `docs/diagnostics/sic-10-lf52-20261127`. Le parent a pris en charge son intégration et la livraison ; ne pas relancer ses campagnes pour reprendre WA30.
