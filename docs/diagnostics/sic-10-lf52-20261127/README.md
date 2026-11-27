# LF52 : priorité d’une préparation encore justifiée

## Première perte publique

Le diagnostic chronologique part du niveau 1 et conserve un seul SIC, un seul worker et aucune reprise. Les cinq premiers niveaux demandent 8, 40, 46, 54 et 99 commandes. Au niveau 6, les commandes 30 et 31 exécutent une série de deux déplacements dont les retours confirment la projection. L’acquisition conserve une préparation de deux sauts et la référence de l’observation actuelle.

À la commande 32, l’arbitrage choisit pourtant `sic_test_prepared_effects / investigateContactFrontier` avant de consulter le propriétaire de cette préparation. Ce geste étranger rend sa référence périmée. Le refus ultérieur du propriétaire est correct ; la première perte est une priorité, sans contradiction du garde de déplacement. `first-preemption.json.gz` conserve l’image publique, l’observation, les preuves et l’état acquis au premier point de préemption.

Le diagnostic initial a omis la variable de références archivées et utilise donc au niveau 6 le plafond de secours de 80 commandes et 90 secondes. Il ne vaut pas qualification sous le plafond original de 110 commandes et 76 secondes. La perte à la commande 32 précède les deux limites. Un rejeu strict distinct doit utiliser `docs/architecture/sic-replay-reference-levels-20261126.json` sans changer les budgets.

## Rôle, preuve, réemploi et réfutation

Le rôle réutilisé associe une commande à la translation observée du porteur et de son contenu, puis les sauts supportés à la réduction observée de population. Les références de réduction sont acquises par les clics et leurs retours publics ; les contrôles viennent des déplacements effectivement observés. La disposition actuelle retrouve les instances à partir de la maille, des formes et des encres mesurées.

Le candidat donne accès au groupe de continuation précoce seulement lorsqu’une préparation subsiste, que son dernier retour appartient exactement à l’observation et à l’époque actuelles, et que le propriétaire n’est pas arrêté. Il réemploie son planificateur et ses gardes existants. Une commande encore inconnue, un essai de saut entre auxiliaires non établi, une référence périmée, une absence de préparation ou une contradiction ne gagne pas cette priorité.

Aucun identifiant de jeu, niveau, palette, coordonnées ou parcours témoin n’intervient dans cette règle de production.

## Transferts natifs

`tests/sic-carrier-reduction-transfer.test.ts` construit deux épisodes indépendants de trois salles. La première enseigne la réduction par quatre clics natifs et transmet leurs retours au crochet public d’acquisition ; la deuxième laisse le propriétaire découvrir les contrôles de porteur puis gagner ; la troisième déplace les instances et ajoute un auxiliaire transporté, alors qu’une expérience concurrente est prête.

La seconde variante change la silhouette, les dimensions, la palette, les positions et l’affectation des commandes. Dans les deux épisodes, le premier déplacement utile de la troisième salle réemploie le contrôle acquis, transporte ses preuves dans la proposition, puis la préparation conservée précède l’expérience concurrente et les tickets réels atteignent la victoire officielle. Une apparence d’auxiliaire ambiguë refuse l’association ; un retour de translation contradictoire ferme la préparation sans effacer les preuves antérieures. Un dernier test refuse les références périmées, les autres époques, les plans absents, les propriétaires arrêtés et les commandes encore à sonder.

Les cinq tests natifs et TypeScript passent. La campagne réelle des dix niveaux et le contrôle global de continuité restent à exécuter avant qualification ou publication.

```bash
node --test tests/sic-carrier-reduction-transfer.test.ts
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json \
  node scripts/check-sic-chronological.mjs LF52 auto /tmp/lf52-strict.jsonl 1 sic
```
