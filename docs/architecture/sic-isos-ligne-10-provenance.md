# ISOS, ligne 10 — provenance du passage

## Premier écart attendu avant correction

Parent `5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f`, dont l'arbre
moteur est celui de `d0e7527c`. L'opérateur a reproduit l'acceptation
d'une référence antérieure au vrai passage dans
[`949c08db`](https://github.com/yannick-fontan-1981/sra-playground/blob/949c08dbfc9a5dd34e5b1f495515ba19562cf8be/experiments/symbolic-situations/isos-ligne-10/BILAN.md).
La ligne 10 est partielle tant que ce cas reste ouvert.

| Paire | Écart attendu entre le parent et le correctif |
|---|---|
| N1/T3 officiel, puis N2/T4 avec référence remplacée par l'observation immédiatement antérieure à T3 | T1–T3, le score et le raster de N2 restent identiques. Le parent admet la reprise `facet_examples` ACTION6 (27,14). Le correctif écarte cette reprise. Le premier changement doit être le ticket de T4. Vérifier le ticket natif de repli et son retour réel. |
| N2/T7 officiel, puis N3/T8 avec l'ancienne référence authentique du gain de N1 | T1–T7 et les deux gains restent identiques. Une preuve de passage vraie à une époque antérieure ne suffit plus à la reprise courante. Vérifier le ticket et le retour du repli de T8. |
| Références authentiques en N2 et N3 | Les 12 tickets de facette, les points, les rendus visibles, les trois gains et le ticket T13 restent ceux du parent. Le reste du préfixe historique de 16 gestes est comparé à part. |

Le gain doit être acquis par le vrai retour de la commande sélectionnée.
Une méthode locale fournit un départ mesuré et un déplacement. Une
composition déjà liée peut porter la même méthode à un autre niveau.
Le rattachement du passage reste une preuve distincte et vérifiable.
Le correctif porte sur le consommateur natif de la méthode de la
ligne 10. Le calcul des rendus et les formes des reçus publics
restent conformes au parent dans les scénarios nominaux.

## Correction et prise en charge

`NativeFacetExamples.record` attache le retour du passage à la méthode
portable si le ticket qui a marqué utilisait cette méthode. Pour un
essai de sommet, il retrouve la même méthode locale, son déplacement,
son époque et ses références dans la méthode portable. Pour une
extension de composition déjà reprise, il retrouve la méthode source
dans le plan sélectionné. Un gain officiel reste acquis même si aucune
méthode ne peut lui être rattachée.

À la reprise, `NativeFacetExamples.measure` compare la référence
conservée à l'observation de retour du dernier événement
`official_boundary` acquis par cette famille. Il ne soumet la méthode
au calcul `facetCompoundPlan` que si les références coïncident.
Le plan cite ensuite les références de la méthode effectivement
recalée. Les événements acquis et le format d'état existants
suffisent à ce contrôle. Les calculs géométriques de
`facetCompoundPlan` et les propriétaires des tickets de repli
conservent leurs rôles.
[Consommation](../../src/logos-engine/v6-facet-examples.ts?plain=1#L128)
· [Acquisition](../../src/logos-engine/v6-facet-examples.ts?plain=1#L219)

Sur le parent, les deux tests de substitution échouent à la première
décision suivant le gain. T4 conserve `facet_examples` ACTION6 (27,14)
avec une référence d'avant le passage. T8 conserve `facet_examples`
ACTION6 (33,23) avec la référence authentique d'un autre passage.
Sur le candidat, le score et le raster officiels restent acquis.
Le service reprend par `observed_frontier` ACTION6 (10,14) dans les
deux cas. Les tests soumettent ce repli au vrai jeu et contrôlent son
retour dans le niveau courant. Un troisième test construit conserve
le gain mais retire la méthode du ticket qui l'a produit. Le journal
acquiert le gain et la méthode portable ne reçoit aucune nouvelle
référence de passage.

## Reproduire

Employer Node 24 avec les actifs Pyodide préparés sous `public/`.
Le test charge le candidat depuis sa branche. Renseigner
`SIC_ISOS_ENGINE_ROOT` avec le checkout du gel pour constater les
deux écarts préenregistrés sur la référence.

```powershell
node --test tests/sic-isos-line-10.test.ts
node --test --test-name-pattern 'substituted boundary provenance' tests/sic-isos-line-10.test.ts
node --test tests/v6-facet-examples.test.ts tests/v6-facet-examples-integration.test.ts tests/v6-facet-examples-foreign-acquisition.test.ts tests/sic-facet-layered-search.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

`SIC_ISOS_GAME_ROOT` désigne au besoin un checkout préparé distinct.
La suite locale contrôle la reprise et la parité nominale en N2 et N3.
Les verdicts indépendants sur le correctif restent ouverts.

Les deux rejeux nominaux, sur le gel et sur le candidat, produisent
les mêmes **16 libérations, 16 retours et 17 observations publiques**,
palette comprise. Les projections des plans et les gardes comparées
sont également identiques. Le correctif conserve les reprises
authentiques à T4 et T8 et le passage de N3 à T12.

Résultat local du candidat à 23:57:27 (UTC−3) avec **6/6 tests de
caractérisation**, **112/112 contrats** et le contrôle TypeScript.
La comparaison de catalogue et les scénarios de provenance ont des
résultats distincts.
