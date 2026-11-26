# Reprise de la campagne SIC — 26 novembre 2026

## Sources et portée

La reprise réunit `main` après SS23 (`7ba57180f543b0954fc98d1f3f1e016c8f161508`) et la branche SIC sauvegardée (`19a82e7afb4bcac034de9a7f16b643153b1c00ac`). Le témoin intégré est `844e4be77efc69bde6c1fb8ba31b3d5325cb9702`. Le nouveau correctif de production est `fa1ac73068c3800002d887228e7d3ac6a9166b4a`, sur `fix/sic-campaign-recovery-20261126` ([PR 129](https://github.com/yannick-fontan-1981/sra-playground/pull/129)).

Les corrections SIGN et GABA de la session interrompue étaient déjà sauvegardées sur la branche SIC. L’extension de continuité WA30 ne l’était pas. Cette reprise conserve les sources SS23 et leurs réglages d’animation dans le merge. SS24 a ensuite été publié sur `main` (`66127782bd56b98b3e5925c5027de9ab3f73dbe7`) pendant ce travail et a été intégré sans perte dans `1987d7389758a931b93b42bb39cebfe8ed890c05`.

Les [références archivées](../../architecture/sic-replay-reference-provenance-20261126.md) décrivent explicitement les 100 jeux source et SS01–SS07. Le fichier temporaire Windows de la campagne interrompue n’a pas été retrouvé. Les anciens compteurs « 12 verdicts, 7 jeux, 69 niveaux » ne sont donc pas repris comme résultats de ce lot. Aucun plafond de qualification n’est augmenté.

## Première décision perdue et correction

Le [premier témoin](wa30-first-refused-route.json) situe le défaut au niveau 2 de WA30, révision 35. Une translation connue permet une route calculée de cinq `ACTION4`, mais la proposition n’en expose qu’une dès qu’un autre porteur est connu. Il s’agit d’un refus de continuation d’une route reconnue et atteignable.

Le transport orienté conserve maintenant cette route tant que chaque observation confirme le porteur propre, son orientation et sa charge. Les autres caisses ne peuvent varier que par un transport déjà attesté avec propriétaire unique. Les nouvelles empreintes au sol doivent être reconnues avant le mouvement et revérifiées juste avant son exécution. Un obstacle, une attribution ambiguë, une charge perdue, une destination occupée ou un motif inconnu ferme la série. Les acquisitions utilisent les observations réelles, une seule fois et dans leur ordre.

Les attentes de livraison, interceptions et interactions encore dépendantes du prochain retour restent unitaires. Le [témoin du niveau 4](wa30-unitary-level4.json) montre une route d’un seul pas; les douze dernières commandes de ce niveau attendent les livraisons autonomes. Le contrat ne lui impose pas une série artificielle.

Deux variantes synthétiques changent la maille, l’orientation, les positions, la palette et la commande. Après deux transports publics acquis, chacune exécute cinq tickets sous une seule décision native. Les tests refusent notamment l’obstacle déjà présent avant proposition, le propriétaire externe ambigu et le faux sol d’un récepteur dont les contours sont masqués. Aucune règle de production ne dépend du jeu, du niveau, d’une couleur ou de coordonnées absolues.

## Coût commun

Le store évite le commit sans changement d’une famille seulement pour une source profondément immuable, déjà validée et publiée par ce même store, dont la racine staged et toutes les métadonnées restent identiques. Les comparaisons superficielles de tableaux se limitent à `evidence` et `relations`, construits localement. Une preuve ou métadonnée nouvelle conserve le chemin de validation normal. Les transactions, receipts et la frontière asynchrone restent inchangés.

Le propriétaire `prepared-effects` utilise le contrat natif de checkpoint existant et restaure une seule copie mutable détachée. Les cinq valeurs par défaut, les états publics, les acquisitions et les propositions restent identiques dans les tests différentiels. Les autres familles conservent leur chemin actuel.

## Rejeux chronométrés, une session depuis L1

Les campagnes ont été exécutées séparément avec un seul worker et le surveillant externe inchangé. Les temps ci-dessous vont jusqu’au score public; la réconciliation est conservée séparément dans les JSONL.

### WA30 : sept niveaux passent, le niveau 8 reste ouvert

Le [témoin initial](wa30-baseline.jsonl) s’arrête au niveau 4 à 43 commandes sous 30 secondes. Le [diagnostic du seul trajet](wa30-route-only-diagnostic.jsonl), sans les deux optimisations de coût, atteint le niveau 5 en 113 coups et 52,992 s. **Seul son niveau 4 dispose d’une limite de diagnostic de 60 s** et prend 31,062 s; ce passage ne qualifie pas L4.

Le [candidat strict](wa30-strict.jsonl) gagne L1–L7 en 412 commandes, avec les plafonds d’origine. Ses empreintes de commandes et retours jusqu’à L5 sont identiques à celles du diagnostic corrigé.

| Niveau | Coups | Score | Réconciliation | Plafond de résolution |
|---|---:|---:|---:|---:|
| 1 | 26 | 7,492 s | 0,191 s | 18 s |
| 2 | 59 | 20,328 s | 0,213 s | 46 s |
| 3 | 76 | 30,253 s | 0,439 s | 41 s |
| 4 | 48 | 28,203 s | 0,501 s | 30 s |
| 5 | 113 | 48,729 s | 0,891 s | 61 s |
| 6 | 48 | 18,532 s | 1,073 s | 21 s |
| 7 | 42 | 17,863 s | 0,650 s | 22 s |
| 8 | 95, arrêt | Aucun score | — | 103 s |

L8 atteint le watchdog à 103,001 s, sur une référence de 138 commandes. Les huit dernières commandes et leurs familles sont conservées dans le rapport. L9 n’est pas atteint. Après ce lot borné, aucune nouvelle hypothèse de comportement n’est ajoutée sans reproduire sa première décision perdue.

### GABA et SIGN

Le [rejeu du candidat](focus-strict.jsonl) gagne les six niveaux de GABA en **47, 37, 67, 88, 106 et 102 coups**, total 447. Le score L6 arrive à **24,213 s**, sous 37 s. Le [témoin avant les nouvelles optimisations](gaba-baseline.jsonl) gagnait déjà sur cet hôte, avec L6 à 27,318 s. Ce passage n’établit donc pas qu’un échec encore reproductible de GABA a été corrigé.

Les six empreintes de préfixe, la trajectoire complète et les longueurs de série sont identiques. Les volumes finaux sont également identiques : 2 954 nœuds, 11 224 deltas et 447 acquisitions. Le temps cumulé des six niveaux, réconciliation comprise, passe de 99,492 à 98,223 s dans cette paire (−1,28 %). La réconciliation L6 passe séparément de 3,580 à 4,165 s. Cette paire locale ne constitue pas une mesure statistique de toute la campagne.

Les chaînes brutes du graphe diffèrent, car les traces de raisonnement persistées incluent `created` produit par `Date.now() / 1000`. Le rejeu fixe l’UUID, pas l’horloge. Les tests différentiels contrôlent les graphes sur entrées maîtrisées; ces JSONL ne constituent pas une comparaison exhaustive des graphes réels hors horodatages.

SIGN conserve **15, 44, 56, 22, 53 et 81 coups**, total 271. Son score L6 arrive à **31,026 s**, sous 88 s. Tous les plafonds individuels sont respectés.

### M0R0 : l’arrêt de réconciliation ne se reproduit pas sur ce passage

Le [contrôle limité à L1–L2](m0r0-strict-l1-l2.jsonl) gagne les deux niveaux en 19 puis 27 commandes. L1 marque à 2,624 s puis réconcilie en 1,628 s; L2 marque à 6,403 s puis réconcilie en 1,770 s. Les plafonds sont 11 et 18 s. Aucun correctif propre à M0R0 n’est revendiqué et ses niveaux suivants ne sont pas qualifiés ici.

Le délai après score du surveillant est `max(temps de résolution restant, min(5 s, max(250 ms, budget / 4)))`. Il ne vaut pas systématiquement cinq secondes. Si cet arrêt revient, la prochaine mesure doit isoler le dernier seal de quinze retours et ses acquisitions passives.

## Contrôle de continuité et livraison

Le contrat ajoute WA30 L1–L7 aux 71 niveaux protégés. Les tickets conservent l’identité exacte du plan, son retour acquitté et le nombre de clôtures. La pose et la charge sont remesurées dans les deux grilles publiques; une simple variation des pixels d’un autre porteur ne constitue pas un mouvement propre. Une trace devenue indisponible reste `null`.

La [capture WA30 complète](wa30-continuity.jsonl.gz) contient 412 tickets et reproduit exactement l’empreinte du strict jusqu’au score L7. Les seuils de continuité et de transport de charge du contrat proviennent de cette capture; ils sont proportionnels au nombre de commandes, comme ceux de SIGN/GABA. L4 reste exempt des exigences de série.

| Niveau | Commandes | Continuations | Séries ≥ 2 | Plus longue | Paires de mouvements propres | Paires de même charge |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 26 | 5 | 3 | 4 | 5 | 1 |
| 2 | 59 | 18 | 9 | 6 | 13 | 7 |
| 3 | 76 | 22 | 6 | 9 | 20 | 10 |
| 4 | 48 | 0 | 0 | 1 | 0 | 0 |
| 5 | 113 | 59 | 15 | 10 | 54 | 41 |
| 6 | 48 | 24 | 4 | 10 | 23 | 15 |
| 7 | 42 | 20 | 4 | 9 | 20 | 13 |
| Total | 412 | 148 | 41 | 10 | 135 | 87 |

Les 264 décisions ont exactement une clôture finale acquérant leurs commandes, sans clôture intermédiaire. Aucun retour n’est absent ou ambigu dans cette capture. Les 45 retours réfutés, dont 13 fermant une série, ne sont jamais suivis d’une commande de la même décision. Les paires physiques les excluent; une réfutation finale légitime ne doit pas être confondue avec une perte de continuité.

Le lot de tests ciblés compte **58 tests TS réussis**, auxquels s’ajoutent **10 tests de contrat et de collecte**. Le typecheck passe. Le contrôle complet `npm run test:sic-continuity` et sa revalidation avec les seuils finaux sont tous deux réussis : **78 niveaux, 13 jeux, 4 439 commandes SIC et 3 247 continuations**.

| Jeu | Niveaux contrôlés | Commandes | Continuations |
|---|---:|---:|---:|
| AR25 | 1 | 17 | 12 |
| DC22 | 1 | 22 | 7 |
| GABA | 6 | 447 | 408 |
| HANO | 1 | 6 | 3 |
| SIGN | 6 | 271 | 117 |
| SS01 | 8 | 444 | 243 |
| SS02 | 8 | 546 | 439 |
| SS03 | 8 | 491 | 424 |
| SS04 | 8 | 442 | 374 |
| SS05 | 8 | 393 | 351 |
| SS06 | 8 | 399 | 284 |
| SS07 | 8 | 549 | 437 |
| WA30 | 7 | 412 | 148 |

L’[archive des onze cohortes](continuity-78.tar.gz) contient les JSONL, le journal de capture et celui de la revalidation finale. Le [manifeste](continuity-78.summary.json) fournit les empreintes de chaque fichier et des sources contrôlées. La capture séquentielle a traversé l’intégration de SS24 : elle n’est pas présentée comme l’exécution d’un unique commit. Les sources SIC, le collecteur, le contrat et les moteurs SS01–SS07 n’ont pas changé dans cet intervalle. La revalidation finale a été effectuée sur `5c1c647a60c4c1f206ef85e34b08033c6f5300b7`.

La CI [SIC continuity, exécution 45860115434](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/45860115434) a également réussi : **141 tests**, onze cohortes indépendantes puis assemblage et vérification des 78 niveaux. Le head de la PR est `5c1c647a`; GitHub a testé son merge `30c8ab604d73d42bf1274c2161a702c17271c11d` avec `main`. Les deux commits ont exactement le même arbre `111a040f5790b1d36dfeeadef6f9457cc6fa5355`. Chaque cohorte vérifie la révision de ses sources et conserve son manifeste avec l’empreinte de ses preuves. Les plafonds des jeux restent inchangés. Le [résumé CI](ci-78.summary.json) précise les identités et résultats des treize jobs.

### Reproduction dans le viewer

Les trois rejeux de l’interface utilisent le code intégré avec SS24 dans l’aperçu local `http://127.0.0.1:4173/`, le mode SIC et une session neuve commencée au niveau 1. Chaque niveau suivant est lancé après le score précédent, sans reset ni sélection directe d’un niveau. Les lectures de l’interface sont consignées dans [ui-replays.json](ui-replays.json).

| Jeu | Niveaux gagnés | Commandes par niveau | Total | Plans terminés | État final visible |
|---|---:|---|---:|---:|---|
| GABA | 6 sur 6 | 47, 37, 67, 88, 106, 102 | 447 | 39 | `The game reports WIN.` |
| SIGN | 6 sur 6 | 15, 44, 56, 22, 53, 81 | 271 | 154 | `The game reports WIN.` |
| WA30 | 7 sur 9 | 26, 59, 76, 48, 113, 48, 42 | 412 | 264 | `Level completed.`; niveau 8 prêt |

Le premier onglet WA30 a disparu après trois niveaux; cette tentative partielle est exclue de la preuve. Le rejeu retenu a recommencé au niveau 1 et a gagné les sept niveaux dans son unique session. Aucun coup n’a été exécuté au niveau 8 dans ce rejeu visuel. Les temps de ces passages de l’interface ne servent pas de mesure de campagne; les temps stricts proviennent uniquement des campagnes isolées ci-dessus.

La portée du lot chronométré reste **21 niveaux gagnés sur quatre jeux, dont deux jeux complets**. Les 78 niveaux du contrat recouvrent une partie de ces résultats et ne s’y additionnent pas. La campagne entière des 107 jeux n’a pas été rejouée ici.

## Suite de la campagne

| Sujet | État de ce lot | Prochaine preuve requise |
|---|---|---|
| WA30 L1–L7 | Plafonds stricts, contrat complet et viewer validés | Conserver ces preuves lors de la correction de L8 |
| WA30 L8–L9 | Arrêt temporel L8; L9 non atteint | Reproduire la première route/attente coûteuse L8 depuis L1 |
| GABA et SIGN | Six niveaux chacun, parcours conservés | Conserver les gardes et la continuité dans le gate |
| M0R0 | L1–L2 passent sur cet hôte | Reprendre ensuite la campagne complète; profiler le seal si l’arrêt revient |
| COLM L2, CGWL L4 | Arrêts temporels précédemment documentés, non retestés ici | Rejouer sous les références archivées avant tout correctif |
| Reste des 107 jeux | Non rejoué dans ce lot | Produire un nouveau bilan attaché au commit, sans fusionner les anciens compteurs |

Les fichiers de preuve et la provenance sont sauvegardés dans le dépôt. Les budgets du solveur restent indépendants de ces rapports.
