# ISOS, ligne 10 — transformation par facettes

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.
Ligne 10 du catalogue, ISOS N1/T1 ACTION6, `facet_examples /
facet_example / public_facet_example`. Repartir de N1 dans le mode
de l'inventaire SIC avec un budget de 16 gestes.

- Relever la structure d'exemples mise en correspondance, la facette
  choisie et ce que le ticket permet réellement de tester à froid.
  Vérifier le vrai retour, son rattachement et la décision suivante.
- Chercher où le rapport visible entre exemple et réponse devient une
  méthode réutilisée. Séparer la correspondance géométrique, la
  transformation mesurée, les couches non observées et le gain officiel.
- Dans une autre situation et dans une contre-épreuve à commande
  comparable, retirer une correspondance ou son reçu. Contrôler le
  premier refus, changement d'offre ou retrait de méthode.
- Attribuer la part présente sur le gel et borner la recapture à la
  ligne 10. Une extraction éventuelle doit correspondre à un maillon
  causal précis.

## Du premier clic à la mesure d'une transformation

`facetProject` mesure des cadres rectangulaires. Le grand intérieur
borné est (0,0)–(63,43). Le cadre de l'exemple est (2,45)–(18,59).
Les couleurs 8, 9 et 14 relient trois facettes de cet exemple à
trois facettes d'une référence extérieure unique. Les rapports de
largeurs donnent l'échelle 0,6 et les hauteurs mesurées distinguent
un sommet conservé de deux côtés à étendre. La référence est une
hypothèse de construction. À froid, la famille choisit une face
vide congruente dont l'enveloppe estimée tient dans l'intérieur.

| Geste | Question effectivement proposée | Retour et conséquence |
|---|---|---|
| T1 | ACTION6 (33,23), face vide en (29,21)–(38,25), `probe_congruent_empty_face`. Aucune méthode d'extension acquise et aucun état futur déclaré. | `filled_example_correspondence`. Les pixels hors de l'intérieur strict sont conservés. Cette mesure fournit un exemple visible de départ. |
| T2 | ACTION6 (33,23) à nouveau, cette fois sur un sommet visible, `probe_visible_cap`. | Le sommet monte de (0,−6) et les deux côtés s'étendent vers le haut à empreinte latérale et bord inférieur inchangés. `observed_visible_cap_and_side_change` acquiert une méthode locale, datée du couple avant/après. |
| T3 | Le même type de sommet est retrouvé en (33,17). La proposition porte la méthode de même portée, forme et couleur, avec le reçu exact de T2. | Le jeu marque N1. `official_boundary` ajoute sa référence à la méthode portable. |
| T4–T7 en N2 | La méthode de départ est recalée dans une nouvelle composition. T4 clique (27,14) et mesure le premier rendu. Les autres ports restent des hypothèses tant que leur réponse courante manque. | Le rendu coloré complet de T4 et son extérieur préservé corroborent le départ. T7 utilise le décalage local (6,3) et marque N2. |
| T8–T12 en N3 | Une autre composition est recalée, avec son départ en (33,23) et des ports remesurés. Au T11 le déplacement local (0,−6) et au T12 (−6,3) sont liés à leurs propres reçus. | T8 confirme le départ sur le rendu entier. T12 marque N3 et le service reprend par `observed_frontier` en N4. |

Chaque ticket `public_facet_example` est scellé pour une seule
édition. La garde vérifie l'observation, l'époque, le score, la
commande et le pixel qui porte le clic. Le reçu de comparaison du
ticket reste `matched:null`. `record` acquiert séparément la
correspondance visible, la translation, la préservation et le gain
officiel. Aucun de ces résultats ne mesure un nombre de couches cachées.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L50)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L36)
· [Projection](../../src/logos-engine/v6-facet-examples-geometry.ts?plain=1#L82)
· [Sélection et méthode](../../src/logos-engine/v6-facet-examples.ts?plain=1#L132)
· [Acquisition](../../src/logos-engine/v6-facet-examples.ts?plain=1#L209)
· [Admission d'une composition](../../src/logos-engine/v6-facet-examples-compound.ts?plain=1#L119)

## Contre-épreuves

- Le véritable T3 marque toujours N1. Retirer uniquement sa référence
  dans la méthode portable, avant la décision de N2, conserve le
  raster officiel, le niveau et le déplacement acquis. La composition
  de T4 disparaît du service. Ce refus teste le lien de provenance,
  indépendamment du passage physique.
- Au même ACTION6 (33,23) de T1, un retour construit sans changement
  inscrit `no_visible_effect` dans la mémoire du contexte. Le même
  essai n'est plus offert. Le retour physique de T1 reste celui du
  scénario nominal qui crée les facettes.

Sur le gel, la mémoire de facettes transmet déjà un exemple, un
déplacement mesuré et son rattachement au passage. Le producteur
compound refait les correspondances et vérifie le rendu courant.
La branche ajoute la caractérisation autour de cette articulation.

## Reproduction et portée

Le gel et `8ce7ee35` concordent pour les 16 premières commandes,
leurs propriétaires, sous-questions, types et retours. La
métadonnée `palette` diffère entre les deux révisions. Les **12/12
occurrences** du catalogue, les trois points officiels et la reprise
à T13 sont dans le rejeu. La qualification indépendante reste ouverte.

Avec Node 24 et les actifs et Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-isos-line-10.test.ts
node --test tests/v6-facet-examples.test.ts tests/v6-facet-examples-integration.test.ts tests/v6-facet-examples-foreign-acquisition.test.ts tests/sic-facet-layered-search.test.ts
```

`SIC_ISOS_GAME_ROOT` désigne au besoin le checkout des actifs.
`SIC_ISOS_ENGINE_ROOT` permet de tester le moteur du gel depuis
son propre checkout.

La caractérisation passe **3/3**, les quatre suites de contrats
**112/112**. Branche ouverte à 23:37:06, critères figés à
23:37:33, premier rejeu du gel à 23:37:53 et verdict local à
23:40:20 (UTC−3).
