# WEAV : preuve passive des avances de lignes et croisements

Le module `scripts/sic-crossing-continuity.mjs` ne participe pas au choix des actions. Il capture la commande déjà autorisée, le rôle acquis de son axe, les preuves disponibles et la maille publique. Après l’exécution, il relit chaque case de la grille ainsi que la référence et calcule les empreintes des deux images réelles. Le collecteur raccorde ensuite ces mesures au retour natif et à l’acquisition finale.

Le contrat `measureCrossingContinuity` exige une série native bornée à 16 tickets, des indices successifs, des retours intermédiaires confirmés et une seule réconciliation finale. Chaque avance comptée doit changer la case effectivement adressée et y montrer l’encre attendue. Deux cases successives appartiennent au même contrôleur et suivent son axe et son sens. Un croisement de deux encres distinctes exige également la composition acquise, ses deux commandes et sa référence antérieure. Les changements d’autres éléments de l’image ne remplacent pas une avance de case.

Une transition officielle est vérifiée séparément : l’image du niveau suivant ne sert pas de preuve physique pour la dernière case de l’ancien niveau. Le compteur physique peut donc être inférieur au nombre de tickets continués. Les seuils par niveau doivent provenir du collecteur chronologique complet ; ils ne sont pas fournis par ce diagnostic.

Les 12 tests de `tests/sic-crossing-continuity.test.ts` passent. Ils vérifient une série d’avances simples et une série de croisements composés, puis refusent une proposition non exécutée, un plan distinct, une acquisition anticipée, une image périmée, une case inchangée ou erronée, un contrôle inconnu, une composition absente, une acquisition absente et un retour manquant.

Le petit fixture `tests/fixtures/sic-crossing-executed-public.json.gz` conserve les commandes publiques 7–8 et 18–19 de la capture diagnostique `weav-public.json.gz`, leurs propositions et les retours natifs présents dans l’observation suivante. Ce fixture n’est pas une qualification temporelle ni un parcours fourni au solveur. SHA-256 : `a162c309dcb438b65bdd4b2d839276414aa3e831ccc68e8413f92b527b561f82`.

Les hooks de `compare-source100.mjs` sont additifs et activés uniquement par le collecteur de continuité. Aucune source de production n’est modifiée.
