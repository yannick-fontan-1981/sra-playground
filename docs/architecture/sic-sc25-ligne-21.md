# SC25, ligne 21 — du motif à l'accès

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Ligne 21,
SC25 N1/T2 ACTION1, `motif_access / motif_conditioned_access /
motif_to_geometric_access`. Rejouer le départ N1 avec les paramètres
du catalogue historique.

- Identifier le motif exact, son support, le but intermédiaire et la
  preuve que le service emploie pour choisir le prochain accès. Suivre
  le point de mesure, le ticket, le retour et la reprise.
- Distinguer une homologie de motif, un mouvement qui peut préparer
  le trajet et une interaction ou un accès réellement constaté.
- Sur le même raster, retirer la preuve qui autorise la voie. Retrouver
  le premier ticket ou refus réellement libéré. Vérifier un autre
  contexte avec un motif ou un état de mouvement différent.
- Garder les occurrences cataloguées, la prolongation et les contrôles
  construits dans leurs périmètres. Un changement éventuel de code doit
  répondre à un défaut de liaison effectivement reproduit.

## Parcours officiel au gel

| Geste | Preuve utilisée et ticket | Retour et décision suivante |
|---|---|---|
| T1 | `public_occurrence_recall / cell_patch_placement` soumet ACTION6 (30,55). | Le raster final retrouve ses pixels d'entrée. Le ticket et le retour appartiennent à la pose de cellule. |
| T2 | `motifLattice` mesure la grille 3×3 et l'unique carte [1,3,5,7]. Le corps est en (39,19)–(42,22). Le cadre homologue en (13,18)–(16,21) donne un but à tester. Aucune translation n'est acquise. La voie `motif_conditioned_access` libère ACTION1 en mode `calibrate`. | Le raster change de huit pixels. Le corps suivi reste à la même pose. Le reçu n'acquiert aucun déplacement de ce sujet. T3 essaie ACTION2. |
| T4 et T7 | Deux autres calibrations, issues de la même reconnaissance de carte et de corps. | ACTION3 déplace le corps de (39,19) à (35,19). ACTION4 le ramène à (39,19). Les reçus datés établissent (−4,0) et (4,0). |
| T8 puis T11–T14 | La carte mesurée définit les bits à obtenir. T8 prépare un bit avec ACTION6 (30,50). T11–T14 recalculent la préparation à partir de la saisie courante. | Les effets de bit attendus sont confirmés. T9 et T10 appartiennent à la pose de cellule. Le même (30,55) est libéré à T9 par la pose et à T13 par le motif, sous des preuves et des tickets distincts. |
| T15 | ACTION6 (30,60) termine le motif. La commande d'invocation n'a pas d'effet prédit. | Dix-sept images sont retournées et le raster change de 54 pixels. Le reçu confirme l'effacement de la saisie. Il n'acquiert aucun témoin de contact distant ni aucun avancement officiel. T16 reprend avec ACTION6 (30,55) pour une pose de cellule. |

`MotifAccess.propose` refait la correspondance du corps et du cadre.
Le calcul de trajet examine les déplacements attestés et les poses
supportées. La liaison par un effet distant exige une trajectoire
visible sur un axe, un récepteur stable et un rattachement au blocage
d'une pose. `MotifAccess.record` mesure ces faits séparément. Le
retour officiel de T15 fournit une activation observable et un
effacement de motif, sans acquérir les conditions d'un trajet.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L61)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L47)
· [Mesure de la grille](../../src/logos-engine/v6-motif-access-geometry.ts?plain=1#L69)
· [Proposition](../../src/logos-engine/v6-motif-access.ts?plain=1#L265)
· [Mesure d'un effet distant](../../src/logos-engine/v6-motif-access.ts?plain=1#L214)
· [Garde et acquisition](../../src/logos-engine/v6-motif-access.ts?plain=1#L372)

## Contre-épreuves et premier fait manquant

- **T2, sans preuve de grille.** La grille mesurée est retirée
  uniquement de l'appel d'offre. Le raster réel et le corps ne changent
  pas. Le service libère encore ACTION1 sous
  `observed_frontier / experiment`. Le vrai retour reste en N1
  et est acquis par cette frontière.
- **T8, sans carte compatible.** La grille et les deux transports
  mesurés sont conservés. Seule l'unique carte est masquée à l'appel
  d'offre. La préparation `toggle` disparaît. Le moteur libère
  `observed_frontier / experiment` ACTION6 (12,19) et acquiert son
  vrai retour au même niveau.

Le scénario construit `coldInvocation` du noyau établit un autre
enchaînement. Après la même invocation, un retour d'ouverture donne
`walk / ACTION4`. Une réponse contraire donne un autre `toggle`.
Le noyau y vérifie la reprise. Ce cas n'est pas une observation du
jeu SC25.

Au départ officiel, les **12/12 occurrences** du catalogue sont
retrouvées sur 16 gestes. Dans une prolongation avec plafond de 55,
la session s'arrête à 51 gestes, avec 0 niveau marqué. Tous les
tickets T16–T51 appartiennent à `cell_patch_placement`. Le scénario
officiel ne montre donc aucun trajet consommant la réponse du
motif. Le premier témoin manquant est un retour de motif dans cette
situation qui rend un déplacement de préparation admissible sous la
même famille, avec un témoin de destination et son vrai déplacement
observé. La qualification reste partielle à cette étape. Les
preuves locales ne justifient aucune extraction de moteur.
[Deux suites sur les mêmes commandes](../../tests/v6-motif-access-kernel.test.ts?plain=1#L78)

## Reproduction

Les 16 libérations du gel concordent avec `8ce7ee35`, y compris
familles, sous-questions, commandes et résultats. La métadonnée
`palette` diffère entre les deux révisions. La caractérisation et
la prolongation emploient le vrai jeu.

Avec Node 24 et les actifs Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-sc25-line-21.test.ts
node --test tests/v6-motif-access-contract.test.ts tests/v6-motif-access-kernel.test.ts tests/v6-motif-access-reference.test.ts
```

`SIC_SC25_GAME_ROOT` désigne le checkout des actifs et
`SIC_SC25_ENGINE_ROOT` permet de charger le moteur d'un checkout
distinct du gel. Le plafond de prolongation est 55 plutôt que 16.

Pour la prolongation, l'entrée d'inventaire utilise
`/tests/sic-qualification.html?strategy-inventory&games=SC25&actions=55`.
Le rejeu local appelle le service natif avec ces paramètres. Les trois
tests de caractérisation et les **201 contrats** passent. Le
générateur de référence a été vérifié sur ses octets Git, puis
restauré avec les fins de ligne du checkout Windows.

Branche ouverte le 27 novembre à 23:58:36, critères à 23:59:01,
premier rejeu à 23:59:30. Prolongation terminée le 28 novembre
à 00:01:41 et verdict local à 00:04:01 (UTC−3).
