# GRIL · interroger un catalogue masqué et changer de vue

## Critères avant changement

L’inventaire attribue le clic N1/T2 à la ligne **54** et le changement de vue N1/T4 à la ligne **40**. Les deux gestes passent par `public_occurrence_recall`. Le témoin de 54 est `occluded_catalogue_composition / occluded_catalogue_experiment`, `ACTION6(11,53)`. Celui de 40 est `catalogue_view_experiment`, `ACTION3`. Départ N1, six niveaux, 600 actions par niveau, au plus 16 gestes, sans curiosité ciblée. [Catalogue 40](sic-v8-strategies-observees.md?plain=1#L66) · [Catalogue 54](sic-v8-strategies-observees.md?plain=1#L80)

| Ligne | Critère de preuve |
|---|---|
| 54 | Suivre l’hypothèse d’occurrence, le contrôle du clic, le reçu daté et le premier choix qui en dépend. Retirer le reçu à paquet réel identique et vérifier quel choix ou refus en résulte. |
| 40 | Identifier l’événement qui autorise la réutilisation d’`ACTION3`, avec le champ et l’époque liés à l’observation courante. Retirer uniquement ce témoin d’accès et vérifier le prochain ticket, puis comparer l’effet physique. |
| Articulation des deux | Distinguer le reçu d’accès lu par 40 de toute influence de 54 sur le choix intermédiaire T3 et sur l’état perçu à T4. Une même référence d’observation peut servir à plusieurs mesures. |

Les vérifications portent sur le propriétaire du ticket, le mode, la preuve consommée et le retour réel. Une réponse au clic peut être datée et changer la suite tout en laissant sa correction ouverte jusqu’à la progression officielle. [Producteur et gardes](../../src/logos-engine/v6-occluded-catalogue-access.ts)

## Verdict sur le gel

Les 16 décisions de `8ce7ee35` et du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` concordent. Le préfixe prolongé à 19 gestes retrouve les 20 trames et séquences de l’archive publique v49. Les tests rejouent les 16 commandes du catalogue. Ils comprennent les 9 occurrences de la ligne 54 et les 2 de la ligne 40. Les deux mécanismes étudiés existent déjà sur le gel. [Archive v49](../migration/native-campaigns-v49/gril-public-trace.json.gz) · [Tests via le service](../../tests/sic-gril-lines-40-54.test.ts)

| Tour | Autorité, preuve et retour |
|---|---|
| T1, repérage par la frontière | `observed_frontier` libère `ACTION3`. Le champ change et la structure du catalogue est conservée. `OccludedCatalogueMemory.record` observe un substrat de valeur 5, un candidat compatible pour la palette 8 et un `catalogue_field_input_observed` daté qui habilite un essai futur d’`ACTION3`. |
| T2, ligne 54 | `SharedSeriesConstraint.cataloguePropose` présente l’unique candidat 0 compatible avec le substrat 5. `certifyOccludedCatalogue` certifie la compatibilité dans cette vue. Le garde vérifie époque, score, observation, trame et point mesuré avant `ACTION6(11,53)`. Le clic change 63 pixels. L’événement `catalogue_response` enregistre la soumission pour la palette 8 et les références avant et après. Le résultat est `matched:null`, sans progression officielle. |
| T3, nouvelle question de la ligne 54 | Le propriétaire a déjà soumis une réponse pour la palette 8. `ACTION6(36,4)` essaie le sélecteur de palette 9. Le retour confirme la sélection, change 275 pixels et laisse trois candidats [0,1,2]. |
| T4, ligne 40 | `SharedSeriesConstraint.catalogueViewPropose` consomme le `catalogue_field_input_observed` de T1. Le témoin doit appartenir au même champ, montrer un changement en préservant la structure et porter une commande disponible qui reste inédite dans cette vue. `ACTION3` est lié à la trame courante. Le retour change 39 pixels et demande une nouvelle comparaison, avec `matched:null`. Le recalcul réduit les candidats à [2]. |
| T5 et seconde situation | T5 soumet le candidat 2 en (51,53) et le jeu ouvre N2. N3 reproduit les deux mécanismes sur de nouvelles observations. T11 fournit le témoin d’accès, T12 soumet le candidat 3, T13 sélectionne la palette 9, T15 discrimine [0,1,2,3] en [0] puis T16 soumet le candidat 0 sans progression officielle dans le préfixe de 16 gestes. |

## Contre-épreuves et attribution par ligne

**54 · retrait du reçu de soumission.** Le service reçoit le véritable retour T2 avec ses 63 pixels modifiés. Retirer seulement l’inscription de `catalogue_response` laisse le candidat 0 et le substrat dans la mémoire. T3 répète le clic (11,53) au lieu de choisir le sélecteur. Ce second clic physique laisse l’image inchangée. La preuve discriminante est l’inscription de la palette comme traitée, dont le sens reste distinct de la correction officielle de la réponse.

**40 · retrait du témoin d’accès.** Garder les deux gestes de catalogue et retirer seulement `catalogue_field_input_observed` de T1 donne la même histoire physique jusqu’à T3. À T4, `observed_frontier` libère `ACTION4` sans offre de vue du catalogue. Le retour physique change 50 pixels et fournit une nouvelle mesure d’accès. L’empreinte et les références sont celles de cette autre action.

**Lien entre 54 et 40.** Le reçu T2 change T3, qui provoque la vue ambiguë où 40 peut être élue. Une fois conservé ce retour T3, le producteur 40 construit exactement la même offre à partir d’une mémoire reconstituée sans les deux événements du clic T2. Les références d’accès sont celles de T1. Le lien est indirect par l’arrivée sur une autre palette. Les deux contrats de décision restent distincts, bien qu’ils passent par le même propriétaire, la même libération et le même journal.

Les interventions de test évaluent le producteur avec un journal reconstitué sans les événements spécifiés. Le journal acquis du service reste cohérent avant de recevoir l’action alternative. Les paquets qui suivent l’action alternative viennent du jeu public. Les deux parcours consomment déjà, sur le gel, leur preuve propre et les sous-questions natives de catalogue. La remise documente et teste ces articulations existantes. [Réception et producteurs](../../src/logos-engine/v6-occluded-catalogue-access.ts) · [Entrées de la famille](../../src/logos-engine/v6-shared-series.ts) · [Deux retours alternatifs](../../tests/fixtures/sic-gril-alternate-returns.json.gz)

## Reproduction

Depuis la racine du lot sous Node 24. Définir `SIC_GRIL_GAME_ROOT` sur un checkout contenant les archives Python et Pyodide pour reproduire les retours physiques. `SIC_GRIL_ENGINE_ROOT` permet de viser explicitement le checkout du gel.

~~~powershell
node --test tests/sic-gril-lines-40-54.test.ts
$env:SIC_GRIL_GAME_ROOT = (Get-Location).Path
node --test tests/sic-gril-lines-40-54.test.ts
node --test tests/v6-occluded-catalogue-kernel.test.ts tests/v6-occluded-catalogue-reference.test.ts tests/sic-catalogue-view-transfer.test.ts tests/sic-joint-catalogue-views.test.ts
~~~

Le rejeu des contrats attend les octets Git des scripts Python référencés (fins de ligne LF). Les critères sont figés à `cb05fadc`.

Les quatre tests de caractérisation et les 73 contrats existants passent. Préparation à 22 h 11 min 08 s, premier rejeu du gel à 22 h 12 min 03 s, verdict local à 22 h 17 min 34 s, soit 6 min 26 s (27 novembre 2026, UTC−3). La reprise du harnais a déplacé les retraits de preuve vers la reconstruction utilisée pour proposer. L’acquisition du service conserve ainsi ses contrôles d’intégrité.
