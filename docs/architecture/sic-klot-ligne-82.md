# KLOT, ligne 82 — déplacer la pièce dont la sélection est confirmée

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, KLOT N1/T1 ACTION6, `selected_rigid`, douze occurrences.
Suivre le propriétaire actif, depuis le clic de sélection jusqu'au
premier déplacement admis, à son retour et à la prochaine question.

- Relever ce qui distingue une pièce simplement visible, une sélection
  mesurée par le retour et l'attribution d'une translation à cette pièce.
- À observation et commande directionnelle identiques, opposer une preuve
  confirmée, l'absence de cette preuve et, si le contrat l'admet, une
  preuve liée à une autre pièce. Relever le premier refus ou geste
  distinct. Jouer le repli sur le jeu public quand il existe.
- Chercher un second sujet, une reprise après retour contredit, ou une
  reprise sur un autre plateau. Maintenir séparées les mutations
  contrôlées, les retours officiels et la reproduction du catalogue.
- Décrire l'admission avant un geste, la mesure après et la portée
  transmise à la prochaine décision. Limiter tout changement à un défaut
  causal reproduit.

Le harnais conserve les budgets d'action du catalogue. Un essai à temps
mesuré et un rejeu à horloge déterministe ont des verdicts distincts.

## Catalogue et chaîne de preuve

Le [catalogue](sic-v8-strategies-observees.md#L108) décrit N1/T1 et
12 occurrences. Sur les actifs officiels, depuis N1 avec la borne de
16 actions, le moteur historique `8ce7ee35` et le gel `d0e7527c`
libèrent les mêmes 16 commandes de `selected_rigid` et donnent les
mêmes 16 verdicts. Les 17 observations concordent hors métadonnées de
palette. Dans chaque trace, 12 retours ont `matched:true` et quatre
restent sans prédiction vérifiée. La campagne locale avec horloge
murale a arrêté les deux moteurs avant T1. Le rejeu déterministe
établit les décisions et leurs retours dans le budget d'actions
demandé. Les temps d'exécution observés sur cette machine restent
hors de cette preuve.

| Tour | Ce que le moteur utilise | Retour physique et suite |
| --- | --- | --- |
| T1 | La recherche de configurations choisit un masque mesuré et un point occupé propre à la pièce 11. Elle propose ACTION6(28,31). | 46 pixels de décoration changent, les sept poses restent identiques. Le garde confirme cette conservation, le reçu garde `selected_receiver_hypothesis` et les 24 modèles. |
| T2 | Le plan relit l'index de la pièce 11 dans le reçu T1. Il propose ACTION4 comme sonde. | Seule la pièce 11 passe de [1,3] à [2,3]. Le retour nomme `observed_exclusive_receiver` et laisse 6 combinaisons. T3 sonde ACTION3 sur la même pièce. |
| T3–T5 | Les réponses d'ACTION3, ACTION4 et ACTION2 réduisent les directions compatibles à un modèle. | Au T6, la recherche réutilise ce modèle et demande la sélection de la pièce 6, ACTION6(20,31). |
| T6–T7 | La nouvelle sélection conserve les poses. Le mouvement prévu pour cette pièce est ACTION1, avec modèle unique. | T7, la pièce 6 seule passe de [0,3] à [0,2]. Le retour est confirmé. |
| T8–T9 | ACTION6(20,39) sélectionne la pièce 12. La même ACTION1 vise maintenant cette autre pièce. | T9, seule la pièce 12 passe de [0,4] à [0,3]. Le retour est confirmé. |

`selectedRigidFamily` raccorde `NativeSelectedRigid.propose` à
`goal_access / selected_rigid`. `selectedRigidScene` identifie la
population de masques dans la géométrie courante. `proposeCurrent`
demande un nouveau clic dès que le sujet du prochain pas diffère de
`state.active`. `before` vérifie la disponibilité de la commande,
la liaison exacte du plan, l'époque, le score, les masques et les poses.
Le premier pas lie également le raster et la référence d'observation.
Le clic reste une hypothèse de récepteur même quand sa décoration
change. Après une direction, `record` compare la population complète
à chaque déplacement compatible du corps sélectionné, avec les deux
références avant et après. `after` compare la prédiction de poses
quand elle existe. Ainsi la sonde T2 acquiert un effet physique avec
`matched:null`.

## Contre-épreuve

Le test retire uniquement l'événement de T1 pendant la production de
l'offre à la même observation du T2. Le sujet visible et le point de
sélection restent disponibles. Le service libère à nouveau le clic
ACTION6(28,31). Le repli est joué sur le vrai jeu. Après ce retour,
le service resonde ACTION4 et vérifie le déplacement de la pièce.
Les vrais T7 et T9 attestent aussi qu'une commande directionnelle
connue se réutilise après deux rattachements distincts. Leur commande
est identique, leur sujet et le reçu de sélection diffèrent.

`two-cell-counterexample-refutes-every-cardinal-model` exerce une
contradiction construite dans la référence de composant. Elle vide les
modèles cardinaux et le test d'intégration correspondant vérifie que le
service suspend les actions après ce refus. Le journal historique
séparé `klot-actual-public-journal.jsonl.gz` couvre trois niveaux
officiels et retrouve les 16 premières commandes. Le lot présent
s'arrête au préfixe du catalogue pour le rejeu A/B. Le gel contient
déjà le propriétaire, le rattachement et l'acquisition nécessaires.

## Reproduction

Depuis la branche de qualification, Node 24. Définir
`SIC_KLOT_GAME_ROOT` pour charger Pyodide et les archives depuis un
checkout d'actifs distinct. L'option `SIC_KLOT_ENGINE_ROOT` compare un
autre moteur aux mêmes assertions. Le nouveau test utilise le service
et le jeu officiel, avec horloge moteur déterministe.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-klot-line-82.test.ts tests/v6-selected-rigid-native.test.ts tests/v6-selected-rigid-integration.test.ts tests/v6-selected-rigid-reference.test.ts
```

[Test du jeu](../../tests/sic-klot-line-82.test.ts) ·
[Propriétaire](../../src/logos-engine/v6-selected-rigid.ts) ·
[Raccord natif](../../src/logos-engine/v6-native-runtime.ts) ·
[Témoins constructifs et refus](../../tests/v6-selected-rigid-reference.test.ts) ·
[Journal public historique](../migration/lot6b-evidence/provisional-063-01/klot-fa23-01/klot-actual-public-journal.jsonl.gz)
