# GIGO, ligne 53 — commande d'un motif imbriqué

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.
Ligne 53 du catalogue, GIGO N1/T1, ACTION6,
`public_occurrence_recall / field_service_composition / nested_control_experiment`.
Repartir de N1 avec les mêmes paramètres que l'inventaire historique.

- Mesurer les motifs qui peuvent offrir un clic et isoler le critère de
  sélection et le point. Au même état d'avancement, rendre le minimum
  ambigu ou invalider la liaison du point. Vérifier la première
  abstention ou le remplacement effectif de l'offre.
- Relever le retour physique et sa portée. Séparer les cas d'absence
  d'effet visible, de modification locale ou distante et de gain
  officiel. Vérifier le ticket ou la question suivante.
- Comparer aux retours des lignes VALV 44, 47 et 48, sur le code du
  gel. Vérifier à quel niveau les producteurs, l'arbitrage et la mesure
  sont réellement communs. Garder un verdict propre à la ligne 53 et
  décrire la portée d'un second contexte.

## GIGO N1/T1 sur le gel

`SharedSeriesConstraint.servicePropose` appelle
`commonFieldServiceProposal`, puis `FieldServiceMemory.proposeService`.
Au départ, aucune mémoire de transfert, de service ou de remplissage
ne donne d'offre. `nestedQuestion` cherche les cadres carrés de taille
admissible dont le cœur compact occupe un seul bloc à l'échelle
mesurée et dont le centre a la valeur attendue. En cas de minimum unique, le plus petit cadre
mesuré donne le point. Une égalité au minimum fait s'abstenir ce
producteur.

Le seul cadre retenu en GIGO est (24,18)–(29,23), un cœur 4×4 de
couleur 5 et d'aire 16. La famille `public_occurrence_recall` lie la
question `nested_control_experiment` à ACTION6 en (26,20).
`fieldServiceBefore` exige l'époque, le score, l'observation, le
raster et le point exacts. Le moteur autorise un seul geste à effet
inconnu.

Le vrai retour change 420 pixels, dont 20 dans le cadre et 400 au
dehors. Le compte inclut 316 pixels 0→9 et 104 pixels 15→0. Il ne
marque aucun niveau. `fieldServiceAfter` clôt le préfixe avec
`matched:null`. `recordNested` conserve la mesure et ses deux
références. Aucun contexte de remplissage n'est acquis. Le premier
arrêt du service est `nested_control_effect_requires_composition`.
La variation du raster établit une réponse au clic dans cette
situation. La signification et l'utilité des effets restent ouvertes.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L93)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L79)
· [Appel commun](../../src/logos-engine/v6-shared-series.ts?plain=1#L347)
· [Sélection](../../src/logos-engine/v6-field-service-access.ts?plain=1#L105)
· [Garde et clôture](../../src/logos-engine/v6-field-service-access.ts?plain=1#L46)
· [Mesure](../../src/logos-engine/v6-field-service-access.ts?plain=1#L277)

## Deux contre-épreuves construites

- **Deux minima.** Copier le cadre 6×6 dans une zone uniforme sans
  changer le cadre historique ajoute un candidat de même aire. Le
  producteur s'abstient dans le service. La garde isolée refuse aussi
  le ticket ACTION6 (26,20) préparé pour l'ancien raster.
- **Même clic, image inchangée.** Présenter au service le retour
  construit sans pixel changé déclenche `local_no_visible_effect`.
  Le reçu porte le cadre, la commande et la référence de retour. Il
  n'acquiert ni sélection ni impossibilité. Le même ticket imbriqué
  est écarté dans ce contexte et `observed_frontier` autorise
  une expérience ACTION1.
  Ce retour construit est distinct du vrai effet de GIGO.

## VALV comme seconde situation publique

| Ticket VALV | Articulation effectivement consommée | Différence de preuve |
|---|---|---|
| T1, ligne 53 | `nestedQuestion` retient un cadre 5×5 en (30,48)–(34,52), cœur d'aire 9, devant un cadre alternatif au cœur d'aire 49. ACTION6 (32,50). | Le retour réel change 72 pixels, tous hors du motif. Deux champs au moins sont mesurés. `recordFill` inscrit un contexte de remplissage et ouvre T2. |
| T2, ligne 44 | Le même point passe par la même enveloppe, la même garde exacte et `recordNested`. Le ticket effectif est `envelope_fill_experiment/repeat`. | Le besoin utilise les mesures de T1. Il prépare un contraste sur les champs. |
| T5, ligne 47 | `field_service_experiment/isolate` en (50,33) réutilise la garde et la mesure de pixels. | Le besoin vient de la restauration et de l'orientation du contrôle lié à un champ. |
| T11, ligne 48 | `field_service_transfer_experiment/revalidate_source_access` en (11,35) réutilise la garde et la mesure. Le retour inscrit le modèle de transfert, puis la prochaine question porte sur la source. | La frontière officielle et le rattachement du récepteur bornent ce besoin. Le producteur aval ne réacquiert pas un remplissage à cette étape. |

Les contre-épreuves de VALV sur `699ac89e` retirent les trois offres
aval une par une. Le repli effectivement sélectionné appelle la
sonde imbriquée, aux points (32,50), (32,50) et (32,51) respectivement.
Le préfixe de VALV rejoué ici vérifie les trois voies nominales sur le
gel et leur mesure commune. Les trois replis restent attribués à
l'intervention sur la branche VALV. La provenance de la frontière,
traitée séparément pour 48, n'est pas une condition de la première
sonde GIGO.
[Contre-épreuves VALV](https://github.com/yannick-fontan-1981/sra-playground/blob/699ac89e/docs/architecture/sic-valv-lignes-44-47-48.md)
· [Raccord et effet communs](../../src/logos-engine/v6-field-service-access.ts?plain=1#L378)

## Reproduction et portée

Le jeu du gel et `8ce7ee35` concordent sur le départ GIGO, sa seule
commande, son retour et le point d'arrêt. L'observation comparable
exclut la métadonnée `palette` différente entre révisions.
Le rejeu officiel recapture une occurrence sur GIGO et une sur VALV,
soit deux des six occurrences cataloguées de la ligne 53. Cette
caractérisation est attribuable au moteur du gel.

Avec Node 24 et les actifs et Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-gigo-line-53.test.ts
node --test tests/v6-field-service-kernel.test.ts tests/v6-field-service-reference.test.ts
```

`SIC_GIGO_GAME_ROOT` désigne au besoin l'autre checkout des actifs.
`SIC_GIGO_ENGINE_ROOT` permet de charger les modules depuis un
checkout distinct du gel. La branche ajoute des preuves et des
assertions. La qualification indépendante reste ouverte.

La caractérisation passe **4/4** et les deux suites de contrats
**242/242**. Sur Windows, les deux scripts de provenance ont été
vérifiés avec les octets exacts du gel, puis restaurés avec les fins
de ligne du checkout. Branche ouverte à 23:24:36, critères à
23:24:56, premier rejeu à 23:24:57 et première série native verte
à 23:28:09 (UTC−3).
