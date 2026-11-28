# REWI, ligne 49 — fenêtre dans un cadre

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Ligne 49,
N1/T9 ACTION6, `public_occurrence_recall / framed_window_composition /
framed_window_experiment`. Repartir depuis N1 avec le plafond de
16 gestes de l'inventaire et suivre la même session à la reprise.

- Distinguer les offres d'information de la ligne 15 du ticket de
  recherche de fenêtre. Relever la preuve courante consommée, le point
  choisi, le vrai retour et l'identité de la décision suivante.
- À cadre et point nominal identiques, ajouter une correspondance ou
  retirer l'égalité qui rend le point admissible. Vérifier le refus de
  l'ancien ticket et l'absence ou la substitution de l'offre.
- Contraster le vrai passage de niveau avec un retour sans gain.
  Vérifier la portée du blocage de cet essai. Relever l'utilisation
  du même opérateur sur une autre configuration si elle existe, en
  déclarant l'origine publique ou construite de chaque témoin.
- Établir la portée historique de la ligne 49 sans crédit supplémentaire
  pour les tickets de la ligne 15. L'arbre de production du gel
  demeure la référence du lot.

## Du premier essai au ticket de fenêtre

| Gestes | Propriétaire et preuve | Suite |
|---|---|---|
| T1–T6 | `information_goal` ouvre six clics sur la rangée à y=61. Les offres d'information concernent la réponse locale et celle d'une rangée réceptrice. Elles portent un reçu `sic_information_decision`. | Aucune fenêtre admissible n'est mesurée à l'entrée de ces six tickets. Ils relèvent du parcours d'information de la ligne 15. |
| T7–T8 | `observed_frontier` émet ACTION3 deux fois. L'entrée de T8 ne présente encore aucune fenêtre unique admissible. | Le retour de T8 expose les deux cadres et une égalité unique. |
| T9 | `public_occurrence_recall` consomme `framed_window_composition`. Le seul centre offert donne ACTION6 (33,24) avec garde `current_window_and_point_bound`. | Le vrai clic marque N1. Le reçu de comparaison reste `matched:null` et demande une réconciliation publique. Le journal de fenêtre date le vrai gain. |
| T10 | En N2, `observed_frontier` émet ACTION3 pour `rebind_prior_epoch_hypothesis_without_transferring_authority`. | Le service reprend avec un autre propriétaire et un nouveau contexte. |

Le petit cadre à bord complet (53,53)–(62,62) fournit un contenu
intérieur 8×8. Le grand cadre disjoint (1,1)–(62,42) a un bord de
même couleur et un intérieur 60×40. `measureFramedWindow` examine
les 1 749 positions. Une seule, (27,18) en coordonnées de l'intérieur
du grand cadre, est égale pixel pour pixel au contenu du petit cadre.
`certifyFramedWindow` passe cette correspondance au calcul
`mechanics.temporal_fragment_match.exact_candidates`. Le reçu
`COMPLETE` porte sur son domaine de comparaison. La proposition
n'utilise comme preuve de route que l'observation courante. L'idée
que le petit contenu est une référence utile à pointer reste une
hypothèse jusqu'au retour du jeu.

`FramedWindowMemory.propose` consomme l'unicité. La garde lie
l'époque, le score, la référence, le raster et le payload au ticket.
`record` acquiert ensuite le couple de références, la fenêtre,
le point et le progrès officiel. Une réponse sans gain ferme
le même essai par une clé de fenêtre, de raster et d'époque.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L89)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L75)
· [Mesure et certification](../../src/logos-engine/v6-framed-window-observation.ts?plain=1#L13)
· [Proposition et acquisition](../../src/logos-engine/v6-framed-window-access.ts?plain=1#L71)
· [Appel commun](../../src/logos-engine/v6-shared-series.ts?plain=1#L361)

## Variations au même point

| Situation | Observation et réponse |
|---|---|
| Autre préfixe officiel | Envoyer (33,24) après le premier ACTION3, une commande avant le témoin, ne marque rien. L'observation de départ ne contient pas de fenêtre unique. Sur ce raster, la garde du ticket préparé plus tard refuse le même payload. |
| Deux égalités construites | Recopier la référence à (5,5) dans l'intérieur du grand cadre préserve les boîtes et la fenêtre à (27,18). La comparaison retrouve deux occurrences. Le producteur s'abstient dans le service malgré la présence du point nominal. |
| Retour construit sans gain | Le service reçoit le raster initial pour le ticket de fenêtre nominal. Le journal garde la paire de références, `official_progress:false` et `canonical_changed:false`. La clé de cet essai exact est bloquée. La suite relève d'une autre question. |

Les tests existants déplacent et recolorent également les cadres
construits et conservent la même relation de mesure. Les cas à
deux égalités ou à un pixel divergent y restent hors de l'admission.
Ils complètent le vrai REWI sans accroître le crédit du catalogue.
[Contrats d'observation](../../tests/v6-framed-window-observation.test.ts?plain=1#L69)

## Reproduction et portée

Le gel et le moteur historique `8ce7ee35` convergent jusqu'à l'arrêt,
après 11 gestes. Commandes, propriétaires, sous-questions, types
et résultats concordent, ainsi que les observations hors métadonnée
`palette`. La portée directe est **1/1 occurrence de 49** et un
gain officiel. La preuve de la ligne 15 garde son dénominateur.

Avec Node 24 et les actifs Pyodide préparés sous `public/` :

```powershell
node --test tests/sic-rewi-line-49.test.ts
node --test tests/v6-framed-window-access.test.ts tests/v6-framed-window-observation.test.ts tests/v6-framed-window-integration.test.ts
```

`SIC_REWI_49_GAME_ROOT` désigne au besoin le checkout des actifs.
`SIC_REWI_49_ENGINE_ROOT` permet de charger les modules du gel dans
un checkout distinct. Le lot ajoute des preuves et des assertions.
La qualification indépendante reste ouverte.

Les quatre tests de caractérisation et les **132 contrats** passent.
Le reçu de provenance historique a été vérifié avec ses octets Git,
puis restauré avec les fins de ligne du checkout Windows. Branche
ouverte à 23:30:29, critères figés à 23:30:51, premier rejeu à
23:31:00 et verdict local à 23:34:39 (UTC−3).
