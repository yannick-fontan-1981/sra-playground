# RE86 · acquérir les supports puis couvrir les repères

## Critères avant intervention

Le témoin de la ligne 7 est `constellation_cover / controlled_constellation_cover`, RE86 N1/T1, `ACTION1`. La capture d’inventaire part de N1 avec six niveaux cibles, 600 gestes par niveau, 16 gestes au total et sans curiosité ciblée. Un rejeu prolongé suit la première couverture jusqu’au niveau suivant. [Catalogue](sic-v8-strategies-observees.md?plain=1#L33) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L47)

| Étape | Faits à établir |
|---|---|
| Sondes initiales | Relier les vecteurs à leurs vrais retours, distinguer la pose du curseur du masque d’un support et montrer ce qui permet de séparer deux propriétaires. |
| Variation | À même première observation, retirer la première commande du domaine présenté au fournisseur et relever la commande restante, son effet physique et l’offre suivante. À même premier ticket, présenter aussi un retour stationnaire et vérifier l’absence de vecteur acquis. |
| Couverture | Identifier le reçu qui complète l’attribution des supports. Suivre les projections admises, le passage par une autre sélection et le retour officiel. |
| Seconde disposition | Vérifier le même calcul après déplacement ou sélection d’un autre support, dans une vue où l’identité du corps et ses repères sont encore justifiés. |

La seule apparition d’une commande dans un plan ne qualifie pas une couverture. Les retours doivent permettre de distinguer l’acquisition, la sélection conditionnelle, le déplacement et la progression officielle. [Famille et preuves](../../src/logos-engine/v6-constellation-cover.ts)

## Parcours sur le gel

Les 16 décisions et trames de `8ce7ee35` concordent avec celles de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. La métadonnée de palette est exclue de la comparaison entre révisions. Les 16/16 gestes de la ligne 7 sont retrouvés. Un rejeu indépendant à 30 gestes retrouve les observations de l’archive v54 et atteint N2 au retour de T26. [Archive v54](../migration/native-campaigns-v54/baseline-re86/re86-public-trace.json.gz) · [Tests du service](../../tests/sic-re86-line-7.test.ts)

| Tour | Offre et preuve acquise |
|---|---|
| **T1–T4 · acquisition et calibration** | `measureConstellationLayout` mesure des repères répétés et localise le focus. À T1, aucun support, sélecteur ni vecteur n’est acquis. `ACTION1` est une acquisition, avec prédiction nulle. Les retours T1–T4 mesurent respectivement (0,−3), (0,+3), (−3,0), (+3,0). `acquireConstellation` compare les pixels matériels dans le repère du focus en déplacement. Au T4, le reçu identifie le propriétaire 0, palette 9, avec 53 pixels de support. |
| **T5–T8 · second propriétaire** | T5 libère `ACTION5` en mode sélection. Le retour change l’occultation locale et conduit à une autre pose du focus. Le moteur retient `ACTION5` comme sélecteur. Les acquisitions T6 et T7 exploitent les déplacements déjà mesurés. T8 sélectionne de nouveau et le reçu identifie le propriétaire 1, palette 11, 45 pixels. Les poses deviennent [(36,45),(18,24)] et la comparaison matérielle marque l’attribution complète pour cette configuration. |
| **T9–T19 · premier support déplacé** | `ConstellationCover.propose` exige l’accord de l’image avec les deux corps, leur pose et le focus. Le pas de 3 vient des vecteurs mesurés. `constellationMechanicalPoseOptions` contrôle les domaines de pose et `constellationJointGoal` choisit une combinaison de couvertures par couleur, à coût de déplacement minimal dans ce domaine. Le garde lie le corps actif et l’observation. Chaque retour admis doit confirmer la projection visible des deux supports. Le corps 0 atteint (48,24). |
| **T20–T27 · sélection suivante et résultat officiel** | À poses [(48,24),(18,24)], T20 retrouve l’effet de sélection d’`ACTION5`. La pose des corps reste acquise et l’actif devient le propriétaire 1. T21–T26 réutilisent le calcul sur cette disposition. T26 atteint la frontière officielle. T27 reprend l’acquisition à froid sur le niveau suivant. |

## Même observation, preuve différente

- **Commande alternative à T1.** Le test retire seulement `ACTION1` des commandes simples présentées au producteur. Le vrai service libère `ACTION2`, mesure (0,+3) avec la référence de son retour, puis teste `ACTION1`. La seconde pose acquise est (18,30) au lieu de (18,24). L’offre de couverture consomme cette disposition à T9 et son premier retour la confirme. La variante atteint la frontière officielle à T28 et reprend l’acquisition en N2.
- **Même ticket T1, retour stationnaire construit.** L’observation conserve l’image initiale. Le reçu date la tentative sans vecteur ni support acquis. `ACTION2` devient la sonde suivante et la table de déplacements reste vide. Le T1 nominal, lui, avait déjà lié `ACTION1` au vecteur (0,−3).

Le retrait du premier candidat s’applique au domaine de la proposition. Les commandes alternatives et leurs retours sont physiques. L’immobilité de la seconde épreuve est construite à partir de la trame avant le ticket. [Retours de la variante](../../tests/fixtures/sic-re86-alternate-returns.json.gz)

**Attribution.** La composition est observable au gel. Le même calcul de couverture est consommé avec deux poses du second support et après une nouvelle élection du propriétaire actif. Les mesures de focus, de vecteurs, d’occultation et de concordance visible restent les preuves d’admission de la famille. La branche ajoute la caractérisation de ces décisions. [Acquisition, couverture et garde](../../src/logos-engine/v6-constellation-cover.ts) · [Inscription native](../../src/logos-engine/v6-native-interface-families.ts)

## Reproduire

Depuis la racine, sous Node 24. Définir `SIC_RE86_GAME_ROOT` sur le checkout avec les archives Python et Pyodide pour vérifier physiquement les retours. `SIC_RE86_ENGINE_ROOT` permet d’importer le moteur du gel directement.

~~~powershell
node --test tests/sic-re86-line-7.test.ts
$env:SIC_RE86_GAME_ROOT = (Get-Location).Path
node --test tests/sic-re86-line-7.test.ts
node --test tests/v6-interface-families.test.ts tests/v6-native-interface-families.test.ts tests/v6-native-family-registration.test.ts tests/v6-radial-port-integration.test.ts
~~~

Critères figés au commit `7b271706`.

Les trois tests de caractérisation et les 119 contrats associés passent. Les tests de provenance utilisent les octets Git de la fixture d’interface (LF). Le 27 novembre 2026 (UTC−3), préparation à 22 h 36 min 36 s, premier rejeu du gel à 22 h 37 min 11 s, contrat à 22 h 37 min 50 s et verdict physique à 22 h 40 min 59 s, soit 4 min 23 s.
