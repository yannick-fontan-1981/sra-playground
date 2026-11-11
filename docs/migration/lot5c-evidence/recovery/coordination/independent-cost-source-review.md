# Contre-lecture source des outils de coût 5C

Revue ciblée du 11 novembre 2026, depuis les outils 5B conservés et les nouvelles adaptations 5C. La fin de cette revue et la correction décrite ci-dessous ont lieu pendant le calme 6A : **aucun import, test, contrôle syntaxique, calcul d’empreinte, capture ou coût n’est exécuté pour cette note**. Les résultats de capture et de mesure restent inconnus. Ce document ne remplace pas les futurs reçus de qualification et de revue des données réelles.

## Périmètre relu

Les exigences de propriétaire, programme installé, sources justificatives et couverture des faits ont été relues dans `record-owner-source-inventory.mjs`, `prepare-cost-protocol.py`, `finalize-owner-cost-contract.py`, `check-cost-static-inputs.py`, `consolidate-owner-costs.mjs` et `review-owner-costs.py`. Les passages correspondants de `capture-cost-owner-graphs.mjs` et `qualify-cost-owner-graphs.mjs` servent à vérifier les contrats amont. Cette lecture est ciblée ; elle ne constitue pas un audit exhaustif de chaque instruction des outils.

| Invariant | Constat textuel |
| --- | --- |
| Ajout du propriétaire | L’ajout attendu est uniquement `public_observed_binding`. L’ordre des propriétaires antérieurs doit être conservé. |
| Programme réellement installé | L’inventaire appelle les vrais `attachPrograms` des familles des deux factories dans un magasin séparé, sans initialiser de session ni autoriser l’exécution d’un workflow. L’ajout attendu est `v6.observed_binding.choose`, avec une installation propre du propriétaire. Les installations antérieures sont comparées intégralement. La présence préexistante du programme compilé ne se confond pas avec son installation dans le magasin de session. |
| Nœuds fixes | Les trois nœuds attendus sont l’état de famille, son activation et `program:v6.observed_binding.choose`. Les autres différences restent soumises à l’attribution détaillée issue des captures ; aucun nombre global de nœuds supplémentaires n’est présumé. |
| Onze sources justificatives | La liste canonique couvre le runtime, les huit modules Binding, le magasin de connaissances et le Kernel. Elle est liée à la déclaration du domaine, aux manifestes du candidat, au contrat et aux lecteurs aval. |
| Domaine des acquisitions | Le domaine déclaré refuse sélection/admission Binding, connaissance de corps ou méthodes, mutation d’attention et acquisition incomplète. Un retour hors frontière est nul ; une frontière réelle peut produire l’événement exact `scope_changed_preserving_conditional_methods`. Cette distinction découle du tracker original et précède les captures. |
| Couverture des faits | `sourceCallIndices` couvre toutes les acquisitions réellement scellées. `sourceEventCallIndices` désigne leur sous-ensemble ordonné non nul, lié aux événements de frontière et aux faits attribués au même point. Un retour nul ne crée pas de fait passif fictif. |
| Politique de coût | Le budget global et les diagnostics par phase demeurent séparés. Les outils nouveaux ne transforment pas le refus du comparateur historique strict en succès et doivent conserver ce refus effectif. Aucun verdict global n’est déduit de la seule préparation. |

## Défaut identifié et corrigé avant capture

La première version des quatre validateurs de couverture assimilait `acquiredReturns` à `request.sequence`. Cela contredisait le scellement des préfixes : une commande publique peut être retournée alors que son acquisition reste reportée à la fin du préfixe. Le qualifier amont lie correctement `calls.length` à `snapshot.caller.acquiredTransitions`.

La lecture des seules métadonnées de la fixture publiée 5B confirme le cas concret : dans STCK mesuré, les requêtes `advance` de séquences **5, 6 et 7** ont encore **4 acquisitions**. Aucun paquet de jeu n’a été analysé pour ce constat et aucune nouvelle capture n’a été lancée.

Integration a corrigé les fonctions de `finalize-owner-cost-contract.py`, `check-cost-static-inputs.py`, `consolidate-owner-costs.mjs` et `review-owner-costs.py`. La contre-lecture des quatre textes confirme désormais :

- L’identité du point reste liée à la séquence de la requête.
- Le nombre d’acquisitions correspond à `observations[i].acquiredTransitions` ; les inspections utilisent le compteur final.
- Les longueurs requêtes/observations sont égales ; les acquisitions sont entières, non négatives, monotones et ne dépassent pas la séquence publique.
- Les indices complets des acquisitions et le sous-ensemble exact des faits non nuls sont conservés.
- Les formes fixes se terminent avec toutes leurs actions réellement acquises.

Aucun autre défaut concret n’a été établi sur ce correctif lors de cette contre-lecture. La [note de correction d’Integration](cost-tools-review-02/source-correction.md) conserve la portée et la chronologie de l’édition. Une validation syntaxique future doit porter sur ces nouveaux octets ; les reçus antérieurs ne valent pas pour cette édition.
