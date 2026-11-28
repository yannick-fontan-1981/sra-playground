# SKBN, ligne 38 — composer avec l'inventaire

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Ligne 38,
SKBN N1/T14, ACTION1, `public_observed_inventory /
observed_inventory_composition / public_inventory_composition`.
Repartir de N1 avec les paramètres de l'inventaire SIC.

- Relever les ressources disponibles et leur provenance, puis vérifier
  lesquelles sont effectivement lues pour le ticket historique. Garder
  séparés une présence visible, un emploi et une consommation acquise.
- Suivre l'action, le retour contredit du catalogue et la décision
  suivante. Chercher un deuxième emploi ou un refus fondé sur une autre
  disponibilité, en donnant la portée du retour physique.
- Retirer un fait d'inventaire à raster identique. Vérifier le premier
  ticket différent ou refus effectif, et isoler un contrôle neutre si
  une autre preuve suffisait. Garder l'intervention distincte du jeu.
- Attribuer au gel et borner les recaptures. Toute extraction répond
  à un défaut causal effectivement constaté.

## Le geste historique et sa répétition

Le [catalogue](sic-v8-strategies-observees.md#L64) donne 31 occurrences,
tous jeux confondus. En SKBN depuis N1, à 16 actions, les deux moteurs
`8ce7ee35` et `d0e7527c` ont libéré les mêmes 16 commandes, avec les
mêmes familles et types et les mêmes 16 verdicts de retour. Deux
occurrences concernent cette ligne, T14 et T16. Le rejeu prolongé à 19
permet aussi de suivre la décision après T16 et retrouve les 16 premiers
tickets.

`ObservedInventory.proposeInSubquestion` reçoit la question
`observed_inventory_composition`. `CellProjection.measure_with_input`
combine les déplacements déjà mesurés, la trame périodique et les
sous-couches visitées. `endpoint_measurements` extrait une case encore
non visitée, contenant une forme visible. `ObservedInventory.project`
la soumet comme terminaison de rôle inconnu et `measured_paths`
compose une approche d'un pas. Les deux plans lient l'occupation visible
de la case [1,5] à la référence courante. Le candidat affiché et les
compléments de forme sont absents, et aucune surface matérielle n'a
encore été retenue dans ces offres.

| Tour | Offre admise et preuve active | Retour officiel | Décision suivante |
| --- | --- | --- | --- |
| T14 | `endpoint_approach_candidate`, ACTION1, translation verticale mesurée, départ [46,19,49,22] | Le corps identifié arrive en [46,11,49,14]. 62 pixels changent, dont 16 hors du corps de départ et de la case d'arrivée. Le retour du préfixe est contredit et scellé. | T15 `observed_frontier`, ACTION3. |
| T16 | Même case [44,9,51,16], ACTION4, translation horizontale mesurée, départ [38,11,41,14] | Même arrivée, même nombre de pixels changés, dont 16 hors des régions attendues. Le retour est contredit et scellé. | T17 `pre_score_contact`, ACTION3 sur la prolongation à 19. |

Le garde `ObservedInventory.before` lie la position, l'époque, la
commande disponible et, au premier pas, le raster et la référence.
`ObservedInventory.after` retrouve le corps attendu dans les deux
cas, puis réfute la conservation des autres cases. `recordSource`
exige un retour confirmé avant d'acquérir une preuve d'accès. Les
approches renseignent donc la géométrie d'une recherche d'inventaire.
L'effet qu'aurait l'emploi du matériau et sa disponibilité après le
contact restent ouverts.

## Contre-épreuve et portée

Le test ajoute au registre des sous-couches visitées la forme de la
case [1,5] uniquement pendant la projection de T14. L'image, la
référence, le corps et la mesure d'ACTION1 viennent du vrai préfixe
inchangé. Cette visite injectée exclut l'offre d'approche. Le repli `observed_frontier` libère ACTION2, ensuite
jouée sur le vrai jeu.

Le noyau possède un témoin construit de réemploi d'une clé conservée
sur deux portes pendant qu'une seconde prend la place libre. Ce
témoin regarde la disponibilité d'un matériau dans une autre
configuration. Dans les deux tickets SKBN, le service mesure seulement
une approche et la contredit. La ligne reste partielle pour le
catalogue. Le témoin manquant est un choix SKBN qui consomme un
matériau ou un accès acquis, puis réutilise son retour pour choisir
l'étape suivante. Le retrait d'une terminaison visitée caractérise
le filtre déjà présent dans `_provisional_object_terminating_routes`.

## Reproduction

Depuis la branche de qualification, sous Node 24 avec les archives du
jeu et Pyodide installés. `SIC_SKBN_GAME_ROOT` permet de fournir un
checkout d'actifs distinct. La variable facultative
`SIC_SKBN_ENGINE_ROOT` désigne le moteur à charger pour comparer les
révisions sur les mêmes assertions.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-skbn-line-38.test.ts tests/v6-inventory-kernel.test.ts tests/sic-inventory-route-plan.test.ts tests/sic-inventory-route-observation.test.ts
```

[Tests SKBN](../../tests/sic-skbn-line-38.test.ts) ·
[Offres et retour](../../src/logos-engine/v6-observed-inventory.ts) ·
[Mesures de terminaison](../../src/logos-engine/v6-inventory-endpoints.ts) ·
[Routes provisoires](../../src/logos-engine/v6-inventory-measurements.ts) ·
[Témoin de clés conservées](../../tests/v6-inventory-kernel.test.ts)
